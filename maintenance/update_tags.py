
import json

file_path = r'c:\YOON\CSrepos\NewEventMap\eventmap-platform\frontend-web\src\mock_data.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The file is a JS module, so we need to extract the array part
prefix = "export const mockEvents = "
suffix = ";"

json_str = content.replace(prefix, "").strip()
if json_str.endswith(suffix):
    json_str = json_str[:-1].strip()

data = json.loads(json_str)

for event in data:
    if 'tags' in event:
        # Prefix each tag with @ if not already there
        event['tags'] = [f"@{t}" if not t.startswith("@") else t for t in event['tags']]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(prefix + json.dumps(data, indent=2, ensure_ascii=False) + suffix)

print("Successfully updated tags with @ prefix.")
