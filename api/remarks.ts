
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  const databaseUrl = process.env.DATABASE_URL || (await import('fs')).readFileSync('.env.example', 'utf8').match(/DATABASE_URL=(.+)/)?.[1].trim();
  if (!databaseUrl) return res.status(500).json({ error: 'DATABASE_URL missing' });
  const sql = neon(databaseUrl);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM remarks ORDER BY date DESC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { id, teacherId, date, note, type } = req.body;
      await sql`
        INSERT INTO remarks (id, teacher_id, date, note, type)
        VALUES (${id}, ${teacherId}, ${date}, ${note}, ${type})
        ON CONFLICT (id) DO UPDATE SET 
          teacher_id = EXCLUDED.teacher_id, 
          date = EXCLUDED.date, 
          note = EXCLUDED.note, 
          type = EXCLUDED.type
      `;
      return res.status(200).json({ success: true });
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM remarks WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
