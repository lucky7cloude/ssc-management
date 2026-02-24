
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  const databaseUrl = process.env.DATABASE_URL || (await import('fs')).readFileSync('.env.example', 'utf8').match(/DATABASE_URL=(.+)/)?.[1].trim();
  if (!databaseUrl) return res.status(500).json({ error: 'DATABASE_URL missing' });
  const sql = neon(databaseUrl);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM exams ORDER BY date ASC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { id, examType, classId, subject, invigilatorId, date, startTime, endTime } = req.body;
      await sql`
        INSERT INTO exams (id, exam_type, class_id, subject, invigilator_id, date, start_time, end_time)
        VALUES (${id}, ${examType || null}, ${classId || null}, ${subject || null}, ${invigilatorId || null}, ${date || null}, ${startTime || null}, ${endTime || null})
        ON CONFLICT (id) DO UPDATE SET 
          exam_type = EXCLUDED.exam_type, 
          class_id = EXCLUDED.class_id, 
          subject = EXCLUDED.subject, 
          invigilator_id = EXCLUDED.invigilator_id, 
          date = EXCLUDED.date, 
          start_time = EXCLUDED.start_time, 
          end_time = EXCLUDED.end_time
      `;
      return res.status(200).json({ success: true });
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM exams WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
