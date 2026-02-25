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
      SELECT
          tc.table_schema, 
          tc.constraint_name, 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='timetable';
    `;
    console.log("Timetable Foreign Keys:", res);
  } catch (e) {
    console.error(e);
  }
}
run();
