import os
import json
import base64
import zipfile
import requests
from pathlib import Path
from PIL import Image

# Load OpenAI API key from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
API_URL = "https://api.openai.com/v1/chat/completions"

# Set paths
UPLOAD_DIR = Path("uploaded_images")
OUTPUT_DIR = Path("output_zips")
PARAMS_FILE = Path("selected_params.json")

# Ensure output directory exists
OUTPUT_DIR.mkdir(exist_ok=True)

# Load selected tags
with open(PARAMS_FILE, "r") as f:
    selected_tags = json.load(f)

# Define GPT prompt template
PROMPT_TEMPLATE = """
You are a visual classifier. Given an image, classify it according to this controlled vocabulary (return all that apply):

1 - Natural landscape (no people)
2 - People present
2.1 - One person
2.2 - Two people
2.3 - More than two people
2.4 - City scene
2.5 - Natural landscape (with people)
2.6 - Food present
3.0 - Indoor scene
3.1 - Pets or animals
3.2 - Nighttime or low-light
3.3 - Group selfie or posed group
3.4 - Artistic or abstract image
3.5 - Text-heavy image (e.g. signs, menus)
3.6 - Vehicles or transportation
3.7 - Child or baby present
3.8 - Celebration or event

Respond with a JSON list of applicable codes.
"""

def classify_image_b64(image_b64):
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": PROMPT_TEMPLATE},
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
            ]}
        ],
        "max_tokens": 200
    }
    response = requests.post(API_URL, json=body, headers=headers)
    if response.status_code == 200:
        try:
            text = response.json()['choices'][0]['message']['content']
            return json.loads(text)
        except Exception:
            return []
    return []

def encode_image(image_path):
    try:
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            buffer = Path("temp.jpg")
            img.save(buffer, format="JPEG")
            encoded = base64.b64encode(buffer.read_bytes()).decode('utf-8')
            buffer.unlink()
            return encoded
    except Exception:
        return None

# Prepare zip grouping
grouped = {tag: [] for tag in selected_tags}

# Process each image
for image_file in UPLOAD_DIR.iterdir():
    if not image_file.suffix.lower() in {".jpg", ".jpeg", ".png"}:
        continue
    image_b64 = encode_image(image_file)
    if not image_b64:
        continue
    categories = classify_image_b64(image_b64)
    for tag in selected_tags:
        if tag in categories:
            grouped[tag].append(image_file)

# Create zip files
for tag, files in grouped.items():
    if not files:
        continue
    zip_path = OUTPUT_DIR / f"{tag.replace('.', '-')}.zip"
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for f in files:
            zipf.write(f, arcname=f.name)