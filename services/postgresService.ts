
import { ScheduleEntry, DailyOverride, AttendanceStatus, ClassSection } from '../types';

export const postgresService = {
  classes: {
    getAll: async (): Promise<ClassSection[]> => {
      const res = await fetch('/api/classes');
      if (!res.ok) throw new Error("Failed to fetch classes");
      return await res.json();
    },
    save: async (cls: ClassSection) => {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cls)
      });
      if (!res.ok) throw new Error("Failed to save class");
      return await res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/classes?id=${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete class");
      return await res.json();
    }
  },
  timetable: {
    getEffective: async (dateStr: string, dayName: string): Promise<{ baseSchedule: Record<string, any>, dailyOverrides: Record<string, any>, attendance: Record<string, AttendanceStatus>, instruction: string }> => {
      const res = await fetch(`/api/timetable?dateStr=${dateStr}&dayName=${dayName}`);
      if (!res.ok) throw new Error(`API unavailable (${res.status})`);
      return await res.json();
    },

    saveBase: async (dayName: string, classId: string, periodIndex: number, entry: ScheduleEntry | null) => {
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
    },

    saveSubstitution: async (dateStr: string, dayName: string, classId: string, periodIndex: number, override: DailyOverride | null) => {
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
    },

    saveAttendance: async (dateStr: string, teacherId: string, status: AttendanceStatus) => {
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
    },

    saveInstruction: async (dateStr: string, text: string) => {
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
    },
    copySchedule: async (sourceDate: string, targetDate: string, targetDayName: string) => {
      const res = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'COPY_SCHEDULE',
          payload: { sourceDate, targetDate, targetDayName }
        })
      });
      if (!res.ok) throw new Error("API Copy failed");
      return await res.json();
    },
    repeatSchedule: async (sourceDate: string, targetDates: { dateStr: string, dayName: string }[]) => {
      const res = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'REPEAT_SCHEDULE',
          payload: { sourceDate, targetDates }
        })
      });
      if (!res.ok) throw new Error("API Repeat failed");
      return await res.json();
    }
  },
  teachers: {
    getAll: async () => {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error("Failed to fetch teachers");
      return await res.json();
    },
    save: async (teacher: any) => {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teacher)
      });
      if (!res.ok) throw new Error("Failed to save teacher");
      return await res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/teachers?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete teacher");
      return await res.json();
    }
  },
  remarks: {
    getAll: async () => {
      const res = await fetch('/api/remarks');
      if (!res.ok) throw new Error("Failed to fetch remarks");
      return await res.json();
    },
    save: async (remark: any) => {
      const res = await fetch('/api/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(remark)
      });
      if (!res.ok) throw new Error("Failed to save remark");
      return await res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/remarks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete remark");
      return await res.json();
    }
  },
  exams: {
    getAll: async () => {
      const res = await fetch('/api/exams');
      if (!res.ok) throw new Error("Failed to fetch exams");
      return await res.json();
    },
    save: async (exam: any) => {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exam)
      });
      if (!res.ok) throw new Error("Failed to save exam");
      return await res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/exams?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete exam");
      return await res.json();
    }
  },
  meetings: {
    getAll: async () => {
      const res = await fetch('/api/meetings');
      if (!res.ok) throw new Error("Failed to fetch meetings");
      return await res.json();
    },
    save: async (meeting: any) => {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meeting)
      });
      if (!res.ok) throw new Error("Failed to save meeting");
      return await res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/meetings?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete meeting");
      return await res.json();
    }
  },
  periods: {
    getAll: async (): Promise<any[]> => {
      const res = await fetch('/api/periods');
      if (!res.ok) throw new Error("Failed to fetch periods");
      return await res.json();
    },
    save: async (configs: any[]) => {
      const res = await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs)
      });
      if (!res.ok) throw new Error("Failed to save periods");
      return await res.json();
    }
  }
};
