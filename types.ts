

export type UserRole = 'PRINCIPAL' | 'MANAGEMENT';

export const SCHOOL_LOGO_URL = 'https://image2url.com/r2/default/images/1769146032212-8a3c0445-0f84-4d4b-b978-35b6c3d3ee7c.png';

export type AttendanceStatus = 'present' | 'absent' | 'half_day_before' | 'half_day_after';

export interface Teacher {
  id: string;
  name: string;
  initials: string;
  color: string;
  subject?: string;
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
  isOverride?: boolean;
  status?: AttendanceStatus;
}

export interface DailyOverride {
  subTeacherId?: string;
  subSubject?: string;
  subNote?: string;
  originalTeacherId: string;
  type: 'SUBSTITUTION' | 'VACANT';
}

export interface DailyInstruction {
  dateStr: string;
  text: string;
}

// Added missing TeacherRemark interface
export interface TeacherRemark {
  id: string;
  teacherId: string;
  date: string;
  note: string;
  type: 'General' | 'Monthly' | 'Yearly';
}

// Added missing ExamSchedule interface
export interface ExamSchedule {
  id: string;
  examType: string;
  classId: string;
  subject: string;
  invigilatorId?: string;
  date: string;
  startTime: string;
  endTime: string;
}

// Added missing TeacherMeeting interface
export interface TeacherMeeting {
  id: string;
  name: string;
  date: string;
  note: string;
  type?: string;
}

// Added missing AppNotification interface
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'info' | 'warning' | 'error';
}

// Updated DEFAULT_CLASSES based on requirements
export const DEFAULT_CLASSES: ClassSection[] = [
  { id: '6', name: '6', section: 'SECONDARY' },
  { id: '7', name: '7', section: 'SECONDARY' },
  { id: '8', name: '8', section: 'SECONDARY' },
  { id: '9', name: '9', section: 'SECONDARY' },
  { id: '10', name: '10', section: 'SECONDARY' },
  { id: '11_SCI', name: '11 Science', section: 'SENIOR_SECONDARY' },
  { id: '11_COM', name: '11 Commerce', section: 'SENIOR_SECONDARY' },
  { id: '12_SCI', name: '12 Science', section: 'SENIOR_SECONDARY' },
  { id: '12_COM', name: '12 Commerce', section: 'SENIOR_SECONDARY' },
];

export const PERIODS = [
  { start: "09:15 AM", end: "09:55 AM", label: "I" },
  { start: "09:55 AM", end: "10:35 AM", label: "II" },
  { start: "10:35 AM", end: "11:15 AM", label: "III" },
  { start: "11:15 AM", end: "11:30 AM", label: "LUNCH" },
  { start: "11:30 AM", end: "12:15 PM", label: "IV" },
  { start: "12:15 PM", end: "01:00 PM", label: "V" },
  { start: "01:00 PM", end: "01:45 PM", label: "VI" },
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const PREDEFINED_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", 
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e"
];
