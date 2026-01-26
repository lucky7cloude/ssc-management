import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || '');

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const { dateStr, dayName } = req.query;

      const results = await sql`
        SELECT class_id, period_index, teacher_id, subject, note, is_base_schedule 
        FROM timetable 
        WHERE (date_str = ${dateStr} AND is_base_schedule = false)
           OR (day_name = ${dayName} AND is_base_schedule = true)
      `;

      const schedule: Record<string, any> = {};
      results.forEach((row: any) => {
        const key = `${row.class_id}_${row.period_index}`;
        if (row.is_base_schedule) {
          if (!schedule[key]) {
            schedule[key] = { teacherId: row.teacher_id, subject: row.subject, note: row.note };
          }
        } else {
          schedule[key] = { 
            subTeacherId: row.teacher_id, 
            subSubject: row.subject, 
            subNote: row.note,
            isOverride: true 
          };
        }
      });

      return res.status(200).json(schedule);
    } 

    if (req.method === 'POST') {
      const { type, payload } = req.body;

      if (type === 'SAVE_BASE') {
        const { dayName, classId, periodIndex, entry } = payload;
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
            ON CONFLICT (date_str, class_id, period_index, is_base_schedule) 
            DO UPDATE SET 
              teacher_id = EXCLUDED.teacher_id,
              subject = EXCLUDED.subject,
              note = EXCLUDED.note
          `;
        }
      } else if (type === 'SAVE_OVERRIDE') {
        const { dateStr, dayName, classId, periodIndex, override } = payload;
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

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}