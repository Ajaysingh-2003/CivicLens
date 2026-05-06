import io
from PIL import Image
import torch
import requests
from transformers import pipeline
from typing import List

# We initialize this globally so the model is only loaded into memory ONCE
# when the application starts up, preventing huge latency on each request.
print("Loading CLIP Model into memory... This might take a few seconds.")
# Using clip-vit-base-patch32, which is a good balance of speed and accuracy
clip_classifier = pipeline(
    task="zero-shot-image-classification", 
    model="openai/clip-vit-base-patch32",
    device=0 if torch.cuda.is_available() else -1
)
print("CLIP Model Loaded successfully!")

def classify_image(image_bytes: bytes, categories: List[str]) -> str:
    """
    Given raw image bytes and a list of category names (e.g. ['Pothole', 'Graffiti']),
    it will format the candidate labels and return the single highest matching category name.
    """
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # We prefix the categories with a contextual prompt for better accuracy
    candidate_labels = [f"A photo of a {cat}" for cat in categories]
    
    results = clip_classifier(image, candidate_labels=candidate_labels)
    
    # results is a list of dicts sorted by score descending:
    # [{'score': 0.99, 'label': 'A photo of a Pothole'}, ...]
    top_result = results[0]['label']
    
    # Extract the original category name from the prefixed string
    for cat in categories:
        if top_result == f"A photo of a {cat}":
            return cat
            
    # Fallback (should theoretically never hit due to softmax)
    return categories[0]
