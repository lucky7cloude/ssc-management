import { ScheduleEntry, DailyOverride } from '../types';

export const postgresService = {
  timetable: {
    /**
     * Fetches effective schedule via the proxy API.
     */
    getEffective: async (dateStr: string, dayName: string) => {
      try {
        const res = await fetch(`/api/timetable?dateStr=${dateStr}&dayName=${dayName}`);
        if (!res.ok) throw new Error('Fetch failed');
        return await res.json();
      } catch (error) {
        console.error("API Fetch Error:", error);
        return {};
      }
    },

    /**
     * Upserts a base schedule entry via the proxy API.
     */
    saveBase: async (dayName: string, classId: string, periodIndex: number, entry: ScheduleEntry | null) => {
      const res = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SAVE_BASE',
          payload: { dayName, classId, periodIndex, entry }
        })
      });
      if (!res.ok) throw new Error('Save base failed');
      return await res.json();
    },

    /**
     * Upserts a daily override via the proxy API.
     */
    saveOverride: async (dateStr: string, dayName: string, classId: string, periodIndex: number, override: DailyOverride | null) => {
      const res = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SAVE_OVERRIDE',
          payload: { dateStr, dayName, classId, periodIndex, override }
        })
      });
      if (!res.ok) throw new Error('Save override failed');
      return await res.json();
    }
  }
};