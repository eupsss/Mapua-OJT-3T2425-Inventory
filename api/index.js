// api/index.js
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';

import * as exportSqlModule from './routes/exportSql.js';   // grab *everything*
const exportSqlRouter = exportSqlModule.default            // prefer default
                      || exportSqlModule.exportSqlRouter;  // …else named
console.log('🔍 exportSqlRouter type →', typeof exportSqlRouter);


// ────────────────────────────────────────────────────────────────
// Compute __dirname and static directory
// ────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const staticDir  = path.join(__dirname, '../frontend');

// ────────────────────────────────────────────────────────────────
// Load env & initialize DB (if any)
// ────────────────────────────────────────────────────────────────
dotenv.config();
import './db.js'; // your DB pool

// ────────────────────────────────────────────────────────────────
// Import all your routers
// ────────────────────────────────────────────────────────────────
import metrics        from './routes/metrics.js';
import checksOverTime from './routes/checks-over-time.js';
import avgFixTime     from './routes/avg-fix-time.js';
import defectsByRoom  from './routes/defects-by-room.js';
import issuesBreak    from './routes/issues-breakdown.js';
import fixesOverTime  from './routes/fixes-over-time.js';
import updateStatus   from './routes/update-status.js';
import login          from './routes/login.js';
import register       from './routes/register.js';
import users          from './routes/users.js';
import rooms          from './routes/rooms.js';
import pcs            from './routes/pcs.js';
import fix            from './routes/fix.js';
import assetsRouter   from './routes/assets.js';
import reportsRouter  from './routes/reports.js';
import computerAssets from './routes/computerAssets.js';
// import exportSqlRouter from './routes/exportSql.js';   // default import
import insightsRouter from './routes/insights.js';    // <— your new proxy
import defectsTrend     from './routes/defects-trend.js';
import issuesOverTime    from './routes/issues-over-time.js';
import roomUptime        from './routes/room-uptime.js';
import adminUsers from './routes/adminUsers.js';

// ────────────────────────────────────────────────────────────────
// Create Express app & middleware
// ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-with-a-strong-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// ────────────────────────────────────────────────────────────────
// Serve icons if you have them
// ────────────────────────────────────────────────────────────────
app.use('/icons', express.static(path.join(__dirname, '../icons')));

// ────────────────────────────────────────────────────────────────
// Mount your API routes
// ────────────────────────────────────────────────────────────────
app.use('/api/metrics',          metrics);
app.use('/api/checks-over-time', checksOverTime);
app.use('/api/avg-fix-time',     avgFixTime);
app.use('/api/defects-by-room',  defectsByRoom);
app.use('/api/issues-breakdown', issuesBreak);
app.use('/api/fixes-over-time',  fixesOverTime);
app.use('/api/update-status',    updateStatus);
app.use('/api/login',            login);
app.use('/api/register',         register);
app.use('/api/users',            users);
app.use('/api/rooms',            rooms);
app.use('/api/pcs',              pcs);
app.use('/api/fix',              fix);
app.use('/api/assets',           assetsRouter);
app.use('/api/reports',          reportsRouter);
app.use('/api/computer-assets',  computerAssets);
app.use('/api/defects-trend',      defectsTrend);
app.use('/api/issues-over-time',   issuesOverTime);
app.use('/api/room-uptime',        roomUptime);
app.use('/api/exportSQL', exportSqlRouter);
app.use('/api/adminUsers', adminUsers);

// ← Mount the new insights proxy **before** the catch-all 404:
app.post('/api/insights-test', (req, res) => {
  console.log('📬  [test] POST /api/insights-test received:', req.body);
  res.json({ ok: true, youSent: req.body });
});

app.use('/api/insights',         insightsRouter);

// ────────────────────────────────────────────────────────────────
// Catch-all JSON 404 for any other /api/*
// ────────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// ────────────────────────────────────────────────────────────────
// Dynamically serve config.js so the front-end can read GEMINI_KEY
// ────────────────────────────────────────────────────────────────
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(
    `// generated from .env at runtime\n` +
    `window.GEMINI_KEY = ${JSON.stringify(process.env.GEMINI_KEY || '')};`
  );
});

// ────────────────────────────────────────────────────────────────
// Serve static front-end & SPA fallback
// ────────────────────────────────────────────────────────────────
console.log('Serving static files from:', staticDir);
app.use(express.static(staticDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(staticDir, 'index.html'));
});

// ────────────────────────────────────────────────────────────────
// Error handler & server start
// ────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.stack || err);
  res.status(500).json({ success:false, error:'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 API + front-end on http://127.0.0.1:${PORT}`);
});
