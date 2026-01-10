import sqlite3
from pathlib import Path
import sys

if len(sys.argv) < 3:
    print('Usage: set_user_role.py <username> <role>')
    print('Roles: user, support, admin')
    sys.exit(1)

username = sys.argv[1]
role = sys.argv[2]
if role not in ('user', 'support', 'admin'):
    print('Invalid role')
    sys.exit(1)

DB = Path(__file__).resolve().parents[1] / 'uni_market.db'
conn = sqlite3.connect(str(DB))
cur = conn.cursor()
cur.execute('SELECT id, username, role FROM users WHERE username = ?', (username,))
row = cur.fetchone()
if not row:
    print('User not found:', username)
    sys.exit(1)

cur.execute('UPDATE users SET role = ? WHERE id = ?', (role, row[0]))
conn.commit()
print(f"Updated user {username} (id={row[0]}) to role {role}")
conn.close()
