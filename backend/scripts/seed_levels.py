"""
Seed the levels table with the CivicLens gamification level configuration.
Run once after migration: python -m scripts.seed_levels
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.level import Level

LEVEL_SEED = [
    {"level": 1,  "title": "Citizen Reporter",      "min_points": 0,    "description": "Every great city starts with one voice."},
    {"level": 2,  "title": "Civic Observer",         "min_points": 100,  "description": "You're paying attention — and it shows."},
    {"level": 3,  "title": "Community Voice",        "min_points": 300,  "description": "Your reports are making a difference."},
    {"level": 4,  "title": "Neighborhood Guardian",  "min_points": 600,  "description": "You watch over your community with care."},
    {"level": 5,  "title": "City Watchdog",          "min_points": 1000, "description": "Officials know your name. Keep going."},
    {"level": 6,  "title": "Civic Champion",         "min_points": 1500, "description": "You champion the causes others overlook."},
    {"level": 7,  "title": "Urban Protector",        "min_points": 2200, "description": "Your city is safer because of you."},
    {"level": 8,  "title": "District Leader",        "min_points": 3000, "description": "A beacon of civic responsibility."},
    {"level": 9,  "title": "City Steward",           "min_points": 5000, "description": "Entrusted with the spirit of the city."},
    {"level": 10, "title": "Civic Legend",           "min_points": 8000, "description": "A legacy written in resolved issues."},
]


def seed():
    db = SessionLocal()
    try:
        existing = db.query(Level).count()
        if existing > 0:
            print(f"Levels table already has {existing} rows. Skipping seed.")
            return

        for data in LEVEL_SEED:
            db.add(Level(**data))
        db.commit()
        print(f"✅ Seeded {len(LEVEL_SEED)} levels successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
