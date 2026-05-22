import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.deps import get_current_user
from app.models import Idea, Task, User
from app.schemas import IdeaCreate, IdeaOut, TaskOut
from app.services.productivity import score_task


router = APIRouter(prefix="/ideas", tags=["ideas"])


@router.get("", response_model=list[IdeaOut])
async def list_ideas(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Idea).where(Idea.user_id == user.id).order_by((Idea.impact + Idea.interest - Idea.difficulty).desc()))
    return result.scalars().all()


@router.post("", response_model=IdeaOut)
async def create_idea(payload: IdeaCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    idea = Idea(user_id=user.id, **payload.model_dump())
    db.add(idea)
    await db.commit()
    await db.refresh(idea)
    return idea


@router.post("/{idea_id}/convert", response_model=TaskOut)
async def convert_idea(idea_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Idea).where(Idea.id == idea_id, Idea.user_id == user.id))
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    task = Task(
        user_id=user.id,
        title=f"Validate: {idea.title}",
        description=idea.description,
        tags=idea.tags + ["idea-vault"],
        estimated_minutes=90,
    )
    scores = score_task(task)
    task.productivity_score = scores["productivity_score"]
    task.deep_work_score = scores["deep_work_score"]
    task.ai_priority_score = scores["ai_priority_score"]
    db.add(task)
    await db.flush()
    idea.converted_task_id = task.id
    await db.commit()
    await db.refresh(task)
    return task
