from datetime import datetime, timezone
from app.models import Task, TaskStatus


PRIORITY_WEIGHT = {"low": 0.15, "medium": 0.35, "high": 0.65, "urgent": 0.85}


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def score_task(task: Task) -> dict[str, float]:
    planned = max(task.estimated_minutes or 1, 1)
    actual = max(task.actual_minutes or 0, 0)
    idle_minutes = task.idle_minutes or 0
    context_switches = task.context_switches or 0
    efficiency = 100 if actual == 0 else clamp((planned / max(actual, 1)) * 100)
    completion = 100 if task.status == TaskStatus.completed else 45 if task.status == TaskStatus.in_progress else 15
    focus_duration = clamp((actual / 90) * 100)
    idle_penalty = clamp((idle_minutes / planned) * 40)
    switch_penalty = clamp(context_switches * 7)
    deadline_score = 70

    if task.deadline:
        now = datetime.now(timezone.utc)
        if task.status == TaskStatus.completed and task.end_time and task.end_time <= task.deadline:
            deadline_score = 100
        elif task.deadline < now and task.status != TaskStatus.completed:
            deadline_score = 15
        else:
            hours_left = max((task.deadline - now).total_seconds() / 3600, 0)
            deadline_score = clamp(35 + min(hours_left, 72) / 72 * 65)

    productivity_score = clamp(
        completion * 0.30
        + efficiency * 0.25
        + focus_duration * 0.20
        + deadline_score * 0.20
        - idle_penalty
        - switch_penalty
    )
    deep_work_score = clamp(focus_duration * 0.65 + (100 - switch_penalty) * 0.25 + (100 - idle_penalty) * 0.10)
    priority_score = calculate_priority_score(task)

    return {
        "productivity_score": round(productivity_score, 2),
        "deep_work_score": round(deep_work_score, 2),
        "ai_priority_score": round(priority_score, 2),
        "efficiency_ratio": round(actual / planned, 2) if planned else 0,
    }


def calculate_priority_score(task: Task) -> float:
    priority = PRIORITY_WEIGHT.get(str(task.priority.value if hasattr(task.priority, "value") else task.priority), 0.35) * 100
    deadline = 20
    if task.deadline:
        hours_left = (task.deadline - datetime.now(timezone.utc)).total_seconds() / 3600
        deadline = 100 if hours_left < 12 else 80 if hours_left < 24 else 60 if hours_left < 72 else 30
    effort = clamp((task.estimated_minutes / 180) * 100)
    overdue_boost = 25 if task.deadline and task.deadline < datetime.now(timezone.utc) else 0
    return clamp(priority * 0.45 + deadline * 0.40 + effort * 0.15 + overdue_boost)


def summarize_day(tasks: list[Task]) -> dict:
    total = len(tasks)
    completed = len([task for task in tasks if task.status == TaskStatus.completed])
    focus_minutes = sum(task.actual_minutes for task in tasks)
    avg_productivity = round(sum(task.productivity_score for task in tasks) / total, 2) if total else 0
    deep_work = round(sum(task.deep_work_score for task in tasks) / total, 2) if total else 0
    completion_rate = round((completed / total) * 100, 2) if total else 0
    return {
        "total_tasks": total,
        "completed_tasks": completed,
        "completion_rate": completion_rate,
        "focus_minutes": focus_minutes,
        "productivity_score": avg_productivity,
        "deep_work_score": deep_work,
    }
