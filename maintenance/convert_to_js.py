
import json
import os

mock_json = r'c:\YOON\CSrepos\NewEventMap\mock_events.json'
mock_js = r'c:\YOON\CSrepos\NewEventMap\eventmap-platform\frontend-web\src\mock_data.js'

if os.path.exists(mock_json):
    with open(mock_json, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    with open(mock_js, 'w', encoding='utf-8') as f:
        f.write('export const mockEvents = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';')
    print("Successfully converted to UTF-8 JS module.")
else:
    print("Source JSON not found.")
