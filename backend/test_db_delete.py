from app.db.session import engine
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text("DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000000'"))
    print("Delete executed successfully")
