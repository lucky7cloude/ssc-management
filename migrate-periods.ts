import { neon } from '@neondatabase/serverless';
import fs from 'fs';

async function run() {
  const databaseUrl = process.env.DATABASE_URL || fs.readFileSync('.env.example', 'utf8').match(/DATABASE_URL=(.+)/)?.[1].trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    return;
  }
  const sql = neon(databaseUrl);
  try {
    console.log("Creating period_configs table...");
    await sql`
      CREATE TABLE IF NOT EXISTS period_configs (
        period_index INTEGER PRIMARY KEY,
        start_time TEXT,
        end_time TEXT
      )
    `;
    console.log("Table created successfully");
  } catch (e) {
    console.error("Migration error:", e);
  }
}
run();
