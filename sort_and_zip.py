import os
import json
import base64
import openai
from pathlib import Path
from zipfile import ZipFile

# Load API key securely from environment variable
openai.api_key = os.getenv("OPENAI_API_KEY")

# Define paths
UPLOAD_DIR = Path("uploaded_images")
ZIP_DIR = Path("output_zips")
PARAMS_FILE = Path("selected_params.json")

# Ensure output directory exists
ZIP_DIR.mkdir(exist_ok=True)

# Load selected categories
try:
    with open(PARAMS_FILE, "r", encoding="utf-8") as f:
        selected_categories = set(json.load(f))
except Exception as e:
    print(f"Error loading selected categories: {e}")
    selected_categories = set()

# Supported image types
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif"}

# Clean previous zips
for zip_file in ZIP_DIR.glob("*.zip"):
    zip_file.unlink()

# Function to classify image via GPT-4o Vision
def classify_image(filepath):
    with open(filepath, "rb") as img_file:
        base64_img = base64.b64encode(img_file.read()).decode("utf-8")
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a visual classifier. Use only the category codes."},
                {"role": "user", "content": f"Classify this image using the given taxonomy:\n\n{CATEGORY_PROMPT}"},
                {
                    "role": "user",
                    "content": {"image": {"base64": base64_img}, "type": "image_url"},
                },
            ],
            max_tokens=50,
        )
        result_text = response.choices[0].message["content"]
        detected = {code.strip() for code in result_text.split(",")}
        return detected
    except Exception as e:
        print(f"Failed to classify {filepath.name}: {e}")
        return set()

# GPT-4o will use this prompt to choose category codes
CATEGORY_PROMPT = """\
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
3.5 - Text-heavy image
3.6 - Vehicles or transportation
3.7 - Child or baby present
3.8 - Celebration or event
Only respond with applicable category codes, comma-separated. Example: 2.1, 3.3
"""

# Group images by tag
grouped_images = {cat: [] for cat in selected_categories}

# Process images
for image_path in UPLOAD_DIR.glob("*"):
    if image_path.suffix.lower() not in IMAGE_EXTS:
        continue
    matched_tags = classify_image(image_path)
    for tag in matched_tags:
        if tag in selected_categories:
            grouped_images[tag].append(image_path)

# Zip per category
for category, images in grouped_images.items():
    if not images:
        continue
    zip_path = ZIP_DIR / f"category_{category.replace('.', '_')}.zip"
    with ZipFile(zip_path, "w") as zipf:
        for img in images:
            zipf.write(img, img.name)

print("Sorting and zipping complete.")
