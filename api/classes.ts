
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  const databaseUrl = process.env.DATABASE_URL || (await import('fs')).readFileSync('.env.example', 'utf8').match(/DATABASE_URL=(.+)/)?.[1].trim();
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL missing' });
  }

  const sql = neon(databaseUrl);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM classes ORDER BY sort_order ASC, name ASC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { id, name, section, sort_order } = req.body;
      console.log('Saving class:', { id, name, section, sort_order });
      
      const order = sort_order !== undefined ? sort_order : 0;

      // Upsert logic
      await sql`
        INSERT INTO classes (id, name, section, sort_order)
        VALUES (${id}, ${name}, ${section}, ${order})
        ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name, 
          section = EXCLUDED.section,
          sort_order = EXCLUDED.sort_order
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      const bodyId = req.body?.id;
      const classId = id || bodyId;

      if (!classId) {
        return res.status(400).json({ error: 'Class ID required' });
      }

      console.log('Deleting class and dependencies:', classId);

      try {
        // 1. Clean up dependencies in timetable
        await sql`DELETE FROM timetable WHERE class_id = ${classId.toString()}`;

        // 2. Delete the class itself
        const result = await sql`DELETE FROM classes WHERE id = ${classId.toString()}`;
        console.log('Delete result:', result);

        return res.status(200).json({ success: true });
      } catch (dbError: any) {
        console.error('Database error during delete:', dbError);
        return res.status(500).json({ error: dbError.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error /api/classes:', error);
    return res.status(500).json({ error: error.message });
  }
}
