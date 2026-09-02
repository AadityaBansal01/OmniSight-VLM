"""
WebSocket connection manager for broadcasting real-time pipeline progress.
"""
import json
from typing import List

from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts messages."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        """Send JSON data to all connected clients."""
        dead_connections = []
        message = json.dumps(data)
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                dead_connections.append(connection)
        # Clean up dead connections
        for conn in dead_connections:
            self.disconnect(conn)

    def broadcast_sync(self, data: dict):
        """
        Synchronous broadcast helper for use in background threads.
        Creates a new event loop to push the async broadcast.
        """
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self.broadcast(data))
            else:
                loop.run_until_complete(self.broadcast(data))
        except RuntimeError:
            # No event loop in this thread — create one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.broadcast(data))


# Global singleton
ws_manager = ConnectionManager()
