# Spenny AI

**Spenny AI** is an AI-powered expense tracker built around a conversational interface called **Sage**. Log expenses by voice, text, receipt photo, or WhatsApp. Ask natural language questions about your spending. Get rich, dynamic answers — charts, tables, metric cards, and insights — all composed in real time by the AI.

---

## Table of Contents

- [What Makes Spenny Different](#what-makes-spenny-different)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Generative UI & the `@spenny/ui-renderer` SDK](#generative-ui--the-spennyui-renderer-sdk)
- [Demo Prompts](#demo-prompts)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [WhatsApp Integration (Optional)](#whatsapp-integration-optional)
- [Gmail Auto-Sync (Optional)](#gmail-auto-sync-optional)
- [PWA & Share Target](#pwa--share-target)
- [License](#license)

---

## What Makes Spenny Different

Most expense trackers are forms. Spenny is a conversation.

**Sage** is the AI assistant at the center of the experience. You talk to it like a person — and it responds not with plain text, but with structured, interactive UI generated on the fly. The backend decides what to show: a donut chart, a table of transactions, metric summary cards, or a highlighted insight callout. The frontend just renders whatever JSON the AI returns.

This is **Generative UI** — the AI is the layout engine.

---

## Features

### Sage — AI Chat Interface (Main Page)

- **Natural language expense logging** — "Spent 200 on dinner and 50 for Uber." Sage extracts, categorises, and saves. You see a confirmation list with one-tap undo per item.
- **Spending queries** — "How much did I spend on food last week?" Returns a live query with chart, summary cards, table of transactions, and a Sage Insight callout.
- **Monthly insights** — "Show me my spending insights." Returns month-over-month comparison metrics, category breakdown chart, and personalised observations.
- **Receipt scanning** — Upload a receipt photo. Groq Vision extracts line items; Sage confirms them with the same undo-able collection UI.
- **Voice input** — Tap the mic, speak naturally. Transcribed via Whisper and sent through the same Sage pipeline.
- **Conversational fallback** — If Sage can't extract an expense or find data, it responds conversationally with a helpful message.
- **Dynamic layout** — Every Sage response is a different arrangement of components decided by the AI: headings, metric cards, charts (donut or bar), tables, item lists, insight callouts — composed per query.

### Transactions & Analytics

- **All Transactions** — View, search, filter by category and date, edit, delete, export to CSV or PDF.
- **Analytics** — Category pie/bar charts, spending over time, category totals.

### Auth & Profile

- **Email/password** and **Google OAuth** via Supabase Auth.
- **Settings** — Update display name, store your Groq API key (used for all AI features; falls back to server-side key if not set).

### Integrations

- **WhatsApp** — Link your number (OTP verification). Message the bot to log expenses, ask questions, or request CSV/PDF exports directly in chat.
- **Gmail Auto-Sync** — Connect your Gmail account (read-only) and import expenses directly from bank and payment alert emails. AI extracts amount, merchant, and category from HDFC, ICICI, SBI, Axis, Kotak, Paytm, UPI, NEFT, IMPS, and more. First sync lets you pick a start date and pulls all historical emails from that date. Subsequent syncs are incremental. Duplicate-safe, fully undoable for 10 seconds after sync, with a "delete all synced" option.
- **API Keys** — Create and manage programmatic API keys (e.g. for MCP integrations).
- **PWA** — Installable, with share target for images.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 6, React Router 7 |
| **Styling** | Tailwind CSS 4, shadcn/ui (Radix UI primitives), Lucide icons |
| **Backend / DB** | Supabase (Auth, Postgres, Edge Functions) |
| **AI — text** | Groq `llama-3.3-70b-versatile` — intent classification, expense extraction, query building, UI JSON generation; `llama-3.1-8b-instant` — Gmail email classification |
| **AI — vision** | Groq `meta-llama/llama-4-scout-17b-16e-instruct` — receipt and PDF extraction |
| **AI — audio** | OpenAI Whisper (via Supabase Edge Function `transcribe-audio`) |
| **Charts** | Recharts (inside `@spenny/ui-renderer`) |
| **Generative UI** | `@spenny/ui-renderer` — internal SDK (see below) |
| **PDF export** | jsPDF + jspdf-autotable |
| **PWA** | vite-plugin-pwa |

---

## Generative UI & the `@spenny/ui-renderer` SDK

### The Problem

Early versions of Spenny had hardcoded response layouts: every expense log looked the same, every spending query looked the same. The UI was driven by intent type, not by what the data actually needed.

### The Solution — AI as Layout Engine

The Sage backend (`sage-chat` Edge Function) no longer returns fixed fields. It returns a `uiResponse` JSON object that describes a **tree of UI nodes**. The AI decides which nodes to include, in what order, and with what content — based on the question and the data.

A response for "How much did I spend this month?" might look like:

```json
{
  "layout": {
    "kind": "column",
    "children": [
      { "kind": "block", "style": "subheading", "text": "March 2026" },
      {
        "kind": "row",
        "children": [
          { "kind": "summary", "heading": "Total", "primary": "₹12,400", "sentiment": "neutral" },
          { "kind": "summary", "heading": "Transactions", "primary": "34", "sentiment": "neutral" }
        ]
      },
      { "kind": "visual", "variant": "donut", "points": [...] },
      { "kind": "table", "rows": [...] },
      { "kind": "block", "style": "insight", "text": "Food accounts for 62% of spending..." }
    ]
  }
}
```

The frontend renders this tree — it never knows the intent, only the nodes.

### The `@spenny/ui-renderer` Package

To keep this rendering logic clean and reusable, it lives as a standalone internal package at `packages/ui-renderer` — exported as `@spenny/ui-renderer`.

**Design goals:**
- **Zero domain knowledge** — no concept of "expense" or "finance". Takes any valid `uiResponse` JSON and renders it.
- **Zero web-app dependencies** — styled entirely with inline CSS and CSS variables (`var(--card)`, `var(--border)`, etc.) so it works in any host app that defines a theme.
- **AI-context-aware** — the Edge Function receives a `UI_COMPONENT_CATALOG` (a plain-text description of every available node type) so the Groq model knows exactly what it can produce.

**Available node types:**

| Node | Description |
|---|---|
| `column` | Vertical stack of children |
| `row` | Horizontal grid of children |
| `block` | Text block — `subheading`, `body`, or `insight` (green callout) |
| `summary` | Metric card with heading, primary value, optional secondary and sentiment |
| `visual` | Chart — `donut` (pie/donut) or `bars` (bar chart) via Recharts |
| `table` | Scrollable data table with "Show more" for >10 rows |
| `collection` | Confirmed item list (e.g. logged expenses) with per-item undo |

**Usage in the web app:**

```tsx
import { UiRenderer } from "@spenny/ui-renderer";

<UiRenderer
  layout={response.uiResponse.layout}
  callbacks={{ onUndo: handleUndo }}
/>
```

The `collection` node's undo callback connects directly to the Supabase delete function — so users can one-tap remove any just-logged expense without leaving the chat.

---

## Demo Prompts

Try these in Sage (text or voice):

### Logging expenses
- *"Spent 200 on dinner and 50 for Uber."*
- *"Coffee 80, groceries 1200, electricity bill 900."*
- *"Paid 15000 rent and 3000 for groceries."*

### Spending queries
- *"How much did I spend this month?"*
- *"Show my food and travel expenses this week."*
- *"What did I spend most on last month?"*
- *"Show me all transactions above ₹500."*

### Insights
- *"Give me my spending insights."*
- *"How does this month compare to last month?"*
- *"What's my top spending category?"*

### Receipt scanning
Upload a photo of any receipt, payment screenshot, or bank SMS. Sage extracts and logs automatically.

### WhatsApp (after linking your number)
- *"Spent 200 on dinner and 50 on cab."* → Logs expenses.
- *"How much did I spend last month?"* → Summary reply.
- *"Export last 30 days as CSV"* → Sends file in chat.

### Gmail Auto-Sync
1. Go to **Gmail Sync** in the sidebar.
2. Click **Connect Gmail** — you'll be redirected to Google OAuth (read-only scope).
3. On first sync, click **Sync Now** to open the setup modal — pick a start date and review which bank emails are scanned.
4. Click **Start Sync**. Expenses are imported, categorised by AI, and appear instantly in Transactions.
5. Use **Undo all** within 10 seconds to roll back the entire sync if needed.
6. Subsequent syncs are incremental — only new emails since the last sync are processed.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key

### 1. Clone and install

```bash
git clone <repo-url>
cd spenny-ai

# Web app
cd web && npm install

# UI renderer SDK
cd ../packages/ui-renderer && npm install
```

### 2. Environment

Create `web/.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Supabase setup

- Enable Email and (optional) Google auth in **Authentication → Providers**.
- Create tables: `profiles`, `expenses`, `api_keys`, `gmail_sync_state`. Apply RLS policies.
- Run migrations:

```bash
npx supabase db push
```

- Deploy Edge Functions:

```bash
npx supabase functions deploy sage-chat --no-verify-jwt
npx supabase functions deploy extract-receipt --no-verify-jwt
npx supabase functions deploy transcribe-audio --no-verify-jwt
npx supabase functions deploy sync-gmail-expenses
```

- Set Edge Function secrets in Supabase dashboard:
  - `GROQ_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### 4. Run

```bash
cd web && npm run dev
```

Open `http://localhost:5173`. Sign up, add your Groq API key in **Settings**, then start chatting with Sage.

---

## Environment Variables

**Web (`web/.env`)**

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |

**Edge Functions (Supabase secrets)**

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Server-side Groq key (fallback if user hasn't set their own) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (for DB writes in Edge Functions) |

**Gmail Sync — Google Cloud setup**

The Gmail sync feature requires a Google Cloud project with:
1. **OAuth 2.0 credentials** — add your Supabase project URL as an authorised redirect URI in **APIs & Services → Credentials**.
2. **Gmail API** enabled — visit **APIs & Services → Library** and enable the Gmail API.
3. **OAuth consent screen** — add the `gmail.readonly` scope. During testing, add users via **Test users** (production requires Google verification).

These are configured in [Google Cloud Console](https://console.cloud.google.com), not in Supabase.

---

## Project Structure

```
spenny-ai/
├── packages/
│   └── ui-renderer/               # @spenny/ui-renderer — Generative UI SDK
│       └── src/
│           ├── UiRenderer.tsx     # Root renderer component
│           ├── renderNode.tsx     # Node type dispatch
│           ├── types.ts           # UiNode, UiLayout, UiResponse types
│           └── nodes/
│               ├── Block.tsx      # Text blocks (subheading, body, insight)
│               ├── Summary.tsx    # Metric cards
│               ├── Visual.tsx     # Donut / bar charts (Recharts)
│               ├── Table.tsx      # Data table with show more
│               ├── Collection.tsx # Item list with per-item undo
│               ├── Row.tsx        # Horizontal layout
│               └── Column.tsx     # Vertical layout
├── web/                           # React + Vite web app (PWA)
│   └── src/
│       ├── App.tsx                # Routes, auth, sidebar layout
│       ├── pages/
│       │   ├── SagePage.tsx       # Main page — Sage AI chat interface
│       │   ├── AllTransactionsPage.tsx
│       │   ├── AnalyticsPage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── ApiKeysPage.tsx
│       │   ├── WhatsAppIntegrationPage.tsx
│       │   ├── GmailSyncPage.tsx  # Gmail auto-sync — connect, date picker, undo
│       │   ├── ShareTargetPage.tsx
│       │   └── deprecated/
│       │       └── HomePage.tsx   # Legacy home (voice/text/image input) — kept but not linked
│       └── components/
│           ├── sidebar.tsx        # Nav sidebar with theme toggle
│           ├── sage/
│           │   ├── widgets.tsx    # Chat UI components, AssistantResponse renderer
│           │   └── types.ts       # Message, SageResponse, etc.
│           └── ui/                # shadcn/ui primitives
├── supabase/
│   └── functions/
│       ├── sage-chat/             # Main AI function — intent → uiResponse JSON
│       ├── extract-receipt/       # Vision extraction → uiResponse JSON
│       ├── transcribe-audio/      # Whisper transcription
│       ├── whatsapp-webhook/      # WhatsApp bot
│       ├── send-whatsapp-otp/
│       ├── verify-whatsapp-otp/
│       └── sync-gmail-expenses/   # Gmail sync — paginated fetch, parallel AI classification, dedup
├── app/                           # React Native / Expo mobile app
└── mcp-server/                    # MCP server for AI tool integrations
```

---

## WhatsApp Integration (Optional)

1. **Meta setup** — Create a Meta app, add WhatsApp product, get phone number ID and access token. Set webhook URL to:
   `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`
2. **Supabase secrets** for `whatsapp-webhook`:
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `GROQ_API_KEY`
3. **Deploy** `whatsapp-webhook`, `send-whatsapp-otp`, `verify-whatsapp-otp`.
4. **App** — Users link their number in **WhatsApp Integration** via OTP.

---

## Gmail Auto-Sync (Optional)

### How it works

The `sync-gmail-expenses` Edge Function runs on demand when the user clicks **Sync Now**:

1. **Fetches all matching emails** from Gmail using a date-filtered query across bank senders and transactional subjects (HDFC, ICICI, SBI, Axis, Kotak, Paytm, UPI, NEFT, IMPS, etc.). Paginates through all results.
2. **Deduplicates** against `synced_message_ids` stored in `gmail_sync_state` — previously processed emails are skipped.
3. **Fetches full email details in parallel** (batches of 25 concurrent requests).
4. **Classifies each email with AI in parallel** (batches of 15 concurrent Groq calls using `llama-3.1-8b-instant`). Only debit/payment alerts are extracted; credits, refunds, and OTPs are ignored.
5. **Inserts all new expenses** in a single DB batch.
6. **Updates sync state** — `last_synced_at` and `synced_message_ids` — so the next sync is incremental.

Email content is never stored. Only the extracted fields (amount, category, description, date) are saved.

### Database

| Table | Purpose |
|---|---|
| `gmail_sync_state` | Per-user sync state: `last_synced_at`, `synced_message_ids`, `gmail_email` |
| `expenses.gmail_message_id` | Nullable column used for per-row deduplication and bulk undo/delete |

### Setup

1. Enable Google as an OAuth provider in **Supabase → Authentication → Providers**.  
   Add the `gmail.readonly` scope and `access_type=offline` in the provider config.
2. In [Google Cloud Console](https://console.cloud.google.com):
   - Enable the **Gmail API**.
   - Configure the **OAuth consent screen** with `gmail.readonly` scope.
   - Add test users (or complete Google verification for production).
3. Deploy the Edge Function:
   ```bash
   npx supabase functions deploy sync-gmail-expenses
   ```
4. Run migrations to create `gmail_sync_state` and add `gmail_message_id` to `expenses`:
   ```bash
   npx supabase db push
   ```

### UI behaviour

- **First sync** — clicking Sync Now opens a modal: choose start date, review which bank email sources are scanned, then confirm. Supports any date range (up to 500 emails per invocation; syncing again continues from where it left off).
- **Subsequent syncs** — immediate, incremental. Only emails after `last_synced_at` are fetched.
- **Undo** — after each sync, a 10-second countdown with a draining progress bar lets you roll back all inserted expenses and restore the previous sync state.
- **Delete all synced** — permanently removes all Gmail-imported expenses and resets sync history.
- **Estimated time** — shown in the modal and while syncing. Typical times: 1–2 min for 6 months of emails, 3–5 min for 1 year.

---

## PWA & Share Target

The app is a PWA (via vite-plugin-pwa): installable on desktop and mobile. Supports the Web Share Target API — share a receipt photo from your camera roll directly to Spenny and it gets scanned automatically.

---

## License

See repository license file.
