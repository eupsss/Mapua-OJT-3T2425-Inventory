import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();                   // loads .env

export const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'mapuainventory',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true
});
