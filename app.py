from flask import Flask, request, jsonify, render_template_string
import sqlite3
import random
import os
from functools import wraps

app = Flask(__name__)
DB_FILE = 'submissions.db'

# Simple authentication for the admin page
def check_auth(username, password):
    return username == 'admin' and password == 'admin123'

def authenticate():
    return jsonify({"error": "Unauthorized. Use admin:admin123"}), 401, {'WWW-Authenticate': 'Basic realm="Login Required"'}

def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return authenticate()
        return f(*args, **kwargs)
    return decorated

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ref_id TEXT UNIQUE,
            full_name TEXT,
            roll_no TEXT,
            email TEXT,
            phone TEXT,
            year TEXT,
            section TEXT,
            branch TEXT,
            github TEXT,
            linkedin TEXT,
            interests TEXT,
            proficiency TEXT,
            why_join TEXT,
            experience TEXT,
            referral TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/api/submit', methods=['POST', 'OPTIONS'])
def submit():
    if request.method == 'OPTIONS':
        # Handle CORS preflight
        response = app.make_default_options_response()
        headers = None
        if 'ACCESS_CONTROL_REQUEST_HEADERS' in request.headers:
            headers = request.headers['ACCESS_CONTROL_REQUEST_HEADERS']
        h = response.headers
        h['Access-Control-Allow-Origin'] = '*'
        h['Access-Control-Allow-Methods'] = 'POST'
        h['Access-Control-Max-Age'] = "21600"
        if headers is not None:
            h['Access-Control-Allow-Headers'] = headers
        return response

    data = request.json
    if not data:
        response = jsonify({"error": "No data provided"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 400

    ref_id = f"SC-AIML-{random.randint(1000, 9999)}"

    # Insert into database
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO submissions (
                ref_id, full_name, roll_no, email, phone, year, section, branch,
                github, linkedin, interests, proficiency, why_join, experience, referral
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ref_id,
            data.get('fullName'),
            data.get('rollNo'),
            data.get('email'),
            data.get('phone'),
            data.get('year'),
            data.get('section'),
            data.get('branch'),
            data.get('github'),
            data.get('linkedin'),
            ','.join(data.get('interests', [])),
            data.get('proficiency'),
            data.get('whyJoin'),
            data.get('experience'),
            data.get('referral')
        ))
        conn.commit()
    except Exception as e:
        conn.rollback()
        response = jsonify({"error": str(e)})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 500
    finally:
        conn.close()

    response = jsonify({"success": True, "ref_id": ref_id})
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response

@app.route('/admin')
@requires_auth
def admin():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM submissions ORDER BY timestamp DESC')
    rows = c.fetchall()
    conn.close()

    template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Admin - Submissions</title>
        <style>
            body { font-family: sans-serif; background: #f4f4f9; padding: 20px; }
            table { width: 100%; border-collapse: collapse; background: white; margin-top: 20px; }
            th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
            th { background: #00f5d4; color: #050a0e; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            h1 { color: #333; }
        </style>
    </head>
    <body>
        <h1>SC CSE(AI-ML) Submissions</h1>
        <table>
            <tr>
                <th>Ref ID</th>
                <th>Name</th>
                <th>Roll No</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Year/Sec/Branch</th>
                <th>Interests</th>
                <th>Proficiency</th>
                <th>Referral</th>
                <th>Date</th>
            </tr>
            {% for row in rows %}
            <tr>
                <td>{{ row['ref_id'] }}</td>
                <td>{{ row['full_name'] }}</td>
                <td>{{ row['roll_no'] }}</td>
                <td>{{ row['email'] }}</td>
                <td>{{ row['phone'] }}</td>
                <td>{{ row['year'] }} / {{ row['section'] }} / {{ row['branch'] }}</td>
                <td>{{ row['interests'] }}</td>
                <td>{{ row['proficiency'] }}</td>
                <td>{{ row['referral'] }}</td>
                <td>{{ row['timestamp'] }}</td>
            </tr>
            {% endfor %}
        </table>
    </body>
    </html>
    """
    return render_template_string(template, rows=rows)

if __name__ == '__main__':
    init_db()
    print("Starting server on http://localhost:5000")
    print("Admin access at http://localhost:5000/admin (admin / admin123)")
    app.run(port=5000, debug=True)
