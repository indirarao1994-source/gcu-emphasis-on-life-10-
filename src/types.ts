/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StudentMasterRecord {
  registerNo: string;
  name: string;
  email: string;
  department: string;
  programName: string;
}

export interface Occasion {
  id: string;
  title: string; // e.g., "Fresherism-26", "Gardenia-26", "Independence Day", "Gala-26"
  eventDates?: string; // e.g., "AUG 3 – 15, 2026"
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  logoUrl?: string;
  brochureUrl?: string;
  description: string;
  chiefGuestName?: string;
  chiefGuestPhotoUrl?: string;
  chiefGuestDescription?: string;
  chiefGuestData?: string;
  convenorName: string;
  convenorEmail: string;
  capLimit: number; // How many minimum number of events student is supposed to register
  isOpenToExternal?: boolean;
  isActive?: boolean;
  isCompleted?: boolean;
  certificateTemplateUrl?: string;
  reportFormatUrl?: string;
  masterStudents?: StudentMasterRecord[];
  createdAt?: string;
}

export interface Event {
  id: string;
  occasionId?: string; // Belongs to an occasion (defaults to default occasion if undefined)
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  timeStart: string; // HH:MM (24h)
  timeEnd: string; // HH:MM (24h)
  venue: string;
  hostDepartment: string;
  coordinatorFacultyId: string;
  coordinatorName: string;
  coordinatorMobile: string;
  coordinatorEmail: string;
  studentCoordinatorName?: string;
  rules: string;
  imageUrl?: string;
  brochureUrl?: string;
  eventType?: 'individual' | 'group'; // Defaults to 'individual' if undefined
  isCompleted?: boolean; // Flagged when coordinator marks "Event Completed"
  reportedToConvenor?: boolean; // Flagged when coordinator reports completion to convenor
  resultsPublished?: boolean; // Flagged when Convenor approves and publishes scores to Leaderboard ("Yes Update Results")
  resultsPublishedAt?: string; // Timestamp when Convenor approved and published results
  isRegistrationClosed?: boolean; // True if coordinator closed student registrations before commencement
  registrationClosed?: boolean; // Alias for isRegistrationClosed
  noBrochure?: boolean; // True if NA selected for brochure
  completedReportUrl?: string; // Word report download URL or base64 data
  geotaggedPhotos?: string[]; // Photos uploaded by coordinator on completion (min 2 required)
  scannedSheets?: { id: string; name: string; url: string; uploadedAt: string }[]; // Scanned score sheets stored in Firestore
  chiefGuestName?: string;
  chiefGuestPhotoUrl?: string;
  chiefGuestDescription?: string;
  chiefGuestData?: string;
  chiefGuestEmail?: string;
  chiefGuestMobile?: string;
  internalJudgeName?: string;
  internalJudgeMobile?: string;
  internalJudgeEmail?: string;
  externalJudgeName?: string;
  externalJudgeDesignation?: string;
  externalJudgeEmail?: string;
  externalJudgeMobile?: string;
  aiSummaryReport?: string; // AI generated report content
}

export interface GroupRegistrationInfo {
  groupLeaderName: string;
  groupLeaderEmail: string;
}

export interface Student {
  uid?: string;
  registerNo: string;
  name: string;
  mobile: string;
  email: string;
  school: string;
  department: string;
  programName: string;
  registeredEventIds?: string[];
  isExternal?: boolean;
  externalCollegeName?: string;
  groupInfo?: Record<string, GroupRegistrationInfo>; // eventId -> group leader info
  password?: string;
  authProvider?: 'password' | 'google' | 'microsoft';
  isEmailVerified?: boolean;
  verificationCode?: string;
  isProfileComplete?: boolean;
  sem1Declared?: boolean;
  isSeniorAcknowledged?: boolean;
  isNccInterested?: boolean;
  nccRegisteredAt?: string;
}

export interface FacultyCoordinator {
  facultyId: string;
  name: string;
  email: string; // Must end with @gcu.edu.in
  username?: string;
  password?: string;
  authProvider?: 'password' | 'google' | 'microsoft';
  mobile: string;
  school?: string;
  department: string;
  designation?: string;
  isApproved: boolean;
  createdAt: string;
  registeredAt?: string;
  isProfileComplete?: boolean;
  isNccCoordinator?: boolean;
}

export interface Notification {
  id: string;
  eventId: string;
  eventTitle: string;
  title: string;
  content: string;
  timestamp: string;
  senderName: string;
  targetRegisterNo?: string; // Optional: for unicast student messages. If undefined, broadcast to all in event.
}

export interface Score {
  id: string; // "studentRegisterNo_eventId"
  studentRegisterNo: string;
  studentName: string;
  eventId: string;
  eventTitle: string;
  registrationPoints: number; // 5 points automatically awarded on registering
  participated: boolean; // Did the student participate in the event?
  participationPoints: number; // 15 if participated, 0 if not
  eventScore: number; // Evaluated criterion marks sum (0-80)
  criterion1?: number; // Criterion 01 (Out of 20 marks)
  criterion2?: number; // Criterion 02 (Out of 20 marks)
  criterion3?: number; // Criterion 03 (Out of 20 marks)
  criterion4?: number; // Criterion 04 (Out of 20 marks)
  participationMarks?: number; // Flat 15 marks
  totalScore: number; // registrationPoints (5) + participationPoints (0 or 15) + criteria (0-80) = 100
  isWinner: boolean; // Did they win the event?
  scoreEntered: boolean;
  basePoints?: number; // Backward compatibility
  performanceScore?: number; // Backward compatibility
  isGroupScore?: boolean;
}

export type UserRole = 'convenor' | 'coordinator' | 'student' | 'superadmin';

export interface MessageToCoordinator {
  id: string;
  coordinatorFacultyId: string;
  coordinatorName: string;
  eventTitle: string;
  message: string;
  timestamp: string;
}

export interface ClashRequest {
  id: string;
  studentRegisterNo: string;
  studentName: string;
  studentEmail: string;
  eventId: string;
  eventTitle: string;
  clashingEventTitle: string;
  coordinatorFacultyId: string;
  coordinatorEmail: string;
  message: string;
  timestamp: string;
  status?: 'pending' | 'allowed' | 'rejected';
}

function isLevenshteinSimilar(str1: string, str2: string): boolean {
  if (str1 === str2) return true;
  if (Math.abs(str1.length - str2.length) > 2) return false;
  let diff = 0;
  let i = 0, j = 0;
  while (i < str1.length && j < str2.length) {
    if (str1[i] !== str2[j]) {
      diff++;
      if (diff > 2) return false;
      if (str1.length > str2.length) i++;
      else if (str2.length > str1.length) j++;
      else { i++; j++; }
    } else {
      i++; j++;
    }
  }
  diff += (str1.length - i) + (str2.length - j);
  return diff <= 2;
}

export function normalizeRegisterNo(regNo?: string): string {
  if (!regNo) return '';
  return regNo.trim().toUpperCase();
}

export function isStudentEmailOrId(input?: string, studentList: Student[] = []): boolean {
  if (!input) return false;
  const clean = input.trim().toLowerCase();
  const localPart = clean.split('@')[0];

  // Faculty emails (e.g. shimla.g@gcu.edu.in) ending in @gcu.edu.in starting with a letter are NOT students
  if (clean.endsWith('@gcu.edu.in') && !clean.endsWith('@student.gcu.edu.in') && /^[a-zA-Z]/.test(localPart)) {
    return false;
  }

  // 1. Explicit student domain (@student.gcu.edu.in)
  if (clean.endsWith('@student.gcu.edu.in')) {
    return true;
  }

  // 2. Starts with a digit or contains batch code (e.g. 26anshuman.k, 24bcar105, etc.)
  if (/^[0-9]/.test(clean) || /^[0-9]/.test(localPart)) {
    return true;
  }

  // 3. Matches register number pattern (e.g. 26anshuman.k, 24bcar..., 22bt..., gcu-...)
  if (/^[0-9]{2}[a-z]/i.test(localPart) || /^[0-9]{2}bt/i.test(localPart) || /^gcu-[0-9]/i.test(localPart)) {
    return true;
  }

  // 4. Exists in student list BUT only if registerNo actually looks like a student register number
  if (studentList.some(s => {
    const sEmail = s.email?.toLowerCase();
    const sReg = s.registerNo?.toLowerCase();
    const isStudentReg = sReg && (/^[0-9]/.test(sReg) || sReg.startsWith('gcu-'));
    return isStudentReg && (sEmail === clean || sReg === clean || sReg === localPart);
  })) {
    return true;
  }

  return false;
}

export function getStudentRegisteredEventIds(student?: Student | null, allScores: Score[] = []): string[] {
  if (!student) return [];
  const eventIdsSet = new Set<string>(student.registeredEventIds || []);

  if (allScores && allScores.length > 0) {
    const normReg = student.registerNo ? normalizeRegisterNo(student.registerNo) : '';
    const rawRegLower = student.registerNo ? student.registerNo.trim().toLowerCase() : '';
    const emailLower = student.email ? student.email.trim().toLowerCase() : '';
    const emailLocal = emailLower ? emailLower.split('@')[0] : '';
    const uidClean = student.uid ? student.uid.trim() : '';

    allScores.forEach(sc => {
      if (!sc.eventId) return;
      const scReg = sc.studentRegisterNo ? sc.studentRegisterNo.trim() : '';
      if (!scReg) return;
      const scRegNorm = normalizeRegisterNo(scReg);
      const scRegLower = scReg.toLowerCase();
      const scRegLocal = scRegLower.includes('@') ? scRegLower.split('@')[0] : scRegLower;

      const isMatch = Boolean(
        (normReg && scRegNorm && normReg === scRegNorm) ||
        (rawRegLower && scRegLower === rawRegLower) ||
        (emailLower && scRegLower === emailLower) ||
        (emailLocal && scRegLocal && emailLocal === scRegLocal) ||
        (uidClean && scReg === uidClean)
      );

      if (isMatch) {
        eventIdsSet.add(sc.eventId);
      }
    });
  }

  return Array.from(eventIdsSet);
}

export function isStudentRegisteredForEvent(
  student: Student,
  targetEvent: Event,
  allEvents: Event[] = [],
  allScores: Score[] = []
): boolean {
  if (!student || !targetEvent) return false;

  const targetId = targetEvent.id;
  const normTargetTitle = targetEvent.title ? targetEvent.title.trim().toLowerCase() : '';

  // Gather matching event IDs (in case of duplicate/re-created events with same title)
  const matchingEventIds = new Set<string>();
  matchingEventIds.add(targetId);

  if (normTargetTitle && allEvents.length > 0) {
    allEvents.forEach(e => {
      if (e.title && e.title.trim().toLowerCase() === normTargetTitle) {
        matchingEventIds.add(e.id);
      }
    });
  }

  // 1. Direct check in student.registeredEventIds
  if (student.registeredEventIds && student.registeredEventIds.some(eid => matchingEventIds.has(eid))) {
    return true;
  }

  // 2. Score record check
  if (allScores.length > 0) {
    const normReg = student.registerNo ? student.registerNo.trim().toUpperCase() : '';
    const normEmail = student.email ? student.email.trim().toLowerCase() : '';
    const hasScore = allScores.some(sc => 
      matchingEventIds.has(sc.eventId) && (
        (normReg && sc.studentRegisterNo && sc.studentRegisterNo.trim().toUpperCase() === normReg) ||
        (normEmail && sc.studentRegisterNo && sc.studentRegisterNo.trim().toLowerCase() === normEmail)
      )
    );
    if (hasScore) return true;
  }

  return false;
}

export function isFacultyEmail(input?: string, facultyList: FacultyCoordinator[] = []): boolean {
  if (!input) return false;
  const clean = input.trim().toLowerCase();
  const localPart = clean.split('@')[0];

  if (clean.endsWith('@student.gcu.edu.in')) return false;

  // Faculty emails start with an alphabet letter (a-z)
  if (/^[a-zA-Z]/.test(localPart)) {
    return true;
  }

  if (facultyList.some(f => f.email?.toLowerCase() === clean || f.facultyId?.toLowerCase() === clean)) {
    return true;
  }

  return false;
}

export function extractEmailFromUser(user: any): string {
  if (!user) return '';
  let mail = user.email || '';
  if (!mail && user.providerData && Array.isArray(user.providerData)) {
    for (const p of user.providerData) {
      if (p && p.email) {
        mail = p.email;
        break;
      }
    }
  }
  if (!mail && user.reloadUserInfo && user.reloadUserInfo.email) {
    mail = user.reloadUserInfo.email;
  }
  return (mail || '').trim().toLowerCase();
}

export function findStudentMatch(
  studentsList: Student[],
  target: { uid?: string; email?: string; registerNo?: string }
): Student | undefined {
  if (!studentsList || studentsList.length === 0) return undefined;

  const targetUid = target.uid ? target.uid.trim() : '';
  const targetEmail = target.email ? target.email.trim().toLowerCase() : '';
  const targetRegNo = target.registerNo ? target.registerNo.trim().toLowerCase() : '';

  const emailLocal = targetEmail ? targetEmail.split('@')[0] : '';
  const strippedEmailLocal = emailLocal ? emailLocal.replace(/^(\d{2})([a-zA-Z])/, '$2') : '';

  return studentsList.find(s => {
    if (!s) return false;
    const sUid = s.uid ? s.uid.trim() : '';
    const sEmail = s.email ? s.email.trim().toLowerCase() : '';
    const sRegNo = s.registerNo ? s.registerNo.trim().toLowerCase() : '';
    const sEmailLocal = sEmail ? sEmail.split('@')[0] : '';
    const sStrippedEmailLocal = sEmailLocal ? sEmailLocal.replace(/^(\d{2})([a-zA-Z])/, '$2') : '';

    // 1. UID exact match
    if (targetUid && sUid && targetUid === sUid) return true;

    // 2. Email exact match
    if (targetEmail && sEmail && targetEmail === sEmail) return true;

    // 3. RegisterNo exact match
    if (targetRegNo && sRegNo && targetRegNo === sRegNo) return true;

    // 4. RegisterNo matches Target Email Local Part
    if (sRegNo && emailLocal && (sRegNo === emailLocal || sRegNo === strippedEmailLocal)) return true;

    // 5. Target RegisterNo matches Student Email Local Part
    if (targetRegNo && sEmailLocal && (targetRegNo === sEmailLocal || targetRegNo === sStrippedEmailLocal)) return true;

    // 6. Student Email Local Part matches Target Email Local Part
    if (sEmailLocal && emailLocal && (sEmailLocal === emailLocal || sStrippedEmailLocal === strippedEmailLocal)) return true;

    return false;
  });
}

export function isMatchingEmail(email1?: string, email2?: string): boolean {
  if (!email1 || !email2) return false;
  const e1 = email1.toLowerCase().trim();
  const e2 = email2.toLowerCase().trim();
  if (e1 === e2) return true;

  const local1 = e1.split('@')[0];
  const local2 = e2.split('@')[0];
  if (local1 === local2) return true;

  // Split into tokens like 'a', 'gnansundari', 'gnanasundari'
  const tokens1 = local1.split(/[._-]/).filter(Boolean).sort();
  const tokens2 = local2.split(/[._-]/).filter(Boolean).sort();

  if (tokens1.length === tokens2.length) {
    let allMatch = true;
    for (let i = 0; i < tokens1.length; i++) {
      if (tokens1[i] !== tokens2[i] && !isLevenshteinSimilar(tokens1[i], tokens2[i])) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }

  const long1 = tokens1.find(t => t.length >= 5);
  const long2 = tokens2.find(t => t.length >= 5);
  if (long1 && long2 && isLevenshteinSimilar(long1, long2)) {
    return true;
  }

  return false;
}

