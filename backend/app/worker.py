import asyncio
from datetime import datetime, timezone
from celery import Celery
from celery.schedules import crontab
from sqlalchemy import select
from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models import Task, TaskStatus, User
from app.services.ai import generate_reflection
from app.services.productivity import summarize_day
from app.services.whatsapp import send_whatsapp_message


settings = get_settings()
celery_app = Celery("momentum", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.timezone = "Asia/Kolkata"
celery_app.conf.beat_schedule = {
    "send-daily-whatsapp-schedules-6am-ist": {
        "task": "app.worker.send_daily_whatsapp_schedules",
        "schedule": crontab(hour=6, minute=0),
    },
}


@celery_app.task(name="app.worker.send_daily_whatsapp_schedules")
def send_daily_whatsapp_schedules():
    asyncio.run(_send_daily_whatsapp_schedules())


async def _send_daily_whatsapp_schedules():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User).where(User.whatsapp_number.is_not(None)))).scalars().all()
        today = datetime.now(timezone.utc).date()
        for user in users:
            result = await db.execute(select(Task).where(Task.user_id == user.id).order_by(Task.ai_priority_score.desc()))
            tasks = [task for task in result.scalars().all() if task.deadline is None or task.deadline.date() == today]
            pending = [task for task in tasks if task.status != TaskStatus.completed]
            summary = summarize_day(tasks)
            reflection = await generate_reflection(summary, [{"title": task.title, "status": task.status.value} for task in tasks])
            lines = [
                f"Good morning, {user.name}.",
                f"Today: {len(pending)} pending, {summary['completion_rate']}% complete.",
                "",
                "Top priorities:",
                *[f"- {task.title} ({round(task.ai_priority_score)}/100)" for task in pending[:5]],
                "",
                reflection["summary"],
            ]
            await send_whatsapp_message(user.whatsapp_number, "\n".join(lines))
