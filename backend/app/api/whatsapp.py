import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Idea, Task, TaskStatus, User
from app.services.productivity import score_task
from app.services.whatsapp import send_whatsapp_message


router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
settings = get_settings()


@router.get("/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == settings.whatsapp_verify_token:
        return Response(content=params.get("hub.challenge", ""), media_type="text/plain")
    return Response(status_code=403)


@router.post("/webhook")
async def receive_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    messages = _extract_messages(payload)
    for from_number, text in messages:
        user = await _user_by_whatsapp(db, from_number)
        if not user:
            await send_whatsapp_message(from_number, "Connect your WhatsApp number in Momentum first.")
            continue
        response = await process_command(db, user, text)
        await send_whatsapp_message(from_number, response)
    return {"ok": True}


def _extract_messages(payload: dict) -> list[tuple[str, str]]:
    items = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for message in change.get("value", {}).get("messages", []):
                text = message.get("text", {}).get("body")
                if text:
                    items.append((message.get("from", ""), text.strip()))
    if "Body" in payload and "From" in payload:
        items.append((payload["From"], payload["Body"].strip()))
    return items


async def _user_by_whatsapp(db: AsyncSession, number: str) -> User | None:
    clean = number.replace("whatsapp:", "")
    result = await db.execute(select(User).where((User.whatsapp_number == clean) | (User.whatsapp_number == f"whatsapp:{clean}")))
    return result.scalar_one_or_none()


async def process_command(db: AsyncSession, user: User, text: str) -> str:
    parts = text.strip().split()
    command = parts[0].lower() if parts else ""
    args = text[len(parts[0]) :].strip() if parts else ""

    if command == "/today":
        result = await db.execute(select(Task).where(Task.user_id == user.id).order_by(Task.ai_priority_score.desc()))
        tasks = [task for task in result.scalars().all() if task.deadline is None or task.deadline.date() == datetime.now(timezone.utc).date()]
        lines = [f"Today: {len([t for t in tasks if t.status == TaskStatus.completed])}/{len(tasks)} complete"]
        lines += [f"{'✓' if task.status == TaskStatus.completed else '□'} {task.title} [{round(task.ai_priority_score)}]" for task in tasks[:12]]
        return "\n".join(lines)

    if command == "/add" and args:
        task = Task(user_id=user.id, title=args, estimated_minutes=30, tags=["whatsapp"])
        scores = score_task(task)
        task.productivity_score = scores["productivity_score"]
        task.deep_work_score = scores["deep_work_score"]
        task.ai_priority_score = scores["ai_priority_score"]
        db.add(task)
        await db.commit()
        return f"Added task {task.title}. ID: {str(task.id)[:8]}"

    if command == "/start" and args:
        task = await _find_task(db, user, args)
        if not task:
            return "Task not found."
        task.status = TaskStatus.in_progress
        task.start_time = datetime.now(timezone.utc)
        await db.commit()
        return f"Started timer for {task.title}."

    if command == "/stop":
        result = await db.execute(select(Task).where(Task.user_id == user.id, Task.status == TaskStatus.in_progress))
        task = result.scalars().first()
        if not task:
            return "No active timer."
        now = datetime.now(timezone.utc)
        task.end_time = now
        if task.start_time:
            task.actual_minutes += max(round((now - task.start_time).total_seconds() / 60), 1)
        scores = score_task(task)
        task.productivity_score = scores["productivity_score"]
        task.deep_work_score = scores["deep_work_score"]
        task.ai_priority_score = scores["ai_priority_score"]
        await db.commit()
        return f"Stopped {task.title}. Productivity: {task.productivity_score}/100, deep work: {task.deep_work_score}/100."

    if command == "/done" and args:
        task = await _find_task(db, user, args)
        if not task:
            return "Task not found."
        task.status = TaskStatus.completed
        task.end_time = datetime.now(timezone.utc)
        scores = score_task(task)
        task.productivity_score = scores["productivity_score"]
        task.deep_work_score = scores["deep_work_score"]
        task.ai_priority_score = scores["ai_priority_score"]
        await db.commit()
        return f"Marked complete: {task.title}"

    if command == "/move" and len(parts) >= 3:
        task = await _find_task(db, user, parts[1])
        if not task:
            return "Task not found."
        task.start_time = datetime.fromisoformat(parts[2])
        await db.commit()
        return f"Moved {task.title} to {task.start_time.isoformat()}."

    if command == "/idea" and args:
        db.add(Idea(user_id=user.id, title=args[:120], description=args, tags=["whatsapp"]))
        await db.commit()
        return "Saved to idea vault."

    return "Commands: /today, /start <task>, /stop, /done <id>, /add <task>, /move <id> <ISO time>, /idea <text>"


async def _find_task(db: AsyncSession, user: User, lookup: str) -> Task | None:
    try:
        task_id = uuid.UUID(lookup)
        result = await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user.id))
        return result.scalar_one_or_none()
    except ValueError:
        result = await db.execute(select(Task).where(Task.user_id == user.id, Task.title.ilike(f"%{lookup}%")))
        return result.scalars().first()
