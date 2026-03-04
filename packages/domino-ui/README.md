# domino-ui

A React library for rendering AI-generated JSON layouts into UI. Each node renders the next — like dominoes.

Pass a structured JSON layout from your LLM and `domino-ui` cascades it into a fully composed React UI with charts, tables, summaries, collections, and text blocks.

## Install

```bash
npm install domino-ui
```

### Peer dependencies

```bash
npm install react recharts lucide-react clsx tailwind-merge
```

## Quick start

```tsx
import { UiRenderer } from "domino-ui";
import type { UiLayout } from "domino-ui";

const layout: UiLayout = {
  kind: "column",
  children: [
    {
      kind: "block",
      style: "subheading",
      text: "Monthly Overview",
    },
    {
      kind: "row",
      children: [
        {
          kind: "summary",
          id: "total",
          heading: "Total Spent",
          primary: "$2,340",
          secondary: "+12% vs last month",
          sentiment: "down",
        },
        {
          kind: "summary",
          id: "savings",
          heading: "Saved",
          primary: "$560",
          secondary: "On track",
          sentiment: "up",
        },
      ],
    },
    {
      kind: "visual",
      variant: "donut",
      points: [
        { label: "Food", value: 820, share: 35 },
        { label: "Transport", value: 470, share: 20 },
        { label: "Shopping", value: 610, share: 26 },
        { label: "Other", value: 440, share: 19 },
      ],
    },
  ],
};

export default function App() {
  return <UiRenderer layout={layout} />;
}
```

## Node types

### `block`
A text element. Three styles:

| style | description |
|-------|-------------|
| `"subheading"` | Small uppercase section label |
| `"body"` | Regular paragraph text |
| `"insight"` | Highlighted callout with a star icon |

```ts
{
  kind: "block",
  style: "subheading" | "body" | "insight",
  text: string,
}
```

### `summary`
A metric card — heading, primary value, optional secondary text with sentiment colouring.

```ts
{
  kind: "summary",
  id: string,
  heading: string,
  primary: string,
  secondary?: string,
  sentiment?: "up" | "down" | "neutral",
}
```

### `visual`
A chart. `"donut"` renders a donut/pie chart with a custom legend. `"bars"` renders a bar chart.

```ts
{
  kind: "visual",
  variant: "donut" | "bars",
  points: Array<{
    label: string,
    value: number,
    share?: number,   // percentage 0-100, shown in tooltip and legend
  }>,
}
```

### `table`
A data table with up to 4 columns, expand/collapse for long lists.

```ts
{
  kind: "table",
  variant: "records",
  columns?: [string, string, string, string],  // defaults to ["Item","Category","Value","Date"]
  rows: Array<{
    id?: string,
    label: string,
    badge?: string,
    value: string | number,
    secondary?: string,
  }>,
}
```

### `collection`
A list of newly created items with per-item undo support.

```ts
{
  kind: "collection",
  variant: "items",
  text: string,   // header/confirmation message
  items: Array<{
    id?: string,
    label: string,
    badge?: string,
    value: string | number,
    icon?: string,
  }>,
}
```

### `row`
Lays children out horizontally in equal-width columns.

```ts
{
  kind: "row",
  children: UiNode[],
}
```

### `column`
Lays children out vertically with a gap.

```ts
{
  kind: "column",
  children: UiNode[],
}
```

## UiRenderer props

```ts
<UiRenderer
  layout={layout}           // required — UiLayout
  callbacks={callbacks}     // optional — { onUndo?: (ids: string[]) => Promise<void> }
  className={className}     // optional — CSS class on the root div
/>
```

## Undo callbacks

The `collection` node shows an undo button per item. Wire it up via callbacks:

```tsx
<UiRenderer
  layout={layout}
  callbacks={{
    onUndo: async (ids) => {
      await deleteItems(ids);
    },
  }}
/>
```

## Using with an LLM

The library is designed around a JSON schema your LLM can output directly. Prompt your model to return a `UiResponse`:

```ts
import type { UiResponse } from "domino-ui";

// Parse LLM output
const response: UiResponse = JSON.parse(llmOutput);

// Render
<UiRenderer layout={response.layout} />
```

Example system prompt snippet:

```
Respond with a JSON object matching this shape:
{
  "layout": {
    "kind": "column",
    "children": [ ...UiNode[] ]
  }
}

Node kinds: block | summary | visual | table | collection | row | column
```

## Styling

`domino-ui` uses CSS variables for theming. It works out of the box with Tailwind CSS and shadcn/ui. Override these variables in your CSS to match your design system:

```css
:root {
  --background: ...;
  --foreground: ...;
  --card: ...;
  --border: ...;
  --muted: ...;
  --muted-foreground: ...;
  --popover: ...;
  --popover-foreground: ...;
  --primary: ...;
  --chart-1: ...;
  --chart-2: ...;
  --chart-3: ...;
  --chart-4: ...;
  --chart-5: ...;
}
```

## License

MIT
