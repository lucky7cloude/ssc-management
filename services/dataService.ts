
import { Teacher, ScheduleEntry, DailyOverride, ClassSection, TeacherRemark, ExamSchedule, Substitution, AppNotification, PERIODS, DAYS, TeacherMeeting } from '../types';

const PREFIX = 'silver_star_';
const TEACHERS_KEY = PREFIX + 'teachers';
const BASE_SCHEDULE_KEY = PREFIX + 'base_schedule'; 
const OVERRIDES_KEY = PREFIX + 'daily_overrides'; 
const CLASSES_KEY = PREFIX + 'classes';
const REMARKS_KEY = PREFIX + 'remarks';
const EXAMS_KEY = PREFIX + 'exams';
const MEETINGS_KEY = PREFIX + 'meetings';
const ATTENDANCE_KEY = PREFIX + 'attendance';
const NOTIFICATIONS_KEY = PREFIX + 'notifications';
const TIMETABLE_NOTES_KEY = PREFIX + 'timetable_notes';

// Safe JSON Parse Helper
const safeParse = (key: string, fallback: any) => {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch (e) {
        console.error(`Error parsing ${key} from storage:`, e);
        return fallback;
    }
};

export const getEffectiveSchedule = (dateStr: string, dayName: string) => {
    const base = getBaseSchedule(dayName);
    const overrides = getDailyOverrides(dateStr);
    const effective: Record<string, any> = { ...base };
    
    Object.keys(overrides).forEach(key => {
        if (overrides[key]) {
            effective[key] = {
                ...(base[key] || {}),
                ...overrides[key],
                isOverride: true
            };
        }
    });
    
    return effective;
};

export const getBaseSchedule = (dayName: string): Record<string, ScheduleEntry> => {
    const allBases = safeParse(BASE_SCHEDULE_KEY, {});
    return allBases[dayName] || {};
};

export const getSchedule = (): any[] => {
    const allBases = safeParse(BASE_SCHEDULE_KEY, {});
    const flatSchedule: any[] = [];
    Object.keys(allBases).forEach(day => {
        const daySchedule = allBases[day];
        if (daySchedule) {
            Object.keys(daySchedule).forEach(slotKey => {
                const [classId, periodIndex] = slotKey.split('_');
                flatSchedule.push({ 
                    ...daySchedule[slotKey], 
                    day, 
                    classId, 
                    periodIndex: parseInt(periodIndex) 
                });
            });
        }
    });
    return flatSchedule;
};

export const getFreeTeachers = (dateStr: string, dayName: string, periodIndex: number): Teacher[] => {
    const teachers = getTeachers();
    const attendance = getAttendanceForDate(dateStr);
    const schedule = getEffectiveSchedule(dateStr, dayName);
    
    return teachers.filter(t => {
        const isAbsent = attendance[t.id] === 'absent';
        if (isAbsent) return false;
        
        const isBusy = Object.keys(schedule).some(key => {
            const [_, pIdx] = key.split('_');
            if (parseInt(pIdx) !== periodIndex) return false;
            const entry = schedule[key];
            return entry && (entry.teacherId === t.id || entry.subTeacherId === t.id || entry.splitTeacherId === t.id);
        });
        
        return !isBusy;
    });
};

export const saveBaseEntry = (dayName: string, classId: string, periodIndex: number, entry: ScheduleEntry | null) => {
    const allBases = safeParse(BASE_SCHEDULE_KEY, {});
    if (!allBases[dayName]) allBases[dayName] = {};
    const key = `${classId}_${periodIndex}`;
    if (entry) allBases[dayName][key] = entry;
    else delete allBases[dayName][key];
    localStorage.setItem(BASE_SCHEDULE_KEY, JSON.stringify(allBases));
    return allBases[dayName];
};

export const getDailyOverrides = (dateStr: string): Record<string, DailyOverride> => {
    const allOverrides = safeParse(OVERRIDES_KEY, {});
    return allOverrides[dateStr] || {};
};

export const saveDailyOverride = (dateStr: string, classId: string, periodIndex: number, override: DailyOverride | null) => {
    const allOverrides = safeParse(OVERRIDES_KEY, {});
    if (!allOverrides[dateStr]) allOverrides[dateStr] = {};
    const key = `${classId}_${periodIndex}`;
    if (override) allOverrides[dateStr][key] = override;
    else delete allOverrides[dateStr][key];
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(allOverrides));
    return allOverrides[dateStr];
};

export const resetDailyOverrides = (dateStr: string) => {
    const allOverrides = safeParse(OVERRIDES_KEY, {});
    delete allOverrides[dateStr];
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(allOverrides));
};

export const getTeachers = (): Teacher[] => {
  return safeParse(TEACHERS_KEY, []);
};

export const saveTeacher = (teacher: Teacher) => {
  const teachers = getTeachers();
  const index = teachers.findIndex(t => t.id === teacher.id);
  if (index >= 0) teachers[index] = teacher;
  else teachers.push(teacher);
  localStorage.setItem(TEACHERS_KEY, JSON.stringify(teachers));
  return teachers;
};

export const deleteTeacher = (id: string) => {
  const teachers = getTeachers().filter(t => t.id !== id);
  localStorage.setItem(TEACHERS_KEY, JSON.stringify(teachers));
  return teachers;
};

export const getClasses = (): ClassSection[] => {
  const DEFAULT_CLASSES: ClassSection[] = [
    { id: 'c6', name: 'Class 6' },
    { id: 'c7', name: 'Class 7' },
    { id: 'c8', name: 'Class 8' },
    { id: 'c9', name: 'Class 9' },
    { id: 'c10', name: 'Class 10' },
  ];
  return safeParse(CLASSES_KEY, DEFAULT_CLASSES);
};

export const addClass = (name: string): ClassSection[] => {
  const classes = getClasses();
  classes.push({ id: Date.now().toString(), name });
  localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
  return classes;
}

export const deleteClass = (id: string): ClassSection[] => {
  let classes = getClasses().filter(c => c.id !== id);
  localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
  return classes;
}

export const reorderClasses = (newClasses: ClassSection[]): ClassSection[] => {
  localStorage.setItem(CLASSES_KEY, JSON.stringify(newClasses));
  return newClasses;
}

export const getRemarks = (): TeacherRemark[] => {
  return safeParse(REMARKS_KEY, []);
};

export const addRemark = (remark: TeacherRemark): TeacherRemark[] => {
  const remarks = getRemarks();
  remarks.push(remark);
  localStorage.setItem(REMARKS_KEY, JSON.stringify(remarks));
  return remarks;
};

export const deleteRemark = (id: string): TeacherRemark[] => {
  const remarks = getRemarks().filter(r => r.id !== id);
  localStorage.setItem(REMARKS_KEY, JSON.stringify(remarks));
  return remarks;
};

export const getExams = (): ExamSchedule[] => {
  return safeParse(EXAMS_KEY, []);
};

export const addExam = (exam: ExamSchedule): ExamSchedule[] => {
  const exams = getExams();
  exams.push(exam);
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  return exams;
};

export const deleteExam = (id: string): ExamSchedule[] => {
  const exams = getExams().filter(e => e.id !== id);
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  return exams;
};

export const getMeetings = (): TeacherMeeting[] => {
    return safeParse(MEETINGS_KEY, []);
};

export const saveMeeting = (meeting: TeacherMeeting): TeacherMeeting[] => {
    const meetings = getMeetings();
    const index = meetings.findIndex(m => m.id === meeting.id);
    if (index >= 0) meetings[index] = meeting;
    else meetings.push(meeting);
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
    return meetings;
};

export const deleteMeeting = (id: string): TeacherMeeting[] => {
    const meetings = getMeetings().filter(m => m.id !== id);
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
    return meetings;
};

export const getAttendanceData = (): Record<string, Record<string, 'present' | 'absent'>> => {
    return safeParse(ATTENDANCE_KEY, {});
};

export const getAttendanceForDate = (dateStr: string): Record<string, 'present' | 'absent'> => 
    getAttendanceData()[dateStr] || {};

export const markTeacherAttendance = (dateStr: string, teacherId: string, status: 'present' | 'absent') => {
    const allData = getAttendanceData();
    if (!allData[dateStr]) allData[dateStr] = {};
    if (status === 'present') delete allData[dateStr][teacherId];
    else allData[dateStr][teacherId] = 'absent';
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(allData));
    return allData[dateStr];
};

export const getNotifications = (): AppNotification[] => {
    return safeParse(NOTIFICATIONS_KEY, []);
};

export const addNotification = (message: string, type: 'absence' | 'system' = 'system') => {
    const notifications = getNotifications();
    const newNotif: AppNotification = { 
        id: Date.now().toString(), 
        message, 
        date: new Date().toLocaleString(), 
        type, 
        read: false 
    };
    notifications.unshift(newNotif);
    if(notifications.length > 50) notifications.pop();
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    return notifications;
};

export const clearNotifications = () => { 
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([])); 
    return []; 
}

export const getTimetableNote = (date: string): string => 
    safeParse(TIMETABLE_NOTES_KEY, {})[date] || "";

export const saveTimetableNote = (date: string, note: string) => {
    const notes = safeParse(TIMETABLE_NOTES_KEY, {});
    notes[date] = note;
    localStorage.setItem(TIMETABLE_NOTES_KEY, JSON.stringify(notes));
}
