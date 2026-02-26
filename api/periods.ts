import { neon } from '@neondatabase/serverless';
import { Request, Response } from 'express';
import fs from 'fs';

export default async function handler(req: Request, res: Response) {
  const databaseUrl = process.env.DATABASE_URL || fs.readFileSync('.env.example', 'utf8').match(/DATABASE_URL=(.+)/)?.[1].trim();

  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database configuration missing.' });
  }

  const sql = neon(databaseUrl);

  try {
    if (req.method === 'GET') {
      try {
        await sql`ALTER TABLE period_configs ADD COLUMN IF NOT EXISTS label TEXT`;
        await sql`ALTER TABLE period_configs ADD COLUMN IF NOT EXISTS is_lunch BOOLEAN DEFAULT FALSE`;
      } catch (e) {
        // Ignore if already exists
      }
      const rows = await sql`SELECT * FROM period_configs ORDER BY period_index ASC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const configs = req.body; // Array of { period_index, start_time, end_time, label, is_lunch }
      
      // Clear existing periods if the count changes, or just delete all and insert
      await sql`DELETE FROM period_configs`;
      
      for (const config of configs) {
        await sql`
          INSERT INTO period_configs (period_index, start_time, end_time, label, is_lunch)
          VALUES (${config.period_index}, ${config.start_time}, ${config.end_time}, ${config.label || ''}, ${config.is_lunch || false})
        `;
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error in periods.ts:', error);
    return res.status(500).json({ error: error.message });
  }
}
