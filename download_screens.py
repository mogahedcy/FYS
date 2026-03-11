import json
import urllib.request
import os

json_file_path = r"C:\Users\mogahed\.gemini\antigravity\brain\78045020-631b-4449-9eb4-f765df4255c4\.system_generated\steps\28\output.txt"
output_dir = r"C:\Users\mogahed\Desktop\مشروع موقع\appdeyar\stitch_screens"

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

with open(json_file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

for i, screen in enumerate(data.get("screens", [])):
    title = screen.get("title", f"screen_{i}")
    # Sanitize title for filename
    safe_title = "".join([c for c in title if c.isalpha() or c.isdigit() or c==' ']).rstrip()
    safe_title = safe_title.replace(" ", "_")
    if not safe_title:
        safe_title = f"screen_{i}"
    
    html_url = screen.get("htmlCode", {}).get("downloadUrl")
    if html_url:
        print(f"Downloading {safe_title}.html...")
        try:
            req = urllib.request.Request(html_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                html_content = response.read().decode('utf-8')
                file_path = os.path.join(output_dir, f"{safe_title}.html")
                with open(file_path, "w", encoding="utf-8") as out_f:
                    out_f.write(html_content)
                print(f"Saved to {file_path}")
        except Exception as e:
            print(f"Failed to download {title}: {e}")
