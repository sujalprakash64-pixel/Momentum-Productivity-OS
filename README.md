# Momentum Productivity OS

Full-stack AI-powered productivity web app with a Next.js dashboard, FastAPI backend, PostgreSQL, Redis, Celery scheduler, WebSockets, OpenAI integration points, and WhatsApp Cloud API or Twilio webhook handling.

The original `index.html` is preserved as a static prototype. The production-oriented scaffold lives in `frontend/` and `backend/`.

## Architecture

- `frontend/`: Next.js, React, TailwindCSS, ShadCN-style local primitives, FullCalendar, Recharts, responsive dark dashboard.
- `backend/`: FastAPI async API, JWT auth, SQLAlchemy async models, productivity scoring, OpenAI service, WhatsApp webhook, WebSocket endpoint.
- `postgres`: persistent task, user, idea, and focus-session storage.
- `redis`: broker and result backend for Celery.
- `worker`: background AI/reporting/reminder jobs.
- `beat`: scheduled 6 AM IST WhatsApp delivery.

## Core Data Model

`Task` includes title, description, estimated and actual time, start/end time, priority, deadline, tags, productivity score, completion status, notes, deep work score, recurrence rule, context switches, idle minutes, and AI priority score.

Other tables:

- `users`: auth profile, timezone, optional WhatsApp number.
- `ideas`: idea vault with impact, difficulty, interest, tags, and task conversion pointer.
- `focus_sessions`: timer and Pomodoro/deep-work tracking.

## API Design

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/{task_id}`
- `DELETE /api/tasks/{task_id}`
- `POST /api/tasks/{task_id}/start`
- `POST /api/tasks/{task_id}/stop`
- `POST /api/tasks/{task_id}/done`
- `GET /api/ideas`
- `POST /api/ideas`
- `POST /api/ideas/{idea_id}/convert`
- `GET /api/analytics`
- `POST /api/ai/optimize-schedule`
- `GET /api/ai/burnout`
- `GET /api/whatsapp/webhook`
- `POST /api/whatsapp/webhook`
- `WS /ws/{user_id}`

OpenAPI docs are available at `http://localhost:8000/api/docs`.

## WhatsApp Commands

The backend handles:

- `/today`: send today’s schedule, pending tasks, and scores.
- `/start <task>`: start timer by UUID or title search.
- `/stop`: stop active timer and calculate productivity.
- `/done <task_id>`: complete a task.
- `/add <task>`: create a quick task.
- `/move <task_id> <new_time>`: reschedule using ISO datetime.
- `/idea <text>`: save to idea vault.

At 6 AM IST, Celery Beat runs `send_daily_whatsapp_schedules` and sends pending tasks, deadlines, and AI reflection text to connected WhatsApp numbers.

## Productivity Algorithm

`backend/app/services/productivity.py` scores tasks using:

- planned vs actual time
- completion state
- focus duration
- idle gaps
- deadline adherence
- context switching frequency

It produces productivity score, deep work score, efficiency ratio, daily summaries, and deadline-aware AI priority score.

## Local Setup

1. Copy environment files:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

2. Start the full stack:

```bash
docker compose up --build
```

3. Open:

- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/api/docs`
- Health: `http://localhost:8000/health`

## Manual Development

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Worker:

```bash
cd backend
celery -A app.worker.celery_app worker --loglevel=info
celery -A app.worker.celery_app beat --loglevel=info
```

## Deployment Notes

- Frontend: deploy `frontend/` to Vercel with `NEXT_PUBLIC_API_URL`.
- Backend: deploy `backend/` Dockerfile to Railway, Render, Fly.io, or ECS.
- Database: use Neon, Supabase, RDS, or Railway PostgreSQL.
- Redis: use Upstash, Railway Redis, or ElastiCache.
- WhatsApp Cloud API: set `WHATSAPP_PROVIDER=cloud`, `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and webhook URL `/api/whatsapp/webhook`.
- Twilio WhatsApp: set `WHATSAPP_PROVIDER=twilio`, Twilio credentials, and configure the incoming message webhook.
- OpenAI: set `OPENAI_API_KEY` and `OPENAI_MODEL`.

## Implementation Plan

1. Create users, JWT auth, and WhatsApp number linking.
2. Store tasks, schedules, ideas, and focus sessions in PostgreSQL.
3. Use FullCalendar for drag-and-drop time blocks and day/week/month views.
4. Calculate productivity, deep-work, efficiency, and AI priority scores on task changes.
5. Use WebSockets for real-time task updates across dashboard and WhatsApp events.
6. Run Celery workers for reminders, summaries, AI optimization, and daily 6 AM IST messages.
7. Add OpenAI-powered schedule optimization, workload balancing, burnout detection, and reflections.
8. Deploy frontend, backend, worker, beat, database, Redis, and WhatsApp webhook.
