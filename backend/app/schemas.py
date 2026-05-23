import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models import Priority, TaskStatus


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=8)
    whatsapp_number: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    whatsapp_number: str | None = None
    timezone: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class WhatsAppOtpRequest(BaseModel):
    whatsapp_number: str = Field(min_length=8, max_length=40)
    name: str | None = Field(default=None, max_length=120)


class WhatsAppOtpRequestOut(BaseModel):
    message: str
    dev_otp: str | None = None


class WhatsAppOtpVerify(BaseModel):
    whatsapp_number: str = Field(min_length=8, max_length=40)
    otp: str = Field(min_length=4, max_length=8)
    name: str | None = Field(default=None, max_length=120)


class WhatsAppTokenOut(TokenOut):
    user: UserOut


class TaskBase(BaseModel):
    title: str
    description: str = ""
    estimated_minutes: int = 30
    actual_minutes: int = 0
    start_time: datetime | None = None
    end_time: datetime | None = None
    priority: Priority = Priority.medium
    deadline: datetime | None = None
    tags: list[str] = []
    notes: str = ""
    recurrence_rule: str | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    estimated_minutes: int | None = None
    actual_minutes: int | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    priority: Priority | None = None
    deadline: datetime | None = None
    tags: list[str] | None = None
    notes: str | None = None
    recurrence_rule: str | None = None
    status: TaskStatus | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: TaskStatus
    productivity_score: float
    deep_work_score: float
    ai_priority_score: float
    context_switches: int
    idle_minutes: int
    created_at: datetime
    updated_at: datetime


class IdeaCreate(BaseModel):
    title: str
    description: str = ""
    impact: int = Field(default=3, ge=1, le=5)
    difficulty: int = Field(default=3, ge=1, le=5)
    interest: int = Field(default=3, ge=1, le=5)
    tags: list[str] = []


class IdeaOut(IdeaCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    converted_task_id: uuid.UUID | None = None
    created_at: datetime


class AnalyticsOut(BaseModel):
    daily_productivity: list[dict]
    weekly_focus_hours: list[dict]
    task_completion_trends: list[dict]
    most_productive_hours: list[dict]
    category_distribution: list[dict]
    deadline_success_rate: float
    daily_summary: str
    recommendations: list[str]
