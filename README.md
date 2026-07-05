# KnowFlow

> Chat with any document — Arabic & English AI agent, no setup required.

[![Live Demo](https://img.shields.io/badge/Demo-tryknowflow.com-green)](https://tryknowflow.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Claude API](https://img.shields.io/badge/Claude-Haiku-orange)](https://anthropic.com)

Upload a PDF or paste a URL. Ask questions in Arabic or English.  
KnowFlow streams answers in real time — sourced directly from your document.

## Features

- Bilingual: Arabic (RTL) + English in the same session
- Streaming responses via Claude Haiku
- PDF, DOCX, and URL ingestion
- Authentication via Supabase
- PRO tier with usage limits

## Stack

`Next.js 15` · `FastAPI` · `Claude Haiku` · `Supabase` · `Railway` · `Vercel`

## Architecture

```
User → Next.js (Vercel)
         └→ FastAPI (Railway)
               └→ Claude Haiku (streaming)
               └→ Supabase (auth + storage)
```

## Run locally

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload
```

```env
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## Live

🌐 [tryknowflow.com](https://tryknowflow.com)

## Built by

[AboJad](https://github.com/tornidomaroc-web) — Full Stack AI Engineer, Marrakesh 🇲🇦 

## Secrets & API keys

**Standing rule:** one named API key per project per environment, living in exactly one location, never copied between projects. Give each environment its own distinctly named key (e.g. `knowflow-dev`, `knowflow-prod`) so rotating means replacing a single copy with none left to go stale. The recurring Anthropic key "exposures" across these repos were one key hand-copied between consumers, not a leak.

- Local secrets live only in `.env.local` / `.env` (gitignored), never in a committed file.
- Deployed secrets live only in the host env store (Vercel / Railway / etc.).
- A pre-commit secrets scan (`scripts/secrets_scan.py`) blocks accidental commits; install it once per clone with `powershell -ExecutionPolicy Bypass -File scripts/install_hooks.ps1`.
