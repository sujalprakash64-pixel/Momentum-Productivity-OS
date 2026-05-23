from datetime import datetime
from app.models import Task, User
from app.services.whatsapp import send_whatsapp_message


def _format_task(task: Task) -> str:
    deadline = task.deadline.strftime("%b %d, %I:%M %p") if task.deadline else "No deadline"
    return f"{task.title}\nPriority: {task.priority.value}\nDeadline: {deadline}\nAI priority: {round(task.ai_priority_score)}/100"


async def notify_task_created(user: User, task: Task) -> None:
    await _notify(user, f"Task added:\n{_format_task(task)}")


async def notify_task_updated(user: User, task: Task) -> None:
    await _notify(user, f"Task updated:\n{_format_task(task)}")


async def notify_task_deleted(user: User, title: str) -> None:
    await _notify(user, f"Task deleted:\n{title}")


async def notify_task_started(user: User, task: Task) -> None:
    now = datetime.now().strftime("%I:%M %p")
    await _notify(user, f"Focus timer started at {now}:\n{task.title}")


async def notify_task_stopped(user: User, task: Task) -> None:
    await _notify(
        user,
        f"Timer stopped:\n{task.title}\nActual time: {task.actual_minutes} min\nProductivity: {round(task.productivity_score)}/100\nDeep work: {round(task.deep_work_score)}/100",
    )


async def notify_task_completed(user: User, task: Task) -> None:
    await _notify(user, f"Task complete:\n{task.title}\nProductivity: {round(task.productivity_score)}/100")


async def _notify(user: User, message: str) -> None:
    if user.whatsapp_number:
        await send_whatsapp_message(user.whatsapp_number, f"Momentum update\n\n{message}")
