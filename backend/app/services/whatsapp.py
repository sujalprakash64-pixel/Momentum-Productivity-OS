import httpx
from app.core.config import get_settings


settings = get_settings()


async def send_whatsapp_message(to_number: str, message: str) -> None:
    if not to_number:
        return
    if settings.whatsapp_provider == "twilio":
        await _send_twilio(to_number, message)
    else:
        await _send_cloud(to_number, message)


async def _send_cloud(to_number: str, message: str) -> None:
    if not settings.whatsapp_cloud_token or not settings.whatsapp_phone_number_id:
        return
    url = f"https://graph.facebook.com/v20.0/{settings.whatsapp_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number.replace("whatsapp:", ""),
        "type": "text",
        "text": {"preview_url": False, "body": message},
    }
    headers = {"Authorization": f"Bearer {settings.whatsapp_cloud_token}"}
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(url, json=payload, headers=headers)


async def _send_twilio(to_number: str, message: str) -> None:
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        return
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    data = {"From": settings.twilio_from, "To": to_number, "Body": message}
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(url, data=data, auth=(settings.twilio_account_sid, settings.twilio_auth_token))
