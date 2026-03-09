#!/bin/bash
# Start the Spenny AI backend server
cd "$(dirname "$0")"
source .venv/bin/activate
SSL_VERIFY=false uvicorn main:app --host 0.0.0.0 --port 8000 --reload
