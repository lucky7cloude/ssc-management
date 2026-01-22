
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
const TEACHER_INSTRUCTIONS_KEY = PREFIX + 'teacher_instructions';

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

export const bulkSaveBaseSchedule = (fullSchedule: Record<string, Record<string, ScheduleEntry>>) => {
    localStorage.setItem(BASE_SCHEDULE_KEY, JSON.stringify(fullSchedule));
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
    
    if (entry) {
        allBases[dayName][key] = entry;
        // Batch assignment for merged classes
        if (entry.mergedClassIds?.length) {
            entry.mergedClassIds.forEach(mId => {
                const mKey = `${mId}_${periodIndex}`;
                allBases[dayName][mKey] = { ...entry, mergedClassIds: [classId, ...entry.mergedClassIds.filter(id => id !== mId)] };
            });
        }
    } else {
        delete allBases[dayName][key];
    }
    
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
    
    if (override) {
        allOverrides[dateStr][key] = override;
        // Batch assignment for merged classes
        if (override.mergedClassIds?.length) {
            override.mergedClassIds.forEach(mId => {
                const mKey = `${mId}_${periodIndex}`;
                allOverrides[dateStr][mKey] = { ...override, mergedClassIds: [classId, ...override.mergedClassIds.filter(id => id !== mId)] };
            });
        }
    } else {
        delete allOverrides[dateStr][key];
    }
    
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(allOverrides));
    return allOverrides[dateStr];
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
  return safeParse(CLASSES_KEY, DEFAULT_CLASSES);
};

export const saveClasses = (classes: ClassSection[]) => {
    localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
    return classes;
}

export const deleteClass = (classId: string) => {
    // 1. Remove from class list
    const classes = getClasses().filter(c => c.id !== classId);
    saveClasses(classes);
    
    // 2. Cleanup Base Schedule
    const allBases = safeParse(BASE_SCHEDULE_KEY, {});
    Object.keys(allBases).forEach(day => {
        const daySchedule = allBases[day];
        if (daySchedule && typeof daySchedule === 'object') {
            Object.keys(daySchedule).forEach(key => {
                // Remove direct entries
                if (key.startsWith(`${classId}_`)) {
                    delete daySchedule[key];
                } else {
                    // Remove merged references in other classes
                    const entry = daySchedule[key];
                    if (entry && entry.mergedClassIds) {
                        entry.mergedClassIds = entry.mergedClassIds.filter((id: string) => id !== classId);
                        if (entry.mergedClassIds.length === 0) delete entry.mergedClassIds;
                    }
                }
            });
        }
    });
    localStorage.setItem(BASE_SCHEDULE_KEY, JSON.stringify(allBases));

    // 3. Cleanup Daily Overrides
    const allOverrides = safeParse(OVERRIDES_KEY, {});
    Object.keys(allOverrides).forEach(date => {
        const dateOverrides = allOverrides[date];
        if (dateOverrides && typeof dateOverrides === 'object') {
            Object.keys(dateOverrides).forEach(key => {
                // Remove direct entries
                if (key.startsWith(`${classId}_`)) {
                    delete dateOverrides[key];
                } else {
                    // Remove merged references in other classes
                    const entry = dateOverrides[key];
                    if (entry && entry.mergedClassIds) {
                        entry.mergedClassIds = entry.mergedClassIds.filter((id: string) => id !== classId);
                        if (entry.mergedClassIds.length === 0) delete entry.mergedClassIds;
                    }
                }
            });
        }
    });
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(allOverrides));
    
    return classes;
}

export const getRemarks = (): TeacherRemark[] => safeParse(REMARKS_KEY, []);
export const addRemark = (remark: TeacherRemark) => {
  const remarks = getRemarks();
  remarks.push(remark);
  localStorage.setItem(REMARKS_KEY, JSON.stringify(remarks));
  return remarks;
};
export const deleteRemark = (id: string) => {
  const remarks = getRemarks().filter(r => r.id !== id);
  localStorage.setItem(REMARKS_KEY, JSON.stringify(remarks));
  return remarks;
};

export const getExams = (): ExamSchedule[] => safeParse(EXAMS_KEY, []);
export const addExam = (exam: ExamSchedule) => {
  const exams = getExams();
  exams.push(exam);
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  return exams;
};
export const deleteExam = (id: string) => {
  const exams = getExams().filter(e => e.id !== id);
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  return exams;
};

export const getMeetings = (): TeacherMeeting[] => safeParse(MEETINGS_KEY, []);
export const saveMeeting = (meeting: TeacherMeeting) => {
    const meetings = getMeetings();
    const index = meetings.findIndex(m => m.id === meeting.id);
    if (index >= 0) meetings[index] = meeting;
    else meetings.push(meeting);
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
    return meetings;
};
export const deleteMeeting = (id: string) => {
    const meetings = getMeetings().filter(m => m.id !== id);
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
    return meetings;
};

export const getAttendanceData = (): Record<string, Record<string, 'present' | 'absent'>> => safeParse(ATTENDANCE_KEY, {});
export const getAttendanceForDate = (dateStr: string) => getAttendanceData()[dateStr] || {};
export const markTeacherAttendance = (dateStr: string, teacherId: string, status: 'present' | 'absent') => {
    const allData = getAttendanceData();
    if (!allData[dateStr]) allData[dateStr] = {};
    if (status === 'present') delete allData[dateStr][teacherId];
    else allData[dateStr][teacherId] = 'absent';
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(allData));
    return allData[dateStr];
};

export const getNotifications = (): AppNotification[] => safeParse(NOTIFICATIONS_KEY, []);
export const addNotification = (message: string, type: 'absence' | 'system' = 'system') => {
    const notifications = getNotifications();
    const newNotif: AppNotification = { id: Date.now().toString(), message, date: new Date().toLocaleString(), type, read: false };
    notifications.unshift(newNotif);
    if(notifications.length > 50) notifications.pop();
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    return notifications;
};
export const clearNotifications = () => { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([])); return []; }
export const getTimetableNote = (date: string): string => safeParse(TIMETABLE_NOTES_KEY, {})[date] || "";
export const saveTimetableNote = (date: string, note: string) => {
    const notes = safeParse(TIMETABLE_NOTES_KEY, {});
    notes[date] = note;
    localStorage.setItem(TIMETABLE_NOTES_KEY, JSON.stringify(notes));
}

export const getTeacherInstructions = (date: string): string => safeParse(TEACHER_INSTRUCTIONS_KEY, {})[date] || "";
export const saveTeacherInstructions = (date: string, instructions: string) => {
    const all = safeParse(TEACHER_INSTRUCTIONS_KEY, {});
    all[date] = instructions;
    localStorage.setItem(TEACHER_INSTRUCTIONS_KEY, JSON.stringify(all));
}
