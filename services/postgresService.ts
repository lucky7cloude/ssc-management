import { sql, isDbConnected } from '../lib/db';
import { ScheduleEntry, DailyOverride } from '../types';

export const postgresService = {
  timetable: {
    /**
     * Fetches effective schedule for a specific date and day.
     */
    getEffective: async (dateStr: string, dayName: string) => {
      if (!isDbConnected) return {};

      try {
        // Fetch both base and daily overrides in parallel
        const results = await sql`
          SELECT class_id, period_index, teacher_id, subject, note, is_base_schedule 
          FROM timetable 
          WHERE (date_str = ${dateStr} AND is_base_schedule = false)
             OR (day_name = ${dayName} AND is_base_schedule = true)
        `;

        const schedule: Record<string, any> = {};
        
        // Process results: Base first, then overrides
        results.forEach(row => {
          const key = `${row.class_id}_${row.period_index}`;
          if (row.is_base_schedule) {
              if (!schedule[key]) {
                  schedule[key] = { teacherId: row.teacher_id, subject: row.subject, note: row.note };
              }
          } else {
              // Overrides always take precedence
              schedule[key] = { 
                  subTeacherId: row.teacher_id, 
                  subSubject: row.subject, 
                  subNote: row.note,
                  isOverride: true 
              };
          }
        });

        return schedule;
      } catch (error) {
        console.error("Postgres Fetch Error:", error);
        return {};
      }
    },

    /**
     * Upserts a base schedule entry.
     */
    saveBase: async (dayName: string, classId: string, periodIndex: number, entry: ScheduleEntry | null) => {
      if (!isDbConnected) return null;

      try {
        if (!entry) {
          return await sql`
            DELETE FROM timetable 
            WHERE day_name = ${dayName} 
              AND class_id = ${classId} 
              AND period_index = ${periodIndex} 
              AND is_base_schedule = true
          `;
        }

        return await sql`
          INSERT INTO timetable (day_name, class_id, period_index, teacher_id, subject, note, is_base_schedule, date_str)
          VALUES (${dayName}, ${classId}, ${periodIndex}, ${entry.teacherId}, ${entry.subject}, ${entry.note}, true, 'BASE')
          ON CONFLICT (date_str, class_id, period_index, is_base_schedule) 
          DO UPDATE SET 
            teacher_id = EXCLUDED.teacher_id,
            subject = EXCLUDED.subject,
            note = EXCLUDED.note
        `;
      } catch (error) {
        console.error("Postgres Save Base Error:", error);
        throw error;
      }
    },

    /**
     * Upserts a daily override (substitution).
     */
    saveOverride: async (dateStr: string, dayName: string, classId: string, periodIndex: number, override: DailyOverride | null) => {
      if (!isDbConnected) return null;

      try {
        if (!override) {
          return await sql`
            DELETE FROM timetable 
            WHERE date_str = ${dateStr} 
              AND class_id = ${classId} 
              AND period_index = ${periodIndex} 
              AND is_base_schedule = false
          `;
        }

        return await sql`
          INSERT INTO timetable (date_str, day_name, class_id, period_index, teacher_id, subject, note, is_base_schedule)
          VALUES (${dateStr}, ${dayName}, ${classId}, ${periodIndex}, ${override.subTeacherId}, ${override.subSubject}, ${override.subNote}, false)
          ON CONFLICT (date_str, class_id, period_index, is_base_schedule) 
          DO UPDATE SET 
            teacher_id = EXCLUDED.teacher_id,
            subject = EXCLUDED.subject,
            note = EXCLUDED.note
        `;
      } catch (error) {
        console.error("Postgres Save Override Error:", error);
        throw error;
      }
    }
  }
};
