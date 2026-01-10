import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / 'uni_market.db'
print('DB path:', DB)
if not DB.exists():
    print('Database not found at', DB)
    raise SystemExit(1)

conn = sqlite3.connect(str(DB))
cur = conn.cursor()
cur.execute("PRAGMA table_info(users);")
cols = [r[1] for r in cur.fetchall()]
print('Existing columns:', cols)
if 'role' in cols:
    print('Column role already exists, nothing to do.')
else:
    print('Adding column role with default "user"...')
    cur.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';")
    conn.commit()
    print('Added column role.')

# Show final table info
cur.execute("PRAGMA table_info(users);")
print('Final columns:', [r[1] for r in cur.fetchall()])
conn.close()
