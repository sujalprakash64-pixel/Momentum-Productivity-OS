from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.deps import get_current_user
from app.models import Task, TaskStatus, User
from app.services.ai import optimize_schedule
from app.services.productivity import summarize_day


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/optimize-schedule")
async def optimize(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Task).where(Task.user_id == user.id, Task.status != TaskStatus.completed))
    tasks = result.scalars().all()
    payload = [
        {
            "id": str(task.id),
            "title": task.title,
            "estimated_minutes": task.estimated_minutes,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "ai_priority_score": task.ai_priority_score,
        }
        for task in tasks
    ]
    return {"optimized": await optimize_schedule(payload)}


@router.get("/burnout")
async def burnout(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Task).where(Task.user_id == user.id))
    tasks = result.scalars().all()
    summary = summarize_day(tasks[-20:])
    workload = min(100, summary["focus_minutes"] / 360 * 100)
    risk = "high" if workload > 85 and summary["deep_work_score"] < 45 else "medium" if workload > 65 else "low"
    return {
        "risk": risk,
        "workload_balance": round(workload, 2),
        "recovery_recommendation": "Leave a 30 minute buffer between demanding tasks and stop scheduling deep work after 7 PM.",
    }
