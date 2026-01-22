
import { Teacher, ScheduleEntry, DailyOverride, ClassSection, TeacherRemark, ExamSchedule, Substitution, AppNotification, PERIODS, DAYS, TeacherMeeting } from '../types';

const PREFIX = 'silver_star_cloud_v5_';
const CLOUD_SYNC_KEY = PREFIX + 'database_id';
const LOCAL_CACHE_KEY = PREFIX + 'local_db_cache';

// This is the "Master Key" for Silver Star Convent School.
// Anyone with this key can access and edit the same database.
const DEFAULT_SYNC_ID = 'silver-star-convent-school-official-db-2025';

export const getSyncId = () => localStorage.getItem(CLOUD_SYNC_KEY) || DEFAULT_SYNC_ID;

export const setSyncId = (id: string) => {
    localStorage.setItem(CLOUD_SYNC_KEY, id);
    window.location.reload(); // Reload to connect to the new database
};

// --- CLOUD ENGINE ---

// Push entire state to the cloud
const pushToCloud = async (data: any) => {
    const id = getSyncId();
    data.lastUpdated = Date.now();
    try {
        const response = await fetch(`https://keyvalue.xyz/1/${id}`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
            return true;
        }
        return false;
    } catch (e) {
        console.error("Cloud save failed", e);
        return false;
    }
};

// Pull entire state from cloud
export const fetchAllData = async () => {
    const id = getSyncId();
    try {
        const res = await fetch(`https://keyvalue.xyz/1/${id}`);
        if (!res.ok) {
            // If cloud is empty, initialize it with local data (Migration)
            const localData = getStore();
            await pushToCloud(localData);
            return localData;
        }
        const cloudData = await res.json();
        if (cloudData) {
            localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cloudData));
            return cloudData;
        }
        return null;
    } catch (e) {
        // Offline fallback
        const cache = localStorage.getItem(LOCAL_CACHE_KEY);
        return cache ? JSON.parse(cache) : null;
    }
};

// Get current state from local cache
const getStore = () => {
    const cache = localStorage.getItem(LOCAL_CACHE_KEY);
    return cache ? JSON.parse(cache) : {
        teachers: [],
        baseSchedule: {},
        overrides: {},
        classes: [],
        remarks: [],
        exams: [],
        meetings: [],
        attendance: {},
        notes: {},
        instructions: {},
        notifications: [],
        lastUpdated: 0
    };
};

// Update a specific key in the cloud store
const updateStore = async (key: string, value: any) => {
    const store = getStore();
    store[key] = value;
    
    // Broadcast "Saving..." status
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'SYNCING' }));
    
    const success = await pushToCloud(store);
    
    // Broadcast result
    window.dispatchEvent(new CustomEvent('sync-status', { detail: success ? 'IDLE' : 'ERROR' }));
    window.dispatchEvent(new CustomEvent('data-updated'));
    
    return store[key];
};

// --- DATA ACCESSORS ---

export const getTeachers = (): Teacher[] => getStore().teachers || [];
export const saveTeacher = async (teacher: Teacher) => {
    const teachers = getTeachers();
    const index = teachers.findIndex(t => t.id === teacher.id);
    if (index >= 0) teachers[index] = teacher;
    else teachers.push(teacher);
    return await updateStore('teachers', teachers);
};
export const deleteTeacher = async (id: string) => {
    const teachers = getTeachers().filter(t => t.id !== id);
    return await updateStore('teachers', teachers);
};

export const getClasses = (): ClassSection[] => {
    const store = getStore();
    if (store.classes && store.classes.length > 0) return store.classes;
    // Default classes if none exist
    return [
        { id: 'c6', name: 'Class 6', section: 'SECONDARY' },
        { id: 'c7', name: 'Class 7', section: 'SECONDARY' },
        { id: 'c8', name: 'Class 8', section: 'SECONDARY' },
        { id: 'c9', name: 'Class 9', section: 'SECONDARY' },
        { id: 'c10', name: 'Class 10', section: 'SECONDARY' },
        { id: 'c11s', name: '11th Science', section: 'SENIOR_SECONDARY' },
        { id: 'c11c', name: '11th Commerce', section: 'SENIOR_SECONDARY' },
        { id: 'c12s', name: '12th Science', section: 'SENIOR_SECONDARY' },
        { id: 'c12c', name: '12th Commerce', section: 'SENIOR_SECONDARY' },
    ];
};
export const saveClasses = async (classes: ClassSection[]) => updateStore('classes', classes);
export const deleteClass = async (classId: string) => {
    const updated = getClasses().filter(c => c.id !== classId);
    return await saveClasses(updated);
};

export const getBaseSchedule = (dayName: string): Record<string, ScheduleEntry> => getStore().baseSchedule[dayName] || {};
export const saveBaseEntry = async (dayName: string, classId: string, periodIndex: number, entry: ScheduleEntry | null) => {
    const store = getStore();
    if (!store.baseSchedule[dayName]) store.baseSchedule[dayName] = {};
    const key = `${classId}_${periodIndex}`;
    if (entry) store.baseSchedule[dayName][key] = entry;
    else delete store.baseSchedule[dayName][key];
    return await updateStore('baseSchedule', store.baseSchedule);
};

export const getDailyOverrides = (dateStr: string): Record<string, DailyOverride> => getStore().overrides[dateStr] || {};
export const saveDailyOverride = async (dateStr: string, classId: string, periodIndex: number, override: DailyOverride | null) => {
    const store = getStore();
    if (!store.overrides[dateStr]) store.overrides[dateStr] = {};
    const key = `${classId}_${periodIndex}`;
    if (override) store.overrides[dateStr][key] = override;
    else delete store.overrides[dateStr][key];
    return await updateStore('overrides', store.overrides);
};

export const getEffectiveSchedule = (dateStr: string, dayName: string) => {
    const base = getBaseSchedule(dayName);
    const overrides = getDailyOverrides(dateStr);
    const effective: Record<string, any> = { ...base };
    Object.keys(overrides).forEach(key => {
        if (overrides[key]) effective[key] = { ...(base[key] || {}), ...overrides[key], isOverride: true };
    });
    return effective;
};

export const getRemarks = (): TeacherRemark[] => getStore().remarks || [];
export const addRemark = async (remark: TeacherRemark) => {
    const remarks = getRemarks();
    remarks.push(remark);
    return await updateStore('remarks', remarks);
};
export const deleteRemark = async (id: string) => {
    const remarks = getRemarks().filter(r => r.id !== id);
    return await updateStore('remarks', remarks);
};

export const getExams = (): ExamSchedule[] => getStore().exams || [];
export const addExam = async (exam: ExamSchedule) => {
    const exams = getExams();
    exams.push(exam);
    return await updateStore('exams', exams);
};
export const deleteExam = async (id: string) => {
    const exams = getExams().filter(e => e.id !== id);
    return await updateStore('exams', exams);
};

export const getMeetings = (): TeacherMeeting[] => getStore().meetings || [];
export const saveMeeting = async (meeting: TeacherMeeting) => {
    const meetings = getMeetings();
    const index = meetings.findIndex(m => m.id === meeting.id);
    if (index >= 0) meetings[index] = meeting;
    else meetings.push(meeting);
    return await updateStore('meetings', meetings);
};
export const deleteMeeting = async (id: string) => {
    const meetings = getMeetings().filter(m => m.id !== id);
    return await updateStore('meetings', meetings);
};

export const getAttendanceForDate = (dateStr: string) => (getStore().attendance || {})[dateStr] || {};
export const markTeacherAttendance = async (dateStr: string, teacherId: string, status: 'present' | 'absent') => {
    const store = getStore();
    if (!store.attendance) store.attendance = {};
    if (!store.attendance[dateStr]) store.attendance[dateStr] = {};
    if (status === 'present') delete store.attendance[dateStr][teacherId];
    else store.attendance[dateStr][teacherId] = 'absent';
    return await updateStore('attendance', store.attendance);
};

export const getTeacherInstructions = (date: string) => (getStore().instructions || {})[date] || '';
export const saveTeacherInstructions = async (date: string, instructions: string) => {
    const store = getStore();
    if (!store.instructions) store.instructions = {};
    store.instructions[date] = instructions;
    return await updateStore('instructions', store.instructions);
};

export const getNotifications = (): AppNotification[] => getStore().notifications || [];
export const clearNotifications = async () => updateStore('notifications', []);

// Function to find free teachers
export const getFreeTeachers = (dateStr: string, dayName: string, periodIndex: number): Teacher[] => {
    const teachers = getTeachers();
    const attendance = getAttendanceForDate(dateStr);
    const schedule = getEffectiveSchedule(dateStr, dayName);
    return teachers.filter(t => {
        if (attendance[t.id] === 'absent') return false;
        return !Object.keys(schedule).some(key => {
            const [_, pIdx] = key.split('_');
            if (parseInt(pIdx) !== periodIndex) return false;
            const entry = schedule[key];
            return entry && (entry.teacherId === t.id || entry.subTeacherId === t.id || entry.splitTeacherId === t.id);
        });
    });
};
