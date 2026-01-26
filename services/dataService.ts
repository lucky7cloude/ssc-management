import { Teacher, ScheduleEntry, DailyOverride, ClassSection, TeacherRemark, ExamSchedule, TeacherMeeting, AttendanceStatus, AppNotification } from '../types';
import { mockDb } from './mockDatabase';

// API Layer pointing to our Mock Async Database
export const getTeachers = async (): Promise<Teacher[]> => await mockDb.teachers.getAll();
export const saveTeacher = async (teacher: Teacher) => await mockDb.teachers.save(teacher);
export const deleteTeacher = async (id: string) => await mockDb.teachers.delete(id);

export const getClasses = async (): Promise<ClassSection[]> => await mockDb.classes.getAll();
export const saveClasses = async (classes: ClassSection[]) => await mockDb.classes.saveAll(classes);

export const getBaseSchedule = async (dayName: string) => await mockDb.schedule.getBase(dayName);
export const saveBaseEntry = async (dayName: string, classId: string, periodIndex: number, entry: ScheduleEntry | null) => 
    await mockDb.schedule.saveBase(dayName, classId, periodIndex, entry);

export const getDailyOverrides = async (dateStr: string) => await mockDb.schedule.getOverrides(dateStr);
export const saveDailyOverride = async (dateStr: string, classId: string, periodIndex: number, override: DailyOverride | null) => 
    await mockDb.schedule.saveOverride(dateStr, classId, periodIndex, override);

export const getAttendanceForDate = async (dateStr: string) => await mockDb.attendance.getForDate(dateStr);
export const markTeacherAttendance = async (dateStr: string, teacherId: string, status: AttendanceStatus) => 
    await mockDb.attendance.mark(dateStr, teacherId, status);

export const getTeacherInstructions = async (date: string) => await mockDb.instructions.get(date);
export const saveTeacherInstructions = async (date: string, instructions: string) => 
    await mockDb.instructions.save(date, instructions);

export const getEffectiveSchedule = async (dateStr: string, dayName: string) => {
    const base = await getBaseSchedule(dayName);
    const overrides = await getDailyOverrides(dateStr);
    const effective: Record<string, any> = { ...base };
    Object.keys(overrides).forEach(key => {
        if (overrides[key]) effective[key] = { ...(base[key] || {}), ...overrides[key], isOverride: true };
    });
    return effective;
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

// Fix: Implement exportData to download local storage as a JSON file
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

// Fix: Implement importData to restore app data from a JSON file
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

// Legacy stubs kept for compatibility
export const resetData = () => { localStorage.clear(); window.location.reload(); };

// Async implementations for Remarks, Exams, and Meetings
export const getRemarks = async (): Promise<TeacherRemark[]> => await mockDb.remarks.getAll();
export const addRemark = async (r: TeacherRemark) => await mockDb.remarks.add(r);
export const deleteRemark = async (id: string) => await mockDb.remarks.delete(id);

export const getExams = async (): Promise<ExamSchedule[]> => await mockDb.exams.getAll();
export const addExam = async (e: ExamSchedule) => await mockDb.exams.save(e);
export const deleteExam = async (id: string) => await mockDb.exams.delete(id);

export const getMeetings = async (): Promise<TeacherMeeting[]> => await mockDb.meetings.getAll();
export const saveMeeting = async (m: TeacherMeeting) => await mockDb.meetings.save(m);
export const deleteMeeting = async (id: string) => await mockDb.meetings.delete(id);
