/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Event, Score, Student, getStudentRegisteredEventIds } from '../types';

// Helper to escape CSV values
function escapeCSV(val: string): string {
  if (!val) return '';
  const cleaned = val.replace(/"/g, '""');
  if (cleaned.includes(',') || cleaned.includes('\n') || cleaned.includes('"')) {
    return `"${cleaned}"`;
  }
  return cleaned;
}

// -------------------------------------------------------------
// CONVENOR: Bulk Event Upload
// -------------------------------------------------------------

export function downloadEventTemplate(): string {
  const headers = [
    'Event Title',
    'Event Description',
    'Event Rules',
    'Date (YYYY-MM-DD)',
    'Start Time (HH:MM)',
    'End Time (HH:MM)',
    'Venue',
    'Host Department',
    'Faculty Coordinator ID',
    'Faculty Coordinator Name',
    'Faculty Coordinator Mobile',
    'Faculty Coordinator Email',
    'Student Coordinator Name'
  ];
  
  const sampleRow1 = [
    'Coral Tank — AI & Tech Ideathon',
    'An innovation pitch challenge where freshers present tech solutions before judges.',
    '1. Open to all students. 2. Teams of 2-4 members. 3. 2 minutes pitch + 1 min Q&A.',
    '2026-08-03',
    '14:35',
    '16:30',
    'Room no 384',
    'IT Club',
    'FAC-102',
    'Prof. Kushal B. S.',
    '+91 98765 43210',
    'kushal.bs@gcu.edu.in',
    'Trisha P (24BCAR105) & Harsha Raj (24BSDC140)'
  ];

  const sampleRow2 = [
    'Passport to Coralverse',
    'An immersive team-based travel expedition through the four seasonal reefs.',
    '1. Register in teams of 4-6 members. 2. Participate in all 4 rounds. 3. No mobile phones during rounds.',
    '2026-08-03',
    '14:55',
    '17:00',
    'Room No. 21, West Block',
    'Travel & Adventure Club',
    'FAC-105',
    'Mr. Dheleepan G V',
    '+91 98765 12345',
    'dheleepan.gv@gcu.edu.in',
    'Jerry Roshan (7795710922) & Vishnu Devan (9686015906)'
  ];

  const csvContent = [
    headers.join(','),
    sampleRow1.map(escapeCSV).join(','),
    sampleRow2.map(escapeCSV).join(',')
  ].join('\n');

  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
}

export function parseEventsCSV(csvText: string): Omit<Event, 'id'>[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length <= 1) return [];

  const events: Omit<Event, 'id'>[] = [];
  
  // Basic CSV / TSV line parser to handle quoted cells or tab-separated Excel exports
  const parseCSVLine = (line: string): string[] => {
    const isTabSeparated = line.includes('\t') && !line.includes(',');
    const delimiter = isTabSeparated ? '\t' : ',';
    
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const cells = parseCSVLine(line);
    if (cells.length < 3) continue;

    // Skip header line if present
    const firstCellLower = cells[0].toLowerCase();
    if (firstCellLower.includes('title') || firstCellLower.includes('event title')) {
      continue;
    }

    // Flexible column mapping:
    // Standard template order:
    // 0: Title, 1: Description, 2: Rules, 3: Date, 4: Start Time, 5: End Time, 6: Venue, 7: Host Dept,
    // 8: Fac ID, 9: Fac Name, 10: Fac Mobile, 11: Fac Email, 12: Student Coord Name
    const title = cells[0] || 'Untitled Event';
    const description = cells[1] || '';
    const rules = cells[2] || '';
    const date = cells[3] || '2026-08-05';
    const timeStart = cells[4] || '10:00';
    const timeEnd = cells[5] || '11:00';
    const venue = cells[6] || 'Main Campus Auditorium';
    const hostDepartment = cells[7] || 'University Club';
    const coordinatorFacultyId = cells[8] || 'FAC-GEN';
    const coordinatorName = cells[9] || 'Faculty Coordinator';
    const coordinatorMobile = cells[10] || '';
    const coordinatorEmail = cells[11] || '';
    const studentCoordinatorName = cells[12] || '';

    events.push({
      title,
      description,
      rules,
      date,
      timeStart,
      timeEnd,
      venue,
      hostDepartment,
      coordinatorFacultyId,
      coordinatorName,
      coordinatorMobile,
      coordinatorEmail,
      studentCoordinatorName,
      imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=600'
    });
  }

  return events;
}

// -------------------------------------------------------------
// COORDINATOR: Bulk Marks Upload
// -------------------------------------------------------------

export function downloadMarksTemplate(eventTitle: string, registeredStudents: Student[], currentScores: Score[]): string {
  const headers = [
    'Student Register No',
    'Student Name',
    'Mobile Number',
    'Registration Points (Auto: 5)',
    'Participated (YES/NO - 15 Pts)',
    'Event Score (0-80)',
    'Is Winner (TRUE/FALSE)'
  ];

  const rows = registeredStudents.map(student => {
    const currentScore = currentScores.find(s => s.studentRegisterNo === student.registerNo);
    const isParticipated = currentScore ? (currentScore.participated || (currentScore.participationPoints ?? 0) > 0) : false;
    const evtScore = currentScore ? (currentScore.eventScore ?? currentScore.performanceScore ?? 0) : 0;
    const isWinner = currentScore ? currentScore.isWinner : false;

    return [
      student.registerNo,
      student.name,
      student.mobile || '',
      '5',
      isParticipated ? 'YES' : 'NO',
      evtScore.toString(),
      isWinner ? 'TRUE' : 'FALSE'
    ];
  });

  const csvContent = [
    `# Template for event: ${eventTitle}`,
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
}

export interface ParsedMarks {
  studentRegisterNo: string;
  mobile?: string;
  participated: boolean;
  eventScore: number;
  isWinner: boolean;
}

export function parseMarksCSV(csvText: string): ParsedMarks[] {
  const lines = csvText.split(/\r?\n/);
  const parsed: ParsedMarks[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue; // Skip comments and empty lines

    const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 3) continue;

    // Check if it is the header line
    if (cells[0].toLowerCase().includes('register') || cells[0].toLowerCase().includes('reg no')) {
      continue;
    }

    const registerNo = cells[0];
    let mobile = '';
    let participatedRaw = '';
    let eventScoreRaw = 0;
    let isWinner = false;

    if (cells.length >= 7) {
      mobile = cells[2];
      participatedRaw = cells[4]?.toUpperCase() || '';
      eventScoreRaw = parseFloat(cells[5]) || 0;
      isWinner = cells[6]?.toUpperCase() === 'TRUE' || cells[6] === '1';
    } else {
      participatedRaw = cells[3]?.toUpperCase() || '';
      eventScoreRaw = parseFloat(cells[4]) || 0;
      isWinner = cells[5]?.toUpperCase() === 'TRUE' || cells[5] === '1';
    }

    const participated = participatedRaw === 'YES' || participatedRaw === 'TRUE' || participatedRaw === '10' || participatedRaw === '1';
    const eventScore = Math.max(0, Math.min(80, eventScoreRaw)); // clamp 0-80

    if (registerNo) {
      parsed.push({
        studentRegisterNo: registerNo,
        mobile,
        participated,
        eventScore,
        isWinner
      });
    }
  }

  return parsed;
}

// -------------------------------------------------------------
// CONVENOR: Export All Student Registrations CSV
// -------------------------------------------------------------

export function downloadStudentRegistrationsCSV(students: Student[], events: Event[], scores: Score[] = []): string {
  const headers = [
    'Register No',
    'Student Name',
    'Email',
    'Mobile Number',
    'School',
    'Department',
    'Program Name',
    'Registered Events Count',
    'Registered Event Titles'
  ];

  const rows = students.map(student => {
    const regEventIds = getStudentRegisteredEventIds(student, scores);
    const regEvents = events.filter(e => regEventIds.includes(e.id));
    const eventTitles = regEvents.map(e => e.title).join(' | ');

    return [
      student.registerNo,
      student.name,
      student.email,
      student.mobile,
      student.school,
      student.department,
      student.programName || '',
      regEventIds.length.toString(),
      eventTitles
    ];
  });

  const csvContent = [
    '# Official Fresherism 2026 - Student Registration Export',
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
}

// -------------------------------------------------------------
// CONVENOR: Export Leaderboard Results CSV
// -------------------------------------------------------------

export function downloadLeaderboardCSV(students: Student[], scores: Score[], events: Event[]): string {
  const headers = [
    'Rank',
    'Register No',
    'Student Name',
    'Department',
    'Program Name',
    'Total Score',
    'Events Participated Count',
    'Winner Flag'
  ];

  // Calculate totals per student
  const studentTotals = students.map(s => {
    const studentScores = scores.filter(sc => sc.studentRegisterNo === s.registerNo);
    const total = studentScores.reduce((acc, curr) => acc + (curr.totalScore || 0), 0);
    const wins = studentScores.filter(sc => sc.isWinner).length;
    return {
      student: s,
      total,
      wins,
      eventsCount: studentScores.length
    };
  }).sort((a, b) => b.total - a.total);

  const rows = studentTotals.map((item, index) => [
    (index + 1).toString(),
    item.student.registerNo,
    item.student.name,
    item.student.department || '',
    item.student.programName || '',
    item.total.toString(),
    item.eventsCount.toString(),
    item.wins > 0 ? `WINNER (${item.wins} events)` : 'Participant'
  ]);

  const csvContent = [
    '# Official Fresherism 2026 - Overall Leaderboard Results Export',
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
}

export function downloadNccStudentsCSV(students: Student[]): string {
  const headers = [
    'Sl No',
    'Register No / Student ID',
    'Student Name',
    'Email ID',
    'Mobile Number',
    'Department',
    'Program / Course',
    'Sem 1 Declared',
    'NCC Expressed Date'
  ];

  const nccCadets = students.filter(s => s.isNccInterested === true);

  const rows = nccCadets.map((s, idx) => [
    (idx + 1).toString(),
    s.registerNo || '',
    s.name || '',
    s.email || '',
    s.mobile || '',
    s.department || '',
    s.programName || '',
    s.sem1Declared ? 'YES (Sem 1)' : 'Pending',
    s.nccRegisteredAt ? new Date(s.nccRegisteredAt).toLocaleString() : 'Registered'
  ]);

  const csvContent = [
    '# GCU National Cadet Corps (NCC) Army Wing 2026 - Interested Cadets Export',
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
}

// -------------------------------------------------------------
// CONVENOR: Export Unique Students Summary CSV
// -------------------------------------------------------------

export function downloadStudentSummaryWithEventCount(students: Student[], events: Event[], scores: Score[] = []): string {
  const headers = [
    'Sl No',
    'Register No',
    'Student Name',
    'Email ID',
    'Mobile Number',
    'School',
    'Department',
    'Program Name',
    'Registered Events Count',
    'Registered Event Titles',
    'Email Verified'
  ];

  const rows = students.map((s, idx) => {
    const regEventIds = getStudentRegisteredEventIds(s, scores);
    const eventTitles = regEventIds
      .map(id => events.find(e => e.id === id)?.title)
      .filter(Boolean)
      .join(' | ');

    return [
      (idx + 1).toString(),
      s.registerNo || '',
      s.name || '',
      s.email || '',
      s.mobile || '',
      s.school || '',
      s.department || '',
      s.programName || '',
      regEventIds.length.toString(),
      eventTitles,
      s.isEmailVerified ? 'Verified' : 'Pending'
    ];
  });

  const csvContent = [
    '# Official Fresherism 2026 - Unique Students Summary Export',
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
}


