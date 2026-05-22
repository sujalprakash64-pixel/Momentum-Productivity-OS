from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.deps import get_current_user
from app.models import Task, TaskStatus, User
from app.schemas import AnalyticsOut
from app.services.ai import generate_reflection
from app.services.productivity import summarize_day


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsOut)
async def analytics(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(select(Task).where(Task.user_id == user.id, Task.created_at >= since))
    tasks = result.scalars().all()
    today_key = datetime.now(timezone.utc).date()
    today_tasks = [task for task in tasks if (task.deadline or task.created_at).date() == today_key]
    summary = summarize_day(today_tasks)

    reflection = await generate_reflection(
        summary,
        [{"title": task.title, "status": task.status.value, "score": task.productivity_score} for task in today_tasks],
    )

    daily = []
    for offset in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=offset)).date()
        day_tasks = [task for task in tasks if (task.deadline or task.created_at).date() == day]
        daily.append({"date": str(day), **summarize_day(day_tasks)})

    categories: dict[str, int] = {}
    for task in tasks:
        for tag in task.tags or ["uncategorized"]:
            categories[tag] = categories.get(tag, 0) + 1

    with_deadlines = [task for task in tasks if task.deadline and task.status == TaskStatus.completed and task.end_time]
    deadline_success = len([task for task in with_deadlines if task.end_time <= task.deadline]) / len(with_deadlines) * 100 if with_deadlines else 0

    return AnalyticsOut(
        daily_productivity=daily,
        weekly_focus_hours=[{"day": row["date"], "hours": round(row["focus_minutes"] / 60, 2)} for row in daily],
        task_completion_trends=[{"day": row["date"], "completed": row["completed_tasks"], "total": row["total_tasks"]} for row in daily],
        most_productive_hours=[
            {"hour": "09:00", "score": 87},
            {"hour": "10:00", "score": 92},
            {"hour": "15:00", "score": 75},
            {"hour": "20:00", "score": 58},
        ],
        category_distribution=[{"category": key, "count": value} for key, value in categories.items()],
        deadline_success_rate=round(deadline_success, 2),
        daily_summary=reflection["summary"],
        recommendations=reflection["recommendations"],
    )
