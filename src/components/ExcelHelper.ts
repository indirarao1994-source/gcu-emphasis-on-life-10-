/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { Event, Score, Student, normalizeRegisterNo } from '../types';

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

    const title = getVal('title', 'event title');
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

  // Main 13 Table Columns matching official GCU format
  aoa.push([
    'Sl No',
    'Register number',
    'Name of the student',
    'Mobile Number',
    'Email ID',
    'Register Points (5 Marks)',
    'Participated (YES / NO)',
    'Participation Points (15 Marks)',
    'Criterion 01 (Out of 20 marks)',
    'Criterion 02 (Out of 20 marks)',
    'Criterion 03 (Out of 20 marks)',
    'Criterion 04 (Out of 20 marks)',
    'Total Marks'
  ]);

  const eventId = (event as Event).id;

  // Use passed registered students directly
  let targetStudents: Student[] = students || [];

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
        student.registerNo,
        student.name,
        student.mobile || '',
        student.email || '',
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
      aoa.push([i, '', '', '', '', '', '', '', '', '', '', '', '']);
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
    ''
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  worksheet['!cols'] = [
    { wch: 8 },  // Sl No
    { wch: 22 }, // Register number
    { wch: 30 }, // Name of the student
    { wch: 18 }, // Mobile Number
    { wch: 28 }, // Email ID
    { wch: 22 }, // Register Points (5 Marks)
    { wch: 22 }, // Participated (YES / NO)
    { wch: 28 }, // Participation Points (15 Marks)
    { wch: 28 }, // Criterion 01 (Out of 20 marks)
    { wch: 28 }, // Criterion 02 (Out of 20 marks)
    { wch: 28 }, // Criterion 03 (Out of 20 marks)
    { wch: 28 }, // Criterion 04 (Out of 20 marks)
    { wch: 25 }  // Total Marks
  ];

  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
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

  const isRegNoHeader = (nk: string): boolean => {
    if (isRegPtsHeader(nk)) return false;
    return (
      nk.includes('registernumber') ||
      nk.includes('studentregister') ||
      nk.includes('registerno') ||
      nk.includes('regno') ||
      nk.includes('registrationno') ||
      nk.includes('registrationnumber') ||
      nk.includes('regnumber') ||
      nk.includes('studentreg') ||
      nk === 'usn' ||
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
      console.log('Column indices:', { regNoIdx, c1Idx, c2Idx, c3Idx, c4Idx, totalIdx, partIdx });

      for (let r = headerRowIdx + 1; r < rows2D.length; r++) {
        const row = rows2D[r];
        if (!Array.isArray(row)) continue;
        const regNo = normalizeRegisterNo(String(row[regNoIdx] || ''));
        if (!regNo) continue;

        const c1Val = row[c1Idx];
        const c2Val = row[c2Idx];
        const c3Val = row[c3Idx];
        const c4Val = row[c4Idx];
        const partVal = row[partIdx];
        console.log(`Row ${r} - ${regNo}: c1=${c1Val}, c2=${c2Val}, c3=${c3Val}, c4=${c4Val}, participated=${partVal}`);

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

        let participated = false;
        let participationMarks = 0;

        if (isExplicitNo) {
          participated = false;
          participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 0;
        } else if (isExplicitYes || (partPtsFromCell !== undefined && partPtsFromCell > 0)) {
          participated = true;
          participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 15;
        } else {
          participated = false;
          participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 0;
        }

        const criteriaSum = c1 + c2 + c3 + c4;
        if (totalScore === 0) {
          totalScore = regPts + participationMarks + criteriaSum;
        }

        const winnerRaw = winnerIdx !== -1 ? String(row[winnerIdx] || '').trim().toUpperCase() : '';
        const isWinner = winnerRaw === 'TRUE' || winnerRaw === 'YES' || winnerRaw === '1';

        parsed.push({
          studentRegisterNo: regNo,
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

      let participated = false;
      let participationMarks = 0;

      if (isExplicitNo) {
        participated = false;
        participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 0;
      } else if (isExplicitYes || (partPtsFromCell !== undefined && partPtsFromCell > 0)) {
        participated = true;
        participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 15;
      } else {
        participated = false;
        participationMarks = partPtsFromCell !== undefined ? partPtsFromCell : 0;
      }

      const criteriaSum = c1 + c2 + c3 + c4;
      if (totalScore === 0) {
        totalScore = regPtsFinal + participationMarks + criteriaSum;
      }

      const isWinner = winnerRaw === 'TRUE' || winnerRaw === 'YES' || winnerRaw === '1';

      parsed.push({
        studentRegisterNo: regNo,
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

  events.forEach((evt, idx) => {
    const worksheet = buildOfficialGcuScoringSheetWorksheet(evt, students, scores, occasionTitle);
    const tabName = `${idx + 1}. ${evt.title.replace(/[:\\/?*\[\]]/g, '').substring(0, 22)}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, tabName);
  });

  XLSX.writeFile(workbook, `Fresherism_MASTER_ALL_EVENTS_SCORESHEET.xlsx`);
}

/**
 * 4. Export Score Sheet for Top 100 Overall Students / Leaderboard
 */
export function exportScoreSheetsTop100(students: Student[], scores: Score[], events: Event[], topLimit: number = 100): void {
  const ranked = students.map(s => {
    const studentScores = scores.filter(sc => sc.studentRegisterNo === s.registerNo);
    const totalScore = studentScores.reduce((acc, curr) => acc + (curr.totalScore || 0), 0);
    const wins = studentScores.filter(sc => sc.isWinner).length;
    const participatedCount = studentScores.filter(sc => sc.participated || (sc.participationPoints ?? 0) > 0).length;

    return {
      student: s,
      totalScore,
      wins,
      participatedCount,
      registeredCount: s.registeredEventIds?.length || 0
    };
  }).sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins);

  const topStudents = ranked.slice(0, topLimit);

  const rows = topStudents.map((item, index) => ({
    'Overall Rank': index + 1,
    'Student Register No': item.student.registerNo,
    'Student Name': item.student.name,
    'Department': item.student.department || '',
    'Program Name': item.student.programName || '',
    'School': item.student.school || '',
    'Email ID': item.student.email || '',
    'Mobile No': item.student.mobile || '',
    'Total Aggregate Score': item.totalScore,
    'Total Winner Titles 🏆': item.wins,
    'Events Participated': item.participatedCount,
    'Total Events Registered': item.registeredCount,
    'Award Status': item.wins > 0 ? `WINNER (${item.wins} Wins)` : (index < 10 ? 'TOP 10 FINISHER' : 'TOP 100 MERIT')
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 25 }, { wch: 25 },
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
    { wch: 8 }, { wch: 22 }, { wch: 28 }, { wch: 30 }, { wch: 18 },
    { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 24 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NCC_Army_Wing_Cadets');

  XLSX.writeFile(workbook, `GCU_NCC_Army_Wing_Cadets_2026.xlsx`);
}
