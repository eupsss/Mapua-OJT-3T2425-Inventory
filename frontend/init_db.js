#!/usr/bin/env node
/**
 * init_db.js ― Simple one‑off utility to initialise your MySQL database.
 *
 * It reproduces the manual mysql‑shell workflow:
 *   \connect root@127.0.0.1:3306
 *   \source "../MapuaInventory.sql"
 *   \source "../computer_assets_126rows_insert.sql"
 *
 * Requirements:
 *   • Node.js ≥14
 *   • npm install mysql2
 *
 * Usage (bash):
 *   # pass connection details through env‑vars
 *   DB_PASSWORD=secret node init_db.js
 *
 *   # or override anything you need
 *   DB_HOST=192.168.1.10 DB_PORT=3307 \
 *   DB_USER=admin DB_PASSWORD=pa55w0rd node init_db.js
 *
 * Environment variables (all optional except DB_PASSWORD):
 *   DB_HOST     defaults to 127.0.0.1
 *   DB_PORT     defaults to 3306
 *   DB_USER     defaults to root
 *   DB_PASSWORD (no default ‑‑ required)
 *
 * The script executes the SQL files **sequentially** with multiple‑statement
 * support enabled, so your schema + seed data are loaded in order.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/** Resolve a path that is relative to this script */
const rel = p => path.resolve(__dirname, p);

async function main() {
  const {
    DB_HOST = '127.0.0.1',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASSWORD,
  } = process.env;

  if (!DB_PASSWORD) {
    console.error('❌  Please set DB_PASSWORD in your environment');
    process.exit(1);
  }

  // 1️⃣ connect -------------------------------------------------------------
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true, // necessary for *.sql dumps
  });

  console.log(`✓ Connected to ${DB_HOST}:${DB_PORT} as ${DB_USER}`);

  // 2️⃣ run the scripts in order -------------------------------------------
  const scripts = [
    rel('../MapuaInventory.sql'),
    rel('../computer_assets_126rows_insert.sql'),
  ];

  for (const file of scripts) {
    const sql = await fs.readFile(file, 'utf8');
    process.stdout.write(`→ Executing ${path.basename(file)} … `);
    await conn.query(sql);
    console.log('done');
  }

  await conn.end();
  console.log('🎉  Database initialised successfully.');
}

main().catch(err => {
  console.error('\n❌  Initialisation failed:', err.message);
  process.exit(1);
});
