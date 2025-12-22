
import { Teacher, ScheduleEntry, ClassSection, TeacherRemark, ExamSchedule, Substitution, AppNotification, PERIODS, DAYS, TeacherMeeting } from '../types';

const PREFIX = 'silver_star_';
const TEACHERS_KEY = PREFIX + 'teachers';
const SCHEDULE_KEY = PREFIX + 'schedule';
const CLASSES_KEY = PREFIX + 'classes';
const REMARKS_KEY = PREFIX + 'remarks';
const EXAMS_KEY = PREFIX + 'exams';
const MEETINGS_KEY = PREFIX + 'meetings';
const ATTENDANCE_KEY = PREFIX + 'attendance';
const SUBSTITUTIONS_KEY = PREFIX + 'substitutions';
const NOTIFICATIONS_KEY = PREFIX + 'notifications';
const TIMETABLE_NOTES_KEY = PREFIX + 'timetable_notes';

// Cleaned Class Names
const DEFAULT_CLASSES: ClassSection[] = [
  { id: 'c6', name: 'Class 6' },
  { id: 'c7', name: 'Class 7' },
  { id: 'c8', name: 'Class 8' },
  { id: 'c9', name: 'Class 9' },
  { id: 'c10', name: 'Class 10' },
  { id: 'c11_sci', name: '11th Science' },
  { id: 'c11_com', name: '11th Commerce' },
  { id: 'c11_art', name: '11th Arts' },
  { id: 'c12_sci', name: '12th Science' },
  { id: 'c12_com', name: '12th Commerce' },
  { id: 'c12_art', name: '12th Arts' },
];

/**
 * Gets a blob of all current application data
 */
export const getFullBackupData = () => {
    const data: Record<string, any> = {};
    const keys = [
        TEACHERS_KEY, SCHEDULE_KEY, CLASSES_KEY, REMARKS_KEY, 
        EXAMS_KEY, MEETINGS_KEY, ATTENDANCE_KEY, SUBSTITUTIONS_KEY, 
        NOTIFICATIONS_KEY, TIMETABLE_NOTES_KEY
    ];
    
    keys.forEach(key => {
        const val = localStorage.getItem(key);
        if (val) data[key] = JSON.parse(val);
    });
    return data;
};

export const exportAllData = () => {
    const data = getFullBackupData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SilverStar_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
};

export const restoreData = (jsonData: any) => {
    try {
        Object.entries(jsonData).forEach(([key, value]) => {
            if (key.startsWith(PREFIX)) {
                localStorage.setItem(key, JSON.stringify(value));
            }
        });
        return true;
    } catch (e) {
        return false;
    }
};

// --- DATA SERVICES ---

export const getTeachers = (): Teacher[] => {
  const data = localStorage.getItem(TEACHERS_KEY);
  return data ? JSON.parse(data) : [];
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
  const schedule = getSchedule().filter(s => s.teacherId !== id && s.splitTeacherId !== id);
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  return teachers;
};

export const getClasses = (): ClassSection[] => {
  const data = localStorage.getItem(CLASSES_KEY);
  return data ? JSON.parse(data) : DEFAULT_CLASSES;
};

export const addClass = (name: string): ClassSection[] => {
  const classes = getClasses();
  const newClass = { id: Date.now().toString(), name };
  classes.push(newClass);
  localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
  return classes;
}

export const deleteClass = (id: string): ClassSection[] => {
  let classes = getClasses().filter(c => c.id !== id);
  localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
  let schedule = getSchedule().filter(s => s.classId !== id);
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  let subs = getAllSubstitutions().filter(s => s.classId !== id);
  localStorage.setItem(SUBSTITUTIONS_KEY, JSON.stringify(subs));
  return classes;
}

export const getSchedule = (): ScheduleEntry[] => {
  const data = localStorage.getItem(SCHEDULE_KEY);
  return data ? JSON.parse(data) : [];
};

export const ensureScheduleForDay = (currentDay: string): ScheduleEntry[] => {
    let schedule = getSchedule();
    const currentDayEntries = schedule.filter(s => s.day === currentDay);
    if (currentDayEntries.length > 0) return schedule;
    
    const dayIndex = DAYS.indexOf(currentDay);
    if (dayIndex <= 0) return schedule;
    
    const prevDay = DAYS[dayIndex - 1];
    const prevDayEntries = schedule.filter(s => s.day === prevDay);
    if (prevDayEntries.length === 0) return schedule;
    
    const newEntries = prevDayEntries.map(entry => ({
        ...entry,
        id: Date.now().toString() + Math.random().toString(),
        day: currentDay
    }));
    
    schedule = [...schedule, ...newEntries];
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
    return schedule;
};

export const saveScheduleEntry = (entry: ScheduleEntry, applyToRestOfWeek: boolean = false) => {
  let schedule = getSchedule();
  schedule = schedule.filter(s => !(s.classId === entry.classId && s.day === entry.day && s.periodIndex === entry.periodIndex));
  schedule.push(entry);

  if (applyToRestOfWeek) {
      const currentDayIndex = DAYS.indexOf(entry.day);
      if (currentDayIndex !== -1 && currentDayIndex < DAYS.length - 1) {
          const subsequentDays = DAYS.slice(currentDayIndex + 1);
          subsequentDays.forEach(day => {
               schedule = schedule.filter(s => !(s.classId === entry.classId && s.day === day && s.periodIndex === entry.periodIndex));
               schedule.push({ ...entry, id: Date.now().toString() + Math.random().toString(), day: day });
          });
      }
  }
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  return schedule;
};

export const removeScheduleEntry = (classId: string, day: string, periodIndex: number) => {
  let schedule = getSchedule().filter(s => !(s.classId === classId && s.day === day && s.periodIndex === periodIndex));
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  return schedule;
};

export const cloneScheduleToAllDays = (sourceDay: string) => {
    let schedule = getSchedule();
    const sourceEntries = schedule.filter(s => s.day === sourceDay);
    schedule = schedule.filter(s => s.day === sourceDay);
    DAYS.filter(d => d !== sourceDay).forEach(targetDay => {
        sourceEntries.forEach(entry => {
            schedule.push({ ...entry, id: Date.now().toString() + Math.random().toString(), day: targetDay });
        });
    });
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
    return schedule;
};

export const isTeacherBooked = (teacherId: string, day: string, periodIndex: number, excludeClassId?: string): boolean => {
  return getSchedule().some(s => 
    (s.teacherId === teacherId || (s.isSplit && s.splitTeacherId === teacherId)) && 
    s.day === day && s.periodIndex === periodIndex && s.classId !== excludeClassId
  );
};

export const getTeacherBookedClass = (teacherId: string, day: string, periodIndex: number): string | undefined => {
    const entry = getSchedule().find(s => 
        (s.teacherId === teacherId || (s.isSplit && s.splitTeacherId === teacherId)) && 
        s.day === day && s.periodIndex === periodIndex
    );
    return entry ? getClasses().find(c => c.id === entry.classId)?.name : undefined;
}

export const getRemarks = (): TeacherRemark[] => {
  const data = localStorage.getItem(REMARKS_KEY);
  return data ? JSON.parse(data) : [];
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
  const data = localStorage.getItem(EXAMS_KEY);
  return data ? JSON.parse(data) : [];
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
    const data = localStorage.getItem(MEETINGS_KEY);
    return data ? JSON.parse(data) : [];
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
    const data = localStorage.getItem(ATTENDANCE_KEY);
    return data ? JSON.parse(data) : {};
};

export const getAttendanceForDate = (dateStr: string): Record<string, 'present' | 'absent'> => getAttendanceData()[dateStr] || {};

export const markTeacherAttendance = (dateStr: string, teacherId: string, status: 'present' | 'absent') => {
    const allData = getAttendanceData();
    if (!allData[dateStr]) allData[dateStr] = {};
    if (status === 'present') delete allData[dateStr][teacherId];
    else allData[dateStr][teacherId] = 'absent';
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(allData));
    return allData[dateStr];
};

export const getAllSubstitutions = (): Substitution[] => {
    const data = localStorage.getItem(SUBSTITUTIONS_KEY);
    return data ? JSON.parse(data) : [];
};

export const getSubstitutionsForDate = (date: string): Substitution[] => getAllSubstitutions().filter(s => s.date === date);

export const saveSubstitution = (sub: Substitution) => {
    let all = getAllSubstitutions().filter(s => !(s.date === sub.date && s.classId === sub.classId && s.periodIndex === sub.periodIndex));
    all.push(sub);
    localStorage.setItem(SUBSTITUTIONS_KEY, JSON.stringify(all));
    return getSubstitutionsForDate(sub.date);
};

export const removeSubstitution = (date: string, classId: string, periodIndex: number) => {
    let all = getAllSubstitutions().filter(s => !(s.date === date && s.classId === classId && s.periodIndex === periodIndex));
    localStorage.setItem(SUBSTITUTIONS_KEY, JSON.stringify(all));
    return getSubstitutionsForDate(date);
};

export const getNotifications = (): AppNotification[] => {
    const data = localStorage.getItem(NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : [];
};

export const addNotification = (message: string, type: 'absence' | 'system' = 'system') => {
    const notifications = getNotifications();
    const newNotif: AppNotification = { id: Date.now().toString(), message, date: new Date().toLocaleString(), type, read: false };
    notifications.unshift(newNotif);
    if(notifications.length > 50) notifications.pop();
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    return notifications;
};

export const markNotificationsRead = () => {
    const updated = getNotifications().map(n => ({...n, read: true}));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    return updated;
};

export const clearNotifications = () => { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([])); return []; }

export const getTeacherClassesForDay = (teacherId: string, dayName: string) => {
    const classes = getClasses();
    return getSchedule()
        .filter(s => (s.teacherId === teacherId || (s.isSplit && s.splitTeacherId === teacherId)) && s.day === dayName)
        .map(s => ({
            ...s,
            className: classes.find(c => c.id === s.classId)?.name || 'Unknown Class',
            time: `Period-${s.periodIndex + (s.periodIndex >= 3 ? 0 : 1)}`,
            subject: (s.isSplit && s.splitTeacherId === teacherId) ? (s.splitSubject || s.subject) : s.subject,
        }))
        .sort((a, b) => a.periodIndex - b.periodIndex);
};

export const getAvailableTeachersForPeriod = (dayName: string, periodIndex: number) => getTeachers().filter(t => !isTeacherBooked(t.id, dayName, periodIndex));

export const getTimetableNote = (date: string): string => JSON.parse(localStorage.getItem(TIMETABLE_NOTES_KEY) || '{}')[date] || "";

export const saveTimetableNote = (date: string, note: string) => {
    const notes = JSON.parse(localStorage.getItem(TIMETABLE_NOTES_KEY) || '{}');
    notes[date] = note;
    localStorage.setItem(TIMETABLE_NOTES_KEY, JSON.stringify(notes));
}
