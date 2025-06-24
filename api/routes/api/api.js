#!/usr/bin/env node
/**
 * api.js – Minimal Express API replacing your old PHP endpoints
 * -------------------------------------------------------------
 * Endpoints provided in this starter:
 *   GET    /assets          → list all PCs & their status
 *   POST   /update-status   → update status of a specific PC
 *
 * Requirements
 *   $ npm install express mysql2 dotenv
 *
 * Environment (create a .env file or export vars):
 *   DB_HOST=127.0.0.1
 *   DB_PORT=3306
 *   DB_NAME=mapuainventory
 *   DB_USER=root
 *   DB_PASSWORD=
 *   PORT=4000            # HTTP port (optional)
 */

import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import session from 'express-session';
import bcrypt  from 'bcrypt';

dotenv.config();

/* ──────────────────────────────────────────────────────────────
   1️⃣  MySQL connection-pool (mysql2/promise)
   ─────────────────────────────────────────────────────────── */
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'mapuainventory',
  waitForConnections: true,
  connectionLimit:    10,
  namedPlaceholders:  true,
});

/* ──────────────────────────────────────────────────────────────
   2️⃣  Express app & middleware
   ─────────────────────────────────────────────────────────── */
const app = express();
app.use(express.json()); // parse JSON bodies
app.use(session({
  secret: process.env.SESSION_SECRET || 'Example',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }   // set true if you serve over HTTPS
}));

// middleware: attach a pooled connection per-request
app.use(async (req, res, next) => {
  try {
    req.db = await pool.getConnection();
    await req.db.query('SET SESSION sql_mode="STRICT_ALL_TABLES"');
    return next();
  } catch (err) {
    console.error('DB pool error', err);
    return res.status(500).json({ success:false, error:'Database unavailable' });
  }
});

// always release the connection after the response finishes
app.use((req, res, next) => {
  res.on('finish', () => req.db && req.db.release());
  next();
});

/* ──────────────────────────────────────────────────────────────
   3️⃣  Routes
   ─────────────────────────────────────────────────────────── */

// GET /assets – list all computer assets
app.get('/assets', async (req, res) => {
  try {
    const [rows] = await req.db.query(`
      SELECT RoomID, PCNumber, Status, Issues
        FROM ComputerAssets
    ORDER BY RoomID, PCNumber`);
    res.json({ success:true, data:rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, error:err.message });
  }
});

// POST /update-status – update a single PC's status
app.post('/update-status', async (req, res) => {
  const { room, pc, status } = req.body;
  if (!room || !pc || !status) {
    return res.status(400).json({ success:false, error:'Invalid payload' });
  }
  try {
    const [result] = await req.db.execute(`
      UPDATE ComputerAssets
         SET Status = :status
       WHERE RoomID = :room AND PCNumber = :pc`,
      { room, pc, status }
    );
    res.json({ success:true, rows:result.affectedRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, error:err.message });
  }
});


// POST /login – authenticate user
app.post('/login', async (req, res) => {
  const { email = '', pass = '' } = req.body;

  // 1️⃣ Basic validation
  if (!email.trim() || !pass) {
    return res
      .status(400)
      .json({ success: false, error: 'Email & password required' });
  }

  try {
    // 2️⃣ Fetch user row
    const [rows] = await req.db.execute(
      `SELECT UserID, FirstName, LastName, PasswordHash, Role
         FROM Users
        WHERE Email = ?`,
      [ email.trim().toLowerCase() ]
    );
    const user = rows[0];
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    // 3️⃣ Verify password against PHP hash
    const match = await bcrypt.compare(pass, user.PasswordHash);
    if (!match) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    // 4️⃣ Save minimal user info in session
    req.session.user = {
      id:   user.UserID,
      name: `${user.FirstName} ${user.LastName}`,
      role: user.Role
    };

    // 5️⃣ Respond with the same JSON shape you had in PHP
    res.json({ success: true, user: req.session.user });

  } catch (err) {
    console.error('Login error:', err);
    res
      .status(500)
      .json({ success: false, error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   4️⃣  Bootstrap server
   ─────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀  API ready at http://localhost:${PORT}`)
);
