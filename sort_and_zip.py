#!/usr/bin/env python3
import os
import sys
import json
import base64
import zipfile
import requests
from pathlib import Path
from typing import List, Dict, Any

# Constants
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o"

# Category definitions
CATEGORY_NAMES = {
    "1": "Natural Landscape (No People)",
    "2.1": "One Person",
    "2.2": "Two People",
    "2.3": "More than Two People",
    "2.4": "City Scene",
    "2.5": "Natural Landscape with People",
    "2.6": "Food Present",
    "3.0": "Indoor Scene",
    "3.1": "Pets or Animals",
    "3.2": "Nighttime or Low-light",
    "3.3": "Group Selfie or Posed Group",
    "3.4": "Artistic or Abstract Image",
    "3.5": "Text-heavy Image",
    "3.6": "Vehicles or Transportation",
    "3.7": "Child or Baby Present",
    "3.8": "Celebration or Event"
}

def read_image_to_base64(image_path: str) -> str:
    """Convert an image file to base64 encoding."""
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        print(f"Error reading image {image_path}: {str(e)}")
        return None

def classify_image(api_key: str, base64_image: str, image_name: str) -> List[str]:
    """Classify an image using OpenAI's GPT-4o Vision API."""
    if not base64_image or not api_key:
        return []
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": """You are an image classification assistant. You'll be provided with an image, and your task is to classify it according to these categories:
                1    - Natural landscape (no people)
                2.1  - One person
                2.2  - Two people
                2.3  - More than two people
                2.4  - City scene
                2.5  - Natural landscape (with people)
                2.6  - Food present
                3.0  - Indoor scene
                3.1  - Pets or animals
                3.2  - Nighttime or low-light
                3.3  - Group selfie or posed group
                3.4  - Artistic or abstract image
                3.5  - Text-heavy image (e.g. signs, menus)
                3.6  - Vehicles or transportation
                3.7  - Child or baby present
                3.8  - Celebration or event
                
                Respond ONLY with the applicable category codes, separated by commas. For example: "1,3.2" or "2.1,3.0,3.4"
                Multiple categories can apply to a single image. Be specific and accurate."""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Please classify this image ({image_name}):"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 100
    }
    
    try:
        response = requests.post(OPENAI_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        
        if "choices" in result and len(result["choices"]) > 0:
            categories_text = result["choices"][0]["message"]["content"].strip()
            categories = [cat.strip() for cat in categories_text.split(',')]
            return categories
        else:
            print(f"Unexpected API response format for {image_name}")
            return []
    except Exception as e:
        print(f"Error classifying image {image_name}: {str(e)}")
        return []

def create_zip_for_category(category: str, images: List[str], image_dir: Path, output_dir: Path) -> str:
    """Create a zip file for a category containing matching images."""
    if not images:
        print(f"No images for category {category}, skipping")
        return None
    
    category_name = CATEGORY_NAMES.get(category, f"Category {category}")
    safe_name = category.replace('.', '_')
    zip_filename = f"{safe_name}_{category_name.replace(' ', '_').lower()}.zip"
    zip_path = output_dir / zip_filename
    
    print(f"Creating zip for {category} ({category_name}) with {len(images)} images: {zip_filename}")
    
    try:
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for image in images:
                image_path = image_dir / image
                if image_path.exists():
                    zipf.write(image_path, arcname=image)
                else:
                    print(f"Warning: Image {image} not found")
        
        return zip_filename
    except Exception as e:
        print(f"Error creating zip for category {category}: {str(e)}")
        return None

def main():
    """Main function to sort images and create zip files."""
    # Set up paths
    base_dir = Path(os.environ.get("BASE_DIR", "."))
    uploads_dir = Path(os.environ.get("UPLOADS_DIR", base_dir / "uploaded_images"))
    output_dir = Path(os.environ.get("OUTPUT_DIR", base_dir / "output_zips"))
    params_file = Path(os.environ.get("PARAMS_FILE", base_dir / "selected_params.json"))
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Get OpenAI API Key
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set")
        sys.exit(1)
    
    # Read selected categories
    selected_categories = []
    try:
        if params_file.exists():
            with open(params_file, 'r') as f:
                params = json.load(f)
                selected_categories = params.get("categories", [])
        
        if not selected_categories:
            # If no specific categories selected, use all
            selected_categories = list(CATEGORY_NAMES.keys())
            
        print(f"Selected categories: {selected_categories}")
    except Exception as e:
        print(f"Error reading parameters file: {str(e)}")
        sys.exit(1)
    
    # Check if uploads directory exists
    if not uploads_dir.exists() or not uploads_dir.is_dir():
        print(f"Error: Uploads directory {uploads_dir} does not exist")
        sys.exit(1)
    
    # Get list of image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp'}
    image_files = [f.name for f in uploads_dir.iterdir() 
                  if f.is_file() and f.suffix.lower() in image_extensions]
    
    if not image_files:
        print("No image files found in uploads directory")
        sys.exit(0)
    
    print(f"Found {len(image_files)} image files")
    
    # Process images
    categorized_images = {category: [] for category in selected_categories}
    
    for image_file in image_files:
        image_path = uploads_dir / image_file
        print(f"Processing {image_file}...")
        
        # Convert image to base64
        base64_image = read_image_to_base64(str(image_path))
        if not base64_image:
            continue
        
        # Classify the image
        categories = classify_image(api_key, base64_image, image_file)
        print(f"Image {image_file} classified as: {', '.join(categories)}")
        
        # Add image to its categories
        for category in categories:
            if category in selected_categories:
                categorized_images[category].append(image_file)
    
    # Create zip files for each category
    zip_files = []
    for category, images in categorized_images.items():
        zip_filename = create_zip_for_category(category, images, uploads_dir, output_dir)
        if zip_filename:
            zip_files.append({
                "category": category,
                "name": CATEGORY_NAMES.get(category, f"Category {category}"),
                "filename": zip_filename,
                "image_count": len(images)
            })
    
    # Write results to a JSON file
    results_file = output_dir / "results.json"
    with open(results_file, 'w') as f:
        json.dump({
            "success": True,
            "total_images": len(image_files),
            "zip_files": zip_files
        }, f)
    
    print(f"Processing complete. Created {len(zip_files)} zip files.")

if __name__ == "__main__":
    main()
