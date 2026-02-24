
import { Teacher, ScheduleEntry, DailyOverride, ClassSection, TeacherRemark, ExamSchedule, TeacherMeeting, AttendanceStatus, AppNotification } from '../types';
import { postgresService } from './postgresService';

// Local Storage Cache Key
const CACHE_KEY = 'ssc_cloud_v7_local_db_cache';

const getCache = () => {
    try {
        const data = localStorage.getItem(CACHE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) { return {}; }
};

const setCache = (data: any) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
};

// API Layer pointing to our Real Database via postgresService
export const getTeachers = async (): Promise<Teacher[]> => {
    try {
        return await postgresService.teachers.getAll();
    } catch (e) {
        console.warn("Using cached teachers");
        return getCache().teachers || [];
    }
};

export const saveTeacher = async (teacher: Teacher) => {
    try {
        await postgresService.teachers.save(teacher);
    } catch (e) {
        const cache = getCache();
        cache.teachers = (cache.teachers || []).filter((t: Teacher) => t.id !== teacher.id);
        cache.teachers.push(teacher);
        setCache(cache);
    }
};

export const deleteTeacher = async (id: string) => {
    try {
        await postgresService.teachers.delete(id);
    } catch (e) {
        const cache = getCache();
        cache.teachers = (cache.teachers || []).filter((t: Teacher) => t.id !== id);
        setCache(cache);
    }
};

export const getClasses = async (): Promise<ClassSection[]> => {
    try {
        return await postgresService.classes.getAll();
    } catch (e) {
        return getCache().classes || [];
    }
};

export const saveClasses = async (classes: ClassSection[]) => {
    try {
        for (const cls of classes) {
            await postgresService.classes.save(cls);
        }
    } catch (e) {
        const cache = getCache();
        cache.classes = classes;
        setCache(cache);
    }
};

export const getBaseSchedule = async (dayName: string): Promise<Record<string, ScheduleEntry>> => {
    try {
        const data = await postgresService.timetable.getEffective('BASE', dayName);
        return data.schedule;
    } catch (e) {
        return getCache().baseSchedule?.[dayName] || {};
    }
};

export const saveBaseEntry = async (dayName: string, classId: string, periodIndex: number, entry: ScheduleEntry | null) => {
    try {
        await postgresService.timetable.saveBase(dayName, classId, periodIndex, entry);
    } catch (e) {
        const cache = getCache();
        if (!cache.baseSchedule) cache.baseSchedule = {};
        if (!cache.baseSchedule[dayName]) cache.baseSchedule[dayName] = {};
        if (entry) cache.baseSchedule[dayName][`${classId}_${periodIndex}`] = entry;
        else delete cache.baseSchedule[dayName][`${classId}_${periodIndex}`];
        setCache(cache);
    }
};

export const getDailyOverrides = async (dateStr: string): Promise<Record<string, DailyOverride>> => {
    try {
        const data = await postgresService.timetable.getEffective(dateStr, 'Monday');
        return data.schedule;
    } catch (e) {
        return getCache().overrides?.[dateStr] || {};
    }
};

export const saveDailyOverride = async (dateStr: string, classId: string, periodIndex: number, override: DailyOverride | null) => {
    try {
        await postgresService.timetable.saveSubstitution(dateStr, 'Monday', classId, periodIndex, override);
    } catch (e) {
        const cache = getCache();
        if (!cache.overrides) cache.overrides = {};
        if (!cache.overrides[dateStr]) cache.overrides[dateStr] = {};
        if (override) cache.overrides[dateStr][`${classId}_${periodIndex}`] = override;
        else delete cache.overrides[dateStr][`${classId}_${periodIndex}`];
        setCache(cache);
    }
};

export const getAttendanceForDate = async (dateStr: string): Promise<Record<string, AttendanceStatus>> => {
    try {
        const data = await postgresService.timetable.getEffective(dateStr, 'Monday');
        return data.attendance;
    } catch (e) {
        return getCache().attendance?.[dateStr] || {};
    }
};

export const markTeacherAttendance = async (dateStr: string, teacherId: string, status: AttendanceStatus) => {
    try {
        await postgresService.timetable.saveAttendance(dateStr, teacherId, status);
    } catch (e) {
        const cache = getCache();
        if (!cache.attendance) cache.attendance = {};
        if (!cache.attendance[dateStr]) cache.attendance[dateStr] = {};
        cache.attendance[dateStr][teacherId] = status;
        setCache(cache);
    }
};

export const getTeacherInstructions = async (date: string): Promise<string> => {
    try {
        const data = await postgresService.timetable.getEffective(date, 'Monday');
        return data.instruction;
    } catch (e) {
        return getCache().instructions?.[date] || '';
    }
};

export const saveTeacherInstructions = async (date: string, instructions: string) => {
    try {
        await postgresService.timetable.saveInstruction(date, instructions);
    } catch (e) {
        const cache = getCache();
        if (!cache.instructions) cache.instructions = {};
        cache.instructions[date] = instructions;
        setCache(cache);
    }
};

export const getEffectiveSchedule = async (dateStr: string, dayName: string): Promise<Record<string, any>> => {
    try {
        const data = await postgresService.timetable.getEffective(dateStr, dayName);
        return data.schedule;
    } catch (e) {
        // Local effective logic
        const base = await getBaseSchedule(dayName);
        const overrides = await getDailyOverrides(dateStr);
        const attendance = await getAttendanceForDate(dateStr);
        const effective: Record<string, any> = { ...base };
        
        Object.keys(effective).forEach(key => {
            const entry = effective[key];
            if(entry && entry.teacherId) entry.status = attendance[entry.teacherId] || 'present';
        });

        Object.keys(overrides).forEach(key => {
            if (overrides[key]) {
                const baseEntry = base[key] || {};
                const override = overrides[key];
                const activeTeacherId = override.subTeacherId || baseEntry.teacherId;
                const status = activeTeacherId ? (attendance[activeTeacherId] || 'present') : 'present';
                effective[key] = { ...baseEntry, ...override, isOverride: true, status };
            }
        });
        return effective;
    }
};

export const getTeacherDetailedStatus = async (teacherId: string, dateStr: string, dayName: string, periodIndex: number) => {
    const attendance = await getAttendanceForDate(dateStr);
    const schedule = await getEffectiveSchedule(dateStr, dayName);
    const status = attendance[teacherId];
    const LUNCH_PERIOD_INDEX = 3;

    if (status === 'absent') return { type: 'ABSENT' as const };
    if (status === 'half_day_before' && periodIndex < LUNCH_PERIOD_INDEX) return { type: 'MORNING_LEAVE' as const };
    if (status === 'half_day_after' && periodIndex > LUNCH_PERIOD_INDEX) return { type: 'AFTERNOON_LEAVE' as const };

    const busySlotKey = Object.keys(schedule).find(key => {
        const [_, pIdxStr] = key.split('_');
        if (parseInt(pIdxStr) !== periodIndex) return false;
        const entry = schedule[key];
        return entry && (entry.teacherId === teacherId || entry.subTeacherId === teacherId || entry.splitTeacherId === teacherId);
    });

    if (busySlotKey) {
        const [classId] = busySlotKey.split('_');
        const classes = await getClasses();
        const cls = classes.find(c => c.id === classId);
        return { type: 'BUSY' as const, busyInClass: cls?.name || 'Class' };
    }
    return { type: 'FREE' as const };
};

export const checkTeacherAvailability = async (teacherId: string, dateStr: string, dayName: string, periodIndex: number, excludeClassIds: string | string[]) => {
    const schedule = await getEffectiveSchedule(dateStr, dayName);
    const classes = await getClasses();
    const excludes = Array.isArray(excludeClassIds) ? excludeClassIds : [excludeClassIds];
    
    for (const key in schedule) {
        const [cId, pIdx] = key.split('_');
        if (parseInt(pIdx) === periodIndex && !excludes.includes(cId)) {
            const entry = schedule[key];
            if (!entry) continue;

            if (entry.teacherId === teacherId || entry.subTeacherId === teacherId || entry.splitTeacherId === teacherId) {
                const cls = classes.find(c => c.id === cId);
                return { busy: true, className: cls?.name || 'Another Class' };
            }
        }
    }
    return { busy: false };
};

export const exportData = () => {
    const data = localStorage.getItem('ssc_cloud_v7_local_db_cache');
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silver_star_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const importData = async (file: File): Promise<boolean> => {
    try {
        const text = await file.text();
        JSON.parse(text); // Verify JSON structure
        localStorage.setItem('ssc_cloud_v7_local_db_cache', text);
        return true;
    } catch (e) {
        console.error("Restore failed:", e);
        return false;
    }
};

export const resetData = () => { localStorage.clear(); window.location.reload(); };

export const getRemarks = async (): Promise<TeacherRemark[]> => await postgresService.remarks.getAll();
export const addRemark = async (r: TeacherRemark) => {
    await postgresService.remarks.save(r);
    return await getRemarks();
};
export const deleteRemark = async (id: string) => {
    await postgresService.remarks.delete(id);
    return await getRemarks();
};

export const getExams = async (): Promise<ExamSchedule[]> => await postgresService.exams.getAll();
export const addExam = async (e: ExamSchedule) => {
    await postgresService.exams.save(e);
    return await getExams();
};
export const deleteExam = async (id: string) => {
    await postgresService.exams.delete(id);
    return await getExams();
};

export const getMeetings = async (): Promise<TeacherMeeting[]> => await postgresService.meetings.getAll();
export const saveMeeting = async (m: TeacherMeeting) => {
    await postgresService.meetings.save(m);
    return await getMeetings();
};
export const deleteMeeting = async (id: string) => {
    await postgresService.meetings.delete(id);
    return await getMeetings();
};
