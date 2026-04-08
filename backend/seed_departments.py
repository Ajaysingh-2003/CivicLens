import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.department import Department

def seed_departments():
    db = SessionLocal()
    try:
        departments_to_seed = [
            {"name": "Water & Sanitation", "description": "Handles water supply and sewage issues."},
            {"name": "Roads & Infrastructure", "description": "Deals with road repairs, potholes, and public works."},
            {"name": "Electricity Board", "description": "Manages street lights and power outages."},
            {"name": "Public Health", "description": "Handles waste management and public hygiene."},
            {"name": "Parks & Recreation", "description": "Maintains public parks and green spaces."},
            {"name": "Disaster Management", "description": "Emergency services and natural disaster response."},
            {"name": "Traffic & Transport", "description": "Handles traffic signals, public transit, and road safety."},
        ]

        for dept_data in departments_to_seed:
            dept = db.query(Department).filter(Department.name == dept_data["name"]).first()
            if not dept:
                new_dept = Department(**dept_data)
                db.add(new_dept)
                print(f"Added department: {dept_data['name']}")
        
        db.commit()
        print("✅ Departments seeded successfully.")
    except Exception as e:
        print(f"Error seeding departments: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_departments()
