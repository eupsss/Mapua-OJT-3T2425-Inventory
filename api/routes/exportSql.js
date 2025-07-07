// File: api/routes/exportSql.js
import express from 'express';
import mysql2  from 'mysql2';
import { pool } from '../db.js';     // your mysql2 promise pool

const router = express.Router();

// Only Admins may export
function requireAdmin(req, res, next) {
  const user = req.session?.user;
  if (!user || user.role !== 'Admin') {
    return res.status(403).json({ success: false, error: 'Admins only' });
  }
  next();
}

router.get(
  '/export-computer-assets-sql',
  requireAdmin,
  async (req, res, next) => {
    try {
      const dbName = process.env.DB_NAME;
      if (!dbName) {
        throw new Error('DB_NAME must be set in your .env');
      }

      // 1) List all base tables
      const [tables] = await pool.query(
        `SELECT table_name AS tbl
           FROM information_schema.tables
          WHERE table_schema = ?
            AND table_type   = 'BASE TABLE'
          ORDER BY table_name`,
        [dbName]
      );

      let fullSql = '';
      fullSql += 'SET FOREIGN_KEY_CHECKS=0;\n\n';

      for (const { tbl } of tables) {
        // 2) Get column metadata, skip AUTO_INCREMENT columns
        const [colsInfo] = await pool.query(
          `SELECT COLUMN_NAME, EXTRA
             FROM information_schema.columns
            WHERE table_schema = ?
              AND table_name   = ?
            ORDER BY ORDINAL_POSITION`,
          [dbName, tbl]
        );
        const exportCols = colsInfo
          .filter(col => !col.EXTRA.includes('auto_increment'))
          .map(col => col.COLUMN_NAME);

        if (exportCols.length === 0) continue;

        // 3) Fetch all rows for this table
        const colList = exportCols.map(c => `\`${c}\``).join(', ');
        const [rows]  = await pool.query(
          `SELECT ${exportCols.map(c => `\`${c}\``).join(', ')}
             FROM \`${tbl}\``
        );
        if (rows.length === 0) continue;

        // 4) Build VALUES tuples with proper escaping
        const tuples = rows
          .map(row => {
            const escaped = exportCols
              .map(c => mysql2.escape(row[c]))
              .join(', ');
            return `(${escaped})`;
          })
          .join(',\n');

        // 5) Append this table’s INSERT to the full SQL
        fullSql += `-- data for table \`${tbl}\`\n`;
        fullSql += `INSERT INTO \`${tbl}\` (${colList}) VALUES\n`;
        fullSql += `${tuples};\n\n`;
      }

      fullSql += 'SET FOREIGN_KEY_CHECKS=1;\n';

      // 6) Stream the combined SQL back as a download
      res
        .header(
          'Content-Disposition',
          'attachment; filename="mapua_inventory_full_data.sql"'
        )
        .type('application/sql')
        .send(fullSql);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
