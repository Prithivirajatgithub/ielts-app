# AGENTS.md

IELTS Band 8 Prep App: FastAPI backend + Next.js frontend. All evaluation endpoints call Gemini; responses follow the IELTS band descriptors.

## Layout
- `backend/` — Python FastAPI. App at `backend/app/main.py`, run via `uvicorn app.main:app --reload` from `backend/`. Deps in `backend/requirements.txt` (fastapi, uvicorn[standard], python-multipart, google-genai, pydantic, python-dotenv, gTTS). Env key: `GEMINI_API_KEY`.
  - `POST /api/v1/evaluate-essay`, `POST /api/v1/evaluate-task1`, and `POST /api/v1/evaluate-speaking` (multipart: `audio` file + `topic` form field). AI calls live in `backend/app/services/evaluator.py`; speaking sends the audio inline to `gemini-3.5-flash`. Keep response fields matching the IELTS band descriptors.
  - Listening module: `backend/app/data/listening_tests.json` holds tests (Section 1 transcript + questions + answer keys). `GET /api/v1/listening/tests` (no keys), `GET /api/v1/listening/audio/{test_id}` (streams via `StreamingResponse`), `POST /api/v1/listening/grade`. Audio synthesis in `backend/app/services/listening.py` tries Gemini TTS (multi-speaker, 20s timeout) then falls back to edge-tts neural voices (Student -> en-GB-SoniaNeural female, Agent -> en-US-ChristopherNeural male) -> MP3 via `io.BytesIO()`.
- `frontend/` — Next.js 16 (App Router, TypeScript, Tailwind v4). No `src/` dir; pages under `frontend/app/`. Import alias `@/*`.
  - `app/speaking/page.tsx` uses the MediaRecorder API and posts the blob via FormData. `app/listening/page.tsx` renders the audio player, countdown timer, and score card. Shared practice nav at `app/writing/task-nav.tsx` links Task 1 / Task 2 / Listening / Speaking.
- `.env.example` (root) — documents `GEMINI_API_KEY`; backend loads `backend/.env` via `python-dotenv`.

## Commands
- Backend: `uvicorn app.main:app --reload` (run from `backend/`)
- Frontend: `npm run dev` | `npm run build` | `npm run lint` (run from `frontend/`)

## Gotchas
- `frontend/.npmrc` must keep `allow-scripts=true`: the machine's global `~/.npmrc` sets `allow-scripts=opencode-ai`, which makes `npm install` fail with `EALLOWSCRIPTS` without it.
- Tailwind v4: no `tailwind.config`; theme is configured via `@theme` in `frontend/app/globals.css`.
- Repo is a fresh git repo (no commits). Remote: `origin` -> github.com/Prithivirajatgithub/ielts-band8-app.
