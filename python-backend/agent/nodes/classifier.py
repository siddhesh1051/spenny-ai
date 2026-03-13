"""Intent classifier node — fast regex path with LLM fallback."""

import re
from typing import Literal

from agent.tools.groq_tools import groq_chat

Intent = Literal["expense", "query", "insights", "conversation"]


async def classify_intent(message: str, groq_key: str) -> Intent:
    t = message.strip().lower()

    # Fast path: conversation
    if re.match(r"^(hi|hello|hey|namaste|good\s+(morning|afternoon|evening))", t, re.I):
        return "conversation"
    if re.match(r"^(thanks?|thank\s+you|thx|ty)[\s!.,]*$", t, re.I):
        return "conversation"
    if re.match(r"^(bye|goodbye|see\s+ya|cya)[\s!.,]*$", t, re.I):
        return "conversation"
    if re.match(r"^(ok|okay|cool|great|nice|awesome|perfect)[\s!?.,]*$", t, re.I):
        return "conversation"
    if re.match(r"^what\s+(can\s+you|do\s+you|are\s+you)", t, re.I):
        return "conversation"

    # Fast path: expense
    if re.search(r"spent\s+\d+", t, re.I):
        return "expense"
    if re.search(r"paid\s+\d+", t, re.I):
        return "expense"
    if re.search(r"\d+\s+(on|for)\s+\w+", t, re.I):
        return "expense"
    if re.search(r"bought\s+.+\s+for\s+\d+", t, re.I):
        return "expense"
    if re.search(r"^\d+\s+(rs|₹|inr|rupees?)", t, re.I):
        return "expense"
    if re.search(r"^add\s+\d+\s+(for|on)\s+\w+", t, re.I):
        return "expense"

    # Fast path: query
    if re.search(r"(how\s+much|total|summary|show|list|what\s+did).*(spent?|expense|cost)", t, re.I):
        return "query"
    if re.search(r"(where|breakdown|analysis|report).*(money|spend|expense)", t, re.I):
        return "query"
    if re.search(
        r"my\s+(food|dining|travel|grocery|groceries|entertainment|utilities|rent|shopping|education|investments|healthcare|subscriptions)\s+expense",
        t, re.I
    ):
        return "query"
    # "trend/pattern for X" with a time reference → query (date-aware)
    if re.search(r"(trend|pattern)\s+(for|over|last|past|till|until|since)", t, re.I):
        return "query"
    if re.search(r"(show|give|display)\s+(me\s+)?(trend|pattern|chart|graph)", t, re.I):
        return "query"

    # Fast path: insights (advice, budgeting, comparisons — no time-range drilling)
    if re.search(r"(suggest|advice|tip|should\s+i|how\s+can|how\s+to\s+save)", t, re.I):
        return "insights"
    if re.search(r"(save|reduce|cut|lower).*(spending|expense|cost|money)", t, re.I):
        return "insights"
    if re.search(r"(budget|compare|vs|versus|insight)", t, re.I):
        return "insights"
    if re.search(r"\btrend\b", t, re.I) and not re.search(r"\b(for|over|last|past|till|until|since|month|week|day|year)\b", t, re.I):
        return "insights"

    # LLM fallback
    reply = await groq_chat(
        f"""Classify this message into ONE category: expense, query, insights, or conversation.
Message: "{message}"
- expense: logging a new expense ("spent 50 on coffee", "lunch 200")
- query: asking about past spending ("show food expenses", "how much last month")
- insights: asking for advice/analysis ("save money", "compare months", "budget tips")
- conversation: greeting, thanks, general chat

Reply with ONE WORD only.""",
        groq_key,
        temperature=0,
        max_tokens=5,
    )
    r = reply.lower().strip()
    if "query" in r:
        return "query"
    if "insight" in r:
        return "insights"
    if "expense" in r:
        return "expense"
    return "conversation"
