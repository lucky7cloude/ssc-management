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
    const res = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'classes';
    `;
    console.log("Classes columns:", res);
    
    const rows = await sql`SELECT * FROM classes LIMIT 5`;
    console.log("Classes sample rows:", rows);
  } catch (e) {
    console.error(e);
  }
}
run();
