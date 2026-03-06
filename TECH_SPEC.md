# Spenny AI — Technical Specification

> Version 1.0 · March 2026
>
> *An AI-powered expense tracker built around Sage — a conversational assistant that uses Generative UI to render rich, dynamic financial insights from natural language.*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Sage — AI Chat System](#5-sage--ai-chat-system)
6. [WhatsApp Integration](#6-whatsapp-integration)
7. [Gmail Auto-Sync](#7-gmail-auto-sync)
8. [Export Functionality](#8-export-functionality)
9. [MCP Server (Claude Desktop Integration)](#9-mcp-server-claude-desktop-integration)
10. [Generative UI Deep Dive (domino-ui)](#10-generative-ui-deep-dive-domino-ui)
11. [PWA & Mobile](#11-pwa--mobile)
12. [Security & Authentication](#12-security--authentication)
13. [Future Scope — Python Backend + RAG](#13-future-scope--python-backend--rag)
14. [Appendix](#14-appendix)

---

## 1. Executive Summary

Spenny AI is an AI-powered personal finance tracker centred on a conversational interface called **Sage**. Unlike traditional expense trackers that rely on manual form entry, Spenny allows users to log expenses through natural language text, voice, receipt photos, or WhatsApp messages. The system then responds not with plain text but with structured, interactive UI composed in real time by the AI.

The core architectural innovation is **Generative UI**: the AI model acts as the layout engine. Rather than returning prose, the Sage backend returns a JSON tree of UI nodes — headings, metric cards, charts, tables, and insight callouts — that the frontend renders directly. The frontend has zero knowledge of "expense" or "finance"; it only renders whatever JSON the AI produces.

### 1.1 Core Philosophy

| Principle | Description |
|-----------|-------------|
| **Conversational First** | Every interaction goes through Sage. No forms, no dropdowns — just natural language. |
| **Generative UI** | The AI decides what the response looks like. The backend is the layout engine. |
| **Zero Domain on Frontend** | The UI renderer (`domino-ui`) has no concept of finance, expenses, or Sage. |
| **Multi-Channel Parity** | WhatsApp, Gmail, and the web app all share the same AI pipeline and data layer. |
| **Privacy-First Sync** | Gmail email content is never stored; only extracted fields (amount, category, date) are saved. |

---

## 2. System Architecture

### 2.1 High-Level Component Map

The system comprises four tiers: the client layer (React SPA + PWA), the edge compute layer (Supabase Edge Functions in Deno), the AI layer (Groq LLM APIs), and the data layer (Supabase Postgres).

| Layer | Component | Technology |
|-------|-----------|------------|
| Client | Web Application (PWA) | React 19, TypeScript, Vite 6, React Router 7 |
| Client | Mobile Application | React Native / Expo — iOS & Android |
| Client | WhatsApp Bot Interface | Meta WhatsApp Business API |
| Edge Compute | `sage-chat` | Supabase Edge Function (Deno) |
| Edge Compute | `extract-receipt` | Supabase Edge Function (Deno) |
| Edge Compute | `transcribe-audio` | Supabase Edge Function (Deno) |
| Edge Compute | `export-expenses` | Supabase Edge Function (Deno) |
| Edge Compute | `sync-gmail-expenses` | Supabase Edge Function (Deno) |
| Edge Compute | `whatsapp-webhook` | Supabase Edge Function (Deno) |
| Edge Compute | `send-whatsapp-otp` / `verify-whatsapp-otp` | Supabase Edge Function (Deno) |
| AI Layer | Text generation & reasoning | Groq — `llama-3.3-70b-versatile` |
| AI Layer | Gmail email classification | Groq — `llama-3.1-8b-instant` |
| AI Layer | Receipt / image extraction | Groq — `llama-4-scout-17b` (vision) |
| AI Layer | Voice transcription | OpenAI Whisper (via Groq) |
| Data Layer | Primary database | Supabase Postgres |
| Data Layer | Auth | Supabase Auth (email + Google OAuth) |
| Data Layer | File storage | Supabase Storage (exports) |
| Integration | MCP Server | Node.js — Claude Desktop integration (`mcp-server/`) |
| Video | Remotion | React-based video — animated trailer/promo scenes (`remotion/`) |

### 2.2 Request Flow — Sage Chat

A typical user query flows through the Sage pipeline as follows:

1. User types or speaks a message in the React SPA.
2. If voice: audio is sent to `transcribe-audio` → Whisper transcription returned.
3. Message text is sent to `sage-chat` Edge Function with user JWT and optional Groq API key header.
4. `sage-chat` classifies intent (`expense` / `query` / `insights` / `conversation`) using Groq llama-3.3-70b.
5. For **expense** intent: extracts structured expenses, inserts to DB, builds a `collection` uiResponse node.
6. For **query** intent: constructs Postgres filters, fetches expenses, generates visual uiResponse layout.
7. For **insights** intent: fetches current and prior month data, generates comparative uiResponse layout.
8. `sage-chat` returns `{ uiResponse, expenses, intent }` JSON to the client.
9. `domino-ui` renders the uiResponse JSON tree into React components.

### 2.3 Data Flow

| Source | Sink | Protocol | Auth |
|--------|------|----------|------|
| React SPA | `sage-chat` Edge Function | HTTPS POST (JSON) | Supabase JWT + optional Groq key header |
| React SPA | `extract-receipt` Edge Function | HTTPS POST (multipart) | Supabase JWT |
| React SPA | `transcribe-audio` Edge Function | HTTPS POST (multipart) | Supabase JWT |
| React SPA | `sync-gmail-expenses` Edge Function | HTTPS POST (JSON) | Supabase JWT + Google OAuth token |
| Meta Webhook | `whatsapp-webhook` Edge Function | HTTPS POST (JSON) | `WHATSAPP_VERIFY_TOKEN` HMAC |
| Edge Functions | Supabase Postgres | Postgres wire protocol | `SUPABASE_SERVICE_ROLE_KEY` |
| Edge Functions | Groq API | HTTPS POST (JSON) | `GROQ_API_KEY` |
| `whatsapp-webhook` | Supabase Storage | SDK (S3-compatible) | `SERVICE_ROLE_KEY` |
| MCP Server | Supabase Postgres | Postgres wire protocol | API key hash lookup |

---

## 3. Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Frontend Framework | React | 19 | UI component model |
| Frontend Framework | TypeScript | 5.x | Type safety |
| Build Tool | Vite | 6 | Dev server, bundling, HMR |
| Routing | React Router | 7 | SPA client-side routing |
| Styling | Tailwind CSS | 4 | Utility-first CSS |
| UI Primitives | shadcn/ui (Radix UI) | Latest | Accessible component primitives |
| Icons | Lucide React | Latest | Icon library |
| Charts | Recharts | Latest | Bar and donut charts inside `domino-ui` |
| Generative UI | `domino-ui` | npm package | JSON-to-React renderer for AI layouts (published on npm) |
| Video | Remotion | 4.0.432 | Animated trailer/promo video composition (`remotion/`) |
| Backend / DB | Supabase | Latest | Auth, Postgres, Edge Functions, Storage |
| Edge Runtime | Deno | Latest | Supabase Edge Function runtime |
| AI — Text | Groq `llama-3.3-70b-versatile` | Latest | Intent classification, expense extraction, query building, UI JSON generation |
| AI — Text (fast) | Groq `llama-3.1-8b-instant` | Latest | Gmail email classification (speed-optimised) |
| AI — Vision | Groq `llama-4-scout-17b-16e` | Latest | Receipt and PDF image extraction |
| AI — Audio | OpenAI Whisper (via Groq) | Latest | Voice transcription |
| PDF Export | jsPDF + jspdf-autotable | Latest | Client-side PDF generation |
| PWA | vite-plugin-pwa | Latest | Service worker, manifest, share target |
| Testing | Vitest + Playwright | Latest | Unit and E2E tests |
| MCP Server | Node.js | 18+ | MCP tool integrations for Claude Desktop |

---

## 4. Database Schema

All tables reside in a Supabase Postgres instance. Row-Level Security (RLS) is enabled on all tables — users can only read and write their own rows. The service role key (used by Edge Functions) bypasses RLS.

### 4.1 `profiles`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | `uuid` | NOT NULL (PK) | Foreign key to `auth.users.id` |
| `full_name` | `text` | NULL | Display name from OAuth or manual entry |
| `groq_api_key` | `text` | NULL | User-provided Groq API key (stored plaintext, used server-side) |
| `currency` | `text` | DEFAULT `'INR'` | Preferred display currency (ISO 4217) |
| `whatsapp_phone` | `text` | NULL | Verified WhatsApp phone number (E.164 format) |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Last profile update timestamp |

### 4.2 `expenses`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | `uuid` | NOT NULL (PK) | Auto-generated primary key |
| `user_id` | `uuid` | NOT NULL (FK) | Foreign key to `profiles.id` |
| `amount` | `numeric(12,2)` | NOT NULL | Expense amount in user's currency |
| `category` | `text` | NOT NULL | AI-assigned category (Food, Transport, Shopping, etc.) |
| `description` | `text` | NOT NULL | Merchant name or expense description |
| `date` | `date` | NOT NULL | Date of the expense (YYYY-MM-DD) |
| `gmail_message_id` | `text` | NULL | Source Gmail message ID (for dedup and bulk undo/delete) |
| `created_at` | `timestamptz` | DEFAULT `now()` | Row creation timestamp |

### 4.3 `api_keys`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | `uuid` | NOT NULL (PK) | Auto-generated primary key |
| `user_id` | `uuid` | NOT NULL (FK) | Owner (`profiles.id`) |
| `key_hash` | `text` | NOT NULL | SHA-256 hash of the API key (raw key is never stored) |
| `name` | `text` | NULL | Human-readable label for the key |
| `is_active` | `boolean` | DEFAULT `true` | Whether the key is valid for use |
| `expires_at` | `timestamptz` | NULL | Optional expiry date |
| `last_used_at` | `timestamptz` | NULL | Last successful API request timestamp |
| `created_at` | `timestamptz` | DEFAULT `now()` | Key creation timestamp |

### 4.4 `gmail_sync_state`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `user_id` | `uuid` | NOT NULL (PK) | One row per user |
| `last_synced_at` | `timestamptz` | NULL | Timestamp of last successful sync (incremental cursor) |
| `synced_message_ids` | `text[]` | DEFAULT `'{}'` | Array of Gmail message IDs already processed (dedup list) |
| `gmail_email` | `text` | NULL | Gmail address used for OAuth |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Last sync state update |

### 4.5 `whatsapp_export_state`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `phone` | `text` | NOT NULL (PK) | WhatsApp phone number (E.164) |
| `user_id` | `uuid` | NOT NULL | Linked user |
| `step` | `text` | NOT NULL | Conversation step: `period_selection` \| `format_selection` \| `exporting` |
| `date_from` | `date` | NULL | Selected export start date |
| `date_to` | `date` | NULL | Selected export end date |
| `format` | `text` | NULL | Selected export format: `csv` \| `pdf` |

### 4.6 RLS Policies

All tables enforce the same Row-Level Security pattern:

```sql
-- SELECT / INSERT / UPDATE / DELETE
auth.uid() = user_id   -- (or auth.uid() = id for the profiles table)
```

Edge Functions that need unrestricted DB access (e.g. `whatsapp-webhook`, which looks up users by phone number) use `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely.

---

## 5. Sage — AI Chat System

Sage is the primary interface of Spenny AI. It processes natural language input, classifies intent, performs the appropriate database operations, and returns a structured Generative UI response. Sage is not a chatbot that returns prose — it returns a JSON tree that the frontend renders as a rich, interactive layout.

### 5.1 Intent Classification

The first step in every `sage-chat` request is intent classification. `llama-3.3-70b-versatile` receives the user message and classifies it into one of four intents:

| Intent | Example Prompt | AI Actions Taken |
|--------|---------------|-----------------|
| `expense` | "Spent 200 on dinner and 50 for Uber" | Extract expenses → insert to DB → return `collection` node with undo |
| `query` | "How much did I spend on food last week?" | Build date/category filters → query DB → build chart + table layout |
| `insights` | "Show me my spending insights" | Fetch current + prior month → generate comparative metric layout |
| `conversation` | "What categories do you support?" | Answer conversationally → return text block layout |

### 5.2 Generative UI — uiResponse Schema

After intent classification and data retrieval, the AI generates a `uiResponse` JSON object. The JSON describes a tree of UI nodes; the frontend renders it without knowing the intent or the data domain.

Sample `uiResponse` for a spending query:

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
      { "kind": "table", "columns": ["Date", "Description", "Category", "Amount"], "rows": [...] },
      { "kind": "block", "style": "insight", "text": "Food accounts for 62% of spending..." }
    ]
  }
}
```

### 5.3 domino-ui Node Types

The `domino-ui` package defines the complete catalog of renderable node types. The Edge Function receives a plain-text `UI_COMPONENT_CATALOG` description of all node types, ensuring the AI produces only valid nodes.

| Node Kind | Fields | Rendered As |
|-----------|--------|-------------|
| `column` | `children: UiNode[]` | Vertical flex stack |
| `row` | `children: UiNode[]` | Horizontal flex grid (wraps) |
| `block` | `style: subheading\|body\|insight`, `text: string` | Text paragraph; `insight` renders as green callout box |
| `summary` | `heading`, `primary`, `secondary?`, `sentiment: positive\|negative\|neutral` | Metric card with coloured sentiment indicator |
| `visual` | `variant: donut\|bars`, `points: [{label, value}]` | Recharts donut or bar chart |
| `table` | `columns: string[]`, `rows: string[][]` | Scrollable data table; "Show more" for >10 rows |
| `collection` | `items: [{id, label, amount, category, date}]` | Confirmed expense list with per-item undo button |

### 5.4 Voice Input Flow

1. User taps microphone in SagePage and records audio.
2. Audio blob is sent via HTTPS multipart POST to `transcribe-audio` Edge Function.
3. Edge Function calls OpenAI Whisper (via Groq) and returns the transcribed text string.
4. Transcribed text is injected into the Sage message input and submitted to `sage-chat` as normal text.
5. The voice bubble UI renders the transcription alongside the standard Sage response.

### 5.5 Receipt Scanning Flow

1. User uploads or shares a receipt image (JPEG, PNG, PDF, or via PWA Share Target).
2. Image is sent via HTTPS multipart POST to `extract-receipt` Edge Function.
3. Edge Function calls `llama-4-scout-17b` with the image and a structured extraction prompt.
4. The model extracts line items: amount, description, category, date.
5. Extracted expenses are inserted into the database.
6. Edge Function returns a full `uiResponse` with a `collection` node listing each extracted item.
7. User can one-tap undo any or all items from the collection node.

### 5.6 Client-Side Groq Fallback

When a user provides their own Groq API key in Settings, it is stored in their profile. For `sage-chat` requests, the key is passed as a request header. The Edge Function uses the user's key in preference to the server-side `GROQ_API_KEY` secret, allowing users to use their own Groq quota and models.

---

## 6. WhatsApp Integration

The WhatsApp integration allows users to interact with Sage entirely through WhatsApp. Once a phone number is linked via OTP verification, users can log expenses, query spending, and request CSV or PDF exports directly in WhatsApp chat.

### 6.1 Setup & Webhook

| Component | Detail |
|-----------|--------|
| Meta App Type | WhatsApp Business API via Meta Developer Portal |
| Webhook URL | `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook` |
| Webhook Verification | `WHATSAPP_VERIFY_TOKEN` compared against `hub.verify_token` in GET request |
| Message Auth | `X-Hub-Signature-256` HMAC verified on every POST |
| Secrets Required | `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `GROQ_API_KEY` |

### 6.2 OTP Verification Flow

1. User enters phone number (E.164 format) in the web app.
2. Web app calls `send-whatsapp-otp` Edge Function — generates 6-digit OTP, sends via WhatsApp.
3. OTP is stored temporarily in Supabase with a 10-minute TTL.
4. User enters the OTP in the web app; web app calls `verify-whatsapp-otp`.
5. On success, phone number is written to `profiles.whatsapp_phone`.
6. `whatsapp-webhook` now resolves incoming messages from this number to the linked user.

### 6.3 Message Processing State Machine

| State / Trigger | Action | Next State |
|----------------|--------|------------|
| Unlinked phone | Send onboarding instructions linking to web app | Awaiting link |
| Text message (linked) | Classify intent with Groq (expense/query/insights/export/conversation) | Intent-based branch |
| Intent: expense | Extract expenses → insert to DB → reply with confirmation list | Idle |
| Intent: query | Build filters → query DB → format text summary → reply | Idle |
| Intent: insights | Fetch months data → format insight summary → reply | Idle |
| Intent: export | Set `step=period_selection` → ask user for date range | Export: period_selection |
| Export: period_selection | Parse date range → set `step=format_selection` → ask CSV or PDF | Export: format_selection |
| Export: format_selection | Parse format → generate file → upload to Storage → send signed URL | Idle |
| Audio message | Call `transcribe-audio` → process as text | Intent-based branch |
| Image message | Forward to `extract-receipt` equivalent → reply with extracted expenses | Idle |

### 6.4 Export Flow Detail

The multi-step export flow is managed via the `whatsapp_export_state` table:

- **Step 1 — Period Selection:** Bot asks for a date range (e.g. "last 7 days", "this month", or custom `YYYY-MM-DD to YYYY-MM-DD`).
- **Step 2 — Format Selection:** Bot asks "Which format? Reply CSV or PDF".
- **Step 3 — File Generation:** Expenses are fetched, formatted as CSV or PDF, uploaded to Supabase Storage, and a signed URL (1-hour TTL) is sent as a WhatsApp document message.

---

## 7. Gmail Auto-Sync

The Gmail Auto-Sync feature imports expenses automatically from bank and payment notification emails. It uses Google OAuth (read-only scope) with AI classification. Email content is never stored — only the extracted financial data is persisted.

### 7.1 OAuth Setup

| Requirement | Detail |
|-------------|--------|
| OAuth Provider | Google (configured in Supabase Authentication → Providers) |
| Scope | `gmail.readonly` |
| Access Type | `offline` (for refresh token support) |
| Google Cloud Setup | Enable Gmail API, configure OAuth consent screen, add `gmail.readonly` scope |
| Redirect URI | Supabase project OAuth callback URL |
| Production | Requires Google verification for `gmail.readonly` scope |

### 7.2 sync-gmail-expenses Pipeline

The `sync-gmail-expenses` Edge Function runs on demand when the user clicks **Sync Now**:

| Step | Operation | Detail |
|------|-----------|--------|
| 1 | Query Construction | Build Gmail search query across bank senders (HDFC, ICICI, SBI, Axis, Kotak, Paytm) and transactional subjects (UPI, NEFT, IMPS, debit, payment) |
| 2 | Pagination | Use Gmail API list endpoint, paginate through all results using `nextPageToken` |
| 3 | Deduplication | Filter out message IDs already in `synced_message_ids`; skip previously processed emails |
| 4 | Parallel Fetch | Fetch full email details in parallel (batches of 25 concurrent requests via `Promise.all`) |
| 5 | AI Classification | Classify each email with `llama-3.1-8b-instant` in parallel (batches of 15). Extract: amount, description, category, date. Ignore credits, refunds, OTPs. |
| 6 | Batch Insert | Insert all new expenses in a single DB batch with `gmail_message_id` populated |
| 7 | State Update | Update `gmail_sync_state`: increment `synced_message_ids` array, set `last_synced_at = now()` |
| 8 | Response | Return count of expenses synced; client shows 10-second undo countdown |

### 7.3 Supported Banks & Providers

| Bank / Provider | Email Patterns Detected |
|----------------|------------------------|
| HDFC Bank | Debit alerts, net banking, UPI payment notifications |
| ICICI Bank | Transaction alerts, iMobile pay notifications |
| State Bank of India (SBI) | Debit alerts, online transaction notifications |
| Axis Bank | Transaction confirmation, UPI alerts |
| Kotak Mahindra Bank | Debit transaction alerts |
| Paytm | Payment confirmations, wallet debits |
| Generic UPI | UPI payment success notifications from any VPA |
| NEFT / IMPS | Fund transfer confirmations |

### 7.4 Undo & Rollback

Immediately after a successful sync, the client displays a 10-second countdown with a draining progress bar:

- All expenses from the current sync batch (identified by `gmail_message_id`) are deleted on undo.
- `gmail_sync_state` is restored to its previous state (`last_synced_at` and `synced_message_ids` reverted).
- A **Delete all synced** option permanently removes all Gmail-imported expenses and resets sync history at any time.

---

## 8. Export Functionality

Spenny AI supports exporting expense data as CSV or PDF across multiple surfaces.

### 8.1 Web App Export

| Format | Library | Implementation Detail |
|--------|---------|----------------------|
| CSV | Native | UTF-8 with BOM prefix (`\uFEFF`) for Excel compatibility. Columns: Date, Description, Category, Amount. Triggered via Blob download URL. |
| PDF | jsPDF + jspdf-autotable | Landscape A4 layout. Bold header row, alternating fill on data rows, auto-scaling column widths. |

Export can be triggered from two places:
- **All Transactions Page** — Export modal with preset ranges (last 7/30/90 days, this month, custom date picker) and format selector.
- **Sage Chat** — Inline export buttons appear on Sage responses that include expense data (`InlineExportButtons` in `widgets.tsx`).

### 8.2 `export-expenses` Edge Function

A dedicated `export-expenses` Supabase Edge Function serves as the server-side export endpoint. This decouples export logic from the client and enables server-driven exports (used by the WhatsApp bot and future integrations).

| Parameter | Type | Description |
|-----------|------|-------------|
| `date_from` | `date` (YYYY-MM-DD) | Start of export range (inclusive) |
| `date_to` | `date` (YYYY-MM-DD) | End of export range (inclusive) |
| `format` | `csv` \| `pdf` | Output format |
| `user_id` | `uuid` (from JWT) | Resolved from Supabase JWT; scopes query to requesting user |

### 8.3 WhatsApp Export

Files are generated server-side in `whatsapp-webhook`, uploaded to Supabase Storage, and a signed URL (1-hour TTL) is sent as a WhatsApp document message. See [Section 6.4](#64-export-flow-detail) for the full multi-step flow.

### 8.4 MCP Programmatic Access

The MCP Server exposes expense data via MCP tools for programmatic access. See [Section 9](#9-mcp-server-claude-desktop-integration).

---

## 9. MCP Server (Claude Desktop Integration)

The MCP (Model Context Protocol) server (`mcp-server/`) enables Claude Desktop and other AI agents to interact with Spenny AI expense data programmatically. `McpServerPage.tsx` in the web app provides the UI for generating and managing API keys.

### 9.1 Authentication

API keys are generated in the web app — the raw key is shown once; only the SHA-256 hash is stored. On each MCP request, the provided key is hashed and compared against the `api_keys` table. If `is_active` is `true` and the key has not expired, the request is authenticated and `last_used_at` is updated.

### 9.2 Available Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `list_expenses` | `limit?`, `offset?`, `category?`, `date_from?`, `date_to?` | Paginated list of expenses with optional filters |
| `add_expense` | `amount`, `category`, `description`, `date` | Insert a new expense record |
| `get_summary` | `date_from?`, `date_to?` | Aggregate total and count by category for the period |
| `analyze_budget` | `month` (YYYY-MM) | Spending breakdown vs. average for a given month |
| `get_category_insights` | `months?` (default 3) | Category trends and top merchants over N months |

---

## 10. Generative UI Deep Dive (domino-ui)

The `domino-ui` package (`packages/domino-ui`, published on npm) is the rendering engine for all Sage responses. It was designed with three explicit goals:

- **Zero domain knowledge** — no concept of "expense" or "finance". Renders any valid JSON node tree.
- **Zero web-app dependencies** — styled entirely with CSS variables (`var(--card)`, `var(--border)`) so it works in any host app that defines a theme.
- **AI-context-aware** — the Edge Function receives a `UI_COMPONENT_CATALOG` string (plain English description of every available node type and its fields), ensuring Groq generates only valid, renderable JSON.

### 10.1 The AI-to-Renderer Contract

The contract between the Groq model and the renderer is the `UI_COMPONENT_CATALOG` — injected into every `sage-chat` system prompt. The model returns only JSON matching the catalog. Invalid nodes are silently ignored by `renderNode`.

```tsx
import { UiRenderer } from "domino-ui";

<UiRenderer
  layout={response.uiResponse.layout}
  callbacks={{ onUndo: handleUndo }}
/>
```

### 10.2 Node Rendering Architecture

| Component | File | Responsibility |
|-----------|------|----------------|
| `UiRenderer` | `packages/domino-ui/src/UiRenderer.tsx` | Root component; receives `layout` prop, passes to `renderNode` |
| `renderNode` | `packages/domino-ui/src/renderNode.tsx` | Dispatch function; switches on `node.kind` to appropriate renderer |
| `Column` | `nodes/Column.tsx` | Renders children in vertical flex stack |
| `Row` | `nodes/Row.tsx` | Renders children in horizontal flex grid with wrap |
| `Block` | `nodes/Block.tsx` | Renders text in `subheading`, `body`, or `insight` (callout) style |
| `Summary` | `nodes/Summary.tsx` | Renders metric card with heading, value, and sentiment colour |
| `Visual` | `nodes/Visual.tsx` | Renders Recharts `PieChart` (donut) or `BarChart` based on `variant` |
| `Table` | `nodes/Table.tsx` | Renders scrollable table with "Show more" for >10 rows |
| `Collection` | `nodes/Collection.tsx` | Renders expense list; each item has an Undo button connected to `onUndo` callback |

### 10.3 Theming

The renderer uses CSS custom properties for all colours and spacing. The host web app (`web/src/index.css` via Tailwind CSS 4 and shadcn/ui) defines these variables — the renderer automatically honours light/dark mode and any theme customisation without changes to the renderer package.

---

## 11. PWA & Mobile

### 11.1 Progressive Web App

| Feature | Detail |
|---------|--------|
| Plugin | `vite-plugin-pwa` — generates service worker and web app manifest automatically |
| Installability | Meets PWA install criteria; installable on Android, iOS, macOS, Windows, Linux |
| Offline Support | Service worker caches static assets; dynamic requests (Supabase, Groq) require network |
| Share Target | Web Share Target API: sharing a receipt photo from the camera roll opens Spenny and triggers receipt scanning |
| Share Handling | `ShareTargetPage.tsx` receives shared file; forwards to `extract-receipt` pipeline |
| External Server | App references `https://spenny-ai.onrender.com` for handling shared files in some scenarios |

### 11.2 React Native / Expo App (`app/`)

A React Native / Expo mobile application at `app/` targets iOS and Android. It provides native mobile experiences with parity to the web PWA — including voice input, receipt scanning via camera, push notifications, and WhatsApp deep-link integration.

### 11.3 Remotion Video (`remotion/`)

The `remotion/` directory contains a Remotion composition for an animated trailer and promo video. Remotion is a React-based video creation framework — video scenes are written as React components and rendered to MP4 via the Remotion CLI. See [`remotion/README.md`](remotion/README.md) for full details.

---

## 12. Security & Authentication

### 12.1 Authentication

| Method | Implementation |
|--------|---------------|
| Email / Password | Supabase Auth with bcrypt password hashing |
| Google OAuth | Supabase Auth → Google OAuth 2.0 → profile auto-created via auth trigger |
| Session Management | Supabase handles JWT issuance, refresh, and revocation. Tokens stored in `localStorage` via `@supabase/supabase-js`. |
| WhatsApp Auth | OTP-based phone verification. OTP generated server-side, stored with TTL, deleted after verification. |

### 12.2 Authorisation

| Surface | Mechanism |
|---------|-----------|
| Web App → Supabase DB | Supabase anon key + JWT. RLS policies enforce user isolation. |
| Edge Functions → DB | `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS (only used for cross-user lookups, e.g. phone → `user_id` in `whatsapp-webhook`). |
| MCP Server → DB | API key hash lookup. Key scoped to user. All DB queries filter by resolved `user_id`. |
| WhatsApp Webhook | `X-Hub-Signature-256` HMAC verification on every incoming POST. |
| Gmail OAuth | Access token verified by Gmail API. Refresh tokens handled by Google OAuth flow. |

### 12.3 Secret Management

| Secret | Storage Location | Usage |
|--------|-----------------|-------|
| `GROQ_API_KEY` | Supabase Edge Function secrets | Server-side fallback for all AI calls |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets | Unrestricted DB access in Edge Functions |
| `WHATSAPP_VERIFY_TOKEN` | Supabase Edge Function secrets | Webhook verification |
| `WHATSAPP_TOKEN` | Supabase Edge Function secrets | Meta WhatsApp API calls |
| `WHATSAPP_PHONE_NUMBER_ID` | Supabase Edge Function secrets | Meta send-message API |
| User Groq API Key | `profiles.groq_api_key` (Postgres) | Stored plaintext; used only server-side in Edge Functions |
| API Key Hash | `api_keys.key_hash` (Postgres) | SHA-256 only; raw key is never stored |

---

## 13. Future Scope — Python Backend + RAG

The current architecture uses Supabase Edge Functions (Deno runtime) as the compute layer. While this is an excellent starting point — zero infrastructure management, automatic scaling, co-located with the database — it has limitations as the product matures:

- **Limited Python ecosystem:** Deno/TypeScript lacks the depth of Python's AI/ML libraries (LangChain, LlamaIndex, sentence-transformers, Celery).
- **Cold start latency:** Edge Functions can have cold start delays for infrequent routes.
- **No background job support:** Long-running tasks (large Gmail syncs, scheduled insights) cannot run beyond request timeouts.
- **Debugging complexity:** Local Deno development tooling is less mature than Python FastAPI.

The proposed migration follows four phases, each independently deployable and backwards-compatible with the existing frontend.

---

### 13.1 Phase 1 — Python FastAPI Backend

Replace Supabase Edge Functions with a Python FastAPI service. Supabase DB, Auth, and Storage remain unchanged — only the compute layer moves.

| Aspect | Current (Deno) | Target (Python FastAPI) |
|--------|----------------|------------------------|
| Runtime | Deno (TypeScript) | Python 3.12+ with uvicorn/gunicorn |
| AI SDK | `groq-sdk` (TypeScript) | `groq` Python SDK + LangChain |
| Async | Deno async/await | FastAPI async endpoints + `httpx` async client |
| Deployment | Supabase Edge Functions (auto-scaled) | Docker container on Render / Railway / AWS ECS |
| Local Dev | `supabase functions serve` | `uvicorn --reload` with `.env` |
| Observability | Supabase Function Logs | OpenTelemetry → Grafana / Datadog |
| Background Jobs | Not supported (timeout-bound) | Celery + Redis workers |

**FastAPI endpoint mapping:**

| Current Edge Function | FastAPI Endpoint | Router File |
|----------------------|-----------------|-------------|
| `sage-chat` | `POST /api/v1/chat` | `app/routers/chat.py` |
| `extract-receipt` | `POST /api/v1/receipt` | `app/routers/receipt.py` |
| `transcribe-audio` | `POST /api/v1/transcribe` | `app/routers/transcribe.py` |
| `sync-gmail-expenses` | `POST /api/v1/gmail/sync` | `app/routers/gmail.py` |
| `whatsapp-webhook` | `POST /api/v1/whatsapp/webhook` | `app/routers/whatsapp.py` |
| `send-whatsapp-otp` | `POST /api/v1/whatsapp/send-otp` | `app/routers/whatsapp.py` |
| `verify-whatsapp-otp` | `POST /api/v1/whatsapp/verify-otp` | `app/routers/whatsapp.py` |

---

### 13.2 Phase 2 — RAG Pipeline

With a Python backend in place, a full Retrieval-Augmented Generation (RAG) pipeline can be added. RAG allows Sage to answer spending questions using semantic search over the user's entire expense history — including queries too vague for exact SQL filters.

| Component | Technology Choice | Rationale |
|-----------|------------------|-----------|
| Embedding Model | OpenAI `text-embedding-3-small` | High quality, low cost, 1536-dim vectors |
| Vector Store | `pgvector` extension on existing Supabase Postgres | No new infrastructure; same DB as `expenses` table |
| Orchestration | LangChain (Python) | RetrievalQA chain, prompt templating, model abstraction |
| Embedding Storage | New column: `expenses.embedding vector(1536)` | Per-expense vector alongside existing fields |
| Index Type | HNSW index on `expenses.embedding` | Sub-linear approximate nearest-neighbour search |
| Similarity Metric | Cosine similarity (`<=>` operator) | Standard for text embeddings |

**RAG pipeline for a query like "What did I spend at Indian restaurants in summer?":**

1. Embed the user query using `text-embedding-3-small` → 1536-dim vector.
2. Run pgvector similarity search: `SELECT * FROM expenses WHERE user_id = $1 ORDER BY embedding <=> $2 LIMIT 20`.
3. Retrieve top-K most semantically similar expenses from the user's history.
4. Inject retrieved expenses as context into the Groq prompt alongside the original query.
5. Groq generates a response grounded in the retrieved data — with full awareness of amounts, merchants, dates.
6. Result is formatted as a standard `uiResponse` JSON for rendering by `domino-ui`.

**Expense embedding format:**

```
"{amount} {category} {description} {date}"
# Example: "1200 Food Dinner at Punjabi Dhaba 2026-02-14"
```

**Embedding generation strategy:**
- New expenses are embedded asynchronously after DB insert (Celery task or FastAPI `background_tasks`).
- Existing expenses are batch-embedded during migration (Python script, 100 expenses per API call).
- Re-embedding is triggered if `description` or `category` is updated by the user.

---

### 13.3 Phase 3 — Smarter Sage

With embeddings and a Python backend in place, Sage can be enhanced with financial intelligence features:

| Feature | Implementation Approach | User Benefit |
|---------|------------------------|-------------|
| **Financial Memory** | Embed conversation history; retrieve relevant past exchanges via pgvector before each response | Sage remembers context across sessions |
| **Budget Anomaly Detection** | Compute embedding distance from rolling baseline vector; flag outliers | Proactive alerts: "This week's spending pattern looks unusual for you" |
| **Recurring Payment Detection** | Cluster expenses by merchant + amount + day-of-month; identify periodic patterns | Auto-detect subscriptions (Netflix, rent, gym) |
| **Spending Forecasting** | Time-series regression on historical expense data by category | End-of-month projections: "At this rate, you'll spend ₹8,000 on food this month" |
| **Smart Categorisation** | Fine-tune classification with user correction signals; use embedding similarity for new merchants | Categories improve over time based on user edits |

---

### 13.4 Phase 4 — Full Infrastructure Decoupling

The final phase moves all infrastructure to fully owned, self-managed services, eliminating Supabase vendor dependency while retaining Postgres as the core database:

| Current (Supabase) | Target (Self-managed) | Migration Path |
|-------------------|----------------------|----------------|
| Supabase Auth | Auth0 or Clerk (or keep Supabase Auth) | Update frontend auth SDK; JWT issuer changes in FastAPI middleware |
| Supabase Postgres | Self-hosted Postgres (RDS / Cloud SQL) with pgvector | Logical replication + cutover; schema identical |
| Supabase Edge Functions | FastAPI on Docker (Render / AWS ECS) | Already migrated in Phase 1 |
| Supabase Storage | AWS S3 or Cloudflare R2 | Update storage SDK calls in `whatsapp-webhook` and export code |
| Gmail sync (request-scoped) | Celery + Redis background workers | Sync jobs queue on request, run async, notify via WebSocket or polling |
| No observability | OpenTelemetry → traces/metrics → Grafana | Add OTel SDK to FastAPI; export to OTLP collector |
| No rate limiting | Redis-based rate limiter in FastAPI middleware | Protect AI endpoints from abuse |

### 13.5 Migration Strategy

Each phase is designed to be independently deployed without frontend changes. Recommended order:

- Run FastAPI and Edge Functions in **parallel (shadow mode)**. FastAPI handles new requests; compare outputs with Edge Functions for correctness.
- Switch traffic to FastAPI endpoint by endpoint via feature flag. Start with low-risk endpoints (`transcribe-audio`).
- Deploy RAG pipeline in **additive mode** — only used for queries returning zero SQL results. Monitor quality and latency before making it primary.
- Run embedding generation as a background job; do not block on it. Mark expenses with `embedding IS NULL` and fill incrementally.
- Full decoupling (Phase 4) only when Phases 1–3 are stable in production for 30+ days.

---

## 14. Appendix

### 14.1 Environment Variables Reference

| Variable | Location | Required | Description |
|----------|----------|----------|-------------|
| `VITE_SUPABASE_URL` | `web/.env` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `web/.env` | Yes | Supabase anonymous key |
| `GROQ_API_KEY` | Supabase Edge Function secrets | Yes | Server-side Groq key (fallback) |
| `SUPABASE_URL` | Supabase Edge Function secrets | Yes | Supabase project URL (used by Edge Functions) |
| `SUPABASE_ANON_KEY` | Supabase Edge Function secrets | Yes | Supabase anon key (used by Edge Functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets | Yes | Service role key for unrestricted DB access |
| `WHATSAPP_VERIFY_TOKEN` | Supabase Edge Function secrets | WhatsApp only | Meta webhook verification token |
| `WHATSAPP_TOKEN` | Supabase Edge Function secrets | WhatsApp only | Meta WhatsApp Business API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Supabase Edge Function secrets | WhatsApp only | Meta phone number ID for sending messages |

### 14.2 Key File Reference

| File Path | Purpose |
|-----------|---------|
| `web/src/App.tsx` | Root React component: routes, auth state, expense CRUD, share target handling |
| `web/src/pages/SagePage.tsx` | Sage chat UI: message handling, voice recording, receipt upload |
| `web/src/pages/McpServerPage.tsx` | MCP server integration page: API key generation and management UI |
| `web/src/pages/HomePage.tsx` | Standalone voice/text/image input page |
| `web/src/components/sage/widgets.tsx` | Chat UI components: `AssistantResponse`, `InlineExportButtons`, `VoiceMessageBubble` |
| `web/src/components/sage/types.ts` | TypeScript types: `Message`, `SageResponse`, `DbExpense`, etc. |
| `packages/domino-ui/src/types.ts` | `UiNode` type definitions for all Generative UI node kinds |
| `packages/domino-ui/src/UiRenderer.tsx` | Root renderer component |
| `packages/domino-ui/src/renderNode.tsx` | Node type dispatch function |
| `supabase/functions/sage-chat/index.ts` | Main AI handler: intent classification, DB query, uiResponse generation |
| `supabase/functions/extract-receipt/index.ts` | Vision-based receipt extraction → uiResponse |
| `supabase/functions/export-expenses/index.ts` | Server-side CSV/PDF export endpoint |
| `supabase/functions/whatsapp-webhook/index.ts` | WhatsApp message processing, export flow, OTP lookup |
| `supabase/functions/sync-gmail-expenses/index.ts` | Gmail OAuth sync pipeline |
| `mcp-server/index.js` | MCP server for Claude Desktop integration |
| `remotion/` | Remotion video composition — animated trailer/promo scenes |

### 14.3 Edge Function Deploy Commands

```bash
npx supabase functions deploy sage-chat --no-verify-jwt
npx supabase functions deploy extract-receipt --no-verify-jwt
npx supabase functions deploy transcribe-audio --no-verify-jwt
npx supabase functions deploy export-expenses
npx supabase functions deploy sync-gmail-expenses
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy send-whatsapp-otp
npx supabase functions deploy verify-whatsapp-otp
```

### 14.4 Groq Model Selection Rationale

| Use Case | Model | Reason |
|----------|-------|--------|
| Intent classification, UI JSON generation, expense extraction | `llama-3.3-70b-versatile` | Highest reasoning quality for complex structured output; JSON adherence is critical |
| Gmail email classification | `llama-3.1-8b-instant` | Speed-optimised; classification task is simpler and runs in parallel across many emails |
| Receipt / image extraction | `llama-4-scout-17b-16e-instruct` | Multimodal vision model; only model on Groq offering image input support |
| Voice transcription | Whisper (via Groq) | Best-in-class open-source ASR; Groq provides fast inference |
