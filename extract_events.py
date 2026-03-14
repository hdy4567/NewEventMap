
import re
import json

def parse_dart_mock_data(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex-based extraction
    events = []
    # Find EventItem blocks
    event_blocks = re.findall(r'EventItem\(\s*(.*?)\s*\),', content, re.DOTALL)
    
    for block in event_blocks:
        event = {}
        # Extract id
        id_match = re.search(r'id:\s*(\d+)', block)
        if id_match: event['id'] = int(id_match.group(1))
        
        # Extract title
        title_match = re.search(r'title:\s*"(.*?)"', block)
        if title_match: event['title'] = title_match.group(1)
        
        # Extract lat/lng
        lat_match = re.search(r'lat:\s*([\d.-]+)', block)
        lng_match = re.search(r'lng:\s*([\d.-]+)', block)
        if lat_match: event['lat'] = float(lat_match.group(1))
        if lng_match: event['lng'] = float(lng_match.group(1))
        
        # Extract country
        country_match = re.search(r'country:\s*"(.*?)"', block)
        if country_match: event['country'] = country_match.group(1)
        
        # Extract region
        region_match = re.search(r'region:\s*"(.*?)"', block)
        if region_match: event['region'] = region_match.group(1)
        
        # Extract tags
        tags_match = re.search(r'tags:\s*\[(.*?)\]', block, re.DOTALL)
        if tags_match:
            tags_str = tags_match.group(1)
            event['tags'] = [t.strip().strip('"').strip("'") for t in tags_str.split(',') if t.strip()]
        
        # Extract imageUrl
        img_match = re.search(r'imageUrl:\s*"(.*?)"', block)
        if img_match: event['imageUrl'] = img_match.group(1)
        else: event['imageUrl'] = "https://picsum.photos/id/10/400/300" # fallback
        
        events.append(event)
    
    return events

if __name__ == "__main__":
    data = parse_dart_mock_data(r'c:\YOON\CSrepos\NewEventMap\eventmap_flutter\lib\repository\mock_data.dart')
    print(json.dumps(data, indent=2, ensure_ascii=False))
