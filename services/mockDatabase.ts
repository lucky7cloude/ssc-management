import { Teacher, ClassSection, ScheduleEntry, DailyOverride, TeacherRemark, ExamSchedule, TeacherMeeting, AttendanceStatus, AppNotification, DEFAULT_CLASSES } from '../types';

const LOCAL_CACHE_KEY = 'ssc_cloud_v7_local_db_cache';

const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

const getStore = () => {
    try {
        const cache = localStorage.getItem(LOCAL_CACHE_KEY);
        return cache ? JSON.parse(cache) : {
            teachers: [], baseSchedule: {}, overrides: {}, classes: DEFAULT_CLASSES, remarks: [],
            exams: [], meetings: [], attendance: {}, notes: {}, instructions: {},
            notifications: [], lastUpdated: 0
        };
    } catch (e) {
        return { teachers: [], baseSchedule: {}, overrides: {}, classes: DEFAULT_CLASSES, remarks: [], exams: [], meetings: [], attendance: {}, notes: {}, instructions: {}, lastUpdated: 0 };
    }
};

const updateStore = (key: string, value: any) => {
    const store = getStore();
    store[key] = value;
    store.lastUpdated = Date.now();
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(store));
    return store[key];
};

export const mockDb = {
    teachers: {
        getAll: async (): Promise<Teacher[]> => {
            await delay();
            return getStore().teachers || [];
        },
        save: async (teacher: Teacher): Promise<Teacher[]> => {
            await delay();
            const teachers = [...getStore().teachers];
            const index = teachers.findIndex(t => t.id === teacher.id);
            if (index >= 0) teachers[index] = teacher;
            else teachers.push(teacher);
            return updateStore('teachers', teachers);
        },
        delete: async (id: string): Promise<Teacher[]> => {
            await delay();
            const teachers = getStore().teachers.filter((t: Teacher) => t.id !== id);
            return updateStore('teachers', teachers);
        }
    },
    classes: {
        getAll: async (): Promise<ClassSection[]> => {
            await delay();
            const store = getStore();
            return (store.classes && store.classes.length > 0) ? store.classes : DEFAULT_CLASSES;
        },
        saveAll: async (classes: ClassSection[]): Promise<ClassSection[]> => {
            await delay();
            return updateStore('classes', classes);
        }
    },
    schedule: {
        getBase: async (dayName: string): Promise<Record<string, ScheduleEntry>> => {
            await delay();
            return getStore().baseSchedule[dayName] || {};
        },
        saveBase: async (dayName: string, classId: string, periodIndex: number, entry: ScheduleEntry | null) => {
            await delay();
            const store = getStore();
            if (!store.baseSchedule[dayName]) store.baseSchedule[dayName] = {};
            const key = `${classId}_${periodIndex}`;
            if (entry) store.baseSchedule[dayName][key] = entry;
            else delete store.baseSchedule[dayName][key];
            return updateStore('baseSchedule', store.baseSchedule);
        },
        getOverrides: async (dateStr: string): Promise<Record<string, DailyOverride>> => {
            await delay();
            return getStore().overrides[dateStr] || {};
        },
        saveOverride: async (dateStr: string, classId: string, periodIndex: number, override: DailyOverride | null) => {
            await delay();
            const store = getStore();
            if (!store.overrides[dateStr]) store.overrides[dateStr] = {};
            const key = `${classId}_${periodIndex}`;
            if (override) store.overrides[dateStr][key] = override;
            else delete store.overrides[dateStr][key];
            return updateStore('overrides', store.overrides);
        }
    },
    attendance: {
        getForDate: async (dateStr: string): Promise<Record<string, AttendanceStatus>> => {
            await delay();
            return (getStore().attendance || {})[dateStr] || {};
        },
        mark: async (dateStr: string, teacherId: string, status: AttendanceStatus) => {
            await delay();
            const store = getStore();
            if (!store.attendance) store.attendance = {};
            if (!store.attendance[dateStr]) store.attendance[dateStr] = {};
            if (status === 'present') delete store.attendance[dateStr][teacherId];
            else store.attendance[dateStr][teacherId] = status;
            return updateStore('attendance', store.attendance);
        }
    },
    remarks: {
        getAll: async (): Promise<TeacherRemark[]> => {
            await delay();
            return getStore().remarks || [];
        },
        add: async (remark: TeacherRemark): Promise<TeacherRemark[]> => {
            await delay();
            const remarks = [...(getStore().remarks || [])];
            remarks.push(remark);
            return updateStore('remarks', remarks);
        },
        delete: async (id: string): Promise<TeacherRemark[]> => {
            await delay();
            const remarks = getStore().remarks.filter((r: TeacherRemark) => r.id !== id);
            return updateStore('remarks', remarks);
        }
    },
    exams: {
        getAll: async (): Promise<ExamSchedule[]> => {
            await delay();
            return getStore().exams || [];
        },
        save: async (exam: ExamSchedule): Promise<ExamSchedule[]> => {
            await delay();
            const exams = [...(getStore().exams || [])];
            exams.push(exam);
            return updateStore('exams', exams);
        },
        delete: async (id: string): Promise<ExamSchedule[]> => {
            await delay();
            const exams = getStore().exams.filter((e: ExamSchedule) => e.id !== id);
            return updateStore('exams', exams);
        }
    },
    meetings: {
        getAll: async (): Promise<TeacherMeeting[]> => {
            await delay();
            return getStore().meetings || [];
        },
        save: async (meeting: TeacherMeeting): Promise<TeacherMeeting[]> => {
            await delay();
            const meetings = [...(getStore().meetings || [])];
            const index = meetings.findIndex(m => m.id === meeting.id);
            if (index >= 0) meetings[index] = meeting;
            else meetings.push(meeting);
            return updateStore('meetings', meetings);
        },
        delete: async (id: string): Promise<TeacherMeeting[]> => {
            await delay();
            const meetings = getStore().meetings.filter((m: TeacherMeeting) => m.id !== id);
            return updateStore('meetings', meetings);
        }
    },
    instructions: {
        get: async (date: string): Promise<string> => {
            await delay();
            return (getStore().instructions || {})[date] || '';
        },
        save: async (date: string, text: string) => {
            await delay();
            const store = getStore();
            if (!store.instructions) store.instructions = {};
            store.instructions[date] = text;
            return updateStore('instructions', store.instructions);
        }
    }
};