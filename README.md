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
- [PWA & Share Target](#pwa--share-target)
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
- **Share target** – Install as PWA and use “Share to Spenny AI” from other apps to share an image; it opens the app and runs receipt extraction on the shared image.
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
| **PWA**      | vite-plugin-pwa (manifest, service worker, share target) |
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
npm install
```

### 2. Environment

Create `.env` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
# Optional: default Groq key for all users (otherwise set per user in Settings)
# VITE_GROQ_API_KEY=your-groq-api-key
```

Use your Supabase project URL and anon key from **Project → Settings → API**.

### 3. Supabase setup

- Enable Email and (optional) Google auth in **Authentication → Providers**.
- Create tables and RLS policies (e.g. `profiles`, `expenses`, `api_keys`, `whatsapp_export_state` if you use WhatsApp). Apply any migrations or SQL from the project if provided.
- For WhatsApp: deploy Edge Functions and set secrets (see [WhatsApp Integration](#whatsapp-integration-optional)).

### 4. Run the app

```bash
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`). Sign up, add your Groq API key in **Settings**, then try voice, text, or image/PDF on the home page.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_GROQ_API_KEY` | No | Default Groq API key (users can override in Settings) |

For E2E tests, copy `.env.e2e.example` to `.env.e2e` and set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` for full-flow tests.

---

## Project Structure

```
spenny-ai/
├── src/
│   ├── App.tsx                 # Routes, auth, expense logic, Groq calls
│   ├── lib/supabase.ts         # Supabase client
│   ├── pages/
│   │   ├── AuthPage.tsx        # Sign in / Sign up (email, Google)
│   │   ├── HomePage.tsx        # Voice, text, image, PDF input
│   │   ├── AllTransactionsPage.tsx  # List, filter, export CSV/PDF
│   │   ├── AnalyticsPage.tsx   # Charts by category / time
│   │   ├── SettingsPage.tsx    # Profile, Groq API key
│   │   ├── ApiKeysPage.tsx     # API key management
│   │   ├── WhatsAppIntegrationPage.tsx  # Link WhatsApp (OTP)
│   │   └── ShareTargetPage.tsx # PWA share target handler
│   └── components/             # UI (sidebar, dialogs, buttons, etc.)
├── supabase/
│   └── functions/
│       ├── whatsapp-webhook/   # Incoming WhatsApp: expense, query, export
│       ├── send-whatsapp-otp/  # Send OTP for linking number
│       └── verify-whatsapp-otp/ # Verify OTP and save number
├── package.json
├── vite.config.ts              # Vite + PWA (share target, icons)
└── README.md
```

---

## Testing

- **Unit / component:** `npm run test` or `npm run test:run` (Vitest + React Testing Library).
- **E2E (Playwright):**
  - **Run all E2E (Chromium):** `npm run e2e`
  - **With UI:** `npm run e2e:ui`
  - **Headed (see browser):** `npm run e2e:headed`

Auth-page E2E runs without extra config. Full flow (sign in → add expense → transactions) requires test credentials in `.env.e2e` (see `.env.e2e.example`). The app must use the same `VITE_SUPABASE_*` as your dev `.env` so it can reach your Supabase project.

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
- When installed, “Share to Spenny AI” from another app sends the image to `/share-target`; the app runs receipt extraction on it and shows the result on the home flow.

---

## License

See repository license file.
