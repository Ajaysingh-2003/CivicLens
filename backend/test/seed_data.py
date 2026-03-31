import sys
import os
import random
from sqlalchemy.orm import Session
from geoalchemy2.elements import WKTElement

# Add the project root to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.issue import Issue, IssueStatus, IssuePriority
from app.models.category import Category
from app.models.user import User

# List of typical South Indian locations (Latitude, Longitude)
SOUTH_INDIA_HUBS = [
    {"name": "Chennai", "lat": 13.0827, "lng": 80.2707},
    {"name": "Bangalore", "lat": 12.9716, "lng": 77.5946},
    {"name": "Kochi", "lat": 9.9312, "lng": 76.2673},
    {"name": "Madurai", "lat": 9.9252, "lng": 78.1198},
    {"name": "Coimbatore", "lat": 11.0168, "lng": 76.9558},
    {"name": "Trivandrum", "lat": 8.4875, "lng": 76.9492},
]

ISSUE_CATEGORIES = [
    {"name": "Pothole", "desc": "Large cracks or holes in the road surface affecting traffic safety."},
    {"name": "Streetlight", "desc": "Broken or non-functional street lamps causing poor visibility."},
    {"name": "Garbage", "desc": "Overflowing bins or illegal dumping of waste in public areas."},
    {"name": "Drainage", "desc": "Clogged or leaking sewage systems causing foul smell and health risks."},
    {"name": "Water Leakage", "desc": "Burst water pipes or leaking public taps losing clean water."},
    {"name": "Encroachment", "desc": "Illegal structures or vendors blocking public footpaths."},
]

TITLES = [
    "Large Pothole near Main Road",
    "Streetlight not working since 3 days",
    "Open Garbage Bin attracting flies",
    "Drainage overflow after rain",
    "Drinking water pipe burst",
    "Sidewalk blocked by construction debris",
    "Hazardous tree branch about to fall",
    "Broken park bench in public square",
    "Unauthorized poster on heritage wall",
    "Traffic signal malfunctioning",
]

def seed_data():
    db: Session = SessionLocal()
    try:
        # 1. Ensure categories exist
        print("Creating categories...")
        category_map = {}
        for cat_data in ISSUE_CATEGORIES:
            cat = db.query(Category).filter(Category.name == cat_data["name"]).first()
            if not cat:
                cat = Category(name=cat_data["name"], description=cat_data["desc"])
                db.add(cat)
                db.commit()
                db.refresh(cat)
            category_map[cat_data["name"]] = cat.id

        # 2. Check if users 1 and 3 exist as required
        print("Checking users 1 and 3...")
        user_ids = [1, 3]
        valid_user_ids = []
        for uid in user_ids:
            u = db.query(User).filter(User.id == uid).first()
            if u:
                valid_user_ids.append(uid)
        
        if not valid_user_ids:
            print("Error: Required users 1 or 3 not found in database. Please register them first.")
            return

        # 3. Create mock issues
        print(f"Creating 30 mock issues for {', '.join([h['name'] for h in SOUTH_INDIA_HUBS])}...")
        
        categories = list(category_map.values())
        statuses = list(IssueStatus)
        priorities = list(IssuePriority)

        for i in range(30):
            hub = random.choice(SOUTH_INDIA_HUBS)
            # Add a small random jitter to coordinates
            lat_jitter = hub["lat"] + random.uniform(-0.05, 0.05)
            lng_jitter = hub["lng"] + random.uniform(-0.05, 0.05)
            
            location_wkt = f"POINT({lat_jitter} {lng_jitter})" # Using (lat lng) or (lng lat)? PostGIS usually is (lng lat)
            # Wait, PostGIS ST_GeomFromText usually expects (Longitude Latitude)
            location_wkt = f"POINT({lng_jitter} {lat_jitter})"

            new_issue = Issue(
                title=f"{random.choice(TITLES)} - {hub['name']} #{i+1}",
                description=f"This is a mock report for a {random.choice(ISSUE_CATEGORIES)['name']} issue observed in {hub['name']}. Immediate attention is required as it poses a public nuisance.",
                status=random.choice(statuses),
                priority=random.choice(priorities),
                upvotes=random.randint(0, 50),
                downvotes=random.randint(0, 10),
                geom=WKTElement(location_wkt, srid=4326),
                category_id=random.choice(categories),
                reporter_id=random.choice(valid_user_ids)
            )
            db.add(new_issue)

        db.commit()
        print("✅ Successfully seeded 30 mock issues!")

    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
