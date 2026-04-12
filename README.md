# KnowFlow

> Turn any document into an intelligent Arabic/English agent.

## Stack
- Next.js 15 · TypeScript · Tailwind CSS
- Supabase (Auth + PostgreSQL + Storage)
- Python FastAPI + MarkItDown (ingestion)
- Anthropic Claude (claude-haiku-4-5-20251001)

## Quick Start

### 1. Clone & install
npm install

### 2. Environment
Copy .env.local and fill:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- INGESTION_SERVICE_URL=http://localhost:8000

### 3. Supabase setup
- Create project at supabase.com
- Run migrations in order:
  supabase/migrations/001_initial_schema.sql
  supabase/migrations/002_storage.sql
- Enable Email auth in Supabase dashboard

### 4. Run development
Terminal 1 — Python service:
cd services/ingestion
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

Terminal 2 — Next.js:
npm run dev

### 5. Run with Docker
docker-compose up --build

## Project Structure
src/app/(auth)/      → login, signup
src/app/(dashboard)/ → main app
src/app/api/         → ingest + agent routes
src/components/      → UI components
src/lib/supabase/    → client, server, middleware
services/ingestion/  → Python MarkItDown microservice
supabase/migrations/ → SQL schema files
