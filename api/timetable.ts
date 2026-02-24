
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined.');
    return res.status(500).json({ error: 'Database configuration missing.' });
  }

  const sql = neon(databaseUrl);

  // Ensure columns exist (Migration)
  try {
    await sql`ALTER TABLE timetable ADD COLUMN IF NOT EXISTS split_teacher_id TEXT`;
    await sql`ALTER TABLE timetable ADD COLUMN IF NOT EXISTS split_subject TEXT`;
    await sql`ALTER TABLE timetable ADD COLUMN IF NOT EXISTS split_note TEXT`;
    await sql`ALTER TABLE timetable ADD COLUMN IF NOT EXISTS merged_class_ids TEXT`;
  } catch (e) {
    console.error("Migration error:", e);
  }

  try {
    const { method } = req;

    if (method === 'GET') {
      const { dateStr, dayName } = req.query;
      if (!dateStr || !dayName) return res.status(400).json({ error: 'Missing parameters' });

      // Fetch data
      const [baseRows, subRows, attendanceRows, instructionRows] = await Promise.all([
        sql`SELECT class_id, period_index, teacher_id, subject, note, split_teacher_id, split_subject, split_note, merged_class_ids FROM timetable WHERE day_name = ${dayName} AND is_base_schedule = true`,
        sql`SELECT class_id, period_index, teacher_id, subject, note, split_teacher_id, split_subject, split_note, merged_class_ids FROM timetable WHERE date_str = ${dateStr} AND is_base_schedule = false`,
        sql`SELECT teacher_id, status FROM attendance WHERE date_str = ${dateStr}`,
        sql`SELECT text FROM instructions WHERE date_str = ${dateStr}`
      ]);

      const baseSchedule: Record<string, any> = {};
      const dailyOverrides: Record<string, any> = {};
      const attendance: Record<string, string> = {};
      
      attendanceRows.forEach((r: any) => attendance[r.teacher_id] = r.status);

      baseRows.forEach((row: any) => {
        const key = `${row.class_id}_${row.period_index}`;
        baseSchedule[key] = { 
          teacherId: row.teacher_id, 
          subject: row.subject, 
          note: row.note,
          splitTeacherId: row.split_teacher_id,
          splitSubject: row.split_subject,
          splitNote: row.split_note,
          mergedClassIds: row.merged_class_ids ? JSON.parse(row.merged_class_ids) : null,
          status: attendance[row.teacher_id] || 'present' 
        };
      });

      subRows.forEach((row: any) => {
        const key = `${row.class_id}_${row.period_index}`;
        dailyOverrides[key] = { 
          subTeacherId: row.teacher_id, 
          subSubject: row.subject, 
          subNote: row.note, 
          splitTeacherId: row.split_teacher_id,
          splitSubject: row.split_subject,
          splitNote: row.split_note,
          mergedClassIds: row.merged_class_ids ? JSON.parse(row.merged_class_ids) : null,
          isOverride: true,
          status: row.teacher_id ? (attendance[row.teacher_id] || 'present') : 'present'
        };
      });

      return res.status(200).json({
        baseSchedule,
        dailyOverrides,
        attendance,
        instruction: instructionRows[0]?.text || ''
      });
    }

    if (method === 'POST') {
      const { type, payload } = req.body;
      console.log(`Processing ${type}`, payload);

      if (type === 'SAVE_BASE') {
        const { dayName, classId, periodIndex, entry } = payload;
        
        await sql`
          DELETE FROM timetable 
          WHERE day_name = ${dayName} 
            AND class_id = ${classId} 
            AND period_index = ${periodIndex} 
            AND is_base_schedule = true
        `;

        if (entry) {
          await sql`
            INSERT INTO timetable (day_name, class_id, period_index, teacher_id, subject, note, is_base_schedule, date_str, split_teacher_id, split_subject, split_note, merged_class_ids)
            VALUES (
              ${dayName}, 
              ${classId}, 
              ${periodIndex}, 
              ${entry.teacherId || null}, 
              ${entry.subject || null}, 
              ${entry.note || null}, 
              true, 
              'BASE',
              ${entry.splitTeacherId || null},
              ${entry.splitSubject || null},
              ${entry.splitNote || null},
              ${entry.mergedClassIds ? JSON.stringify(entry.mergedClassIds) : null}
            )
          `;
        }
      } 
      
      else if (type === 'SAVE_SUBSTITUTION') {
        const { dateStr, dayName, classId, periodIndex, override } = payload;
        
        await sql`
          DELETE FROM timetable 
          WHERE date_str = ${dateStr} 
            AND class_id = ${classId} 
            AND period_index = ${periodIndex} 
            AND is_base_schedule = false
        `;

        if (override) {
          await sql`
            INSERT INTO timetable (date_str, day_name, class_id, period_index, teacher_id, subject, note, is_base_schedule, split_teacher_id, split_subject, split_note, merged_class_ids)
            VALUES (
              ${dateStr}, 
              ${dayName}, 
              ${classId}, 
              ${periodIndex}, 
              ${override.subTeacherId || null}, 
              ${override.subSubject || null}, 
              ${override.subNote || null}, 
              false,
              ${override.splitTeacherId || null},
              ${override.splitSubject || null},
              ${override.splitNote || null},
              ${override.mergedClassIds ? JSON.stringify(override.mergedClassIds) : null}
            )
          `;
        }
      } 
      
      else if (type === 'SAVE_ATTENDANCE') {
        const { dateStr, teacherId, status } = payload;
        await sql`DELETE FROM attendance WHERE date_str = ${dateStr} AND teacher_id = ${teacherId}`;
        
        if (status !== 'present') {
          await sql`
            INSERT INTO attendance (date_str, teacher_id, status) VALUES (${dateStr}, ${teacherId}, ${status})
          `;
        }
      } 
      
      else if (type === 'SAVE_INSTRUCTION') {
        const { dateStr, text } = payload;
        await sql`DELETE FROM instructions WHERE date_str = ${dateStr}`;
        
        if (text) {
          await sql`
            INSERT INTO instructions (date_str, text) VALUES (${dateStr}, ${text})
          `;
        }
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error in timetable.ts:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
