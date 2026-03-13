"""Shared constants used across agent nodes."""

VALID_CATEGORIES = [
    "Food & Dining", "Groceries", "Travel", "Entertainment", "Utilities",
    "Rent", "Shopping", "Education", "Investments", "Healthcare",
    "Subscriptions", "Other",
]

UI_COMPONENT_CATALOG = """
## Available UI Components

You can use the following node types to compose the "layout" field.
The root "layout" must always be a "column" node.

### Structural nodes

**column** – vertical stack of children
{ "kind": "column", "children": [ ...nodes ] }

**row** – horizontal grid, best for 2-4 metric cards side by side
{ "kind": "row", "children": [ ...summary nodes ] }

### Content nodes

**block** – text block, style controls appearance
{ "kind": "block", "style": "subheading"|"body"|"insight", "text": "..." }
- "subheading": small grey uppercase label/title
- "body": regular paragraph text
- "insight": green highlighted insight box — use for AI-generated conclusions, tips, observations

**summary** – a single metric card (heading + value)
{ "kind": "summary", "id": "unique-id", "heading": "Label", "primary": "1,200", "secondary": "optional note or null", "sentiment": "up"|"down"|"neutral" }
- sentiment "up" = green, "down" = orange, "neutral" = grey for the secondary text

### Data visualisation nodes

**visual** – chart (choose whichever fits the data best)
{ "kind": "visual", "variant": "pie"|"bars"|"area", "x": "name", "y": "value", "points": [ { "label": "food", "value": 1200, "share": 45 }, ... ] }
- "pie": pie chart
- "bars": bar chart
- "area": area chart with gradient fill — good for trends over time
- "share" is optional (percentage 0-100)

**table** – data table of expense records (shows a "Show more" button if >10 rows)
{ "kind": "table", "variant": "records", "rows": [ { "id": "uuid", "date": "ISO string", "description": "Coffee", "category": "food", "amount": 200 }, ... ] }
- Use ONLY when the user explicitly asks to see their transactions/records
- Cap to 50 rows max

**collection** – list of just-logged expenses with undo capability
{ "kind": "collection", "variant": "items", "text": "N expense(s) logged successfully!", "items": [ { "id": "uuid", "description": "...", "category": "...", "amount": number }, ... ] }
- Use ONLY for the expense logging intent to show what was just saved

## Composition rules
- Always wrap everything in a "column" root
- Put metric cards in a "row" (2-4 per row looks best)
- One chart per response is enough
- Use "insight" block for AI-generated conclusions — always include one for query/insights intents
- Use "subheading" blocks as section labels
- Do NOT include a "table" unless the user explicitly asked to see their transactions/list
- Do NOT include a chart if there is only 1 data category
- Keep the layout concise — avoid redundant sections
""".strip()

EXPENSE_CATEGORY_GUIDE = """
Categories (use ONLY these): Food & Dining, Groceries, Travel, Entertainment, Utilities, Rent, Shopping, Education, Investments, Healthcare, Subscriptions, Other

PRIORITY OVERRIDE RULES:
1. RECURRING digital service (Netflix, Spotify, Prime, Hotstar, ChatGPT, Adobe, iCloud, Notion, etc.) → always "Subscriptions"
2. Raw ingredient, packaged food, household supply from a store (not restaurant/delivery) → always "Groceries"

Category definitions:
- Food & Dining: eating out, cafes, restaurants, delivery apps (Zomato, Swiggy, McDonald's, etc.)
- Groceries: BigBasket, Blinkit, Zepto, DMart, kirana, vegetables, milk, packaged food at home
- Travel: Uber, Ola, IRCTC, flights, petrol, Fastag, hotel for travel
- Entertainment: BookMyShow, movies, gaming, events, concerts
- Utilities: electricity, internet, mobile bill, LPG, DTH, maintenance
- Rent: flat rent, PG, hostel, co-living, NestAway
- Shopping: Amazon, Flipkart, Myntra, clothes, electronics, furniture
- Education: courses, coaching, school fees, Udemy, Coursera
- Investments: Zerodha, Groww, mutual funds, SIP, FD, stocks
- Healthcare: Apollo Pharmacy, doctor, gym, medicines, diagnostics
- Subscriptions: Netflix, Spotify, ChatGPT Plus, Adobe, Microsoft 365, iCloud, etc.
- Other: bank fees, donations, visa fees, misc
""".strip()
