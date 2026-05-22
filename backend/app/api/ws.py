from fastapi import APIRouter, WebSocket, WebSocketDisconnect


router = APIRouter(tags=["websockets"])


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active.setdefault(user_id, []).append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active:
            self.active[user_id] = [item for item in self.active[user_id] if item is not websocket]

    async def broadcast(self, user_id: str, event: dict):
        for websocket in self.active.get(user_id, []):
            await websocket.send_json(event)


manager = ConnectionManager()


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    try:
        while True:
            message = await websocket.receive_json()
            await manager.broadcast(user_id, {"type": "echo", "payload": message})
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
