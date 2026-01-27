
import { ScheduleEntry, DailyOverride, AttendanceStatus, ClassSection } from '../types';
import * as dataService from './dataService';

export const postgresService = {
  classes: {
    getAll: async () => {
      try {
        const res = await fetch('/api/classes');
        if (!res.ok) throw new Error("Failed to fetch classes");
        return await res.json();
      } catch (e) {
        console.warn("API Error, using fallback data");
        return dataService.getClasses();
      }
    },
    save: async (cls: ClassSection) => {
      try {
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cls)
        });
        if (!res.ok) throw new Error("Failed to save class");
        return await res.json();
      } catch (e) {
        // Fallback not strictly needed for mutation if we assume online, but consistent with pattern:
        return { success: false }; // Fail silently or handle local logic if needed
      }
    },
    delete: async (id: string) => {
      try {
        const res = await fetch(`/api/classes?id=${id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error("Failed to delete class");
        return await res.json();
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
  },
  timetable: {
    getEffective: async (dateStr: string, dayName: string) => {
      try {
        const res = await fetch(`/api/timetable?dateStr=${dateStr}&dayName=${dayName}`);
        if (!res.ok) {
          throw new Error(`API unavailable (${res.status})`);
        }
        return await res.json();
      } catch (error: any) {
        console.warn("API unavailable, falling back to local storage:", error.message);
        // Fallback to local mock data
        const [schedule, attendance, instruction] = await Promise.all([
          dataService.getEffectiveSchedule(dateStr, dayName),
          dataService.getAttendanceForDate(dateStr),
          dataService.getTeacherInstructions(dateStr)
        ]);
        return { schedule, attendance, instruction };
      }
    },

    saveBase: async (dayName: string, classId: string, periodIndex: number, entry: ScheduleEntry | null) => {
      try {
        const res = await fetch('/api/timetable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'SAVE_BASE',
            payload: { dayName, classId, periodIndex, entry }
          })
        });
        if (!res.ok) throw new Error("API Save failed");
        return await res.json();
      } catch (e) {
        // Fallback
        await dataService.saveBaseEntry(dayName, classId, periodIndex, entry);
        return { success: true };
      }
    },

    saveSubstitution: async (dateStr: string, dayName: string, classId: string, periodIndex: number, override: DailyOverride | null) => {
      try {
        const res = await fetch('/api/timetable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'SAVE_SUBSTITUTION',
            payload: { dateStr, dayName, classId, periodIndex, override }
          })
        });
        if (!res.ok) throw new Error("API Save failed");
        return await res.json();
      } catch (e) {
        // Fallback
        await dataService.saveDailyOverride(dateStr, classId, periodIndex, override);
        return { success: true };
      }
    },

    saveAttendance: async (dateStr: string, teacherId: string, status: AttendanceStatus) => {
      try {
        const res = await fetch('/api/timetable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'SAVE_ATTENDANCE',
            payload: { dateStr, teacherId, status }
          })
        });
        if (!res.ok) throw new Error("API Save failed");
        return await res.json();
      } catch (e) {
        // Fallback
        await dataService.markTeacherAttendance(dateStr, teacherId, status);
        return { success: true };
      }
    },

    saveInstruction: async (dateStr: string, text: string) => {
      try {
        const res = await fetch('/api/timetable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'SAVE_INSTRUCTION',
            payload: { dateStr, text }
          })
        });
        if (!res.ok) throw new Error("API Save failed");
        return await res.json();
      } catch (e) {
        // Fallback
        await dataService.saveTeacherInstructions(dateStr, text);
        return { success: true };
      }
    }
  }
};
