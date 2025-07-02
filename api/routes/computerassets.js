import express  from 'express';
import { pool } from '../db.js';          // ← mysql2 / promise pool

const router = express.Router();

/* ─────────────────────────────  HELPERS  ───────────────────────────── */

// Build a safe INSERT/UPDATE dynamically
const toSql = obj => ({
  cols : Object.keys(obj).map(k => `\`${k}\``).join(','),
  vals : Object.values(obj),
  qMarks: Object.keys(obj).map(() => '?').join(',')
});

/* ────────────────────────────  READ  (GET)  ──────────────────────────
   #1  /api/computer-assets?room=MPO310
       ⟶ active hardware grid (RetiredAt IS NULL)

   #2  /api/computer-assets?room=MPO310&pc=05&history=1
       ⟶ full life-cycle history for that PC

   #3  /api/computer-assets    ⟶ everything (admin view)
------------------------------------------------------------------------ */
router.get('/', async (req, res, next) => {
  try {
    const { room, pc, history } = req.query;
    let sql     = '';
    let params  = [];

    /* 1. Grid view – *current* hardware only */
    if (room && !history) {
      sql = `
        SELECT a.*, c.Status                             -- live flag
          FROM v_CurrentAssets  AS a                     -- RetiredAt IS NULL
          JOIN Computers        AS c
               ON c.RoomID   = a.RoomID
              AND c.PCNumber = a.PCNumber
         WHERE a.RoomID = ?
         ORDER BY a.PCNumber`;
      params = [room];
    }

    /* 2. Full asset history for one PC */
    else if (room && pc && history) {
      sql = `
        SELECT a.*, c.Status
          FROM ComputerAssets   AS a
          JOIN Computers        AS c
               ON c.RoomID   = a.RoomID
              AND c.PCNumber = a.PCNumber
         WHERE a.RoomID   = ?
           AND a.PCNumber = ?
         ORDER BY a.InstalledAt DESC`;
      params = [room, pc];
    }

    /* 3. Admin view – everything */
    else {
      sql = `
        SELECT a.*, c.Status
          FROM ComputerAssets   AS a
          JOIN Computers        AS c
               ON c.RoomID   = a.RoomID
              AND c.PCNumber = a.PCNumber`;
    }

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});


/* ─────────────────────────── CREATE  (POST) ──────────────────────────
   • Inserts a new “asset row”.  
   • If there is still an *active* asset for the same RoomID+PCNumber,
     we auto-retire it first (sets RetiredAt = NOW()).
------------------------------------------------------------------------ */
router.post('/', async (req, res, next) => {
  try {
    const data = req.body;                 // must at least RoomID, PCNumber, InstalledAt …
    if (!data.RoomID || !data.PCNumber || !data.InstalledAt) {
      return res.status(400).json({ error: 'RoomID, PCNumber & InstalledAt required' });
    }

    // retire current asset (if any)
    await pool.execute(
      `UPDATE ComputerAssets
          SET RetiredAt = NOW()
        WHERE RoomID   = ?
          AND PCNumber = ?
          AND RetiredAt IS NULL`,
      [data.RoomID, data.PCNumber]
    );

    // insert the new record
    const { cols, vals, qMarks } = toSql(data);
    await pool.execute(
      `INSERT INTO ComputerAssets (${cols}) VALUES (${qMarks})`,
      vals
    );
    res.status(201).json({ success: true });
  } catch (e) { next(e); }
});

/* ─────────────────────────── UPDATE  (PUT) ───────────────────────────
   • Standard field update by AssetID.
------------------------------------------------------------------------ */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data   = req.body;
    if (!Object.keys(data).length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const pairs = Object.keys(data).map(k => `\`${k}\` = ?`).join(', ');
    await pool.execute(
      `UPDATE ComputerAssets SET ${pairs} WHERE AssetID = ?`,
      [...Object.values(data), id]
    );
    res.json({ success: true });
  } catch (e) { next(e); }
});

/* ─────────────────────────── DELETE  (DELETE) ────────────────────────
   • Hard-delete an AssetID. (You might prefer a soft delete in prod.)
------------------------------------------------------------------------ */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM ComputerAssets WHERE AssetID = ?', [id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
