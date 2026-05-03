import sys
import os
import geopandas as gpd
from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape

# Append backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.state import State
from app.models.city import City

def seed_locations_gadm():
    db = SessionLocal()
    try:
        print("Loading State Shapefiles (Level 1)...")
        gdf_states = gpd.read_file('h:/Projects/CivicLens/gadm41_IND_shp/gadm41_IND_1.shp')
        
        # Dissolve by NAME_1 to merge fragmented polygons (islands/enclaves)
        gdf_states_dissolved = gdf_states.dissolve(by='NAME_1', aggfunc='first').reset_index()
        
        state_id_map = {}
        
        print("Inserting States into database...")
        for _, row in gdf_states_dissolved.iterrows():
            name = row['NAME_1']
            hasc = row.get('HASC_1')
            
            # Extract code from HASC (e.g. IN.AP -> AP). Handle NA or missing.
            if hasc and isinstance(hasc, str) and hasc.startswith('IN.'):
                code = hasc.split('.')[-1][:2].upper()
            else:
                code = name[:2].upper() # Fallback
            
            # Check if state exists to avoid duplicates
            state = db.query(State).filter(State.name == name).first()
            if not state:
                state = State(
                    name=name,
                    code=code,
                    geom=from_shape(row.geometry, srid=4326)
                )
                db.add(state)
                db.flush() # Get the ID immediately
                print(f"  Added State: {name} ({code})")
            else:
                # Update geom if it exists
                state.geom = from_shape(row.geometry, srid=4326)
                db.flush()
                print(f"  Updated State: {name}")
                
            state_id_map[name] = state.id
        
        print("Loading District Shapefiles (Level 2)...")
        gdf_districts = gpd.read_file('h:/Projects/CivicLens/gadm41_IND_shp/gadm41_IND_2.shp')
        
        # Dissolve by State and District name
        gdf_districts_dissolved = gdf_districts.dissolve(by=['NAME_1', 'NAME_2'], aggfunc='first').reset_index()
        
        print("Inserting Districts into database...")
        for _, row in gdf_districts_dissolved.iterrows():
            state_name = row['NAME_1']
            district_name = row['NAME_2']
            
            state_id = state_id_map.get(state_name)
            if not state_id:
                print(f"  Warning: Parent state '{state_name}' not found for district '{district_name}'. Skipping.")
                continue
                
            # Check if district exists
            city = db.query(City).filter(City.name == district_name, City.state_id == state_id).first()
            if not city:
                city = City(
                    state_id=state_id,
                    name=district_name,
                    geom=from_shape(row.geometry, srid=4326)
                )
                db.add(city)
                print(f"  Added District: {district_name} ({state_name})")
            else:
                city.geom = from_shape(row.geometry, srid=4326)
                print(f"  Updated District: {district_name}")
                
        db.commit()
        print("States and Districts seeded successfully.")
        
    except Exception as e:
        print(f"Error seeding locations: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_locations_gadm()
