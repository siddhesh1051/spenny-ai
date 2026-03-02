# Sage Chat SDK

A small, UI-only React component for rendering Spenny Sage responses as a sleek, theme-aware dashboard.

## Install (local repo)

From your app:

```bash
npm install "@spenny/sage-chat-sdk@file:../sage-chat-sdk"
```

## Requirements

- TailwindCSS (classes used for styling)
- `recharts` installed in the consuming app
- React 18+

## Usage

```tsx
import { SageChatContainer } from "@spenny/sage-chat-sdk";

export function MyView({ response }: { response: any }) {
  return <SageChatContainer response={response} mode="dark" />;
}
```

### Props

- `response`: the JSON returned by your backend (e.g. `sage-chat`)
- `mode` (optional): `"light"` | `"dark"`; defaults to detecting `document.documentElement.classList.contains("dark")`
- `currencySymbol` (optional): defaults to `₹`

