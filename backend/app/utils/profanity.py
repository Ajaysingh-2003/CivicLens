from better_profanity import profanity
import re
import os

# Initialize default wordlist
profanity.load_censor_words()

# Load extended hate speech and slur list
current_dir = os.path.dirname(os.path.abspath(__file__))
bad_words_path = os.path.join(current_dir, "bad_words.txt")
try:
    with open(bad_words_path, "r", encoding="utf-8") as f:
        extended_words = [line.strip().lower() for line in f if line.strip()]
    profanity.add_censor_words(extended_words)
except Exception as e:
    print(f"Warning: Could not load extended bad words list: {e}")

# We can add custom words if needed (e.g. local slang, specific hate words not covered by default)
custom_badwords = [
    # Add any extra specific terms here if they bypass the default list
]
profanity.add_censor_words(custom_badwords)


def normalize_text(text: str) -> str:
    """
    Normalizes text to prevent leetspeak and repeated character evasion.
    (e.g., sh1t -> shit, fuuuuuuck -> fuuck)
    Does NOT strip spaces or punctuation to prevent false positives in sentences.
    """
    if not text:
        return ""
    
    text = text.lower()
    
    # Translate leetspeak to standard characters
    leetspeak_map = {
        '0': 'o', '1': 'i', '3': 'e', '4': 'a', 
        '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's'
    }
    for k, v in leetspeak_map.items():
        text = text.replace(k, v)
        
    # Collapse repeated characters down to max 2 (fuuuuck -> fuuck)
    text = re.sub(r'(.)\1{2,}', r'\1\1', text)
    
    return text

def normalize_username(username: str) -> str:
    """
    Aggressive normalization for usernames only.
    Strips all punctuation and spaces to prevent hiding words (e.g. f.u.c.k -> fuck)
    """
    if not username:
        return ""
    
    # First apply standard normalization
    norm = normalize_text(username)
    
    # Aggressively strip punctuation and spaces
    norm = re.sub(r'[\W_]+', '', norm)
    
    return norm


def contains_profanity(text: str, is_username: bool = False) -> bool:
    """
    Checks if the given text contains any profanity, hate speech, or explicit words.
    Checks both the raw string and the normalized string.
    """
    if not text:
        return False
        
    # 1. Check raw text
    if profanity.contains_profanity(text):
        return True
        
    # 2. Check normalized text
    if is_username:
        normalized = normalize_username(text)
    else:
        normalized = normalize_text(text)
        
    return profanity.contains_profanity(normalized)

def validate_clean_text(text: str, field_name: str = "Input", is_username: bool = False) -> None:
    """
    Validates text and raises ValueError if explicit content is found.
    """
    if contains_profanity(text, is_username=is_username):
        raise ValueError(f"{field_name} contains explicit or inappropriate language. Please edit and ensure it follows our community guidelines.")

