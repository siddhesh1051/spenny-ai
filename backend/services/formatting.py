"""Currency formatting and shared constants."""

VALID_CATEGORIES = ["food", "travel", "groceries", "entertainment", "utilities", "rent", "other"]

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

**visual** – chart (choose the right type for the data)
{ "kind": "visual", "variant": "donut"|"bars", "x": "name", "y": "value", "points": [ { "label": "food", "value": 1200, "share": 45 }, ... ] }
- "donut": pie/donut chart — best for ≤5 categories showing proportions
- "bars": bar chart — best for >5 categories or when comparing values over time
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


def format_currency(amount: float, currency: str = "INR") -> str:
    """Format a number as a currency string. Falls back to plain format."""
    try:
        from babel.numbers import format_currency as babel_fmt
        return babel_fmt(amount, currency, locale="en_IN" if currency == "INR" else "en_US")
    except Exception:
        return f"{currency} {amount:,.0f}"
