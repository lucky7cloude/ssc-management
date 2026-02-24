
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
    getEffective: async (dateStr: string, dayName: string): Promise<{ schedule: Record<string, any>, attendance: Record<string, AttendanceStatus>, instruction: string }> => {
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
      return await res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/teachers?id=${id}`, { method: 'DELETE' });
      return await res.json();
    }
  },
  remarks: {
    getAll: async () => {
      const res = await fetch('/api/remarks');
      return await res.json();
    },
    save: async (remark: any) => {
      const res = await fetch('/api/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(remark)
      });
      return await res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/remarks?id=${id}`, { method: 'DELETE' });
      return await res.json();
    }
  },
  exams: {
    getAll: async () => {
      const res = await fetch('/api/exams');
      return await res.json();
    },
    save: async (exam: any) => {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exam)
      });
      return await res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/exams?id=${id}`, { method: 'DELETE' });
      return await res.json();
    }
  },
  meetings: {
    getAll: async () => {
      const res = await fetch('/api/meetings');
      return await res.json();
    },
    save: async (meeting: any) => {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meeting)
      });
      return await res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/meetings?id=${id}`, { method: 'DELETE' });
      return await res.json();
    }
  }
};
