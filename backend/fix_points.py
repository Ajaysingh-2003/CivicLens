import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine, text

engine = create_engine(os.getenv("DATABASE_URL").strip('"'))
with engine.begin() as conn:
    result = conn.execute(text("UPDATE users SET points = 0"))
    print(f"Reset {result.rowcount} user(s) to 0 points.")

    # Verify
    rows = conn.execute(text("SELECT id, username, points FROM users ORDER BY id")).fetchall()
    for r in rows:
        print(f"  [{r[0]}] {r[1]} -> {r[2]} pts")
