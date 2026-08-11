# AGENTS.md

IELTS Band 8 Prep App: FastAPI backend + Next.js frontend. Both endpoints are placeholders that return band score `0.0`; wiring in the OpenAI call is the remaining TODO.

## Layout
- `backend/` — Python FastAPI. App at `backend/app/main.py`, run via `uvicorn app.main:app --reload` from `backend/`. Deps in `backend/requirements.txt` (fastapi, uvicorn[standard], openai, pydantic).
  - `POST /api/v1/evaluate-essay` and `POST /api/v1/evaluate-speaking` (Pydantic request/response models, no AI call yet). Keep response fields matching the IELTS band descriptors.
- `frontend/` — Next.js 16 (App Router, TypeScript, Tailwind v4). No `src/` dir; pages under `frontend/app/`. Import alias `@/*`.
- `.env.example` (root) — documents `OPENAI_API_KEY`. Backend does not load env yet.

## Commands
- Backend: `uvicorn app.main:app --reload` (run from `backend/`)
- Frontend: `npm run dev` | `npm run build` | `npm run lint` (run from `frontend/`)

## Gotchas
- `frontend/.npmrc` must keep `allow-scripts=true`: the machine's global `~/.npmrc` sets `allow-scripts=opencode-ai`, which makes `npm install` fail with `EALLOWSCRIPTS` without it.
- Tailwind v4: no `tailwind.config`; theme is configured via `@theme` in `frontend/app/globals.css`.
- Repo is a fresh git repo (no commits). Remote: `origin` -> github.com/Prithivirajatgithub/ielts-band8-app.
