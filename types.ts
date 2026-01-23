
export type UserRole = 'PRINCIPAL' | 'MANAGEMENT';

export const SCHOOL_LOGO_URL = 'https://img.sanishtech.com/u/91059fc3eb45b749dfc0ffdec432d6b5.png';

export type AttendanceStatus = 'present' | 'absent' | 'half_day_before' | 'half_day_after';

export interface Teacher {
  id: string;
  name: string;
  initials: string;
  color: string;
  subject?: string;
  subjectsTaught?: string[]; // Added for smarter generation
  qualification?: string;
  phone?: string;
  email?: string;
  joiningDate?: string;
}

export interface ClassSection {
  id: string;
  name: string;
  section: 'SECONDARY' | 'SENIOR_SECONDARY';
}

export interface ScheduleEntry {
  teacherId?: string;
  subject?: string;
  note?: string;
  isSplit?: boolean;
  splitTeacherId?: string;
  splitSubject?: string;
  isMerged?: boolean;
  mergedClassIds?: string[];
}

export interface DailyOverride {
  subTeacherId?: string;
  subSubject?: string;
  subNote?: string;
  originalTeacherId: string;
  type: 'SUBSTITUTION' | 'EVENT' | 'VACANT' | 'SPLIT' | 'MERGED';
  isSplit?: boolean;
  splitTeacherId?: string;
  splitSubject?: string;
  mergedClassIds?: string[];
}

export interface Substitution {
  id: string;
  date: string;
  classId: string;
  periodIndex: number;
  originalTeacherId: string;
  subTeacherId: string;
}

export interface TeacherRemark {
  id: string;
  teacherId: string;
  date: string;
  note: string;
  type: 'General' | 'Monthly' | 'Yearly';
}

export interface ExamSchedule {
  id: string;
  examType: string;
  classId: string;
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
  invigilatorId?: string; // Enhanced with teacher duty
}

export interface TeacherMeeting {
  id: string;
  name: string;
  date: string;
  note: string;
}

export interface AppNotification {
  id: string;
  message: string;
  date: string;
  type: 'absence' | 'system';
  read: boolean;
}

export type PeriodTime = {
  start: string;
  end: string;
};

export const PERIODS: PeriodTime[] = [
  { start: "09:15 AM", end: "09:55 AM" }, // 0
  { start: "09:55 AM", end: "10:35 AM" }, // 1
  { start: "10:35 AM", end: "11:15 AM" }, // 2
  { start: "11:15 AM", end: "11:30 AM" }, // 3 (Lunch)
  { start: "11:30 AM", end: "12:15 PM" }, // 4
  { start: "12:15 PM", end: "01:00 PM" }, // 5
  { start: "01:00 PM", end: "01:45 PM" }, // 6
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const PREDEFINED_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", 
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e"
];
