# Spenny AI — Python Backend

FastAPI + LangGraph backend replacing Supabase Edge Functions.

## Quick Start

```bash
cd python-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env values
uvicorn main:app --reload
```

API docs at: http://localhost:8000/docs

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase dashboard → Settings → API |
| `GROQ_API_KEY` | Groq API key |
| `WHATSAPP_VERIFY_TOKEN` | Meta webhook verify token |
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business phone number ID |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | Your bot's username |
| `CORS_ORIGINS` | Comma-separated allowed origins |

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/sage/chat` | LangGraph Sage chat |
| POST | `/api/audio/transcribe` | Groq Whisper transcription |
| POST | `/api/receipt/extract` | Groq Vision receipt extraction |
| POST | `/api/gmail/sync` | Gmail expense sync |
| POST | `/api/whatsapp/otp/send` | Send WhatsApp OTP |
| POST | `/api/whatsapp/otp/verify` | Verify WhatsApp OTP |
| GET/POST/DELETE | `/api/telegram/link` | Telegram link management |
| POST | `/api/telegram/webhook` | Telegram bot webhook |
| GET/POST | `/api/whatsapp/webhook` | WhatsApp webhook |

## Feature Flag (Frontend)

In `web/.env`:
```
VITE_USE_PYTHON_BACKEND=false   # Switch to true when backend is deployed
VITE_PYTHON_BACKEND_URL=https://your-render-app.onrender.com
```

## Deploy to Render

1. Push `python-backend/` to your git repo
2. Create a new **Web Service** on Render
3. Set root directory to `python-backend`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add all environment variables from `.env.example`
7. Deploy!

## Supabase pgvector Migration

Run this migration to enable RAG embeddings:

```bash
supabase db push
```

Or apply `supabase/migrations/20260314000001_pgvector_rag.sql` manually in the Supabase SQL editor.

## Architecture

```
Request → FastAPI → JWT Verification
                  → LangGraph StateGraph (per thread_id)
                       ├── Classifier Node (intent)
                       ├── Expense Node (log + DB insert)
                       ├── Query Node (fetch + AI layout)
                       ├── Insights Node (90-day analytics)
                       └── Conversation Node (RAG + chat history)
                  → Supabase Postgres (expenses, profiles, chat)
                  → Groq API (LLM + Whisper + Vision + Embeddings)
```
