import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.deps import get_current_user
from app.models import FocusSession, Task, TaskStatus, User
from app.schemas import TaskCreate, TaskOut, TaskUpdate
from app.services.productivity import score_task


router = APIRouter(prefix="/tasks", tags=["tasks"])


async def owned_task(task_id: uuid.UUID, user: User, db: AsyncSession) -> Task:
    result = await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user.id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    status: TaskStatus | None = None,
    tag: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Task).where(Task.user_id == user.id).order_by(Task.deadline.asc().nulls_last(), Task.ai_priority_score.desc())
    if status:
        query = query.where(Task.status == status)
    if tag:
        query = query.where(Task.tags.any(tag))
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TaskOut)
async def create_task(payload: TaskCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    task = Task(user_id=user.id, **payload.model_dump())
    scores = score_task(task)
    task.productivity_score = scores["productivity_score"]
    task.deep_work_score = scores["deep_work_score"]
    task.ai_priority_score = scores["ai_priority_score"]
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: uuid.UUID, payload: TaskUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    task = await owned_task(task_id, user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    scores = score_task(task)
    task.productivity_score = scores["productivity_score"]
    task.deep_work_score = scores["deep_work_score"]
    task.ai_priority_score = scores["ai_priority_score"]
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    task = await owned_task(task_id, user, db)
    await db.delete(task)
    await db.commit()


@router.post("/{task_id}/start", response_model=TaskOut)
async def start_task(task_id: uuid.UUID, pomodoro: bool = Query(False), db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    task = await owned_task(task_id, user, db)
    task.status = TaskStatus.in_progress
    task.start_time = datetime.now(timezone.utc)
    db.add(FocusSession(user_id=user.id, task_id=task.id, pomodoro=pomodoro))
    await db.commit()
    await db.refresh(task)
    return task


@router.post("/{task_id}/stop", response_model=TaskOut)
async def stop_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    task = await owned_task(task_id, user, db)
    now = datetime.now(timezone.utc)
    task.end_time = now
    if task.start_time:
        task.actual_minutes += max(round((now - task.start_time).total_seconds() / 60), 1)
    scores = score_task(task)
    task.productivity_score = scores["productivity_score"]
    task.deep_work_score = scores["deep_work_score"]
    task.ai_priority_score = scores["ai_priority_score"]
    await db.commit()
    await db.refresh(task)
    return task


@router.post("/{task_id}/done", response_model=TaskOut)
async def complete_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    task = await owned_task(task_id, user, db)
    task.status = TaskStatus.completed
    task.end_time = datetime.now(timezone.utc)
    scores = score_task(task)
    task.productivity_score = scores["productivity_score"]
    task.deep_work_score = scores["deep_work_score"]
    task.ai_priority_score = scores["ai_priority_score"]
    await db.commit()
    await db.refresh(task)
    return task
