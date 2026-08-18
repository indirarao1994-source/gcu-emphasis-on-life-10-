/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { Event, Score, Student, normalizeRegisterNo, isStudentRegisteredForEvent } from '../types';
import { computeUnifiedLeaderboard } from '../utils/LeaderboardUtils';

// -------------------------------------------------------------
// -------------------------------------------------------------
// CONVENOR: Student USN Assignment & Register No. Correction
// -------------------------------------------------------------

export interface StudentUsnUpdate {
  registerNo: string;
  usnNo: string;
  name: string;
  currentUsnNo?: string;
  correctedRegisterNo?: string;
}

export interface RegisterNoCorrection {
  oldRegisterNo: string;
  newRegisterNo: string;
  name: string;
  usnNo?: string;
}

/**
 * Download registered students as an Excel sheet for assigning / updating USN NO.
 * Can filter to only students without USN if `onlyWithoutUsn` is true.
 */
export function downloadStudentsWithoutUsnSheet(students: Student[], onlyWithoutUsn: boolean = false): void {
  const filtered = onlyWithoutUsn 
    ? students.filter(s => !s.usnNo || s.usnNo.trim() === '')
    : students;

  const sorted = [...filtered].sort((a, b) =>
    (a.department || '').localeCompare(b.department || '') ||
    (a.name || '').localeCompare(b.name || '')
  );

  const exportData = sorted.map((s, idx) => ({
    'S.No': idx + 1,
    'Current Register No': s.registerNo || '',
    'USN NO': s.usnNo || '', // Convenor fills in official permanent USN here
    'Student Name': s.name || '',
    'Mobile Number': s.mobile || '',
    'Email ID': s.email || '',
    'Department': s.department || '',
    'Program / Course': s.programName || '',
    'Events Registered': (s.registeredEventIds || []).length,
    'UID (do not edit)': s.uid || '',
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);

  // Column widths
  ws['!cols'] = [
    { wch: 6 },   // S.No
    { wch: 24 },  // Current Register No
    { wch: 24 },  // USN NO (Column C)
    { wch: 30 },  // Student Name
    { wch: 18 },  // Mobile Number
    { wch: 34 },  // Email ID
    { wch: 28 },  // Department
    { wch: 26 },  // Program / Course
    { wch: 18 },  // Events Registered
    { wch: 28 },  // UID
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student_USN_List');

  // Add instructions sheet
  const instructions: any[][] = [
    ['📋 INSTRUCTIONS FOR ASSIGNING USN NUMBERS'],
    [''],
    ['1. In the "Student_USN_List" sheet, find the student rows.'],
    ['2. Enter or edit the "USN NO" column (Column C) with the official permanent USN for each student.'],
    ['3. Save the Excel file.'],
    ['4. Upload the saved file in Convenor Dashboard under "Upload Corrected Sheet with USN".'],
    ['5. Click "Apply & Save USN Updates". The system will update student records and all event registration lists.'],
    [''],
    ['⚠️  IMPORTANT: Do NOT delete or modify "Current Register No" (Column B) as it is used to identify the student.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  wsInstr['!cols'] = [{ wch: 95 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  const prefix = onlyWithoutUsn ? 'GCU_Students_Without_USN' : 'GCU_Students_Master_USN';
  XLSX.writeFile(wb, `${prefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Backward compatibility alias for downloadStudentRegisterNoSheet
 */
export function downloadStudentRegisterNoSheet(students: Student[]): void {
  downloadStudentsWithoutUsnSheet(students, false);
}

/**
 * Parse an uploaded student USN & register number Excel sheet.
 * Returns updates with USN numbers and optional register number corrections.
 */
export function parseStudentUsnSheet(file: File): Promise<{
  updates: StudentUsnUpdate[];
  corrections: RegisterNoCorrection[];
  conflicts: string[];
  totalRows: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) {
          throw new Error('The uploaded Excel file contains no sheets.');
        }
        const ws = wb.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        const getVal = (row: Record<string, any>, ...keys: string[]): string => {
          for (const key of keys) {
            for (const k of Object.keys(row)) {
              const cleanK = k.toLowerCase().trim().replace(/\s+/g, ' ');
              if (cleanK.includes(key.toLowerCase())) {
                const v = row[k];
                if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
              }
            }
          }
          return '';
        };

        const updates: StudentUsnUpdate[] = [];
        const corrections: RegisterNoCorrection[] = [];
        const conflicts: string[] = [];

        for (const row of rows) {
          const currentReg = (getVal(row, 'current register no', 'current register', 'register number', 'register no', 'reg no') || '').toUpperCase().trim();
          const usnVal = (getVal(row, 'usn no', 'usn', 'usn number', 'permanent usn', 'corrected usn', 'university seat') || '').toUpperCase().trim();
          const correctedReg = (getVal(row, 'corrected register no', 'corrected register', 'new register') || '').toUpperCase().trim();
          const name = getVal(row, 'student name', 'name') || currentReg;

          if (!currentReg) continue;

          // If USN is provided
          if (usnVal) {
            updates.push({
              registerNo: currentReg,
              usnNo: usnVal,
              name,
              correctedRegisterNo: correctedReg && correctedReg !== currentReg ? correctedReg : undefined
            });
          }

          // If register number was also changed
          if (correctedReg && correctedReg !== currentReg) {
            corrections.push({
              oldRegisterNo: currentReg,
              newRegisterNo: correctedReg,
              name,
              usnNo: usnVal || undefined
            });
          }
        }

        resolve({ updates, corrections, conflicts, totalRows: rows.length });
      } catch (err: any) {
        reject(new Error('Failed to parse Excel file: ' + (err?.message || 'Unknown error')));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Backward compatibility parser for register number correction
 */
export async function parseStudentRegisterNoSheet(file: File): Promise<{
  corrections: RegisterNoCorrection[];
  updates: StudentUsnUpdate[];
  conflicts: string[];
  totalRows: number;
}> {
  const result = await parseStudentUsnSheet(file);
  return {
    corrections: result.corrections,
    updates: result.updates,
    conflicts: result.conflicts,
    totalRows: result.totalRows
  };
}

// -------------------------------------------------------------
// CONVENOR: Bulk Event Excel Template Download & Parser
// -------------------------------------------------------------

export function downloadEventExcel(events?: Event[]): void {
  let exportData: any[] = [];

  if (events && events.length > 0) {
    exportData = events.map(e => ({
      'Event Title': e.title || '',
      'Event Description': e.description || '',
      'Event Rules': e.rules || '',
      'Date (YYYY-MM-DD)': e.date || '',
      'Start Time (HH:MM)': e.timeStart || '',
      'End Time (HH:MM)': e.timeEnd || '',
      'Venue': e.venue || '',
      'Host Department': e.hostDepartment || '',
      'Faculty Coordinator ID': e.coordinatorFacultyId || '',
      'Faculty Coordinator Name': e.coordinatorName || '',
      'Faculty Coordinator Mobile': e.coordinatorMobile || '',
      'Faculty Coordinator Email': e.coordinatorEmail || '',
      'Student Coordinator Name': e.studentCoordinatorName || ''
    }));
  } else {
    exportData = [
      {
        'Event Title': 'Coral Tank — AI & Tech Ideathon',
        'Event Description': 'An innovation pitch challenge where participants identify a real-world problem and propose creative, technology-driven solutions across healthcare, education, or smart cities.',
        'Event Rules': '1. Open to all registered GCU students. 2. Teams of 2-4 members. 3. 2 minutes pitch + 1 min Q&A. 4. No prototype required.',
        'Date (YYYY-MM-DD)': '2026-08-03',
        'Start Time (HH:MM)': '14:35',
        'End Time (HH:MM)': '16:30',
        'Venue': 'Room no 384',
        'Host Department': 'IT Club',
        'Faculty Coordinator ID': 'FAC-102',
        'Faculty Coordinator Name': 'Prof. Kushal B. S.',
        'Faculty Coordinator Mobile': '+91 95359 45757',
        'Faculty Coordinator Email': 'kushal.bs@gcu.edu.in',
        'Student Coordinator Name': 'Trisha P (24BCAR105) & Harsha Raj (24BSDC140)'
      },
      {
        'Event Title': 'Passport to Coralverse — A Voyage through the Seasons of Life',
        'Event Description': 'An immersive team-based travel expedition through four seasonal reefs — Spring, Summer, Monsoon, and Winter.',
        'Event Rules': '1. Register in teams of 4-6 members before event. 2. Must participate in all four rounds. 3. No mobile phones or AI tools permitted.',
        'Date (YYYY-MM-DD)': '2026-08-03',
        'Start Time (HH:MM)': '14:55',
        'End Time (HH:MM)': '17:00',
        'Venue': 'Room No. 21, West Block',
        'Host Department': 'Travel & Adventure Club',
        'Faculty Coordinator ID': 'FAC-105',
        'Faculty Coordinator Name': 'Mr. Dheleepan G V',
        'Faculty Coordinator Mobile': '+91 77957 10922',
        'Faculty Coordinator Email': 'dheleepan.gv@gcu.edu.in',
        'Student Coordinator Name': 'Jerry Roshan (7795710922) & Vishnu Devan (9686015906)'
      },
      {
        'Event Title': 'Summer Tide Gourmet Challenge',
        'Event Description': 'A vibrant fireless culinary competition where students craft tropical-inspired salad dishes.',
        'Event Rules': '1. Fireless competition: no open flames or stoves. 2. Bring all own ingredients. 3. Total time 1 hour 30 mins.',
        'Date (YYYY-MM-DD)': '2026-08-05',
        'Start Time (HH:MM)': '14:15',
        'End Time (HH:MM)': '16:00',
        'Venue': 'Green House',
        'Host Department': 'Club de Gastronome',
        'Faculty Coordinator ID': 'FAC-108',
        'Faculty Coordinator Name': 'Chef Vidya Devarajan',
        'Faculty Coordinator Mobile': '+91 95464 58341',
        'Faculty Coordinator Email': 'vidya.d@gcu.edu.in',
        'Student Coordinator Name': 'Prince Kumar (BA)'
      }
    ];
  }

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set column widths for comfortable viewing in Microsoft Excel
  worksheet['!cols'] = [
    { wch: 35 }, // Event Title
    { wch: 45 }, // Event Description
    { wch: 45 }, // Event Rules
    { wch: 18 }, // Date
    { wch: 16 }, // Start Time
    { wch: 16 }, // End Time
    { wch: 25 }, // Venue
    { wch: 25 }, // Host Department
    { wch: 22 }, // Faculty ID
    { wch: 28 }, // Faculty Name
    { wch: 20 }, // Faculty Mobile
    { wch: 28 }, // Faculty Email
    { wch: 40 }  // Student Coordinator Name
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fresherism Events');

  const fileName = events && events.length > 0 ? 'Fresherism_2026_Events_Master.xlsx' : 'Fresherism_2026_Events_Template.xlsx';
  XLSX.writeFile(workbook, fileName);
}

export async function parseEventsExcel(file: File): Promise<Omit<Event, 'id'>[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert worksheet to JSON rows
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  const events: Omit<Event, 'id'>[] = [];

  rawRows.forEach((row) => {
    // Helper to extract value flexibly from keys
    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase().trim().includes(k.toLowerCase())) {
            const val = row[rowKey];
            if (val !== undefined && val !== null) {
              return String(val).trim();
            }
          }
        }
      }
      return '';
    };

    const title = getVal('title', 'event title', 'event name', 'name of event', 'event');
    if (!title || title.toLowerCase().includes('sample') && title.toLowerCase().includes('row')) {
      if (!title) return;
    }

    const description = getVal('description', 'desc');
    const rules = getVal('rules', 'game rules', 'regulations');
    const date = getVal('date');
    const timeStart = getVal('start time', 'time start', 'start');
    const timeEnd = getVal('end time', 'time end', 'end');
    const venue = getVal('venue', 'room', 'location');
    const hostDepartment = getVal('host department', 'department', 'club', 'host');
    const coordinatorFacultyId = getVal('faculty coordinator id', 'faculty id', 'fac id');
    const coordinatorName = getVal('faculty coordinator name', 'faculty coordinator', 'coordinator name', 'fac name');
    const coordinatorMobile = getVal('faculty coordinator mobile', 'mobile', 'phone', 'contact');
    const coordinatorEmail = getVal('faculty coordinator email', 'email', 'mail');
    const studentCoordinatorName = getVal('student coordinator name', 'student coordinator', 'student coord');

    events.push({
      title: title || 'Untitled Event',
      description: description || '',
      rules: rules || '',
      date: date || '2026-08-05',
      timeStart: timeStart || '10:00',
      timeEnd: timeEnd || '12:00',
      venue: venue || 'Main Campus Auditorium',
      hostDepartment: hostDepartment || 'University Club',
      coordinatorFacultyId: coordinatorFacultyId || 'FAC-101',
      coordinatorName: coordinatorName || 'Faculty Coordinator',
      coordinatorMobile: coordinatorMobile || '',
      coordinatorEmail: coordinatorEmail || '',
      studentCoordinatorName: studentCoordinatorName || '',
      imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=600'
    });
  });

  return events;
}

// -------------------------------------------------------------
// COORDINATOR & CONVENOR: Official GCU Scoring Sheet Exporters & Parsers
// Matches official Garden City University PDF format
// -------------------------------------------------------------

export function buildOfficialGcuScoringSheetWorksheet(
  event: Event | { id?: string; title: string; date?: string; venue?: string; coordinatorName?: string; timeStart?: string; timeEnd?: string; isFlagship?: boolean },
  students: Student[],
  scores: Score[],
  occasionTitle: string = 'Fresherism 2K26'
) {
  const aoa: any[][] = [];

  // Top Title Banner
  aoa.push(['GARDEN CITY UNIVERSITY']);
  aoa.push([`${occasionTitle} - Scoring Sheet`]);

  // Event Metadata Block
  aoa.push(['Date of Event:', event.date || '']);
  aoa.push([
    'Type of Event:',
    (event as any).isFlagship ? 'Flagship' : ((event as any).eventType || 'Generic/Flagship'),
    '',
    'Timing:',
    event.timeStart && event.timeEnd ? `${event.timeStart} - ${event.timeEnd}` : ''
  ]);
  aoa.push([
    'Name of Event:',
    event.title || '',
    '',
    'Faculty Coordinator:',
    event.coordinatorName || ''
  ]);

  aoa.push([]); // blank line

  // Main 15 Table Columns matching official GCU format
  aoa.push([
    'Sl No',
    'Register number',
    'USN NO',
    'Name of the student',
    'Mobile Number',
    'Email ID',
    'T-Shirt Size',
    'Register Points (5 Marks)',
    'Participated (YES / NO)',
    'Participation Points (15 Marks)',
    'Criterion 01 (Out of 20 marks)',
    'Criterion 02 (Out of 20 marks)',
    'Criterion 03 (Out of 20 marks)',
    'Criterion 04 (Out of 20 marks)',
    'Total Marks'
  ]);

  const eventObj = event as Event;
  const eventId = eventObj?.id;
  const eventTitleNorm = eventObj?.title ? eventObj.title.trim().toLowerCase() : '';
  const registeredIdsFromEvent: string[] = (eventObj as any)?.registeredStudentIds || [];

  // Filter students to ONLY include those registered for this specific event
  let targetStudents: Student[] = [];

  if (students && students.length > 0 && (eventId || eventTitleNorm)) {
    targetStudents = students.filter(student => {
      // 1. Direct registration check in event.registeredStudentIds
      if (registeredIdsFromEvent.length > 0) {
        const isReg = registeredIdsFromEvent.some(rid => {
          const cleanRid = (rid || '').trim().toUpperCase();
          return Boolean(
            (student.registerNo && student.registerNo.trim().toUpperCase() === cleanRid) ||
            (student.email && student.email.trim().toLowerCase() === rid.trim().toLowerCase()) ||
            (student.uid && student.uid === rid)
          );
        });
        if (isReg) return true;
      }

      // 2. Standard helper check using student.registeredEventIds
      if (eventId && isStudentRegisteredForEvent(student, eventObj, [], scores)) {
        return true;
      }

      // 3. Score record match for this specific event
      const normReg = student.registerNo ? student.registerNo.trim().toUpperCase() : '';
      const normEmail = student.email ? student.email.trim().toLowerCase() : '';
      const normUid = student.uid ? student.uid.trim() : '';

      return scores.some(sc => {
        const scReg = sc.studentRegisterNo ? sc.studentRegisterNo.trim() : '';
        const isUserMatch = (
          (normReg && scReg.toUpperCase() === normReg) ||
          (normEmail && scReg.toLowerCase() === normEmail) ||
          (normUid && scReg === normUid)
        );
        if (!isUserMatch) return false;
        return Boolean(
          (eventId && sc.eventId === eventId) ||
          (eventTitleNorm && sc.eventTitle && sc.eventTitle.trim().toLowerCase() === eventTitleNorm)
        );
      });
    });

    // If filtering returned 0 but students array passed in was already a small pre-filtered subset, preserve passed students
    if (targetStudents.length === 0 && students.length < 20) {
      const anyHasRegs = students.some(s => s.registeredEventIds && s.registeredEventIds.length > 0);
      if (!anyHasRegs) {
        targetStudents = students;
      }
    }
  } else {
    targetStudents = students || [];
  }

  // Deduplicate targetStudents by usnNo or registerNo to ensure no duplicates in the score sheet
  const uniqueTargetMap = new Map<string, Student>();
  targetStudents.forEach(s => {
    const key = (s.usnNo || s.registerNo || '').trim().toUpperCase();
    if (key && !uniqueTargetMap.has(key)) {
      uniqueTargetMap.set(key, s);
    } else if (!key && s.id && !uniqueTargetMap.has(s.id)) {
      uniqueTargetMap.set(s.id, s);
    }
  });
  targetStudents = Array.from(uniqueTargetMap.values());

  const eventScores = eventId ? scores.filter(sc => sc.eventId === eventId) : scores;

  if (targetStudents.length > 0) {
    targetStudents.forEach((student, index) => {
      const normReg = student.registerNo ? student.registerNo.trim().toUpperCase() : '';
      const matchingScores = eventScores.filter(s => s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === normReg);
      matchingScores.sort((a, b) => {
        const aExact = (eventId && a.eventId === eventId) ? 1 : 0;
        const bExact = (eventId && b.eventId === eventId) ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        if (a.scoreEntered && !b.scoreEntered) return -1;
        if (!a.scoreEntered && b.scoreEntered) return 1;
        return 0;
      });
      const sc = matchingScores[0];
      const isParticipated = sc ? Boolean(sc.participated || (sc.participationPoints ?? 0) > 0 || (sc.eventScore ?? 0) > 0) : false;
      const partStatus = isParticipated ? 'YES' : 'NO';
      const regPts = 5;
      const partMarks = (isParticipated && sc) ? (sc.participationPoints ?? 15) : (sc ? (sc.participationPoints ?? 0) : 0);

      const perfScore = (isParticipated && sc) ? (sc.eventScore ?? sc.performanceScore ?? 0) : 0;
      const c1 = (isParticipated && sc) ? (sc.criterion1 ?? Math.min(20, Math.round(perfScore * 0.25))) : 0;
      const c2 = (isParticipated && sc) ? (sc.criterion2 ?? Math.min(20, Math.round(perfScore * 0.25))) : 0;
      const c3 = (isParticipated && sc) ? (sc.criterion3 ?? Math.min(20, Math.round(perfScore * 0.25))) : 0;
      const c4 = (isParticipated && sc) ? (sc.criterion4 ?? Math.max(0, Math.min(20, perfScore - (c1 + c2 + c3)))) : 0;

      const total = isParticipated ? (sc?.totalScore ?? (regPts + partMarks + c1 + c2 + c3 + c4)) : regPts;

      aoa.push([
        index + 1,
        student.registerNo || '',
        student.usnNo || sc?.usnNo || '',
        student.name || '',
        student.mobile || '',
        student.email || '',
        student.tShirtSize || 'N/A',
        regPts,
        partStatus,
        partMarks,
        c1,
        c2,
        c3,
        c4,
        total
      ]);
    });
  } else {
    // 15 blank rows for manual print evaluation if no students registered yet
    for (let i = 1; i <= 15; i++) {
      aoa.push([i, '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    }
  }

  // Footer Signature Block
  aoa.push([]);
  aoa.push([]);
  aoa.push([
    'EVENT JUDGE',
    '',
    '',
    '',
    '',
    '',
    '',
    'Faculty Coordinator',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ]);
  aoa.push([
    '(Name with Signature & Date)',
    '',
    '',
    '',
    '',
    '',
    '',
    '(Signature & Date)',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  worksheet['!cols'] = [
    { wch: 8 },  // Sl No
    { wch: 22 }, // Register number
    { wch: 22 }, // USN NO
    { wch: 28 }, // Name of the student
    { wch: 18 }, // Mobile Number
    { wch: 30 }, // Email ID
    { wch: 15 }, // T-Shirt Size
    { wch: 24 }, // Register Points (5 Marks)
    { wch: 24 }, // Participated (YES / NO)
    { wch: 28 }, // Participation Points (15 Marks)
    { wch: 28 }, // Criterion 01 (Out of 20 marks)
    { wch: 28 }, // Criterion 02 (Out of 20 marks)
    { wch: 28 }, // Criterion 03 (Out of 20 marks)
    { wch: 28 }, // Criterion 04 (Out of 20 marks)
    { wch: 16 }  // Total Marks
  ];

  worksheet['!merges'] = [
    { s: { r: 2, c: 1 }, e: { r: 2, c: 12 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 12 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
    { s: { r: 4, c: 4 }, e: { r: 4, c: 12 } }
  ];

  return worksheet;
}

export function downloadMarksExcel(
  eventOrTitle: Event | string,
  registeredStudents: Student[],
  currentScores: Score[],
  occasionTitle: string = 'Fresherism 2K26'
): void {
  const eventObj = typeof eventOrTitle === 'string' ? { title: eventOrTitle } : eventOrTitle;
  const worksheet = buildOfficialGcuScoringSheetWorksheet(eventObj, registeredStudents, currentScores, occasionTitle);

  const workbook = XLSX.utils.book_new();
  const safeTitle = eventObj.title.replace(/[:\\/?*\[\]]/g, '').substring(0, 25);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeTitle || 'Scoresheet');

  const fileName = `Official_GCU_Scoring_Sheet_${eventObj.title.replace(/[^a-zA-Z0-9_]/g, '_')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export interface ParsedMarks {
  studentRegisterNo: string;
  usnNo?: string;
  studentName?: string;
  mobile?: string;
  participated: boolean;
  eventScore: number;
  criterion1?: number;
  criterion2?: number;
  criterion3?: number;
  criterion4?: number;
  registrationPoints?: number;
  participationMarks?: number;
  totalScore?: number;
  isWinner: boolean;
}

export async function parseMarksExcel(file: File): Promise<ParsedMarks[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded Excel workbook contains no sheets.');
  }
  const worksheet = workbook.Sheets[firstSheetName];

  // Helper to normalize strings for comparison (removes all non-alphanumeric chars)
  const normKey = (str: any): string => {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const isRegPtsHeader = (nk: string): boolean => {
    return (
      nk.includes('registerpoint') ||
      nk.includes('registrationpoint') ||
      nk.includes('registermark') ||
      nk.includes('registrationmark') ||
      nk.includes('regpts') ||
      nk.includes('regpoints')
    );
  };

  const isPartPtsHeader = (nk: string): boolean => {
    return (
      nk.includes('participationpoint') ||
      nk.includes('participationmark') ||
      nk.includes('partpoint') ||
      nk.includes('partmark') ||
      nk.includes('partpts') ||
      nk.includes('partpoints')
    );
  };

  const isUsnHeader = (nk: string): boolean => {
    return (
      nk === 'usn' ||
      nk === 'usnno' ||
      nk === 'usnnumber' ||
      nk === 'universityseatno' ||
      nk === 'universityseatnumber' ||
      nk === 'correctregno' ||
      nk === 'correctregisterno' ||
      nk === 'usnid'
    );
  };

  const isRegNoHeader = (nk: string): boolean => {
    if (isRegPtsHeader(nk) || isUsnHeader(nk)) return false;
    return (
      nk.includes('registernumber') ||
      nk.includes('studentregister') ||
      nk.includes('registerno') ||
      nk.includes('regno') ||
      nk.includes('registrationno') ||
      nk.includes('registrationnumber') ||
      nk.includes('regnumber') ||
      nk.includes('studentreg') ||
      nk === 'rollno' ||
      nk === 'studentid' ||
      nk === 'reg' ||
      nk === 'register'
    );
  };

  const isNameHeader = (nk: string): boolean => {
    return (
      (nk.includes('name') || nk.includes('studentname')) &&
      !nk.includes('coordinator') &&
      !nk.includes('faculty') &&
      !nk.includes('event')
    );
  };

  const isMobileHeader = (nk: string): boolean => {
    return (
      nk.includes('mobile') ||
      nk.includes('phone') ||
      nk.includes('contact') ||
      nk.includes('cell') ||
      nk.includes('phoneno') ||
      nk.includes('mobileno') ||
      nk.includes('mobilenumber') ||
      nk.includes('phonenumber')
    );
  };

  const isPartHeader = (nk: string): boolean => {
    if (isPartPtsHeader(nk)) return false;
    return (
      nk.includes('participat') ||
      nk.includes('present') ||
      nk.includes('attendance') ||
      nk.includes('yesno') ||
      nk === 'part'
    );
  };

  const isC1Header = (nk: string): boolean => {
    return nk.includes('criterion01') || nk.includes('criterion1') || nk.includes('crit01') || nk.includes('crit1') || nk === 'c1' || nk.includes('criteria1') || (nk.includes('mark') && nk.includes('1') && !nk.includes('2') && !nk.includes('3') && !nk.includes('4'));
  };
  const isC2Header = (nk: string): boolean => {
    return nk.includes('criterion02') || nk.includes('criterion2') || nk.includes('crit02') || nk.includes('crit2') || nk === 'c2' || nk.includes('criteria2') || (nk.includes('mark') && nk.includes('2') && !nk.includes('1') && !nk.includes('3') && !nk.includes('4'));
  };
  const isC3Header = (nk: string): boolean => {
    return nk.includes('criterion03') || nk.includes('criterion3') || nk.includes('crit03') || nk.includes('crit3') || nk === 'c3' || nk.includes('criteria3') || (nk.includes('mark') && nk.includes('3') && !nk.includes('1') && !nk.includes('2') && !nk.includes('4'));
  };
  const isC4Header = (nk: string): boolean => {
    return nk.includes('criterion04') || nk.includes('criterion4') || nk.includes('crit04') || nk.includes('crit4') || nk === 'c4' || nk.includes('criteria4') || (nk.includes('mark') && nk.includes('4') && !nk.includes('1') && !nk.includes('2') && !nk.includes('3'));
  };

  const isTotalHeader = (nk: string): boolean => {
    if (isRegPtsHeader(nk) || isPartPtsHeader(nk)) return false;
    return nk.includes('total') || nk.includes('grandtotal') || nk.includes('totalmark') || nk.includes('totalscore') || nk.includes('finalscore') || nk === 'score';
  };

  const isWinnerHeader = (nk: string): boolean => nk.includes('winner') || nk.includes('prize') || nk.includes('rank') || nk.includes('position');

  // Try 2D array parsing first to handle sheets with metadata/title headers
  const rows2D = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
  const parsed: ParsedMarks[] = [];

  let headerRowIdx = -1;
  let regNoIdx = -1;
  let usnIdx = -1;
  let nameIdx = -1;
  let mobileIdx = -1;
  let partIdx = -1;
  let regPtsIdx = -1;
  let partPtsIdx = -1;
  let c1Idx = -1;
  let c2Idx = -1;
  let c3Idx = -1;
  let c4Idx = -1;
  let totalIdx = -1;
  let winnerIdx = -1;

  for (let r = 0; r < Math.min(rows2D.length, 50); r++) {
    const row = rows2D[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const nk = normKey(row[c]);
      if (isRegNoHeader(nk)) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx !== -1) break;
  }

  if (headerRowIdx !== -1) {
    const headerRow = rows2D[headerRowIdx] as any[];
    headerRow.forEach((cell, idx) => {
      const nk = normKey(cell);
      if (isRegPtsHeader(nk) && regPtsIdx === -1) {
        regPtsIdx = idx;
      } else if (isPartPtsHeader(nk) && partPtsIdx === -1) {
        partPtsIdx = idx;
      } else if (isUsnHeader(nk) && usnIdx === -1) {
        usnIdx = idx;
      } else if (isRegNoHeader(nk) && regNoIdx === -1) {
        regNoIdx = idx;
      } else if (isNameHeader(nk) && nameIdx === -1) {
        nameIdx = idx;
      } else if (isMobileHeader(nk) && mobileIdx === -1) {
        mobileIdx = idx;
      } else if (isPartHeader(nk) && partIdx === -1) {
        partIdx = idx;
      } else if (isC1Header(nk) && c1Idx === -1) {
        c1Idx = idx;
      } else if (isC2Header(nk) && c2Idx === -1) {
        c2Idx = idx;
      } else if (isC3Header(nk) && c3Idx === -1) {
        c3Idx = idx;
      } else if (isC4Header(nk) && c4Idx === -1) {
        c4Idx = idx;
      } else if (isTotalHeader(nk) && totalIdx === -1) {
        totalIdx = idx;
      } else if (isWinnerHeader(nk) && winnerIdx === -1) {
        winnerIdx = idx;
      }
    });

    if (regNoIdx !== -1) {
      console.log('📊 Parsing Excel marks - Header found at row:', headerRowIdx);
      console.log('Column indices:', { regNoIdx, usnIdx, c1Idx, c2Idx, c3Idx, c4Idx, totalIdx, partIdx });

      for (let r = headerRowIdx + 1; r < rows2D.length; r++) {
        const row = rows2D[r];
        if (!Array.isArray(row)) continue;
        const usnNo = usnIdx !== -1 ? String(row[usnIdx] || '').trim().toUpperCase() : undefined;
        let regNo = normalizeRegisterNo(String(row[regNoIdx] || ''));
        if (!regNo) {
          regNo = usnNo ? normalizeRegisterNo(usnNo) : (mobileIdx !== -1 && row[mobileIdx] ? normalizeRegisterNo(String(row[mobileIdx])) : '');
        }
        if (!regNo) continue;
        const c1Val = row[c1Idx];
        const c2Val = row[c2Idx];
        const c3Val = row[c3Idx];
        const c4Val = row[c4Idx];
        const partVal = row[partIdx];

        const nkReg = normKey(regNo);
        if (
          nkReg.includes('register') ||
          nkReg.includes('slno') ||
          nkReg.includes('dateof') ||
          nkReg.includes('signature') ||
          nkReg.includes('judge') ||
          nkReg.includes('faculty') ||
          nkReg.includes('namewith') ||
          nkReg.includes('official') ||
          nkReg.includes('gardencity') ||
          nkReg === 'sl' ||
          nkReg === 'no'
        ) continue;

        const regPts = (regPtsIdx !== -1 && row[regPtsIdx] !== '' && row[regPtsIdx] !== undefined)
          ? (parseFloat(String(row[regPtsIdx])) || 0)
          : 5;

        let partPtsFromCell: number | undefined = undefined;
        if (partPtsIdx !== -1 && row[partPtsIdx] !== '' && row[partPtsIdx] !== undefined) {
          const parsedVal = parseFloat(String(row[partPtsIdx]));
          if (!isNaN(parsedVal)) partPtsFromCell = parsedVal;
        }

        const studentName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : undefined;
        const mobile = mobileIdx !== -1 ? String(row[mobileIdx] || '').trim() : undefined;
        const partRaw = partIdx !== -1 ? String(row[partIdx] || '').trim().toUpperCase() : '';

        const c1 = c1Idx !== -1 ? (parseFloat(String(row[c1Idx])) || 0) : 0;
        const c2 = c2Idx !== -1 ? (parseFloat(String(row[c2Idx])) || 0) : 0;
        const c3 = c3Idx !== -1 ? (parseFloat(String(row[c3Idx])) || 0) : 0;
        const c4 = c4Idx !== -1 ? (parseFloat(String(row[c4Idx])) || 0) : 0;

        let totalScore = (totalIdx !== -1 && row[totalIdx] !== '' && row[totalIdx] !== undefined) ? (parseFloat(String(row[totalIdx])) || 0) : 0;
        const isExplicitNo = partRaw === 'NO' || partRaw === 'N' || partRaw === 'FALSE' || partRaw === '0' || partRaw === 'ABSENT';
        const isExplicitYes = partRaw === 'YES' || partRaw === 'Y' || partRaw === 'TRUE' || partRaw === '1' || partRaw === 'PRESENT';

        const criteriaSum = c1 + c2 + c3 + c4;
        let participated = false;
        let participationMarks = 0;

        if (isExplicitNo) {
          participated = false;
          participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 0;
        } else if (isExplicitYes || (partPtsFromCell !== undefined && partPtsFromCell > 0) || criteriaSum > 0 || totalScore > 5) {
          participated = true;
          participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 15;
        } else {
          participated = false;
          participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 0;
        }

        if (totalScore === 0) {
          totalScore = regPts + participationMarks + criteriaSum;
        }

        const winnerRaw = winnerIdx !== -1 ? String(row[winnerIdx] || '').trim().toUpperCase() : '';
        const isWinner = winnerRaw === 'TRUE' || winnerRaw === 'YES' || winnerRaw === '1';

        parsed.push({
          studentRegisterNo: regNo,
          usnNo: usnNo || undefined,
          studentName,
          mobile,
          participated,
          eventScore: criteriaSum,
          criterion1: c1,
          criterion2: c2,
          criterion3: c3,
          criterion4: c4,
          registrationPoints: regPts,
          participationMarks,
          totalScore,
          isWinner
        });
      }
    }
  }

  // Fallback to object-based json parsing if 2D parsing yielded 0 records
  if (parsed.length === 0) {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    rawRows.forEach((row) => {
      let regNo = '';
      let usnNo: string | undefined = undefined;
      let studentName: string | undefined = undefined;
      let mobile: string | undefined = undefined;
      let partRaw = '';
      let regPts: number | undefined = undefined;
      let partPtsFromCell: number | undefined = undefined;
      let c1 = 0;
      let c2 = 0;
      let c3 = 0;
      let c4 = 0;
      let totalScore = 0;
      let winnerRaw = '';

      for (const rowKey of Object.keys(row)) {
        const nk = normKey(rowKey);
        const val = row[rowKey];
        if (val === undefined || val === null || val === '') continue;

        if (regPts === undefined && isRegPtsHeader(nk)) {
          const p = parseFloat(String(val));
          if (!isNaN(p)) regPts = p;
        } else if (partPtsFromCell === undefined && isPartPtsHeader(nk)) {
          const p = parseFloat(String(val));
          if (!isNaN(p)) partPtsFromCell = p;
        } else if (!usnNo && isUsnHeader(nk)) {
          usnNo = String(val).trim().toUpperCase();
        } else if (!regNo && isRegNoHeader(nk)) {
          regNo = normalizeRegisterNo(String(val));
        } else if (!studentName && isNameHeader(nk)) {
          studentName = String(val).trim();
        } else if (!mobile && isMobileHeader(nk)) {
          mobile = String(val).trim();
        } else if (!partRaw && isPartHeader(nk)) {
          partRaw = String(val).trim().toUpperCase();
        } else if (c1 === 0 && isC1Header(nk)) {
          c1 = parseFloat(String(val)) || 0;
        } else if (c2 === 0 && isC2Header(nk)) {
          c2 = parseFloat(String(val)) || 0;
        } else if (c3 === 0 && isC3Header(nk)) {
          c3 = parseFloat(String(val)) || 0;
        } else if (c4 === 0 && isC4Header(nk)) {
          c4 = parseFloat(String(val)) || 0;
        } else if (totalScore === 0 && isTotalHeader(nk)) {
          totalScore = parseFloat(String(val)) || 0;
        } else if (!winnerRaw && isWinnerHeader(nk)) {
          winnerRaw = String(val).trim().toUpperCase();
        }
      }

      if (!regNo) {
        regNo = usnNo ? normalizeRegisterNo(usnNo) : (mobile ? normalizeRegisterNo(mobile) : '');
      }

      if (!regNo) return;
      const nkReg = normKey(regNo);
      if (
        nkReg.includes('register') ||
        nkReg.includes('slno') ||
        nkReg.includes('dateof') ||
        nkReg.includes('signature') ||
        nkReg.includes('judge') ||
        nkReg.includes('faculty') ||
        nkReg.includes('namewith') ||
        nkReg.includes('official') ||
        nkReg.includes('gardencity') ||
        nkReg === 'sl' ||
        nkReg === 'no'
      ) return;

      const regPtsFinal = regPts !== undefined ? regPts : 5;
      const isExplicitNo = partRaw === 'NO' || partRaw === 'N' || partRaw === 'FALSE' || partRaw === '0' || partRaw === 'ABSENT';
      const isExplicitYes = partRaw === 'YES' || partRaw === 'Y' || partRaw === 'TRUE' || partRaw === '1' || partRaw === 'PRESENT';

      const criteriaSum = c1 + c2 + c3 + c4;
      let participated = false;
      let participationMarks = 0;

      if (isExplicitNo) {
        participated = false;
        participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 0;
      } else if (isExplicitYes || (partPtsFromCell !== undefined && partPtsFromCell > 0) || criteriaSum > 0 || totalScore > 5) {
        participated = true;
        participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 15;
      } else {
        participated = false;
        participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 0;
      }

      if (totalScore === 0) {
        totalScore = regPtsFinal + participationMarks + criteriaSum;
      }

      const isWinner = winnerRaw === 'TRUE' || winnerRaw === 'YES' || winnerRaw === '1';

      parsed.push({
        studentRegisterNo: regNo,
        usnNo: usnNo || undefined,
        studentName,
        mobile,
        participated,
        eventScore: criteriaSum,
        criterion1: c1,
        criterion2: c2,
        criterion3: c3,
        criterion4: c4,
        registrationPoints: regPtsFinal,
        participationMarks,
        totalScore,
        isWinner
      });
    });
  }

  return parsed;
}

// -------------------------------------------------------------
// CONVENOR: Comprehensive Official Score Sheet Exporters
// -------------------------------------------------------------

/**
 * 1. Export Score Sheet for a Single Individual Event (PDF layout matching)
 */
export function exportScoreSheetIndividual(
  event: Event,
  students: Student[],
  scores: Score[],
  occasionTitle: string = 'Fresherism 2K26'
): void {
  downloadMarksExcel(event, students, scores, occasionTitle);
}

/**
 * 2. Export Score Sheet for Multiple Selected Events
 */
export function exportScoreSheetsMultiple(
  selectedEvents: Event[],
  students: Student[],
  scores: Score[],
  occasionTitle: string = 'Fresherism 2K26'
): void {
  if (!selectedEvents || selectedEvents.length === 0) return;

  const workbook = XLSX.utils.book_new();

  selectedEvents.forEach((evt, idx) => {
    const worksheet = buildOfficialGcuScoringSheetWorksheet(evt, students, scores, occasionTitle);
    const tabName = `${idx + 1}. ${evt.title.replace(/[:\\/?*\[\]]/g, '').substring(0, 22)}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, tabName);
  });

  XLSX.writeFile(workbook, `Official_GCU_ScoreSheets_Selected_${selectedEvents.length}_Events.xlsx`);
}

/**
 * 3. Export Score Sheet for All Events in Festival
 */
export function exportScoreSheetsAll(
  events: Event[],
  students: Student[],
  scores: Score[],
  occasionTitle: string = 'Fresherism 2K26'
): void {
  if (!events || events.length === 0) return;

  const workbook = XLSX.utils.book_new();
  const worksheet = buildCumulativeMatrixWorksheet(events, students, scores, `${occasionTitle} Master Score Matrix`);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Score Sheet');

  XLSX.writeFile(workbook, `Fresherism_MASTER_ALL_EVENTS_SCORESHEET.xlsx`);
}

/**
 * Helper to build a cumulative score matrix worksheet where each student is a row
 * and each event is a column, concluding with Cumulative Total Score.
 */
export function buildCumulativeMatrixWorksheet(
  eventsList: Event[],
  students: Student[],
  scores: Score[],
  reportTitle: string = 'Cumulative Score Matrix'
): XLSX.WorkSheet {
  const aoa: any[][] = [];

  // Header Title block
  aoa.push([`GARDEN CITY UNIVERSITY — ${reportTitle.toUpperCase()}`]);
  aoa.push([`Generated On: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Total Included Events: ${eventsList.length}`]);
  aoa.push([]); // blank row

  // Table Column Headers: Student Info + 1 column per event + Cumulative Total
  const headerRow = [
    'Sl No',
    'Register Number',
    'USN NO',
    'Student Name',
    'Department',
    'Program Name',
    'School',
    'Email ID',
    'Mobile Number',
    ...eventsList.map(e => `${e.title} (${e.date})`),
    'Cumulative Total Score'
  ];
  aoa.push(headerRow);

  const unifiedEntries = computeUnifiedLeaderboard(students, scores, eventsList);

  const studentRows = unifiedEntries.map((entry, idx) => {
    const eventScoresCells = eventsList.map((evt) => {
      const scoreData = entry.eventScoresMap.get(evt.id);
      return scoreData ? scoreData.score : 0; // 0 if they didn't participate and weren't registered
    });

    return {
      rowArray: [
        0, // placeholder for Sl No
        entry.registerNo || 'N/A',
        entry.usnNo || '',
        entry.name || 'N/A',
        entry.department || '',
        entry.programName || '',
        entry.school || '',
        entry.email || '',
        entry.mobile || '',
        ...eventScoresCells,
        entry.totalScore
      ]
    };
  });

  // Add rows with Sl No
  studentRows.forEach((item, idx) => {
    item.rowArray[0] = idx + 1;
    aoa.push(item.rowArray);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Auto-fit column widths
  const colWidths = [
    { wch: 8 },  // Sl No
    { wch: 22 }, // Reg No
    { wch: 22 }, // USN NO
    { wch: 28 }, // Name
    { wch: 24 }, // Dept
    { wch: 24 }, // Program
    { wch: 24 }, // School
    { wch: 28 }, // Email
    { wch: 18 }, // Mobile
    ...eventsList.map(e => ({ wch: Math.max(20, (e.title.length || 15) + 6) })),
    { wch: 25 }  // Cumulative Total
  ];
  worksheet['!cols'] = colWidths;

  return worksheet;
}

import { isEventOver } from '../dateUtils';

/**
 * Export "Cumulative Reports_Coordinators Submitted" (.xlsx)
 * Includes all events where coordinators have reported completion to convenor or submitted scores.
 */
export function exportCumulativeReportCoordinatorsSubmitted(
  events: Event[],
  students: Student[],
  scores: Score[],
  occasionTitle: string = 'Fresherism 2026'
): void {
  // Filter events reported by coordinators to convenor (MUST be completed/ended events)
  const reportedEvents = events.filter(evt =>
    isEventOver(evt) && (
      evt.reportedToConvenor ||
      scores.some(sc => sc.eventId === evt.id && (sc.scoreEntered || (sc.eventScore ?? 0) > 0 || sc.participated))
    )
  );

  const targetEvents = reportedEvents.length > 0 ? reportedEvents : events;
  const worksheet = buildCumulativeMatrixWorksheet(
    targetEvents,
    students,
    scores,
    `Cumulative Reports — Coordinators Submitted (${targetEvents.length} Events)`
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Coordinators_Submitted');

  XLSX.writeFile(workbook, `Cumulative Reports_Coordinators Submitted.xlsx`);
}

/**
 * Export "Cumulative Reports_Convenor Approved / Published" (.xlsx)
 * Includes all events that have been approved and published to leaderboard by Convenor.
 */
export function exportCumulativeReportConvenorPublished(
  events: Event[],
  students: Student[],
  scores: Score[],
  occasionTitle: string = 'Fresherism 2026'
): void {
  // Filter events published by convenor
  const publishedEvents = events.filter(evt => evt.resultsPublished === true);

  const targetEvents = publishedEvents.length > 0 ? publishedEvents : events;
  const worksheet = buildCumulativeMatrixWorksheet(
    targetEvents,
    students,
    scores,
    `Cumulative Reports — Convenor Approved / Published (${targetEvents.length} Events)`
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Convenor_Approved_Published');

  XLSX.writeFile(workbook, `Cumulative Reports_Convenor Approved Published.xlsx`);
}

/**
 * 4. Export Score Sheet for Top 100 Overall Students / Leaderboard
 */
export function exportScoreSheetsTop100(students: Student[], scores: Score[], events: Event[], topLimit: number = 100): void {
  const unifiedEntries = computeUnifiedLeaderboard(students, scores, events);

  const topStudents = unifiedEntries.slice(0, topLimit);

  const rows = topStudents.map((item, index) => ({
    'Overall Rank': index + 1,
    'Student Register No': item.registerNo,
    'USN NO': item.usnNo || '',
    'Student Name': item.name,
    'Department': item.department || '',
    'Program Name': item.programName || '',
    'School': item.school || '',
    'Email ID': item.email || '',
    'Mobile No': item.mobile || '',
    'Total Aggregate Score': item.totalScore,
    'Total Winner Titles 🏆': item.wins,
    'Events Participated': item.eventsParticipatedCount,
    'Total Events Registered': item.eventsParticipatedCount,
    'Award Status': item.wins > 0 ? `WINNER (${item.wins} Wins)` : (index < 10 ? 'TOP 10 FINISHER' : 'TOP 100 MERIT')
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 25 }, { wch: 25 },
    { wch: 25 }, { wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 22 },
    { wch: 20 }, { wch: 22 }, { wch: 25 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Top_${topLimit}_Leaderboard`);

  XLSX.writeFile(workbook, `Fresherism_2026_TOP_${topLimit}_STUDENTS_SCORESHEET.xlsx`);
}

import { generateEventCompletionReportDocx } from './DocxTemplateHelper';

/**
 * 5. Export Official Word (.docx) Event Completion & Performance Report
 * Strict template merge: substitutes fields into the uploaded Super Admin Word template, preserving 100% of the original styles, fonts, margins, and layout.
 */
export async function downloadEventCompletionWordReport(
  event: Event,
  registeredStudents: Student[],
  scores: Score[],
  occasionTitle: string = 'Fresherism 2026',
  templateDataUrl?: string
): Promise<void> {
  await generateEventCompletionReportDocx(event, registeredStudents, scores, occasionTitle, templateDataUrl);
}

/**
 * 6. Export NCC (National Cadet Corps) Interested Cadets Excel (.xlsx)
 */
export function downloadNccStudentsExcel(students: Student[]): void {
  const nccCadets = students.filter(s => s.isNccInterested === true);

  const rows = nccCadets.map((s, idx) => ({
    'Sl No': idx + 1,
    'Register No / Student ID': s.registerNo || '',
    'USN NO': s.usnNo || '',
    'Student Name': s.name || '',
    'Email ID': s.email || '',
    'Mobile Number': s.mobile || '',
    'Department': s.department || '',
    'Program / Course': s.programName || '',
    'School': s.school || '',
    'Sem 1 Declared': s.sem1Declared ? 'YES (Sem 1)' : 'Pending',
    'NCC Expressed Date': s.nccRegisteredAt ? new Date(s.nccRegisteredAt).toLocaleString() : 'Registered',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{
    'Sl No': 1,
    'Register No / Student ID': 'No NCC Registrations yet',
    'USN NO': '',
    'Student Name': '-',
    'Email ID': '-',
    'Mobile Number': '-',
    'Department': '-',
    'Program / Course': '-',
    'School': '-',
    'Sem 1 Declared': '-',
    'NCC Expressed Date': '-'
  }]);

  worksheet['!cols'] = [
    { wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 30 }, { wch: 18 },
    { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 24 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NCC_Army_Wing_Cadets');

  XLSX.writeFile(workbook, `GCU_NCC_Army_Wing_Cadets_2026.xlsx`);
}

// -------------------------------------------------------------
// CONVENOR / COORDINATOR: 4 SPECIFIC EVENT EXCEL REPORT EXPORTERS
// 1. Registered Students List
// 2. Participation List (Present)
// 3. Not Participants List (Absent)
// 4. Scores of Participants
// -------------------------------------------------------------

export function exportRegisteredStudentsList(
  event: Event,
  students: Student[],
  scores: Score[]
): void {
  const targetStudents = getTargetStudentsForEvent(event, students, scores);

  const exportData = targetStudents.map((st, index) => ({
    'Sl No': index + 1,
    'Register Number': st.registerNo || '',
    'USN NO': st.usnNo || '',
    'Student Name': st.name || '',
    'Mobile Number': st.mobile || '',
    'Email ID': st.email || '',
    'T-Shirt Size': st.tShirtSize || 'N/A',
    'Department': st.department || '',
    'School': st.school || 'Garden City University',
    'Registration Status': 'Confirmed Registered'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData.length > 0 ? exportData : [{
    'Sl No': 1,
    'Register Number': 'N/A',
    'USN NO': 'N/A',
    'Student Name': 'No Registered Students Found',
    'Mobile Number': '',
    'Email ID': '',
    'T-Shirt Size': '',
    'Department': '',
    'School': '',
    'Registration Status': ''
  }]);

  worksheet['!cols'] = [
    { wch: 8 },  { wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 18 },
    { wch: 32 }, { wch: 15 }, { wch: 25 }, { wch: 28 }, { wch: 22 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Registered Students');

  const cleanTitle = (event.title || 'Event').replace(/[^a-zA-Z0-9_\-]/g, '_');
  XLSX.writeFile(workbook, `${cleanTitle}_Registered_Students.xlsx`);
}

export function exportParticipationList(
  event: Event,
  students: Student[],
  scores: Score[]
): void {
  const targetStudents = getTargetStudentsForEvent(event, students, scores);
  const eventScores = scores.filter(s => s.eventId === event.id || (s.eventTitle && event.title && s.eventTitle.trim().toLowerCase() === event.title.trim().toLowerCase()));

  const participants = targetStudents.filter(st => {
    const normReg = st.registerNo ? st.registerNo.trim().toUpperCase() : '';
    const sc = eventScores.find(s => (s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === normReg) || (st.usnNo && s.usnNo && s.usnNo.trim().toUpperCase() === st.usnNo.trim().toUpperCase()));
    return Boolean(
      sc?.participated || 
      (sc?.participationPoints ?? 0) > 0 || 
      (sc?.eventScore ?? 0) > 0 || 
      (sc?.totalScore ?? 0) > 5 || 
      sc?.scoreEntered
    );
  });

  const exportData = participants.map((st, index) => {
    const normReg = st.registerNo ? st.registerNo.trim().toUpperCase() : '';
    const sc = eventScores.find(s => (s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === normReg) || (st.usnNo && s.usnNo && s.usnNo.trim().toUpperCase() === st.usnNo.trim().toUpperCase()));
    return {
      'Sl No': index + 1,
      'Register Number': st.registerNo || '',
      'USN NO': st.usnNo || sc?.usnNo || '',
      'Student Name': st.name || '',
      'Mobile Number': st.mobile || '',
      'Email ID': st.email || '',
      'T-Shirt Size': st.tShirtSize || 'N/A',
      'Department': st.department || '',
      'Participation Status': 'PRESENT / PARTICIPATED',
      'Participation Points (15 Marks)': sc?.participationPoints ?? 15,
      'Total Marks': sc?.totalScore ?? 20
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData.length > 0 ? exportData : [{
    'Sl No': 1,
    'Register Number': 'N/A',
    'USN NO': 'N/A',
    'Student Name': 'No Participants Recorded',
    'Mobile Number': '',
    'Email ID': '',
    'T-Shirt Size': '',
    'Department': '',
    'Participation Status': '',
    'Participation Points (15 Marks)': 0,
    'Total Marks': 0
  }]);

  worksheet['!cols'] = [
    { wch: 8 },  { wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 18 },
    { wch: 32 }, { wch: 15 }, { wch: 25 }, { wch: 28 },
    { wch: 30 }, { wch: 15 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Participation List');

  const cleanTitle = (event.title || 'Event').replace(/[^a-zA-Z0-9_\-]/g, '_');
  XLSX.writeFile(workbook, `${cleanTitle}_Participation_List.xlsx`);
}

export function exportNotParticipantsList(
  event: Event,
  students: Student[],
  scores: Score[]
): void {
  const targetStudents = getTargetStudentsForEvent(event, students, scores);
  const eventScores = scores.filter(s => s.eventId === event.id || (s.eventTitle && event.title && s.eventTitle.trim().toLowerCase() === event.title.trim().toLowerCase()));

  const nonParticipants = targetStudents.filter(st => {
    const normReg = st.registerNo ? st.registerNo.trim().toUpperCase() : '';
    const sc = eventScores.find(s => (s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === normReg) || (st.usnNo && s.usnNo && s.usnNo.trim().toUpperCase() === st.usnNo.trim().toUpperCase()));
    const isPart = Boolean(
      sc?.participated || 
      (sc?.participationPoints ?? 0) > 0 || 
      (sc?.eventScore ?? 0) > 0 || 
      (sc?.totalScore ?? 0) > 5 || 
      sc?.scoreEntered
    );
    return !isPart;
  });

  const exportData = nonParticipants.map((st, index) => ({
    'Sl No': index + 1,
    'Register Number': st.registerNo || '',
    'USN NO': st.usnNo || '',
    'Student Name': st.name || '',
    'Mobile Number': st.mobile || '',
    'Email ID': st.email || '',
    'T-Shirt Size': st.tShirtSize || 'N/A',
    'Department': st.department || '',
    'Attendance Status': 'ABSENT / NOT PARTICIPATED'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData.length > 0 ? exportData : [{
    'Sl No': 1,
    'Register Number': 'N/A',
    'USN NO': 'N/A',
    'Student Name': 'All Registered Students Participated (0 Absentees)',
    'Mobile Number': '',
    'Email ID': '',
    'T-Shirt Size': '',
    'Department': '',
    'Attendance Status': ''
  }]);

  worksheet['!cols'] = [
    { wch: 8 },  { wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 18 },
    { wch: 32 }, { wch: 15 }, { wch: 25 }, { wch: 30 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Not Participants List');

  const cleanTitle = (event.title || 'Event').replace(/[^a-zA-Z0-9_\-]/g, '_');
  XLSX.writeFile(workbook, `${cleanTitle}_Not_Participants_List.xlsx`);
}

export function exportParticipantsScores(
  event: Event,
  students: Student[],
  scores: Score[]
): void {
  const targetStudents = getTargetStudentsForEvent(event, students, scores);
  const eventScores = scores.filter(s => s.eventId === event.id || (s.eventTitle && event.title && s.eventTitle.trim().toLowerCase() === event.title.trim().toLowerCase()));

  const scoredParticipants = targetStudents.map(st => {
    const normReg = st.registerNo ? st.registerNo.trim().toUpperCase() : '';
    const sc = eventScores.find(s => (s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === normReg) || (st.usnNo && s.usnNo && s.usnNo.trim().toUpperCase() === st.usnNo.trim().toUpperCase()));
    const isPart = Boolean(
      sc?.participated || 
      (sc?.participationPoints ?? 0) > 0 || 
      (sc?.eventScore ?? 0) > 0 || 
      (sc?.totalScore ?? 0) > 5 || 
      sc?.scoreEntered
    );
    return {
      student: st,
      score: sc,
      isPart,
      totalMarks: isPart ? (sc?.totalScore ?? sc?.eventScore ?? 0) : 0
    };
  }).filter(item => item.isPart);

  scoredParticipants.sort((a, b) => b.totalMarks - a.totalMarks);

  const exportData = scoredParticipants.map((item, index) => {
    const st = item.student;
    const sc = item.score;
    const isWinner = Boolean(sc?.isWinner || index === 0);
    return {
      'Rank / Result': isWinner ? `🥇 Winner (Rank ${index + 1})` : `Rank ${index + 1}`,
      'Register Number': st.registerNo || '',
      'USN NO': st.usnNo || sc?.usnNo || '',
      'Student Name': st.name || '',
      'Mobile Number': st.mobile || '',
      'Email ID': st.email || '',
      'Department': st.department || '',
      'T-Shirt Size': st.tShirtSize || 'N/A',
      'Register Points (5 Marks)': sc?.registrationPoints ?? 5,
      'Participation Points (15 Marks)': sc?.participationPoints ?? 15,
      'Criterion 01 (20 Marks)': sc?.criterion1 ?? 0,
      'Criterion 02 (20 Marks)': sc?.criterion2 ?? 0,
      'Criterion 03 (20 Marks)': sc?.criterion3 ?? 0,
      'Criterion 04 (20 Marks)': sc?.criterion4 ?? 0,
      'Total Marks (100 Marks)': item.totalMarks
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData.length > 0 ? exportData : [{
    'Rank / Result': 'N/A',
    'Register Number': 'N/A',
    'USN NO': 'N/A',
    'Student Name': 'No Graded Participants Recorded Yet',
    'Mobile Number': '',
    'Email ID': '',
    'Department': '',
    'T-Shirt Size': '',
    'Register Points (5 Marks)': 0,
    'Participation Points (15 Marks)': 0,
    'Criterion 01 (20 Marks)': 0,
    'Criterion 02 (20 Marks)': 0,
    'Criterion 03 (20 Marks)': 0,
    'Criterion 04 (20 Marks)': 0,
    'Total Marks (100 Marks)': 0
  }]);

  worksheet['!cols'] = [
    { wch: 22 }, { wch: 20 }, { wch: 30 }, { wch: 18 },
    { wch: 32 }, { wch: 25 }, { wch: 15 }, { wch: 25 },
    { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 22 }, { wch: 24 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants Scores');

  const cleanTitle = (event.title || 'Event').replace(/[^a-zA-Z0-9_\-]/g, '_');
  XLSX.writeFile(workbook, `${cleanTitle}_Scores_of_Participants.xlsx`);
}

export function getTargetStudentsForEvent(
  event: Event | { id?: string; title: string; registeredStudentIds?: string[] },
  students: Student[],
  scores: Score[]
): Student[] {
  const eventObj = event as Event;
  const eventId = eventObj?.id;
  const eventTitleNorm = eventObj?.title ? eventObj.title.trim().toLowerCase() : '';
  const registeredIdsFromEvent: string[] = (eventObj as any)?.registeredStudentIds || [];

  let targetStudents: Student[] = [];

  if (students && students.length > 0 && (eventId || eventTitleNorm)) {
    targetStudents = students.filter(student => {
      if (registeredIdsFromEvent.length > 0) {
        const isReg = registeredIdsFromEvent.some(rid => {
          const cleanRid = (rid || '').trim().toUpperCase();
          return Boolean(
            (student.registerNo && student.registerNo.trim().toUpperCase() === cleanRid) ||
            (student.email && student.email.trim().toLowerCase() === rid.trim().toLowerCase()) ||
            (student.uid && student.uid === rid)
          );
        });
        if (isReg) return true;
      }

      if (eventId && isStudentRegisteredForEvent(student, eventObj, [], scores)) {
        return true;
      }

      const normReg = student.registerNo ? student.registerNo.trim().toUpperCase() : '';
      const normEmail = student.email ? student.email.trim().toLowerCase() : '';
      const normUid = student.uid ? student.uid.trim() : '';

      return scores.some(sc => {
        const scReg = sc.studentRegisterNo ? sc.studentRegisterNo.trim() : '';
        const isUserMatch = (
          (normReg && scReg.toUpperCase() === normReg) ||
          (normEmail && scReg.toLowerCase() === normEmail) ||
          (normUid && scReg === normUid)
        );
        if (!isUserMatch) return false;
        return Boolean(
          (eventId && sc.eventId === eventId) ||
          (eventTitleNorm && sc.eventTitle && sc.eventTitle.trim().toLowerCase() === eventTitleNorm)
        );
      });
    });

    if (targetStudents.length === 0 && students.length < 20) {
      const anyHasRegs = students.some(s => s.registeredEventIds && s.registeredEventIds.length > 0);
      if (!anyHasRegs) {
        targetStudents = students;
      }
    }
  } else {
    targetStudents = students || [];
  }

  return targetStudents;
}
