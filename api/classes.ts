
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL missing' });
  }

  const sql = neon(databaseUrl);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM classes ORDER BY name`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { id, name, section } = req.body;
      console.log('Saving class:', { id, name, section });
      
      // Upsert logic
      await sql`
        INSERT INTO classes (id, name, section)
        VALUES (${id}, ${name}, ${section})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, section = EXCLUDED.section
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query; // Next.js API route query param
      // If using body for DELETE, check req.body.id
      const classId = id || req.body.id;

      if (!classId) {
        return res.status(400).json({ error: 'Class ID required' });
      }

      console.log('Deleting class and dependencies:', classId);

      // 1. Clean up dependencies in timetable (Foreign Key Constraint Fix)
      await sql`DELETE FROM timetable WHERE class_id = ${classId}`;

      // 2. Delete the class itself
      await sql`DELETE FROM classes WHERE id = ${classId}`;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error /api/classes:', error);
    return res.status(500).json({ error: error.message });
  }
}
