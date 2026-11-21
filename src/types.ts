export const DEPARTMENTS = [
  'ALS',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'SNED',
  'Kindergarten',
  'Administration',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const ANNUAL_WELLNESS_LIMIT = 5;
export const DEFAULT_DAILY_BOOKING_LIMIT = 2;

export interface BookingRecord {
  id: string;
  timestamp: string;
  filingDate: string; // Formatted date of filing e.g. Nov 21, 2026
  formattedName: string;
  firstName: string; // Full first name (used on Form 6 PDF without shortening)
  firstInitials: string;
  lastName: string;
  middleInitial?: string; // Full middle name or initial (used on Form 6 PDF without shortening)
  position?: string;
  salary?: string;
  department: Department;
  dates: string[]; // Sorted YYYY-MM-DD dates
  daysCount: number;
  dateLabel: string;
  form6Token?: string;
  form6TokenHash?: string;
}

export type OccupiedByDepartment = Record<Department, string[]>;

export interface PublicAppState {
  occupiedByDepartment: OccupiedByDepartment;
  dailyCounts: Record<string, number>; // Date YYYY-MM-DD -> total bookings count across school
  dailyCountsByDepartment: Record<Department, Record<string, number>>; // Dept -> Date -> count
  dailyLimits: Record<string, number>; // Date YYYY-MM-DD -> admin exception max bookings per level
  defaultDailyLimit: number;
  bookingCount: number;
  todayStr: string; // YYYY-MM-DD in Asia/Manila
  minAdvanceDateStr: string; // Earliest allowed date (today + 14 days)
  schoolLogoUrl: string;
  depedLogoUrl: string;
}

export interface PersonnelUsagePayload {
  formattedName: string;
  usedByYear: Record<string, number>;
  limit: number;
}

export interface AdminStatusPayload {
  configured: boolean;
  usingEnvPassword: boolean;
}

export interface AdminBookingsPayload {
  token?: string;
  expiresAt?: number;
  bookings: BookingRecord[];
  dailyLimits: Record<string, number>;
  defaultDailyLimit: number;
  schoolLogoUrl: string;
}
