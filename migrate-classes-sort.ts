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
    console.log("Adding sort_order column to classes...");
    await sql`ALTER TABLE classes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`;
    console.log("Column added successfully");
    
    // Initialize sort_order based on current order
    const classes = await sql`SELECT id FROM classes ORDER BY name`;
    for (let i = 0; i < classes.length; i++) {
        await sql`UPDATE classes SET sort_order = ${i} WHERE id = ${classes[i].id}`;
    }
    console.log("Sort order initialized");
  } catch (e) {
    console.error("Migration error:", e);
  }
}
run();
