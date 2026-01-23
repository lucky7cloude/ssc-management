
import { Teacher, ScheduleEntry, DailyOverride, ClassSection, TeacherRemark, ExamSchedule, Substitution, AppNotification, PERIODS, DAYS, TeacherMeeting, AttendanceStatus } from '../types';

const PREFIX = 'silver_star_cloud_v6_'; // Incremented version
const CLOUD_SYNC_KEY = PREFIX + 'database_id';
const LOCAL_CACHE_KEY = PREFIX + 'local_db_cache';

// JSONBlob Endpoint
const BLOB_API = 'https://jsonblob.com/api/jsonBlob';

export const getSyncId = () => localStorage.getItem(CLOUD_SYNC_KEY);

export const setSyncId = (id: string) => {
    localStorage.setItem(CLOUD_SYNC_KEY, id);
    // Force a reload to ensure fresh state
    window.location.reload(); 
};

// --- CLOUD ENGINE ---

const createNewDatabase = async (initialData: any) => {
    try {
        const response = await fetch(BLOB_API, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(initialData),
            mode: 'cors'
        });
        
        if (response.ok) {
            const location = response.headers.get('Location');
            if (location) {
                const newId = location.split('/').pop(); // Extract ID from URL
                if (newId) {
                    localStorage.setItem(CLOUD_SYNC_KEY, newId);
                    return newId;
                }
            }
        }
    } catch (e) {
        console.error("Failed to create cloud DB:", e);
    }
    return null;
};

const pushToCloud = async (data: any) => {
    if (!navigator.onLine) return false;
    let id = getSyncId();
    
    // If no ID exists, create one first
    if (!id) {
        id = await createNewDatabase(data);
        if (!id) return false; // Creation failed
    }

    data.lastUpdated = Date.now();
    try {
        const response = await fetch(`${BLOB_API}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });
        return response.ok;
    } catch (e) {
        console.warn("Cloud sync currently unavailable, saved locally.");
        return false;
    }
};

export const fetchAllData = async () => {
    let id = getSyncId();
    
    try {
        if (!navigator.onLine) throw new Error("Offline");

        // If no ID, create a fresh database with local default data
        if (!id) {
            const localDefault = getStore();
            await pushToCloud(localDefault); // This sets the ID in localStorage
            return localDefault;
        }
        
        const res = await fetch(`${BLOB_API}/${id}`, { 
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            // If 404, the blob might be expired or invalid. 
            // We keep local data but don't overwrite cloud unless user explicitly resets.
            console.warn("Cloud DB not found or error.");
            return getStore();
        }

        const cloudData = await res.json();
        if (cloudData && typeof cloudData === 'object') {
            const local = getStore();
            // Simple conflict resolution: Cloud wins if it's newer or we are forcing a pull
            if (!local.lastUpdated || (cloudData.lastUpdated && cloudData.lastUpdated >= local.lastUpdated)) {
                localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cloudData));
                window.dispatchEvent(new CustomEvent('data-updated'));
            }
            return cloudData;
        }
        return getStore();
    } catch (e) {
        return getStore();
    }
};

const getStore = () => {
    try {
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
    } catch (e) {
        return {
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
    }
};

const updateStore = async (key: string, value: any) => {
    const store = getStore();
    store[key] = value;
    store.lastUpdated = Date.now();
    
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('data-updated'));
    
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'SYNCING' }));
    const success = await pushToCloud(store);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: success ? 'IDLE' : 'ERROR' }));
    
    return store[key];
};

// --- DATA ACCESSORS ---

export const getTeachers = (): Teacher[] => getStore().teachers || [];
export const saveTeacher = async (teacher: Teacher) => {
    const teachers = [...getTeachers()]; 
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

export const getAttendanceStore = () => getStore().attendance || {};

export const getAttendanceForDate = (dateStr: string): Record<string, AttendanceStatus> => (getStore().attendance || {})[dateStr] || {};
export const markTeacherAttendance = async (dateStr: string, teacherId: string, status: AttendanceStatus) => {
    const store = getStore();
    if (!store.attendance) store.attendance = {};
    if (!store.attendance[dateStr]) store.attendance[dateStr] = {};
    
    if (status === 'present') delete store.attendance[dateStr][teacherId];
    else store.attendance[dateStr][teacherId] = status;
    
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

/**
 * Returns a list of periods today where a teacher is absent but no substitution is planned yet.
 */
export const getUnfilledAbsentPeriods = (dateStr: string, dayName: string) => {
    const attendance = getAttendanceForDate(dateStr);
    const base = getBaseSchedule(dayName);
    const overrides = getDailyOverrides(dateStr);
    const unfilled: Array<{ classId: string, periodIndex: number, originalTeacherId: string }> = [];

    const LUNCH_PERIOD_INDEX = 3;

    Object.keys(base).forEach(key => {
        const entry = base[key];
        if (!entry || !entry.teacherId) return;

        const [classId, pIdxStr] = key.split('_');
        const periodIndex = parseInt(pIdxStr);
        if (periodIndex === LUNCH_PERIOD_INDEX) return;

        const status = attendance[entry.teacherId];
        if (!status || status === 'present') return;

        const isAbsentMorning = status === 'absent' || status === 'half_day_before';
        const isAbsentAfternoon = status === 'absent' || status === 'half_day_after';
        
        const isCurrentlyAbsent = periodIndex < LUNCH_PERIOD_INDEX ? isAbsentMorning : isAbsentAfternoon;
        if (!isCurrentlyAbsent) return;

        const override = overrides[key];
        if (override && (override.subTeacherId || override.subNote)) return;

        unfilled.push({ classId, periodIndex, originalTeacherId: entry.teacherId });
    });

    return unfilled;
};

export type TeacherDetailedStatus = {
    type: 'FREE' | 'BUSY' | 'ABSENT' | 'MORNING_LEAVE' | 'AFTERNOON_LEAVE',
    busyInClass?: string
};

export const getTeacherDetailedStatus = (teacherId: string, dateStr: string, dayName: string, periodIndex: number): TeacherDetailedStatus => {
    const attendance = getAttendanceForDate(dateStr);
    const schedule = getEffectiveSchedule(dateStr, dayName);
    const status = attendance[teacherId];
    const LUNCH_PERIOD_INDEX = 3;

    if (status === 'absent') return { type: 'ABSENT' };
    if (status === 'half_day_before' && periodIndex < LUNCH_PERIOD_INDEX) return { type: 'MORNING_LEAVE' };
    if (status === 'half_day_after' && periodIndex > LUNCH_PERIOD_INDEX) return { type: 'AFTERNOON_LEAVE' };

    const busySlotKey = Object.keys(schedule).find(key => {
        const [_, pIdxStr] = key.split('_');
        if (parseInt(pIdxStr) !== periodIndex) return false;
        const entry = schedule[key];
        return entry && (entry.teacherId === teacherId || entry.subTeacherId === teacherId || entry.splitTeacherId === teacherId);
    });

    if (busySlotKey) {
        const [classId] = busySlotKey.split('_');
        const cls = getClasses().find(c => c.id === classId);
        return { type: 'BUSY', busyInClass: cls?.name || 'Class' };
    }

    return { type: 'FREE' };
};

export const getFreeTeachers = (dateStr: string, dayName: string, periodIndex: number): Teacher[] => {
    const teachers = getTeachers();
    return teachers.filter(t => getTeacherDetailedStatus(t.id, dateStr, dayName, periodIndex).type === 'FREE');
};

export const getTeacherScheduleForDay = (teacherId: string, dateStr: string, dayName: string) => {
    const effective = getEffectiveSchedule(dateStr, dayName);
    const results: Array<{ classId: string, periodIndex: number, entry: any }> = [];
    
    Object.keys(effective).forEach(key => {
        const entry = effective[key];
        if (entry.teacherId === teacherId || entry.subTeacherId === teacherId || entry.splitTeacherId === teacherId) {
            const [classId, pIdxStr] = key.split('_');
            results.push({ classId, periodIndex: parseInt(pIdxStr), entry });
        }
    });
    return results;
};
