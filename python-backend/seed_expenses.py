"""
Seed ~550 realistic Indian expenses for user 077f60d1-6196-4c07-a3a3-6f253f69291a
covering Oct 1 2025 → Mar 14 2026 across all 12 categories.
"""

import random
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
load_dotenv()

from db.client import get_admin_client

USER_ID = "077f60d1-6196-4c07-a3a3-6f253f69291a"
START = datetime(2025, 10, 1, tzinfo=timezone.utc)
END   = datetime(2026, 3, 14, 23, 59, tzinfo=timezone.utc)

rng = random.Random(42)   # fixed seed → deterministic but realistic

def rand_dt(start=START, end=END):
    delta = end - start
    secs  = rng.randint(0, int(delta.total_seconds()))
    return (start + timedelta(seconds=secs)).replace(
        hour=rng.randint(7, 23),
        minute=rng.randint(0, 59),
        second=0,
        microsecond=0,
    )

def amt(*args):
    """Pick a rounded-looking amount: randint then round to nearest 5 or 10."""
    lo, hi = args if len(args) == 2 else (args[0], args[0])
    v = rng.randint(lo, hi)
    # round to nearest 5 for smallish, nearest 10 for larger
    if v < 500:
        return round(v / 5) * 5 or 5
    return round(v / 10) * 10

# ─── Category templates ───────────────────────────────────────────────────────
# (description, min, max, weight)

FOOD = [
    ("Swiggy order", 150, 650, 8),
    ("Zomato dinner", 200, 800, 8),
    ("Domino's pizza", 299, 699, 4),
    ("McDonald's", 150, 450, 5),
    ("KFC", 200, 500, 3),
    ("Burger King", 150, 400, 3),
    ("Cafe Coffee Day", 150, 300, 3),
    ("Starbucks", 280, 600, 3),
    ("Chai at tapri", 10, 30, 6),
    ("Office canteen lunch", 80, 180, 10),
    ("Lunch with colleagues", 250, 600, 5),
    ("Dinner at restaurant", 400, 1200, 5),
    ("Biryani from local shop", 150, 350, 6),
    ("Vada pav & samosa", 20, 80, 5),
    ("Ice cream & desserts", 80, 250, 4),
    ("Breakfast at Udupi", 80, 200, 5),
    ("Pizza Hut", 350, 800, 2),
    ("Box8 meal", 150, 300, 3),
    ("EatFit order", 180, 400, 3),
    ("Thali at dhaba", 120, 250, 4),
]

GROCERIES = [
    ("BigBasket order", 600, 2500, 6),
    ("Blinkit order", 300, 1200, 7),
    ("Zepto order", 250, 900, 6),
    ("DMart groceries", 800, 3000, 5),
    ("Reliance Fresh", 400, 1500, 4),
    ("Kirana store", 200, 800, 8),
    ("Milk & dairy (local)", 80, 200, 10),
    ("Vegetables & fruits", 100, 400, 8),
    ("Eggs & bread", 60, 150, 7),
    ("Packaged snacks", 100, 350, 5),
    ("Cooking oil & masalas", 200, 600, 4),
    ("Household cleaning supplies", 150, 500, 4),
    ("Atta & rice (10 kg)", 400, 900, 3),
    ("Swiggy Instamart", 200, 700, 5),
    ("Fruits basket", 150, 400, 4),
]

TRAVEL = [
    ("Uber ride", 80, 500, 10),
    ("Ola ride", 70, 450, 8),
    ("Rapido bike", 30, 150, 7),
    ("Auto rickshaw", 50, 200, 8),
    ("Metro card recharge", 200, 500, 5),
    ("IRCTC train ticket", 350, 2500, 4),
    ("IndiGo flight", 3500, 9000, 3),
    ("Air India flight", 4000, 10000, 2),
    ("Petrol fill-up", 500, 2000, 5),
    ("Fastag recharge", 200, 500, 3),
    ("Hotel stay (travel)", 1500, 5000, 3),
    ("Cab to airport", 400, 1200, 4),
    ("Bus ticket (intercity)", 200, 800, 3),
    ("Parking charges", 20, 100, 5),
    ("OYO room (weekend)", 900, 2500, 2),
    ("Uber Eats delivery trip", 50, 120, 3),
]

ENTERTAINMENT = [
    ("BookMyShow movie", 200, 600, 5),
    ("PVR/INOX movie ticket", 250, 700, 5),
    ("Gaming top-up (BGMI)", 100, 500, 4),
    ("Steam game purchase", 200, 1500, 2),
    ("Amusement park entry", 500, 1200, 2),
    ("Concert ticket", 800, 3000, 2),
    ("Bowling/gaming zone", 300, 800, 3),
    ("Go-karting", 400, 800, 1),
    ("Escape room", 500, 1000, 1),
    ("Cricket match ticket", 300, 2500, 2),
    ("Indoor cricket net session", 200, 500, 2),
    ("Board game cafe", 300, 600, 2),
    ("Comedy show ticket", 400, 1500, 2),
    ("Ludo/carrom with friends (stakes)", 50, 200, 2),
]

UTILITIES = [
    ("Electricity bill (MSEB)", 800, 3000, 3),
    ("Airtel broadband bill", 700, 1200, 3),
    ("Jio prepaid recharge", 239, 999, 6),
    ("Airtel postpaid bill", 400, 1000, 4),
    ("Vi mobile bill", 299, 799, 3),
    ("LPG cylinder (Indane)", 850, 1000, 3),
    ("Piped gas bill", 300, 700, 2),
    ("Water bill", 100, 300, 2),
    ("Society maintenance charge", 1000, 3000, 2),
    ("DTH recharge (Tata Sky)", 200, 600, 3),
    ("Electricity bill (BESCOM)", 600, 2500, 2),
    ("Jio Fiber bill", 500, 1200, 3),
    ("ACT broadband bill", 600, 1000, 2),
]

RENT = [
    ("Monthly flat rent", 12000, 28000, 5),
    ("PG accommodation", 8000, 15000, 2),
    ("Co-living space rent", 10000, 20000, 2),
    ("Rent advance (one-time)", 20000, 50000, 1),
    ("NestAway monthly rent", 11000, 22000, 2),
]

SHOPPING = [
    ("Amazon order", 200, 3000, 8),
    ("Flipkart order", 300, 4000, 6),
    ("Myntra clothing", 500, 3000, 5),
    ("Ajio clothes", 600, 2500, 3),
    ("Nykaa beauty products", 300, 1500, 4),
    ("Meesho order", 150, 800, 4),
    ("Croma electronics", 1500, 15000, 3),
    ("Reliance Digital purchase", 500, 8000, 2),
    ("Westside clothes", 500, 2500, 3),
    ("H&M clothing", 800, 3000, 2),
    ("Zara purchase", 1500, 5000, 2),
    ("Shoes from Bata", 700, 2500, 2),
    ("Nike shoes online", 2000, 6000, 1),
    ("Home decor (IKEA)", 500, 3000, 2),
    ("Stationary & office supplies", 100, 500, 3),
    ("Phone accessories", 200, 1500, 3),
    ("Books (offline store)", 200, 800, 3),
    ("Gifts & presents", 300, 2000, 3),
    ("Watches (Fastrack)", 800, 3000, 1),
    ("Sports equipment", 500, 3000, 2),
]

EDUCATION = [
    ("Udemy course", 399, 799, 4),
    ("Coursera subscription", 1500, 3000, 2),
    ("YouTube Premium (learning)", 129, 189, 2),
    ("Coding bootcamp installment", 5000, 15000, 2),
    ("GATE coaching fee", 3000, 8000, 2),
    ("English speaking class", 1000, 3000, 2),
    ("School/college exam fee", 500, 2000, 2),
    ("Tuition fees (monthly)", 2000, 6000, 3),
    ("LinkedIn Learning", 1200, 2500, 2),
    ("AWS certification fee", 3000, 6000, 1),
    ("Books (Amazon/Flipkart)", 300, 1500, 4),
    ("Byju's subscription", 2000, 5000, 1),
    ("Unacademy subscription", 1500, 4000, 2),
]

INVESTMENTS = [
    ("Groww SIP - NIFTY50 index", 2000, 5000, 5),
    ("Zerodha SIP", 1000, 5000, 4),
    ("PPF deposit", 5000, 10000, 2),
    ("LIC premium", 2000, 8000, 2),
    ("FD in SBI", 5000, 20000, 2),
    ("Mutual fund (lump sum)", 5000, 25000, 3),
    ("Stocks purchased (Zerodha)", 1000, 10000, 4),
    ("NPS contribution", 2000, 5000, 2),
    ("Gold savings (Paytm Gold)", 500, 2000, 3),
    ("RD installment (SBI)", 1000, 3000, 2),
    ("ELSS fund investment", 5000, 15000, 2),
    ("IPO application", 14000, 15000, 1),
]

HEALTHCARE = [
    ("Apollo Pharmacy medicines", 200, 800, 6),
    ("Doctor consultation", 300, 1200, 5),
    ("Gym membership monthly", 500, 2000, 5),
    ("Lab tests (blood work)", 400, 1500, 4),
    ("Dental checkup", 500, 3000, 2),
    ("Eye checkup & glasses", 500, 3000, 2),
    ("Health insurance premium", 3000, 8000, 2),
    ("Cult.fit session", 400, 800, 3),
    ("Yoga class fees", 500, 1500, 3),
    ("Physiotherapy session", 500, 1000, 2),
    ("MRI/X-ray scan", 1000, 4000, 1),
    ("1mg medicines order", 150, 600, 5),
    ("Practo consultation fee", 300, 700, 3),
    ("Protein powder (GNC/MuscleBlaze)", 1500, 3500, 2),
    ("Nutritionist consultation", 500, 1500, 1),
]

SUBSCRIPTIONS = [
    ("Netflix subscription", 149, 649, 3),
    ("Spotify Premium", 59, 179, 3),
    ("Amazon Prime membership", 299, 1499, 2),
    ("ChatGPT Plus", 1700, 1700, 2),
    ("Adobe Creative Cloud", 1675, 5397, 1),
    ("Microsoft 365 Personal", 489, 489, 1),
    ("iCloud storage", 75, 219, 2),
    ("Disney+ Hotstar", 299, 1499, 2),
    ("YouTube Premium", 129, 189, 2),
    ("Notion Pro", 400, 800, 1),
    ("LinkedIn Premium", 1600, 2500, 1),
    ("Jio OTT bundle", 200, 600, 2),
    ("SonyLIV subscription", 299, 999, 1),
    ("Zee5 Premium", 299, 999, 1),
    ("1Password subscription", 500, 900, 1),
    ("Canva Pro", 499, 499, 1),
    ("GitHub Copilot", 800, 800, 1),
]

OTHER = [
    ("UPI transfer to friend", 200, 5000, 5),
    ("Bank processing fee", 50, 500, 3),
    ("ATM withdrawal", 500, 3000, 5),
    ("Donation (temple/charity)", 51, 1001, 3),
    ("Wedding gift", 500, 3000, 2),
    ("Courier/delivery charge", 50, 300, 4),
    ("Toll charges", 50, 200, 3),
    ("Laundry service", 200, 600, 5),
    ("Barber/salon visit", 100, 500, 5),
    ("Petpuja pooja items", 100, 500, 2),
    ("Newspaper subscription", 50, 150, 2),
    ("SIM card charges", 50, 200, 2),
    ("Festival shopping misc", 500, 3000, 3),
    ("Passport/visa fee", 1500, 5000, 1),
    ("Late fee/penalty", 100, 500, 2),
    ("Dry cleaning", 200, 600, 3),
]

CATEGORY_BUCKETS = [
    ("Food & Dining",   FOOD,           110),
    ("Groceries",       GROCERIES,       60),
    ("Travel",          TRAVEL,          75),
    ("Entertainment",   ENTERTAINMENT,   30),
    ("Utilities",       UTILITIES,       35),
    ("Rent",            RENT,            12),
    ("Shopping",        SHOPPING,        60),
    ("Education",       EDUCATION,       25),
    ("Investments",     INVESTMENTS,     35),
    ("Healthcare",      HEALTHCARE,      40),
    ("Subscriptions",   SUBSCRIPTIONS,   30),
    ("Other",           OTHER,           40),
]
# Total target: 552 expenses

def weighted_choice(options):
    population = []
    for item in options:
        desc, lo, hi, w = item
        population.extend([item] * w)
    return rng.choice(population)

rows = []
for category, templates, count in CATEGORY_BUCKETS:
    for _ in range(count):
        desc, lo, hi, _ = weighted_choice(templates)
        rows.append({
            "id":          str(uuid.uuid4()),
            "user_id":     USER_ID,
            "amount":      float(amt(lo, hi)),
            "category":    category,
            "description": desc,
            "date":        rand_dt().isoformat(),
        })

# Sort by date ascending for realism
rows.sort(key=lambda x: x["date"])

print(f"Total expenses to insert: {len(rows)}")

db = get_admin_client()

# Insert in batches of 100 (Supabase PostgREST limit)
BATCH = 100
inserted = 0
for i in range(0, len(rows), BATCH):
    batch = rows[i:i+BATCH]
    r = db.table("expenses").insert(batch).execute()
    inserted += len(r.data or [])
    print(f"  Inserted batch {i//BATCH + 1}: {len(r.data or [])} rows (total so far: {inserted})")

print(f"\nDone! {inserted} expenses inserted.")

# Verify
check = db.table("expenses").select("id", count="exact").eq("user_id", USER_ID).execute()
print(f"Verified count in DB: {check.count}")

# Category summary
from collections import Counter
cats = Counter(r["category"] for r in rows)
print("\nBreakdown by category:")
for cat, n in sorted(cats.items()):
    print(f"  {cat:<20} {n}")
