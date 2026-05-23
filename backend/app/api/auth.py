import random
import re
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.deps import get_current_user
from app.models import OtpPurpose, User, WhatsAppOtp
from app.schemas import LoginIn, TokenOut, UserCreate, UserOut, WhatsAppOtpRequest, WhatsAppOtpRequestOut, WhatsAppOtpVerify, WhatsAppTokenOut
from app.services.whatsapp import send_whatsapp_message


router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def normalize_whatsapp_number(value: str) -> str:
    cleaned = re.sub(r"[^\d+]", "", value.strip())
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    if not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    if len(re.sub(r"\D", "", cleaned)) < 8:
        raise HTTPException(status_code=422, detail="Enter a valid WhatsApp number with country code")
    return cleaned


def local_email_for_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    return f"wa{digits}@momentumapp.com"


@router.post("/register", response_model=TokenOut)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=payload.email,
        name=payload.name,
        hashed_password=hash_password(payload.password),
        whatsapp_number=payload.whatsapp_number,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenOut(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenOut(access_token=create_access_token(str(user.id)))


@router.post("/whatsapp/request-otp", response_model=WhatsAppOtpRequestOut)
async def request_whatsapp_otp(payload: WhatsAppOtpRequest, db: AsyncSession = Depends(get_db)):
    phone = normalize_whatsapp_number(payload.whatsapp_number)
    otp = f"{random.SystemRandom().randint(0, 999999):06d}"
    otp_row = WhatsAppOtp(
        whatsapp_number=phone,
        otp_hash=hash_password(otp),
        purpose=OtpPurpose.login,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(otp_row)
    await db.commit()

    await send_whatsapp_message(
        phone,
        f"Your Momentum login OTP is {otp}. It expires in 10 minutes. Do not share it with anyone.",
    )
    return WhatsAppOtpRequestOut(
        message="OTP sent to WhatsApp.",
        dev_otp=otp if settings.environment != "production" and not settings.whatsapp_cloud_token and not settings.twilio_auth_token else None,
    )


@router.post("/whatsapp/verify", response_model=WhatsAppTokenOut)
async def verify_whatsapp_otp(payload: WhatsAppOtpVerify, db: AsyncSession = Depends(get_db)):
    phone = normalize_whatsapp_number(payload.whatsapp_number)
    result = await db.execute(
        select(WhatsAppOtp)
        .where(
            WhatsAppOtp.whatsapp_number == phone,
            WhatsAppOtp.purpose == OtpPurpose.login,
            WhatsAppOtp.consumed_at.is_(None),
            WhatsAppOtp.expires_at > datetime.now(timezone.utc),
        )
        .order_by(WhatsAppOtp.created_at.desc())
    )
    otp_row = result.scalars().first()
    if not otp_row:
        raise HTTPException(status_code=400, detail="OTP expired or not found")
    if otp_row.attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many OTP attempts")
    if not verify_password(payload.otp, otp_row.otp_hash):
        otp_row.attempts += 1
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user_result = await db.execute(select(User).where(User.whatsapp_number == phone))
    user = user_result.scalar_one_or_none()
    if not user:
        user = User(
            email=local_email_for_phone(phone),
            name=payload.name or f"User {phone[-4:]}",
            hashed_password=hash_password(f"whatsapp:{phone}:{random.random()}"),
            whatsapp_number=phone,
        )
        db.add(user)
        await db.flush()
    elif payload.name and user.name.startswith("User "):
        user.name = payload.name

    otp_row.consumed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    await send_whatsapp_message(phone, "You are signed in to Momentum. Task updates will be sent here.")
    return WhatsAppTokenOut(access_token=create_access_token(str(user.id)), user=user)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
