# Spenny AI

**Spenny AI** is an AI-powered expense tracker that lets you log expenses by voice, text, images, PDF bank statements, and WhatsApp. It uses Groq’s fast LLMs to extract structured expense data and stores everything in Supabase with a modern React + TypeScript frontend.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Demo Questions & Example Inputs](#demo-questions--example-inputs)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [WhatsApp Integration (Optional)](#whatsapp-integration-optional)
- [PWA](#pwa--share-target)
- [License](#license)

---

## Features

### Core

- **Voice input** – Click the mic, speak your expenses (e.g. “spent 50 on coffee and 150 for groceries”). Speech is transcribed and parsed into amount, category, and description. Supports Chrome, Edge, Safari (Web Speech API).
- **Text input** – Type or paste a sentence; the AI extracts one or more expenses and shows them for confirmation before saving.
- **Image receipts** – Upload a photo of a receipt or order history; the AI extracts line items and categories (Groq Vision).
- **PDF bank statements** – Upload a bank statement PDF; the app extracts debit transactions, skips credits/transfers, and imports them with category and date (Groq Vision).
- **All transactions** – View, search, filter by category and date range, edit, delete, and export to CSV or PDF.
- **Analytics** – Pie and bar charts by category, spending over time, and progress toward category totals.
- **Dark/Light mode** – Theme toggle with persisted preference.

### Auth & Profile

- **Email/password** – Sign up and sign in via Supabase Auth.
- **Google sign-in** – OAuth with automatic profile creation.
- **Profile & API key** – Settings page: update display name and store your **Groq API key** (used for all AI features). Optional env fallback: `VITE_GROQ_API_KEY`.

### Integrations

- **WhatsApp** – Link your WhatsApp number (OTP verification). Send text or voice messages to log expenses; ask questions (“How much did I spend last month?”); request exports (“Export last 30 days as CSV”) and receive the file in chat. Uses Supabase Edge Functions: `whatsapp-webhook`, `send-whatsapp-otp`, `verify-whatsapp-otp`.
- **API Keys** – Create and manage API keys for secure access (e.g. MCP or other integrations). Keys are stored in Supabase and can be revoked.
- **PWA** – Installable app with offline-ready shell and share target for images.

### Data & Categories

- **Categories:** `food`, `travel`, `groceries`, `entertainment`, `utilities`, `rent`, `other`.
- **Structured fields:** amount, category, description, date (with optional edit before save for voice/text).

---

## Tech Stack

| Layer        | Technology |
|-------------|------------|
| **Frontend** | React 19, TypeScript, Vite 6, React Router 7 |
| **Styling**  | Tailwind CSS 4, Radix UI (Dialog, Tabs, Dropdown, etc.), Lucide icons |
| **State / Data** | React state, Supabase JS client |
| **Backend / DB** | Supabase (Auth, Postgres, Storage, Edge Functions) |
| **AI**       | Groq (llama-3.1-8b-instant for text, llama-3.2-11b-vision-preview for images/PDFs, Whisper for audio) |
| **Charts**   | Recharts |
| **PDF export** | jsPDF + jspdf-autotable |
| **PWA**      | vite-plugin-pwa (manifest, service worker) |
| **Testing**  | Vitest, React Testing Library, Playwright (E2E) |

---

## Demo Questions & Example Inputs

Use these to try the product (voice, text box, or WhatsApp).

### Logging expenses (voice or text)

- *“Spent 10 on coffee and 150 for groceries.”*
- *“Bought lunch for 25 dollars, paid 50 for gas, and spent 15 on parking.”*
- *“Paid 100 for electricity bill and 80 for internet.”*
- *“Rent 15000, groceries 3200, and 500 on entertainment.”*

### Categories (what the AI maps)

- **food** – restaurants, cafes, fast food, dining out  
- **groceries** – supermarket, household items  
- **travel** – fuel, parking, transport, flights, hotels  
- **entertainment** – movies, games, hobbies, concerts  
- **utilities** – electricity, water, gas, internet, phone  
- **rent** – housing rent, accommodation  
- **other** – everything else  

### WhatsApp (after linking your number)

- *“Spent 200 on dinner and 50 on cab.”* → Logs expenses.
- *“How much did I spend last month?”* → Summary reply.
- *“What are my top categories?”* → Category breakdown.
- *“Export my expenses” / “Export last 30 days as CSV”* → Sends CSV (or PDF) in chat.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key (for AI features)

### 1. Clone and install

```bash
git clone <repo-url>
cd spenny-ai
```

Install dependencies for each sub-package you want to run:

```bash
# Web app
cd web && npm install

# Mobile app (Expo)
cd ../app && npm install

# MCP server
cd ../mcp-server && npm install
```

### 2. Environment

Create `web/.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
# Optional: default Groq key for all users (otherwise set per user in Settings)
# VITE_GROQ_API_KEY=your-groq-api-key
```

Create `app/.env` for the mobile app:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use your Supabase project URL and anon key from **Project → Settings → API**.

### 3. Supabase setup

- Enable Email and (optional) Google auth in **Authentication → Providers**.
- Create tables and RLS policies (e.g. `profiles`, `expenses`, `api_keys`, `whatsapp_export_state` if you use WhatsApp). Apply any migrations or SQL from the project if provided.
- For WhatsApp: deploy Edge Functions and set secrets (see [WhatsApp Integration](#whatsapp-integration-optional)).

### 4. Run the app

**Web:**

```bash
cd web && npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`). Sign up, add your Groq API key in **Settings**, then try voice, text, or image/PDF on the home page.

**Mobile (Expo):**

```bash
cd app && npx expo start
```

---

## Environment Variables

**Web (`web/.env`)**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_GROQ_API_KEY` | No | Default Groq API key (users can override in Settings) |

**Mobile (`app/.env`)**

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |

For E2E tests, copy `web/.env.e2e.example` to `web/.env.e2e` and set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` for full-flow tests.

---

## Project Structure

```
spenny-ai/
├── web/                        # React + Vite web app (PWA)
│   ├── src/
│   │   ├── App.tsx             # Routes, auth, expense logic, Groq calls
│   │   ├── main.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts     # Supabase client
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   ├── AuthPage.tsx              # Sign in / Sign up (email, Google)
│   │   │   ├── HomePage.tsx              # Voice, text, image, PDF input
│   │   │   ├── AllTransactionsPage.tsx   # List, filter, export CSV/PDF
│   │   │   ├── AnalyticsPage.tsx         # Charts by category / time
│   │   │   ├── SettingsPage.tsx          # Profile, Groq API key
│   │   │   ├── ApiKeysPage.tsx           # API key management
│   │   │   ├── McpServerPage.tsx         # MCP server setup guide
│   │   │   ├── WhatsAppIntegrationPage.tsx  # Link WhatsApp (OTP)
│   │   │   └── ShareTargetPage.tsx       # PWA share target handler
│   │   └── components/
│   │       ├── sidebar.tsx
│   │       ├── ApiKeysManagement.tsx
│   │       ├── PWAInstallPrompt.tsx
│   │       ├── mode-toggle.tsx
│   │       ├── theme-provider.tsx
│   │       └── ui/             # Radix-based UI primitives (shadcn/ui)
│   ├── e2e/                    # Playwright E2E tests
│   ├── public/                 # PWA icons, manifest, service worker
│   ├── .env                    # Web environment variables
│   ├── vite.config.ts          # Vite + PWA plugin
│   ├── playwright.config.ts
│   └── package.json
├── app/                        # React Native / Expo mobile app
│   ├── screens/
│   │   ├── AuthScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── TransactionsScreen.tsx
│   │   ├── AnalyticsScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── WhatsAppScreen.tsx
│   ├── components/
│   │   ├── AnimatedTabBar.tsx
│   │   ├── WhatsAppSection.tsx
│   │   └── ui/                 # Mobile UI primitives
│   ├── context/
│   │   └── ThemeContext.tsx
│   ├── lib/supabase.ts
│   ├── App.tsx
│   ├── .env                    # Mobile environment variables
│   └── package.json
├── mcp-server/                 # MCP server for AI integrations
│   ├── index.js
│   └── package.json
├── supabase/
│   └── functions/
│       ├── whatsapp-webhook/   # Incoming WhatsApp: expense, query, export
│       ├── send-whatsapp-otp/  # Send OTP for linking number
│       └── verify-whatsapp-otp/ # Verify OTP and save number
└── README.md
```

---

## Testing

All test commands run from the `web/` directory:

```bash
cd web
```

- **Unit / component:** `npm run test` or `npm run test:run` (Vitest + React Testing Library).
- **E2E (Playwright):**
  - **Run all E2E (Chromium):** `npm run e2e`
  - **With UI:** `npm run e2e:ui`
  - **Headed (see browser):** `npm run e2e:headed`

Auth-page E2E runs without extra config. Full flow (sign in → add expense → transactions) requires test credentials in `web/.env.e2e` (see `web/.env.e2e.example`). The app must use the same `VITE_SUPABASE_*` as your dev `web/.env` so it can reach your Supabase project.

---

## WhatsApp Integration (Optional)

1. **Meta setup** – Create a Meta app, add WhatsApp product, get phone number ID and access token. Configure webhook URL to point to your Supabase function:  
   `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`
2. **Supabase secrets** – Set for the `whatsapp-webhook` (and OTP) functions:
   - `WHATSAPP_VERIFY_TOKEN` (any string; same as in Meta webhook config)
   - `WHATSAPP_TOKEN` – Meta WhatsApp API token
   - `WHATSAPP_PHONE_NUMBER_ID` – WhatsApp Business phone number ID
   - `GROQ_API_KEY` – Used in the webhook for parsing and answering
3. **Deploy** – Deploy `whatsapp-webhook`, `send-whatsapp-otp`, and `verify-whatsapp-otp` Edge Functions.
4. **App** – Users link their number in **WhatsApp Integration** via OTP; then they can message the bot to log expenses, ask questions, and request CSV/PDF exports.

---

## PWA & Share Target

- The app is a PWA (Vite PWA plugin): installable, with a share target for **images**.

---

## License

See repository license file.
