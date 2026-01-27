
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined.');
    return res.status(500).json({ error: 'Database configuration missing.' });
  }

  const sql = neon(databaseUrl);

  try {
    const { method } = req;

    if (method === 'GET') {
      const { dateStr, dayName } = req.query;
      if (!dateStr || !dayName) return res.status(400).json({ error: 'Missing parameters' });

      // Fetch data
      const [baseRows, subRows, attendanceRows, instructionRows] = await Promise.all([
        sql`SELECT class_id, period_index, teacher_id, subject, note FROM timetable WHERE day_name = ${dayName} AND is_base_schedule = true`,
        sql`SELECT class_id, period_index, teacher_id, subject, note FROM timetable WHERE date_str = ${dateStr} AND is_base_schedule = false`,
        sql`SELECT teacher_id, status FROM attendance WHERE date_str = ${dateStr}`,
        sql`SELECT text FROM instructions WHERE date_str = ${dateStr}`
      ]);

      const schedule: Record<string, any> = {};
      const attendance: Record<string, string> = {};
      
      attendanceRows.forEach((r: any) => attendance[r.teacher_id] = r.status);

      baseRows.forEach((row: any) => {
        const key = `${row.class_id}_${row.period_index}`;
        schedule[key] = { 
          teacherId: row.teacher_id, 
          subject: row.subject, 
          note: row.note,
          status: attendance[row.teacher_id] || 'present' 
        };
      });

      subRows.forEach((row: any) => {
        const key = `${row.class_id}_${row.period_index}`;
        schedule[key] = { 
          subTeacherId: row.teacher_id, 
          subSubject: row.subject, 
          subNote: row.note, 
          isOverride: true,
          status: attendance[row.teacher_id] || 'present'
        };
      });

      return res.status(200).json({
        schedule,
        attendance,
        instruction: instructionRows[0]?.text || ''
      });
    }

    if (method === 'POST') {
      const { type, payload } = req.body;
      console.log(`Processing ${type}`, payload);

      if (type === 'SAVE_BASE') {
        const { dayName, classId, periodIndex, entry } = payload;
        
        // Strict Constraint Logic: Update if exists, Insert if new
        // Constraint assumed: (day_name, class_id, period_index, is_base_schedule)
        if (!entry) {
          await sql`
            DELETE FROM timetable 
            WHERE day_name = ${dayName} 
              AND class_id = ${classId} 
              AND period_index = ${periodIndex} 
              AND is_base_schedule = true
          `;
        } else {
          await sql`
            INSERT INTO timetable (day_name, class_id, period_index, teacher_id, subject, note, is_base_schedule, date_str)
            VALUES (${dayName}, ${classId}, ${periodIndex}, ${entry.teacherId}, ${entry.subject}, ${entry.note}, true, 'BASE')
            ON CONFLICT (day_name, class_id, period_index, is_base_schedule) 
            DO UPDATE SET 
              teacher_id = EXCLUDED.teacher_id, 
              subject = EXCLUDED.subject, 
              note = EXCLUDED.note
          `;
        }
      } 
      
      else if (type === 'SAVE_SUBSTITUTION') {
        const { dateStr, dayName, classId, periodIndex, override } = payload;
        
        // Constraint assumed: (date_str, class_id, period_index, is_base_schedule)
        if (!override) {
          await sql`
            DELETE FROM timetable 
            WHERE date_str = ${dateStr} 
              AND class_id = ${classId} 
              AND period_index = ${periodIndex} 
              AND is_base_schedule = false
          `;
        } else {
          await sql`
            INSERT INTO timetable (date_str, day_name, class_id, period_index, teacher_id, subject, note, is_base_schedule)
            VALUES (${dateStr}, ${dayName}, ${classId}, ${periodIndex}, ${override.subTeacherId}, ${override.subSubject}, ${override.subNote}, false)
            ON CONFLICT (date_str, class_id, period_index, is_base_schedule) 
            DO UPDATE SET 
              teacher_id = EXCLUDED.teacher_id, 
              subject = EXCLUDED.subject, 
              note = EXCLUDED.note
          `;
        }
      } 
      
      else if (type === 'SAVE_ATTENDANCE') {
        const { dateStr, teacherId, status } = payload;
        if (status === 'present') {
          await sql`DELETE FROM attendance WHERE date_str = ${dateStr} AND teacher_id = ${teacherId}`;
        } else {
          await sql`
            INSERT INTO attendance (date_str, teacher_id, status) VALUES (${dateStr}, ${teacherId}, ${status})
            ON CONFLICT (date_str, teacher_id) DO UPDATE SET status = EXCLUDED.status
          `;
        }
      } 
      
      else if (type === 'SAVE_INSTRUCTION') {
        const { dateStr, text } = payload;
        await sql`
          INSERT INTO instructions (date_str, text) VALUES (${dateStr}, ${text})
          ON CONFLICT (date_str) DO UPDATE SET text = EXCLUDED.text
        `;
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error in timetable.ts:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
