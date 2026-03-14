"""POST /api/gmail/sync — sync Gmail bank/payment emails to expenses."""

from __future__ import annotations

import asyncio
import logging
import os
import re
from base64 import b64decode
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from utils.http import async_client
from pydantic import BaseModel

from agent.tools.db_tools import get_user_profile, VALID_CATEGORIES
from agent.tools.groq_tools import FAST_MODEL
from auth.supabase_jwt import get_current_user
from db.client import get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_MESSAGES_PER_SYNC = 500

GMAIL_QUERY = (
    '(subject:"debited" OR subject:"credited" OR subject:"transaction" OR subject:"payment" '
    'OR subject:"spent" OR subject:"purchase" OR subject:"UPI" OR subject:"NEFT" OR subject:"IMPS" '
    'OR subject:"alert" OR subject:"order confirmed" OR subject:"order placed" OR subject:"subscription" '
    'OR subject:"charged" OR subject:"receipt" OR subject:"recharge" OR from:alerts OR '
    'from:noreply@paytm.com OR from:alerts@hdfcbank.net OR from:alerts@icicibank.com OR '
    'from:alerts@axisbank.com OR from:sbiintouch@sbi.co.in OR from:no-reply@swiggy.in OR '
    'from:no-reply@zomato.com OR from:order-update@amazon.in OR from:noreply@flipkart.com OR '
    'from:receipts@razorpay.com OR from:noreply@phonepe.com OR from:gpay-noreply@google.com) category:primary'
)


class GmailSyncRequest(BaseModel):
    gmail_access_token: str
    since_date: Optional[str] = None


# ── Email parsing helpers ──────────────────────────────────────────────────────

def _decode_b64url(data: str) -> str:
    try:
        return b64decode(data.replace("-", "+").replace("_", "/") + "==").decode("utf-8", errors="replace")
    except Exception:
        return ""


def _strip_html(html: str) -> str:
    text = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    return re.sub(r"\s+", " ", text).strip()


def _extract_email_text(msg: dict) -> str:
    payload = msg.get("payload", {})
    headers = payload.get("headers", [])
    subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "")
    from_ = next((h["value"] for h in headers if h["name"].lower() == "from"), "")

    plain, html = "", ""

    def walk(parts):
        nonlocal plain, html
        for part in (parts or []):
            mt = part.get("mimeType", "")
            data = (part.get("body") or {}).get("data", "")
            if mt == "text/plain" and data and not plain:
                plain = _decode_b64url(data)
            elif mt == "text/html" and data and not html:
                html = _strip_html(_decode_b64url(data))
            walk(part.get("parts"))

    body_data = (payload.get("body") or {}).get("data", "")
    if body_data:
        ct = next((h["value"] for h in headers if h["name"].lower() == "content-type"), "")
        if "text/html" in ct:
            html = _strip_html(_decode_b64url(body_data))
        else:
            plain = _decode_b64url(body_data)

    walk(payload.get("parts"))
    body = plain or html or msg.get("snippet", "")
    return f"From: {from_}\nSubject: {subject}\n\n{body}"


# ── Regex extraction ───────────────────────────────────────────────────────────

DEBIT_SIGNAL = re.compile(
    r"\b(debited|deducted|debit alert|paid|payment of|payment done|payment successful|spent|"
    r"purchased?|charged|withdrawn|withdrawal|money sent|transferred to|transfer of|upi debit|"
    r"upi payment|upi transfer|sent via upi|subscription charged|subscription renewed|auto.?debit|"
    r"auto.?pay|bill paid|recharge successful|order placed|order confirmed)\b|"
    r"rs\.?\s*[\d,]+|inr\s*[\d,]+|₹\s*[\d,]+",
    re.I,
)
IGNORE_SIGNAL = re.compile(r"\b(otp|one.?time.?pass(word)?|your\s+otp|verification\s+code|login\s+alert|new\s+device|signed\s+in|security\s+alert)\b", re.I)

AMOUNT_PATTERNS = [
    re.compile(r"(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)(?:\s*\/?\-?)?\s*(?:has been|is|was|have been)?\s*(?:debited|deducted|charged|spent|paid|withdrawn|transferred)", re.I),
    re.compile(r"(?:debited|deducted|charged|spent|paid|withdrawn|transferred)\s+(?:with\s+|of\s+|for\s+)?(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)", re.I),
    re.compile(r"(?:amount|txn|transaction|payment|purchase)\s+(?:of\s+)?(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)", re.I),
    re.compile(r"(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)\s+(?:paid|sent|spent|debited|deducted|charged|withdrawn)", re.I),
    re.compile(r"(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)", re.I),
]


def _extract_amount(text: str) -> Optional[float]:
    for pat in AMOUNT_PATTERNS:
        m = pat.search(text)
        if m:
            n = float(m.group(1).replace(",", ""))
            if 0 < n < 10_000_000:
                return n
    return None


BRAND_MAP = {
    "zomato": "Zomato", "swiggy": "Swiggy", "paytm": "Paytm", "phonepe": "PhonePe",
    "google pay": "Google Pay", "gpay": "Google Pay", "amazon pay": "Amazon Pay",
    "amazon": "Amazon", "flipkart": "Flipkart", "blinkit": "Blinkit",
    "bigbasket": "BigBasket", "zepto": "Zepto", "ola": "Ola", "uber": "Uber",
    "rapido": "Rapido", "irctc": "IRCTC", "makemytrip": "MakeMyTrip",
    "bookmyshow": "BookMyShow", "netflix": "Netflix", "spotify": "Spotify",
    "airtel": "Airtel", "jio": "Jio", "dmart": "DMart", "nykaa": "Nykaa",
    "myntra": "Myntra", "meesho": "Meesho", "razorpay": "Razorpay",
}

MERCHANT_STOP = re.compile(
    r"\b(on|via|ref|upi|neft|imps|rtgs|id|no|number|dated|date|account|a\/c|bank|your|from|has|been|is|was|the|this|transaction|txn|transfer|payment|amount|balance|available|dear|customer|please|immediately|regards)\b",
    re.I,
)

CATEGORY_RULES = [
    ("Food & Dining", re.compile(r"\b(zomato|swiggy|food|restaurant|cafe|dhaba|bakery|juice|pizza|burger|biryani|meal|dining|eat|hunger|dominos|kfc|mcdonalds|subway|starbucks)\b", re.I)),
    ("Groceries", re.compile(r"\b(bigbasket|blinkit|zepto|dmart|kirana|grocer|supermarket|pharmacy|medical|medicine|drugstore|chemist|nykaa|cosmetic|beauty|wellness|apollo|medplus)\b", re.I)),
    ("Travel", re.compile(r"\b(ola|uber|rapido|irctc|railway|flight|airline|indigo|air\s*india|spicejet|vistara|petrol|fuel|diesel|fastag|toll|parking|cab|auto|metro|bus|makemytrip|goibibo|redbus|ixigo)\b", re.I)),
    ("Entertainment", re.compile(r"\b(bookmyshow|netflix|spotify|prime\s*video|hotstar|disney|youtube|gaming|gym|fitness|cult|pub|bar|movie|theatre|concert|event|ticket|lenskart)\b", re.I)),
    ("Utilities", re.compile(r"\b(airtel|jio|bsnl|vodafone|\bvi\b|electricity|bescom|msedcl|water\s*bill|gas\s*bill|lpg|insurance|lic|emi|loan|dth|tata\s*play|dish\s*tv|recharge|mobile\s*bill|broadband|internet|wifi)\b", re.I)),
    ("Rent", re.compile(r"\b(rent|paying\s*guest|\bpg\b|society|maintenance|hostel|flat|apartment|housing|nobroker)\b", re.I)),
]


def _categorise(merchant: str, email_text: str) -> str:
    haystack = f"{merchant} {email_text}".lower()
    for cat, pat in CATEGORY_RULES:
        if pat.search(haystack):
            return cat
    return "Other"


def _extract_merchant(text: str, subject: str) -> str:
    vpa_with_name = re.search(
        r"\b(?:vpa|upi\s*id|upi)\s+([A-Za-z0-9._+\-]+@[A-Za-z0-9._]+)\s+([A-Z][A-Z0-9 &'.\/\-]{1,60}?)\s+(?:on\s+\d|on\s+\w)",
        text, re.I,
    )
    if vpa_with_name:
        named = vpa_with_name.group(2).strip()
        if len(named) >= 3 and not MERCHANT_STOP.search(named):
            return named[:40]

    bare_vpa = re.search(r"([A-Za-z0-9._+\-]{3,}@[A-Za-z0-9]{2,}(?:\.[A-Za-z]{2,})?)", text)
    if bare_vpa:
        handle = bare_vpa.group(1).split("@")[0].lower()
        for key, name in BRAND_MAP.items():
            if key.replace(" ", "") in handle:
                return name
        words = re.split(r"[._\-@]", handle)
        words = [w for w in words if re.search(r"[a-zA-Z]{2,}", w) and not w.isdigit()]
        if words:
            return " ".join(w.capitalize() for w in words)[:35]

    haystack = f"{subject} {text}".lower()
    for key, name in BRAND_MAP.items():
        if key in haystack:
            return name

    return "Unknown"


def _extract_by_regex(email_text: str, subject: str) -> Optional[dict]:
    if IGNORE_SIGNAL.search(email_text):
        return None
    if not DEBIT_SIGNAL.search(email_text):
        return None
    amount = _extract_amount(email_text)
    if not amount:
        return None
    merchant = _extract_merchant(email_text, subject)
    category = _categorise(merchant, email_text)
    return {"amount": amount, "merchant": merchant, "category": category}


async def _groq_extract(email_text: str, groq_key: str) -> Optional[dict]:
    import httpx, json
    prompt = f"""Indian bank/payment email. Extract expense if money was DEBITED/PAID/SPENT.

EMAIL:
{email_text[:1500]}

Rules:
- DEBIT only. IGNORE: credited/refund/cashback/OTP/salary.
- amount: number. description: merchant ≤35 chars. category: one of Food & Dining|Groceries|Travel|Entertainment|Utilities|Rent|Shopping|Education|Investments|Healthcare|Subscriptions|Other

If NOT a debit → {{"is_expense":false}}
If debit → {{"is_expense":true,"amount":<number>,"category":"<cat>","description":"<merchant>"}}
JSON only."""

    for attempt in range(1, 4):
        try:
            async with async_client(timeout=30) as client:
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={
                        "model": FAST_MODEL,
                        "messages": [
                            {"role": "system", "content": "Respond with valid JSON only. No markdown."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0,
                        "max_tokens": 150,
                        "seed": 42,
                    },
                )
                if r.status_code == 429:
                    await asyncio.sleep(attempt * 3)
                    continue
                if not r.is_success:
                    continue
                data = r.json()
                raw = data["choices"][0]["message"]["content"]
                cleaned = re.sub(r"```json?|```", "", raw).strip()
                parsed = json.loads(cleaned)
                if not parsed.get("is_expense"):
                    return None
                if not isinstance(parsed.get("amount"), (int, float)) or parsed["amount"] <= 0:
                    return None
                if parsed.get("category") not in VALID_CATEGORIES:
                    return None
                return {"amount": parsed["amount"], "merchant": parsed.get("description", "Unknown"), "category": parsed["category"]}
        except Exception:
            await asyncio.sleep(attempt)
    return None


async def _classify_email(detail: dict, msg_id: str, groq_key: str) -> Optional[dict]:
    payload = detail.get("payload", {})
    headers = payload.get("headers", [])
    subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "(no subject)")
    email_date = datetime.fromtimestamp(int(detail.get("internalDate", 0)) / 1000, tz=timezone.utc).isoformat()
    email_text = _extract_email_text(detail)

    if IGNORE_SIGNAL.search(email_text) or not DEBIT_SIGNAL.search(email_text):
        return None

    result = _extract_by_regex(email_text, subject)
    if not result:
        result = await _groq_extract(email_text, groq_key)

    if not result:
        return None

    return {
        "amount": result["amount"],
        "category": result["category"],
        "description": result["merchant"],
        "date": email_date,
        "gmail_message_id": msg_id,
    }


@router.post("/gmail/sync")
async def sync_gmail_expenses(
    body: GmailSyncRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    profile = get_user_profile(user_id)
    groq_key = profile.get("groq_api_key") or os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        raise HTTPException(status_code=400, detail="No Groq API key configured")

    db = get_admin_client()
    gmail_token = body.gmail_access_token

    # Gmail profile + sync state
    async with async_client(timeout=30) as client:
        profile_r = await client.get(
            "https://www.googleapis.com/gmail/v1/users/me/profile",
            headers={"Authorization": f"Bearer {gmail_token}"},
        )
        gmail_email = profile_r.json().get("emailAddress") if profile_r.is_success else None

    sync_state_result = db.table("gmail_sync_state").select("last_synced_at, synced_message_ids").eq("user_id", user_id).maybe_single().execute()
    sync_state = sync_state_result.data or {}
    synced_ids: set[str] = set(sync_state.get("synced_message_ids") or [])

    # Build query
    gmail_query = GMAIL_QUERY
    if body.since_date:
        y, m, d = body.since_date.split("-")
        gmail_query += f" after:{y}/{m}/{d}"
    elif not sync_state.get("last_synced_at"):
        fallback = (datetime.now(timezone.utc) - timedelta(days=90))
        gmail_query += f" after:{fallback.strftime('%Y/%m/%d')}"

    # Fetch message IDs
    all_messages = []
    page_token = None
    async with async_client(timeout=30) as client:
        while True:
            params = {"q": gmail_query, "maxResults": "100"}
            if page_token:
                params["pageToken"] = page_token
            r = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                headers={"Authorization": f"Bearer {gmail_token}"},
                params=params,
            )
            if not r.is_success:
                raise HTTPException(status_code=400, detail=f"Gmail API error: {r.text}")
            data = r.json()
            page = data.get("messages") or []
            all_messages.extend(page)
            page_token = data.get("nextPageToken")
            if not page_token or (page and all(m["id"] in synced_ids for m in page)):
                break

    if not all_messages:
        db.table("gmail_sync_state").upsert({"user_id": user_id, "last_synced_at": datetime.now(timezone.utc).isoformat(), "synced_message_ids": list(synced_ids)[-2000:]}).execute()
        return {"inserted": 0, "skipped": 0, "total_processed": 0, "gmail_email": gmail_email, "message": "No new bank emails found."}

    new_messages = [m for m in all_messages if m["id"] not in synced_ids][:MAX_MESSAGES_PER_SYNC]

    if not new_messages:
        db.table("gmail_sync_state").upsert({"user_id": user_id, "last_synced_at": datetime.now(timezone.utc).isoformat(), "synced_message_ids": list(synced_ids)[-2000:]}).execute()
        return {"inserted": 0, "skipped": len(all_messages), "total_processed": 0, "gmail_email": gmail_email, "message": "All emails already synced."}

    # Fetch email details in batches of 20
    details = []
    async with async_client(timeout=30) as client:
        for i in range(0, len(new_messages), 20):
            batch = new_messages[i:i + 20]
            tasks = [
                client.get(
                    f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{m['id']}?format=full",
                    headers={"Authorization": f"Bearer {gmail_token}"},
                )
                for m in batch
            ]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            for j, r in enumerate(responses):
                if isinstance(r, Exception) or not r.is_success:
                    details.append(None)
                else:
                    details.append(r.json())

    # Classify emails in batches of 10
    classified = []
    for i in range(0, len(details), 10):
        batch = details[i:i + 10]
        tasks = [
            _classify_email(d, new_messages[i + j]["id"], groq_key)
            if d else asyncio.coroutine(lambda: None)()
            for j, d in enumerate(batch)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        classified.extend(results)

    processed_ids = [new_messages[i]["id"] for i in range(len(classified))]
    expenses_to_insert = [
        {**c, "user_id": user_id}
        for c in classified
        if c and not isinstance(c, Exception)
    ]

    inserted_count = 0
    if expenses_to_insert:
        insert_result = (
            db.table("expenses")
            .insert([
                {"user_id": e["user_id"], "amount": e["amount"], "category": e["category"],
                 "description": e["description"], "date": e["date"], "gmail_message_id": e["gmail_message_id"]}
                for e in expenses_to_insert
            ])
            .select("id")
            .execute()
        )
        inserted_count = len(insert_result.data or [])

    db.table("gmail_sync_state").upsert({
        "user_id": user_id,
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
        "synced_message_ids": list(synced_ids | set(processed_ids))[-2000:],
        **({"gmail_email": gmail_email} if gmail_email else {}),
    }).execute()

    skipped = len(processed_ids) - len(expenses_to_insert)
    return {
        "inserted": inserted_count,
        "skipped": skipped,
        "total_processed": len(processed_ids),
        "gmail_email": gmail_email,
        "message": f"Synced {inserted_count} new expense{'s' if inserted_count != 1 else ''}!" if inserted_count > 0 else "No expense transactions found.",
    }
