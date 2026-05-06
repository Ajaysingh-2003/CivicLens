import sys
import os

# Add the project root to the python path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from app.db.session import SessionLocal
from app.models.category import Category

def seed_categories():
    db = SessionLocal()
    
    categories_data = [
        {"id": 1, "name": "Pothole / Road Damage", "description": "Damage to public roads, including potholes, sinkholes, or severe cracks.", "marker_color": "#FFB300", "baseline_sla_hours": 72},
        {"id": 2, "name": "Streetlight Outage", "description": "Public streetlights that are burnt out, flickering, or damaged.", "marker_color": "#FDD835", "baseline_sla_hours": 48},
        {"id": 3, "name": "Illegal Dumping / Garbage", "description": "Unauthorized dumping of trash, furniture, or hazardous materials on public property.", "marker_color": "#8D6E63", "baseline_sla_hours": 48},
        {"id": 4, "name": "Graffiti / Vandalism", "description": "Defacement of public or private property with paint or markers.", "marker_color": "#E91E63", "baseline_sla_hours": 96},
        {"id": 5, "name": "Fallen Tree / Branch", "description": "Trees or large branches that have fallen and are blocking roads, sidewalks, or causing danger.", "marker_color": "#4CAF50", "baseline_sla_hours": 24},
        {"id": 6, "name": "Water Leak / Flooding", "description": "Burst public pipes, severe street flooding, or continuous water leaks.", "marker_color": "#03A9F4", "baseline_sla_hours": 12},
        {"id": 7, "name": "Sidewalk Damage", "description": "Broken, lifted, or unsafe public sidewalks.", "marker_color": "#9E9E9E", "baseline_sla_hours": 120},
        {"id": 8, "name": "Traffic Signal Malfunction", "description": "Traffic lights that are out, stuck, or flashing incorrectly.", "marker_color": "#F44336", "baseline_sla_hours": 12},
        {"id": 9, "name": "Abandoned Vehicle", "description": "Vehicles left on public streets or property for an extended period without moving.", "marker_color": "#607D8B", "baseline_sla_hours": 168},
        {"id": 10, "name": "Other / General", "description": "Any other civic issue that does not fit into the standard categories.", "marker_color": "#9C27B0", "baseline_sla_hours": 48},
    ]

    try:
        # We will iterate and use merge to insert or update existing rows safely
        for data in categories_data:
            cat = db.query(Category).filter(Category.id == data["id"]).first()
            if cat:
                cat.name = data["name"]
                cat.description = data["description"]
                cat.marker_color = data["marker_color"]
                cat.baseline_sla_hours = data["baseline_sla_hours"]
            else:
                new_cat = Category(**data)
                db.add(new_cat)
        
        db.commit()
        print(f"Successfully seeded {len(categories_data)} categories!")
        
        # Ensure postgres sequence is synced if we manually set IDs
        db.execute(text("SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));"))
        db.commit()
        
    except Exception as e:
        print(f"Error seeding categories: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting category seed process...")
    seed_categories()
