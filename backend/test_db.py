from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT count(*) FROM auth.users")).scalar()
    print(f"Auth users count: {result}")
