from pydantic import BaseModel

class StateResponse(BaseModel):
    id: int
    name: str
    code: str

    class Config:
        from_attributes = True

class CityResponse(BaseModel):
    id: int
    state_id: int
    name: str

    class Config:
        from_attributes = True
