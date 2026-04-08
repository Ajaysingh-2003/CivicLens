from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.models.state import State
from app.models.city import City
from app.schemas.location import StateResponse, CityResponse

router = APIRouter()

@router.get("/states", response_model=List[StateResponse])
def read_states(db: Session = Depends(deps.get_db)) -> Any:
    """
    Retrieve all states.
    """
    states = db.query(State).order_by(State.name).all()
    return states

@router.get("/states/{state_id}/cities", response_model=List[CityResponse])
def read_cities_by_state(state_id: int, db: Session = Depends(deps.get_db)) -> Any:
    """
    Retrieve cities for a specific state.
    """
    cities = db.query(City).filter(City.state_id == state_id).order_by(City.name).all()
    return cities
