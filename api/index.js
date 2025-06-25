// api/index.js
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';

// ────────────────────────────────────────────────────────────────
// Compute __dirname and static directory (ESM-friendly)
// ────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const staticDir  = path.join(__dirname, '../frontend');

// ────────────────────────────────────────────────────────────────
// 1️⃣  Load environment and initialize DB pool
// ────────────────────────────────────────────────────────────────
dotenv.config();
import './db.js';  // exports `pool`

// ────────────────────────────────────────────────────────────────
// 2️⃣  Import routers
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

// ────────────────────────────────────────────────────────────────
// 3️⃣  Create Express app & middleware
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
// 4️⃣  Serve icons folder at /icons
// ────────────────────────────────────────────────────────────────
app.use(
  '/icons',
  express.static(path.join(__dirname, '../icons'))
);

// ────────────────────────────────────────────────────────────────
// 5️⃣  Mount API routes
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
app.use('/api/computer-assets',          computerAssets);

// ────────────────────────────────────────────────────────────────
// 6️⃣  Catch-all JSON 404 for API
// ────────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// ────────────────────────────────────────────────────────────────
// 7️⃣  Serve front-end static and SPA fallback
// ────────────────────────────────────────────────────────────────
console.log('Serving static files from:', staticDir);
app.use(express.static(staticDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(staticDir, 'index.html'));
});

// ────────────────────────────────────────────────────────────────
// 8️⃣  Global error handler (last middleware)
// ────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.stack || err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ────────────────────────────────────────────────────────────────
// 9️⃣  Start server
// ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 API + front-end on http://127.0.0.1:${PORT}`);
});
