const express = require('express');
const cors = require('cors');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let dbQuery;

// Database Connection Logic
if (process.env.DATABASE_URL) {
    // Cloud: Use PostgreSQL
    console.log("Using PostgreSQL Database");
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    dbQuery = async (text, params) => {
        const res = await pool.query(text, params);
        return res;
    };

    // Initialize Table
    pool.query(`
        CREATE TABLE IF NOT EXISTS submissions (
            id SERIAL PRIMARY KEY,
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
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(err => console.error("Error creating PG table:", err));

} else {
    // Local: Use SQLite
    console.log("Using local SQLite Database");
    const sqlite3 = require('sqlite3').verbose();
    const DB_FILE = 'submissions.db';
    const db = new sqlite3.Database(DB_FILE);

    dbQuery = (text, params) => {
        return new Promise((resolve, reject) => {
            // Convert PG syntax ($1, $2) to SQLite syntax (?, ?)
            const sqliteText = text.replace(/\$\d+/g, '?');
            
            if (text.trim().toUpperCase().startsWith("SELECT")) {
                db.all(sqliteText, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                db.run(sqliteText, params, function(err) {
                    if (err) reject(err);
                    else resolve({ rowCount: this.changes });
                });
            }
        });
    };

    db.run(`
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
    `);
}

// Admin authentication middleware
const authMiddleware = basicAuth({
    users: { 'admin': 'admin123' },
    challenge: true,
    unauthorizedResponse: 'Unauthorized. Use admin:admin123'
});

// Submit endpoint
app.post('/api/submit', async (req, res) => {
    const data = req.body;
    if (!data) return res.status(400).json({ error: "No data provided" });

    const ref_id = `SC-AIML-${Math.floor(1000 + Math.random() * 9000)}`;
    const interests = data.interests ? data.interests.join(',') : '';

    const sql = `
        INSERT INTO submissions (
            ref_id, full_name, roll_no, email, phone, year, section, branch,
            github, linkedin, interests, proficiency, why_join, experience, referral
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;

    const params = [
        ref_id, data.fullName, data.rollNo, data.email, data.phone,
        data.year, data.section, data.branch, data.github, data.linkedin,
        interests, data.proficiency, data.whyJoin, data.experience, data.referral
    ];

    try {
        await dbQuery(sql, params);
        res.json({ success: true, ref_id: ref_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Admin dashboard endpoint
app.get('/admin', authMiddleware, async (req, res) => {
    try {
        const result = await dbQuery("SELECT * FROM submissions ORDER BY timestamp DESC", []);
        
        let tableRows = result.rows.map(row => `
            <tr>
                <td>${row.ref_id}</td>
                <td>${row.full_name}</td>
                <td>${row.roll_no}</td>
                <td>${row.email}</td>
                <td>${row.phone}</td>
                <td>${row.year} / ${row.section} / ${row.branch}</td>
                <td>${row.interests}</td>
                <td>${row.proficiency}</td>
                <td>${row.referral}</td>
                <td>${row.timestamp}</td>
            </tr>
        `).join('');

        const html = `
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
                ${tableRows}
            </table>
        </body>
        </html>
        `;

        res.send(html);
    } catch (err) {
        res.status(500).send("Database error: " + err.message);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
