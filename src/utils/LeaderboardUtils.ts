import { Student, Score, Event } from '../types';

export interface UnifiedLeaderboardEntry {
  rank: number;
  studentId: string;
  registerNo: string;
  usnNo?: string;
  name: string;
  department: string;
  programName: string;
  school: string;
  email: string;
  mobile: string;
  eventsParticipatedCount: number;
  totalScore: number;
  wins: number;
  isExternal: boolean;
  eventScoresMap: Map<string, { score: number, isWinner: boolean }>;
}

export function computeUnifiedLeaderboard(
  students: Student[],
  scores: Score[],
  events: Event[]
): UnifiedLeaderboardEntry[] {
  // 1. Setup valid events
  const validEventIds = new Set(events.map(e => e.id));
  const publishedEventIds = new Set(events.filter(e => e.resultsPublished).map(e => e.id));

  // 2. Canonical mapping for robust grouping
  const getCanonicalKey = (reg?: string, usn?: string, email?: string): string => {
    const cleanUsn = (usn || '').trim().toUpperCase();
    if (cleanUsn) return `USN:${cleanUsn}`;

    const cleanReg = (reg || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    const matched = students.find(s => 
      (cleanReg && s.registerNo && s.registerNo.trim().toUpperCase() === cleanReg) ||
      (cleanEmail && s.email && s.email.trim().toLowerCase() === cleanEmail)
    );

    if (matched?.usnNo && matched.usnNo.trim()) {
      return `USN:${matched.usnNo.trim().toUpperCase()}`;
    }

    if (cleanReg) return `REG:${cleanReg}`;
    if (cleanEmail) return `EMAIL:${cleanEmail}`;
    return `KEY:${reg || email || 'unknown'}`;
  };

  const studentStatsMap = new Map<string, {
    canonicalKey: string;
    studentId: string;
    usnNo: string;
    primaryRegisterNo: string;
    allRegisterNos: Set<string>;
    allEmails: Set<string>;
    name: string;
    department: string;
    programName: string;
    school: string;
    email: string;
    mobile: string;
    registeredEventIds: Set<string>;
    isExternal: boolean;
  }>();

  // 3. Populate base student data
  students.forEach(student => {
    const key = getCanonicalKey(student.registerNo, student.usnNo, student.email);
    const cleanReg = (student.registerNo || '').trim().toUpperCase();
    const cleanUsn = (student.usnNo || '').trim().toUpperCase();

    const existing = studentStatsMap.get(key);
    if (existing) {
      if (cleanReg) existing.allRegisterNos.add(cleanReg);
      if (student.email) existing.allEmails.add(student.email.trim().toLowerCase());
      if (cleanUsn && !existing.usnNo) existing.usnNo = cleanUsn;
      if (cleanReg && (cleanReg === cleanUsn || existing.primaryRegisterNo.startsWith('GCU-TEMP-') || existing.primaryRegisterNo.includes('.'))) {
        existing.primaryRegisterNo = cleanReg;
      }
      if (student.name && (!existing.name || existing.name.startsWith('GCU-TEMP-') || existing.name.startsWith('Student'))) {
        existing.name = student.name;
      }
      if (student.department && !existing.department) existing.department = student.department;
      if (student.programName && (existing.programName === 'General' || !existing.programName)) existing.programName = student.programName;
      if (student.school && !existing.school) existing.school = student.school;
      if (student.mobile && !existing.mobile) existing.mobile = student.mobile;
      if (student.email && !existing.email) existing.email = student.email;
      (student.registeredEventIds || []).forEach(eid => {
        if (validEventIds.has(eid)) {
          existing.registeredEventIds.add(eid);
        }
      });
    } else {
      const regSet = new Set<string>();
      if (cleanReg) regSet.add(cleanReg);
      const emailSet = new Set<string>();
      if (student.email) emailSet.add(student.email.trim().toLowerCase());

      const initialRegs = new Set<string>();
      (student.registeredEventIds || []).forEach(eid => {
        if (validEventIds.has(eid)) {
          initialRegs.add(eid);
        }
      });

      studentStatsMap.set(key, {
        canonicalKey: key,
        studentId: student.uid || `std-${student.registerNo || student.email}`,
        usnNo: cleanUsn || (key.startsWith('USN:') ? key.substring(4) : ''),
        primaryRegisterNo: cleanReg || student.name || 'N/A',
        allRegisterNos: regSet,
        allEmails: emailSet,
        name: student.name || student.registerNo || 'N/A',
        department: student.department || '',
        programName: student.programName || student.department || student.school || 'General',
        school: student.school || 'Garden City University',
        email: student.email || '',
        mobile: student.mobile || '',
        registeredEventIds: initialRegs,
        isExternal: !!student.isExternal
      });
    }
  });

  // 4. Compute metrics per canonical student
  const scoresByEvent = new Map<string, Score[]>();
  scores.forEach(sc => {
    if (!sc.eventId) return;
    const list = scoresByEvent.get(sc.eventId) || [];
    list.push(sc);
    scoresByEvent.set(sc.eventId, list);
  });

  const entries: UnifiedLeaderboardEntry[] = Array.from(studentStatsMap.values()).map(std => {
    let studentCumulativeTotal = 0;
    let eventsParticipatedCount = 0;
    let totalWins = 0;
    const eventScoresMap = new Map<string, { score: number, isWinner: boolean }>();

    events.forEach(evt => {
      // Find ALL score records for this student for this event
      const evtScoresAll = scoresByEvent.get(evt.id) || [];
      const evtScores = evtScoresAll.filter(sc => {
        const scReg = (sc.studentRegisterNo || '').trim().toUpperCase();
        const scUsn = (sc.usnNo || '').trim().toUpperCase();
        const scEmail = ((sc as any).studentEmail || (sc as any).email || '').trim().toLowerCase();

        if (std.usnNo && scUsn && scUsn === std.usnNo) return true;
        if (std.usnNo && scReg && scReg === std.usnNo) return true;
        if (scReg && std.allRegisterNos.has(scReg)) return true;
        if (scEmail && std.allEmails.has(scEmail)) return true;
        return false;
      });

      const isPublished = publishedEventIds.size === 0 || publishedEventIds.has(evt.id);

      if (evtScores.length > 0) {
        // Increment count since they participated
        eventsParticipatedCount++;
        
        // Check for wins across any of their score records for this event
        const isWinner = evtScores.some(sc => sc.isWinner);
        if (isWinner) {
          totalWins++;
        }
        
        if (isPublished) {
          // Find max score among evtScores for this event
          let maxEvtScore = 0;
          evtScores.forEach(matchingScore => {
            let scoreVal = 0;
            if (matchingScore.participated || (matchingScore.totalScore ?? 0) > 0 || (matchingScore.eventScore ?? 0) > 0) {
              scoreVal = matchingScore.totalScore ?? (
                (matchingScore.eventScore ?? 0) + 
                (matchingScore.registrationPoints ?? 5) + 
                (matchingScore.participationPoints ?? 15)
              );
            } else {
              scoreVal = matchingScore.registrationPoints ?? 5;
            }
            if (scoreVal > maxEvtScore) maxEvtScore = scoreVal;
          });
          
          studentCumulativeTotal += maxEvtScore;
          eventScoresMap.set(evt.id, { score: maxEvtScore, isWinner });
        } else {
          // Event not published yet, but they have a score sheet (meaning they participated)
          // Add base registration points (5)
          studentCumulativeTotal += 5;
          eventScoresMap.set(evt.id, { score: 5, isWinner: false });
        }
      } else if (std.registeredEventIds.has(evt.id)) {
        // They are registered but don't have a score sheet yet
        eventsParticipatedCount++;
        // Add base registration points (5)
        studentCumulativeTotal += 5;
        eventScoresMap.set(evt.id, { score: 5, isWinner: false });
      }
    });

    return {
      rank: 0,
      studentId: std.studentId,
      registerNo: std.primaryRegisterNo,
      usnNo: std.usnNo,
      name: std.name,
      department: std.department,
      programName: std.programName,
      school: std.school,
      email: std.email,
      mobile: std.mobile,
      eventsParticipatedCount,
      totalScore: studentCumulativeTotal,
      wins: totalWins,
      isExternal: std.isExternal,
      eventScoresMap
    };
  }).filter(entry => entry.eventsParticipatedCount > 0 || entry.totalScore > 0);

  // 5. Sort by Total Score, then Wins
  entries.sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins);

  // 6. Assign Ranks
  let currentRank = 0;
  let currentRankScore = -1;
  let currentRankWins = -1;

  entries.forEach((entry) => {
    if (entry.totalScore !== currentRankScore || entry.wins !== currentRankWins) {
      currentRank++;
      currentRankScore = entry.totalScore;
      currentRankWins = entry.wins;
    }
    entry.rank = currentRank;
  });

  return entries;
}
