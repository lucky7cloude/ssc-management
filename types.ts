
export type UserRole = 'PRINCIPAL' | 'MANAGEMENT';

export interface Teacher {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface ClassSection {
  id: string;
  name: string;
}

export interface ScheduleEntry {
  teacherId: string;
  subject: string;
  isSplit?: boolean;
  splitTeacherId?: string;
  splitSubject?: string;
}

export interface DailyOverride {
  subTeacherId: string;
  subSubject: string;
  originalTeacherId: string;
  type: 'SUBSTITUTION' | 'EVENT' | 'VACANT';
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
  { start: "09:15 AM", end: "09:55 AM" },
  { start: "09:55 AM", end: "10:35 AM" },
  { start: "10:35 AM", end: "11:15 AM" },
  { start: "11:15 AM", end: "11:30 AM" }, // Lunch
  { start: "11:30 AM", end: "12:15 PM" },
  { start: "12:15 PM", end: "01:00 PM" },
  { start: "01:00 PM", end: "01:45 PM" },
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const PREDEFINED_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", 
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e"
];
