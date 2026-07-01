import io
from PIL import Image
import torch
import requests
from transformers import CLIPProcessor, CLIPModel
from typing import List

import threading

_model = None
_processor = None
_device = "cuda" if torch.cuda.is_available() else "cpu"
_model_lock = threading.Lock()

def _load_model():
    global _model, _processor
    if _model is None:
        with _model_lock:
            if _model is None:
                print("Loading CLIP Model into memory... (Running in background)")
                try:
                    m = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(_device)
                    p = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
                    _model = m
                    _processor = p
                    print("CLIP Model Loaded successfully!")
                except Exception as e:
                    print(f"Error loading CLIP Model: {e}")

# Trigger background load immediately
threading.Thread(target=_load_model, daemon=True).start()

def _ensure_model_loaded():
    if _model is None:
        print("Waiting for CLIP Model to finish loading...")
        with _model_lock:
            pass
    return _model, _processor

# Cache for text features to avoid re-encoding on every request
_cached_labels = None
_cached_text_features = None

def get_text_features(labels: List[str]):
    global _cached_labels, _cached_text_features
    if _cached_labels == labels and _cached_text_features is not None:
        return _cached_text_features
    
    model, processor = _ensure_model_loaded()
    
    inputs = processor(text=labels, return_tensors="pt", padding=True).to(_device)
    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
        # Normalize
        text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
    
    _cached_labels = labels
    _cached_text_features = text_features
    return text_features

def classify_image(image_bytes: bytes, categories: List[str], moderation_labels: List[str] = None) -> str:
    """
    Given raw image bytes and a list of category names (e.g. ['Pothole', 'Graffiti']),
    it will format the candidate labels and return the single highest matching category name.
    If moderation_labels are provided, they are evaluated simultaneously. If a moderation
    label scores highest, a ValueError is raised.
    """
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # Resize image to speed up processor handling
    image.thumbnail((500, 500))
    
    # We prefix the categories with a contextual prompt for better accuracy
    civic_labels = [f"A photo of a {cat}" for cat in categories]
    
    # Combine with moderation labels if provided
    mod_labels = moderation_labels or []
    all_labels = civic_labels + mod_labels
    
    # Get cached text features (super fast after first run)
    text_features = get_text_features(all_labels)
    
    model, processor = _ensure_model_loaded()
    
    # Process image
    inputs = processor(images=image, return_tensors="pt").to(_device)
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
        
    # Calculate cosine similarity
    similarity = (100.0 * image_features @ text_features.T).softmax(dim=-1)
    
    # Get top result
    best_idx = similarity[0].argmax().item()
    top_result = all_labels[best_idx]
    
    # Check if the top result is a moderation label
    if top_result in mod_labels:
        raise ValueError(f"Image rejected. Identified as: {top_result}")
    
    # Extract the original category name from the prefixed string
    for cat in categories:
        if top_result == f"A photo of a {cat}":
            return cat
            
    # Fallback (should theoretically never hit)
    return categories[0]

def moderate_avatar(image_bytes: bytes) -> None:
    """
    Moderates a profile picture upload. Raises ValueError if the image
    is classified as inappropriate.
    """
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image.thumbnail((500, 500))
    
    mod_labels = [
        "nudity or explicit sexual content",
        "gore, blood, or extreme violence",
        "hate symbols or offensive imagery",
        "illegal drugs or weapons"
    ]
    safe_labels = [
        "a normal profile picture of a human face",
        "a generic avatar illustration",
        "a photo of an animal, pet, or nature",
        "a solid color or abstract background"
    ]
    all_labels = safe_labels + mod_labels
    
    text_features = get_text_features(all_labels)
    
    model, processor = _ensure_model_loaded()
    
    inputs = processor(images=image, return_tensors="pt").to(_device)
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
        
    similarity = (100.0 * image_features @ text_features.T).softmax(dim=-1)
    
    best_idx = similarity[0].argmax().item()
    top_result = all_labels[best_idx]
    
    if top_result in mod_labels:
        raise ValueError(f"Image rejected. Identified as: {top_result}")
