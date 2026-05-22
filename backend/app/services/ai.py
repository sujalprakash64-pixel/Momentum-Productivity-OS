from openai import AsyncOpenAI
from app.core.config import get_settings


settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None


async def generate_reflection(summary: dict, tasks: list[dict]) -> dict:
    fallback = {
        "summary": (
            f"You completed {summary.get('completed_tasks', 0)} of {summary.get('total_tasks', 0)} tasks "
            f"with a {summary.get('productivity_score', 0)} productivity score."
        ),
        "recommendations": [
            "Protect your highest-energy hours for deep work.",
            "Move overdue work into a concrete time block.",
            "Batch shallow tasks to reduce context switching.",
        ],
    }
    if not client:
        return fallback

    prompt = {
        "summary": summary,
        "tasks": tasks[:20],
        "instruction": "Return compact JSON with keys summary and recommendations for a productivity dashboard.",
    }
    try:
        response = await client.responses.create(
            model=settings.openai_model,
            input=f"Generate a concise productivity reflection as JSON: {prompt}",
        )
        text = response.output_text.strip()
        return {"summary": text, "recommendations": fallback["recommendations"]}
    except Exception:
        return fallback


async def optimize_schedule(tasks: list[dict]) -> list[dict]:
    if not client:
        return sorted(tasks, key=lambda task: task.get("ai_priority_score", 0), reverse=True)
    response = await client.responses.create(
        model=settings.openai_model,
        input=f"Optimize this task schedule. Return a compact JSON array with task id, reason, suggested_start: {tasks}",
    )
    return [{"raw": response.output_text}]
