import asyncio
import websockets
import json
import time
import random

async def simulate_tourism_sync():
    uri = "ws://localhost:8080"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Simulating NewEventMap (Tourism Data Sync) Flow...")
            
            locations = [
                ("Seoul Tower", "37.551, 126.988", "South Korea"),
                ("Fukuoka Castle", "33.584, 130.383", "Japan"),
                ("Hokkaido Park", "43.064, 141.346", "Japan"),
                ("Gyeongbokgung Palace", "37.579, 126.977", "South Korea"),
                ("Tokyo Skytree", "35.710, 139.810", "Japan")
            ]

            while True:
                name, coords, country = random.choice(locations)
                
                # 1. API_SERVICE_PULL (TourAPI / Overpass Fetch)
                print(f"\n[FETCH] API Pulling: {name} ({country})")
                await websocket.send(json.dumps({"signal": "API_SERVICE_PULL", "text": f"{name} | {coords}"}))
                await asyncio.sleep(random.uniform(0.6, 1.2))
                
                # 2. SQL_DIFF_MERGE (SQLite Transaction / Google Drive Sync)
                print(f"[SQL] Merging Diff for {name}")
                await websocket.send(json.dumps({"signal": "SQL_DIFF_MERGE", "text": f"Diff ID: {random.randint(1000, 9999)}"}))
                await asyncio.sleep(random.uniform(0.4, 0.8))
                
                # 3. MAP_CLUSTER_RENDER (Geohash / Flutter UI Display)
                print(f"[RENDER] Clustering {name} on Map")
                await websocket.send(json.dumps({"signal": "MAP_CLUSTER_RENDER", "text": f"Z-Level: {random.randint(10, 18)}"}))
                
                # Wait before next sync event
                await asyncio.sleep(4.0)

    except Exception as e:
        print(f"Error: {e}. Ensure the C# Server is running on port 8080.")

if __name__ == "__main__":
    asyncio.run(simulate_tourism_sync())
