import os
import openai
import zipfile
import json
import base64
from pathlib import Path

openai.api_key = os.getenv("OPENAI_API_KEY")

TAGS = {
    "1": "Natural landscape (no people)",
    "2": "People present",
    "2.1": "One person",
    "2.2": "Two people",
    "2.3": "More than two people",
    "2.4": "City scene",
    "2.5": "Natural landscape (place)",
    "2.6": "Food present",
    "3.0": "Indoor scene",
    "3.1": "Pets or animals",
    "3.2": "Nighttime or low-light photo",
    "3.3": "Group selfie or posed group photo",
    "3.4": "Artistic or abstract image",
    "3.5": "Text-heavy (signs, posters, menus)",
    "3.6": "Vehicles or transportation",
    "3.7": "Child or baby present",
    "3.8": "Celebration or event"
}

def classify_image_with_gpt(image_path):
    with open(image_path, "rb") as f:
        b64_image = base64.b64encode(f.read()).decode()

    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant that classifies images by tag codes."
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Given this image, which of the following category codes apply: {json.dumps(TAGS)}. Return only a JSON list of codes like [\"1\", \"2.4\"]."
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}
                    }
                ]
            }
        ]
    )

    try:
        return json.loads(response.choices[0].message.content.strip())
    except Exception:
        return []

def organize_and_zip(images_dir, selected_params, output_dir="output_zips"):
    os.makedirs(output_dir, exist_ok=True)
    buckets = {param: [] for param in selected_params}

    for image_path in Path(images_dir).glob("*"):
        tags = classify_image_with_gpt(image_path)
        print(f"{image_path.name} → {tags}")
        for param in selected_params:
            if param in tags:
                buckets[param].append(image_path)

    for param, files in buckets.items():
        if files:
            zip_path = Path(output_dir) / f"{param}.zip"
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for f in files:
                    zipf.write(f, arcname=f.name)
            print(f"Created zip: {zip_path} ({len(files)} files)")

if __name__ == "__main__":
    with open("selected_params.json") as f:
        selected_params = json.load(f)
    organize_and_zip("uploaded_images", selected_params)
