import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / 'uni_market.db'
print('DB path:', DB)
if not DB.exists():
    print('Database not found at', DB)
    raise SystemExit(1)

conn = sqlite3.connect(str(DB))
cur = conn.cursor()
cur.execute("PRAGMA table_info(cars);")
cols = [r[1] for r in cur.fetchall()]
print('Existing columns in cars:', cols)
if 'is_sold' in cols:
    print('Column is_sold already exists, nothing to do.')
else:
    print('Adding column is_sold with default 0...')
    cur.execute("ALTER TABLE cars ADD COLUMN is_sold INTEGER NOT NULL DEFAULT 0;")
    conn.commit()
    print('Added column is_sold.')

cur.execute("PRAGMA table_info(cars);")
print('Final columns:', [r[1] for r in cur.fetchall()])
conn.close()
