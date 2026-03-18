import asyncio
import websockets
import json

async def test_ai():
    uri = "ws://localhost:8080/"
    try:
        async with websockets.connect(uri) as websocket:
            print("🔗 Connected to C# Server")
            
            # 1. AI Query Test
            query = {
                "type": "AI_QUERY",
                "data": {"text": "서울의 유명한 축제 추천해줘"}
            }
            print(f"📤 Sending AI Query: {query['data']['text']}")
            await websocket.send(json.dumps(query))
            
            response = await websocket.recv()
            print(f"📥 Received from Server: {response}")
            
            # 2. Sync Packet Test
            sync = {
                "type": "SYNC_EVENT",
                "data": {"id": "test-123", "title": "Test Event"}
            }
            print(f"📤 Sending Sync Packet: {sync['data']['id']}")
            await websocket.send(json.dumps(sync))
            
            ack = await websocket.recv()
            print(f"📥 Received ACK: {ack}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ai())
