/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  onSnapshot,
  deleteDoc,
  getDocFromServer,
  writeBatch,
  arrayUnion,
  arrayRemove,
  FieldValue
} from 'firebase/firestore';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Event, Student, Score, Notification, MessageToCoordinator, FacultyCoordinator, Occasion, normalizeRegisterNo } from './types';
import {
  INITIAL_EVENTS,
  INITIAL_STUDENTS,
  INITIAL_FACULTY_COORDINATORS,
  INITIAL_NOTIFICATIONS,
  INITIAL_MESSAGES,
  INITIAL_OCCASIONS,
  generateInitialScores
} from './data/initialData';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Enable browser local persistence for Firebase Auth sessions
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn('Firebase Auth setPersistence warning:', err);
});

// Verify connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'events', '_test_connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Collection References
const eventsCol = collection(db, 'events');
const studentsCol = collection(db, 'students');
const coordinatorsCol = collection(db, 'facultyCoordinators');
const scoresCol = collection(db, 'scores');
const notificationsCol = collection(db, 'notifications');
const messagesCol = collection(db, 'messages');
const occasionsCol = collection(db, 'occasions');

// Safe error helper for Firestore writes
function handleFirestoreError(actionName: string, err: any) {
  const isQuota = err?.code === 'resource-exhausted' ||
                  err?.message?.includes('Quota') ||
                  err?.message?.includes('resource-exhausted');
  if (isQuota) {
    console.warn(`[Firestore Quota] Write limit reached for today during ${actionName}. Operation applied in local session.`);
  } else {
    console.error(`[Firestore Error] Failed during ${actionName}:`, err);
  }
}

// Initialize / Seed Firebase Firestore if empty
export async function purgeAllSampleData() {
  // Safe explicit purge function if manually called by admin
  console.log('🧹 Purge requested...');
}

function cleanObjectForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj as unknown as T;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObjectForFirestore(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        cleaned[key] = cleanObjectForFirestore(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned as T;
}

export async function seedFirestoreIfEmpty() {
  try {
    const snap = await getDocs(eventsCol);
    if (snap.empty) {
      for (const evt of INITIAL_EVENTS) {
        await setDoc(doc(db, 'events', evt.id), cleanObjectForFirestore(evt));
      }
    } else {
      for (const evt of INITIAL_EVENTS) {
        // Only seed if doc id does NOT exist in Firestore
        const exists = snap.docs.some(d => d.id === evt.id);
        if (!exists) {
          const titleMatch = snap.docs.some(d => d.data().title?.trim().toLowerCase() === evt.title.trim().toLowerCase());
          if (!titleMatch) {
            await setDoc(doc(db, 'events', evt.id), cleanObjectForFirestore(evt));
          }
        }
      }
    }

    // Seed faculty coordinators if missing
    const coordSnap = await getDocs(coordinatorsCol);
    for (const coord of INITIAL_FACULTY_COORDINATORS) {
      const exists = coordSnap.docs.some(d => d.id === coord.facultyId || (coord.email && d.data().email?.trim().toLowerCase() === coord.email.trim().toLowerCase()));
      if (!exists) {
        await setDoc(doc(db, 'facultyCoordinators', coord.facultyId), cleanObjectForFirestore(coord));
      }
    }
  } catch (err) {
    console.warn('Error checking/seeding initial data in Firestore:', err);
  }
}

// Subscribe to real-time collections
export function subscribeEvents(callback: (events: Event[]) => void) {
  return onSnapshot(eventsCol, (snapshot) => {
    const data: Event[] = [];
    snapshot.forEach((doc) => data.push(doc.data() as Event));
    callback(data);
  }, (err) => console.warn('Events subscription status:', err?.message || err));
}

export function formatToTitleCase(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatStudentNameFromEmail(emailOrLocalPart: string, fallbackDisplayName?: string): string {
  if (fallbackDisplayName && fallbackDisplayName.trim() && !fallbackDisplayName.includes('@')) {
    return formatToTitleCase(fallbackDisplayName);
  }
  if (!emailOrLocalPart) return '';
  const local = emailOrLocalPart.split('@')[0];
  // Strip batch year prefix if followed by letters e.g. '26anshuman.k' -> 'anshuman.k'
  const cleaned = local.replace(/^(\d{2})([a-zA-Z])/, '$2');
  // Replace . _ - with spaces
  const spaced = cleaned.replace(/[._-]/g, ' ');
  return formatToTitleCase(spaced);
}

export function subscribeStudents(callback: (students: Student[]) => void) {
  return onSnapshot(studentsCol, (snapshot) => {
    const data: Student[] = [];
    snapshot.forEach((doc) => {
      const student = doc.data() as Student;
      if (student && (student.registerNo || student.email || student.uid || doc.id)) {
        if (student.name) {
          student.name = formatToTitleCase(student.name);
        }
        data.push(student);
      }
    });
    callback(data);
  }, (err) => console.warn('Students subscription status:', err?.message || err));
}

export function subscribeCoordinators(callback: (coords: FacultyCoordinator[]) => void) {
  return onSnapshot(coordinatorsCol, (snapshot) => {
    const data: FacultyCoordinator[] = [];
    snapshot.forEach((doc) => data.push(doc.data() as FacultyCoordinator));
    callback(data);
  }, (err) => console.warn('Coordinators subscription status:', err?.message || err));
}

export function subscribeScores(callback: (scores: Score[]) => void) {
  return onSnapshot(scoresCol, (snapshot) => {
    const data: Score[] = [];
    snapshot.forEach((doc) => {
      const score = doc.data() as Score;
      if (score && (score.studentRegisterNo || score.id)) {
        if (score.studentName) {
          score.studentName = formatToTitleCase(score.studentName);
        }
        data.push(score);
      }
    });
    callback(data);
  }, (err) => console.warn('Scores subscription status:', err?.message || err));
}

export function subscribeNotifications(callback: (notifs: Notification[]) => void) {
  return onSnapshot(notificationsCol, (snapshot) => {
    const data: Notification[] = [];
    // Strict cutoff for all pre-existing sample/dummy notifications
    const cutoffMs = new Date('2026-07-29T11:58:00.000Z').getTime();

    snapshot.forEach((doc) => {
      const notif = doc.data() as Notification;
      if (!notif) return;

      const content = (notif.content || '').toLowerCase();
      const title = (notif.title || '').toLowerCase();

      // Filter out known sample dummy notifications
      if (
        content.includes('venue changed') ||
        content.includes('come asap') ||
        content.includes('start soon') ||
        title.includes('coral tank') ||
        title.includes('event completed') ||
        content.includes('coral tank')
      ) {
        return;
      }

      if (notif.timestamp) {
        const notifMs = new Date(notif.timestamp.replace(' ', 'T')).getTime();
        if (!isNaN(notifMs) && notifMs < cutoffMs) {
          return;
        }
      }
      data.push(notif);
    });
    data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    callback(data);
  }, (err) => console.warn('Notifications subscription status:', err?.message || err));
}

export function subscribeMessages(callback: (msgs: MessageToCoordinator[]) => void) {
  return onSnapshot(messagesCol, (snapshot) => {
    const data: MessageToCoordinator[] = [];
    const cutoffMs = new Date('2026-07-29T11:58:00.000Z').getTime();

    snapshot.forEach((doc) => {
      const msg = doc.data() as MessageToCoordinator;
      if (!msg) return;

      const messageText = (msg.message || '').toLowerCase();
      const eventTitleText = (msg.eventTitle || '').toLowerCase();

      if (
        messageText.includes('venue changed') ||
        messageText.includes('come asap') ||
        messageText.includes('start soon') ||
        eventTitleText.includes('coral tank')
      ) {
        return;
      }

      if (msg.timestamp) {
        const msgMs = new Date(msg.timestamp.replace(' ', 'T')).getTime();
        if (!isNaN(msgMs) && msgMs < cutoffMs) {
          return;
        }
      }
      data.push(msg);
    });
    data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    callback(data);
  }, (err) => console.warn('Messages subscription status:', err?.message || err));
}

export function subscribeOccasions(callback: (occasions: Occasion[]) => void) {
  return onSnapshot(occasionsCol, (snapshot) => {
    const data: Occasion[] = [];
    snapshot.forEach((doc) => data.push(doc.data() as Occasion));
    callback(data);
  }, (err) => console.warn('Occasions subscription status:', err?.message || err));
}

// Write helper functions to Firestore with safe quota exception handling
export async function dbSaveEvent(event: Event) {
  try {
    const payload = cleanObjectForFirestore({
      ...event,
      studentCoordinatorName: event.studentCoordinatorName || '',
      brochureUrl: event.brochureUrl || event.imageUrl || '',
      imageUrl: event.imageUrl || event.brochureUrl || '',
      rules: event.rules || '',
      description: event.description || '',
      venue: event.venue || '',
      date: event.date || '',
      timeStart: event.timeStart || '',
      timeEnd: event.timeEnd || '',
      hostDepartment: event.hostDepartment || '',
      coordinatorName: event.coordinatorName || '',
      coordinatorMobile: event.coordinatorMobile || '',
      coordinatorEmail: event.coordinatorEmail || '',
      coordinatorFacultyId: event.coordinatorFacultyId || '',
      occasionId: event.occasionId || 'occ-fresherism-26',
      registeredStudentIds: (event as any).registeredStudentIds || [],
      isClosed: Boolean((event as any).isClosed),
      resultsPublished: Boolean(event.resultsPublished)
    });
    await setDoc(doc(db, 'events', event.id), payload, { merge: true });
  } catch (err) {
    handleFirestoreError('dbSaveEvent', err);
  }
}

export async function dbSaveOccasion(occ: Occasion) {
  try {
    await setDoc(doc(db, 'occasions', occ.id), cleanObjectForFirestore(occ), { merge: true });
  } catch (err) {
    handleFirestoreError('dbSaveOccasion', err);
  }
}

export async function dbDeleteOccasion(occId: string) {
  try {
    await deleteDoc(doc(db, 'occasions', occId));
  } catch (err) {
    handleFirestoreError('dbDeleteOccasion', err);
  }
}

export async function dbDeleteEvent(eventId: string) {
  try {
    await deleteDoc(doc(db, 'events', eventId));
  } catch (err) {
    handleFirestoreError('dbDeleteEvent', err);
  }
}

export async function dbClearAllEvents() {
  try {
    const eventsSnap = await getDocs(eventsCol);
    const chunkSize = 500;
    const docs = eventsSnap.docs;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
    await setDoc(doc(db, 'meta', 'events_status'), { cleared: true, updatedAt: new Date().toISOString() });
  } catch (err) {
    handleFirestoreError('dbClearAllEvents', err);
  }
}

export async function dbSaveStudent(student: Student): Promise<{ok: boolean; reason?: string}> {
  try {
    const rawId = (student.registerNo && !student.registerNo.startsWith('GCU-TEMP-'))
      ? student.registerNo.trim().toUpperCase()
      : (student.email ? student.email.trim().toLowerCase() : (student.uid || `STD-${Date.now()}`));
    const safeDocId = rawId.replace(/\//g, '_');

    const docRef = doc(db, 'students', safeDocId);
    const finalStudent = cleanObjectForFirestore({
      ...student,
      registerNo: (student.registerNo && !student.registerNo.startsWith('GCU-TEMP-')) ? student.registerNo.trim().toUpperCase() : student.registerNo,
      name: student.name ? formatToTitleCase(student.name) : student.name
    });

    await setDoc(docRef, finalStudent, { merge: true });
    return { ok: true };
  } catch (err: any) {
    handleFirestoreError('dbSaveStudent', err);
    return { ok: false, reason: err.message || 'Firestore write failed' };
  }
}

export async function dbDeleteStudent(registerNo: string) {
  try {
    const cleanReg = (registerNo || '').trim().toUpperCase();
    if (!cleanReg) {
      throw new Error('Invalid register number');
    }
    const safeDocId = cleanReg.replace(/\//g, '_');
    console.log('Deleting student:', cleanReg, 'DocID:', safeDocId);
    await deleteDoc(doc(db, 'students', safeDocId));
    if (safeDocId !== registerNo) {
      await deleteDoc(doc(db, 'students', registerNo)).catch(() => {});
    }
    console.log('✅ Student deleted successfully:', cleanReg);
    return { ok: true };
  } catch (err: any) {
    console.error('❌ Error deleting student:', err);
    handleFirestoreError('dbDeleteStudent', err);
    throw err;
  }
}

export async function dbSaveCoordinator(coord: FacultyCoordinator) {
  try {
    const safeDocId = coord.facultyId.replace(/\//g, '_');
    await setDoc(doc(db, 'facultyCoordinators', safeDocId), cleanObjectForFirestore(coord), { merge: true });
  } catch (err) {
    handleFirestoreError('dbSaveCoordinator', err);
  }
}

export async function dbDeleteCoordinator(coordId: string) {
  try {
    const safeDocId = coordId.replace(/\//g, '_');
    await deleteDoc(doc(db, 'facultyCoordinators', safeDocId));
  } catch (err) {
    handleFirestoreError('dbDeleteCoordinator', err);
  }
}

export function isGradeFiled(s: Partial<Score> | null | undefined): boolean {
  if (!s) return false;
  const cSum = (s.criterion1 || 0) + (s.criterion2 || 0) + (s.criterion3 || 0) + (s.criterion4 || 0);
  const evtScore = s.eventScore || 0;
  const perfScore = s.performanceScore || 0;
  const total = s.totalScore || 0;
  return Boolean(s.scoreEntered) || cSum > 0 || evtScore > 0 || perfScore > 0 || total > 5;
}

export function mergeScoreRecords(existing: Score, incoming: Score): Score {
  const existingFiled = isGradeFiled(existing);
  const incomingFiled = isGradeFiled(incoming);

  // If incoming has filed grades and existing does not, accept incoming with scoreEntered: true
  if (incomingFiled && !existingFiled) {
    return {
      ...existing,
      ...incoming,
      scoreEntered: true
    };
  }

  // If existing has filed grades and incoming does NOT, preserve existing filed grades!
  if (existingFiled && !incomingFiled) {
    return {
      ...incoming,
      ...existing,
      scoreEntered: true,
      participated: Boolean(incoming.participated || existing.participated)
    };
  }

  // If neither has filed grades, merge participation & registration info safely
  if (!existingFiled && !incomingFiled) {
    const isPart = Boolean(incoming.participated || existing.participated);
    const regPts = Math.max(incoming.registrationPoints ?? 5, existing.registrationPoints ?? 5);
    const partPts = isPart ? Math.max(incoming.participationPoints ?? 0, existing.participationPoints ?? 0) : 0;
    return {
      ...existing,
      ...incoming,
      scoreEntered: false,
      participated: isPart,
      registrationPoints: regPts,
      participationPoints: partPts,
      participationMarks: partPts,
      totalScore: regPts + partPts
    };
  }

  // BOTH have filed grades: merge criteria so non-zero grades are preserved unless explicitly overridden by positive value
  const c1 = (incoming.criterion1 !== undefined && incoming.criterion1 > 0) ? incoming.criterion1 : (existing.criterion1 ?? 0);
  const c2 = (incoming.criterion2 !== undefined && incoming.criterion2 > 0) ? incoming.criterion2 : (existing.criterion2 ?? 0);
  const c3 = (incoming.criterion3 !== undefined && incoming.criterion3 > 0) ? incoming.criterion3 : (existing.criterion3 ?? 0);
  const c4 = (incoming.criterion4 !== undefined && incoming.criterion4 > 0) ? incoming.criterion4 : (existing.criterion4 ?? 0);

  const criteriaSum = c1 + c2 + c3 + c4;
  const evtScore = criteriaSum > 0 ? criteriaSum : Math.max(incoming.eventScore ?? 0, existing.eventScore ?? 0);
  const isPart = Boolean(incoming.participated || existing.participated || evtScore > 0);
  const regPts = Math.max(incoming.registrationPoints ?? 5, existing.registrationPoints ?? 5);
  const partPts = isPart ? Math.max(incoming.participationPoints ?? 15, existing.participationPoints ?? 15) : 0;
  const calculatedTotal = regPts + partPts + evtScore;
  const maxTotal = Math.max(incoming.totalScore ?? 0, existing.totalScore ?? 0, calculatedTotal);

  return {
    ...existing,
    ...incoming,
    id: incoming.id || existing.id,
    studentRegisterNo: incoming.studentRegisterNo || existing.studentRegisterNo,
    eventId: incoming.eventId || existing.eventId,
    eventTitle: incoming.eventTitle || existing.eventTitle,
    scoreEntered: true,
    participated: isPart,
    isWinner: Boolean(incoming.isWinner || existing.isWinner),
    registrationPoints: regPts,
    participationPoints: partPts,
    participationMarks: partPts,
    criterion1: c1,
    criterion2: c2,
    criterion3: c3,
    criterion4: c4,
    eventScore: evtScore,
    performanceScore: evtScore,
    basePoints: regPts,
    totalScore: maxTotal
  };
}

export async function dbSaveScore(score: Score): Promise<{ok: boolean; reason?: string}> {
  try {
    const cleanReg = normalizeRegisterNo(score.studentRegisterNo);
    const cleanEvtId = (score.eventId || '').trim();
    if (!cleanReg) {
      console.error('❌ dbSaveScore: Missing register number');
      return { ok: false, reason: 'Missing register number' };
    }
    if (!cleanEvtId) {
      console.error('❌ dbSaveScore: Missing event id');
      return { ok: false, reason: 'Missing event id' };
    }

    const canonicalDocId = `${cleanReg}_${cleanEvtId}`.replace(/\//g, '_');
    const canonicalDocRef = doc(db, 'scores', canonicalDocId);
    console.log('📝 dbSaveScore: Preparing to save', { cleanReg, cleanEvtId, canonicalDocId });

    let existingDoc: Score | null = null;
    try {
      const snap = await getDoc(canonicalDocRef);
      if (snap.exists()) {
        existingDoc = snap.data() as Score;
      }
    } catch (e: any) {
      console.warn('Error reading existing score doc:', e);
      return { ok: false, reason: e.message || 'Failed to read existing score document' };
    }

    let oldDoc: Score | null = null;
    if (score.id && score.id !== canonicalDocId) {
      try {
        const oldSnap = await getDoc(doc(db, 'scores', score.id));
        if (oldSnap.exists()) {
          oldDoc = oldSnap.data() as Score;
        }
      } catch (e: any) {
        console.warn('Error reading old score doc:', e);
      }
    }

    let finalScoreToSave: Score = {
      ...score,
      id: canonicalDocId,
      studentRegisterNo: cleanReg,
      eventId: cleanEvtId
    };

    if (existingDoc) {
      finalScoreToSave = { ...existingDoc, ...finalScoreToSave };
    }
    if (oldDoc) {
      finalScoreToSave = { ...oldDoc, ...finalScoreToSave };
    }

    console.log('💾 Saving score to Firestore:', { canonicalDocId, studentReg: cleanReg, eventId: cleanEvtId });
    console.log('📊 Score data:', finalScoreToSave);

    await setDoc(canonicalDocRef, cleanObjectForFirestore(finalScoreToSave), { merge: true });

    console.log('✅ Score saved successfully to Firestore:', canonicalDocId);

    if (score.id && score.id !== canonicalDocId && oldDoc) {
      deleteDoc(doc(db, 'scores', score.id)).catch(() => {});
    }
    return { ok: true };
  } catch (err: any) {
    console.error('❌ Error in dbSaveScore:', err);
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    handleFirestoreError('dbSaveScore', err);
    return { ok: false, reason: err.message || 'Firestore write failed' };
  }
}

export async function dbDeleteScore(scoreId: string, force: boolean = false): Promise<{ok: boolean; reason?: string}> {
  try {
    const safeDocId = scoreId.replace(/\//g, '_');

    if (!force) {
      try {
        const snap = await getDoc(doc(db, 'scores', safeDocId));
        if (snap.exists()) {
          const score = snap.data() as Score;
          if (score.scoreEntered === true) {
            console.warn(`Cannot delete graded score ${safeDocId}`);
            return { ok: false, reason: 'Cannot delete a graded score. Contact coordinator.' };
          }
        }
      } catch (e: any) {
        console.warn('Error reading score before delete:', e);
      }
    }

    await deleteDoc(doc(db, 'scores', safeDocId));
    return { ok: true };
  } catch (err: any) {
    handleFirestoreError('dbDeleteScore', err);
    return { ok: false, reason: err.message || 'Failed to delete score' };
  }
}

export async function dbAddEventRegistration(studentOrRegNo: Student | string, eventId: string): Promise<{ok: boolean; reason?: string}> {
  try {
    let safeDocId = '';
    let studentDataToMerge: Partial<Student> = {};

    if (typeof studentOrRegNo === 'object' && studentOrRegNo !== null) {
      const student = studentOrRegNo;
      const reg = student.registerNo || '';
      const rawId = (reg && !reg.startsWith('GCU-TEMP-'))
        ? reg.trim().toUpperCase()
        : (student.email ? student.email.trim().toLowerCase() : (student.uid || `STD-${Date.now()}`));
      safeDocId = rawId.replace(/\//g, '_');
      studentDataToMerge = cleanObjectForFirestore({
        ...student,
        registerNo: (reg && !reg.startsWith('GCU-TEMP-')) ? reg.trim().toUpperCase() : reg,
        name: student.name ? formatToTitleCase(student.name) : student.name
      });
    } else {
      const cleanReg = normalizeRegisterNo(studentOrRegNo as string);
      if (!cleanReg) return { ok: false, reason: 'Missing register number' };
      safeDocId = cleanReg.replace(/\//g, '_');
    }

    if (!eventId) return { ok: false, reason: 'Missing event id' };

    const studentDocRef = doc(db, 'students', safeDocId);

    await setDoc(studentDocRef, {
      ...studentDataToMerge,
      registeredEventIds: arrayUnion(eventId)
    }, { merge: true });

    return { ok: true };
  } catch (err: any) {
    handleFirestoreError('dbAddEventRegistration', err);
    return { ok: false, reason: err.message || 'Failed to add event registration' };
  }
}

export async function dbRemoveEventRegistration(studentOrRegNo: Student | string, eventId: string): Promise<{ok: boolean; reason?: string}> {
  try {
    let safeDocId = '';

    if (typeof studentOrRegNo === 'object' && studentOrRegNo !== null) {
      const student = studentOrRegNo;
      const reg = student.registerNo || '';
      const rawId = (reg && !reg.startsWith('GCU-TEMP-'))
        ? reg.trim().toUpperCase()
        : (student.email ? student.email.trim().toLowerCase() : (student.uid || ''));
      safeDocId = rawId.replace(/\//g, '_');
    } else {
      const cleanReg = normalizeRegisterNo(studentOrRegNo as string);
      if (!cleanReg) return { ok: false, reason: 'Missing register number' };
      safeDocId = cleanReg.replace(/\//g, '_');
    }

    if (!safeDocId) return { ok: false, reason: 'Missing student identifier' };
    if (!eventId) return { ok: false, reason: 'Missing event id' };

    const studentDocRef = doc(db, 'students', safeDocId);

    await setDoc(studentDocRef, {
      registeredEventIds: arrayRemove(eventId)
    }, { merge: true });

    return { ok: true };
  } catch (err: any) {
    handleFirestoreError('dbRemoveEventRegistration', err);
    return { ok: false, reason: err.message || 'Failed to remove event registration' };
  }
}

export async function dbSaveStudentsAndScoresBatch(studentsToSave: Student[], scoresToSave: Score[]) {
  try {
    const chunkSize = 250;
    const ops: Array<{ data: any; ref: any }> = [];

    studentsToSave.forEach(student => {
      const reg = student.registerNo || '';
      const rawId = (reg && !reg.startsWith('GCU-TEMP-'))
        ? reg.trim().toUpperCase()
        : (student.email ? student.email.trim().toLowerCase() : (student.uid || `STD-${Date.now()}`));
      const safeDocId = rawId.replace(/\//g, '_');
      const docRef = doc(db, 'students', safeDocId);
      const finalStudent = cleanObjectForFirestore({
        ...student,
        registerNo: (reg && !reg.startsWith('GCU-TEMP-')) ? reg.trim().toUpperCase() : reg,
        name: student.name ? formatToTitleCase(student.name) : student.name
      });
      ops.push({ data: finalStudent, ref: docRef });
    });

    scoresToSave.forEach(score => {
      const cleanReg = normalizeRegisterNo(score.studentRegisterNo);
      const cleanEvtId = (score.eventId || '').trim();
      if (!cleanReg || !cleanEvtId) return;

      const canonicalDocId = `${cleanReg}_${cleanEvtId}`.replace(/\//g, '_');
      const canonicalDocRef = doc(db, 'scores', canonicalDocId);
      const finalScoreToSave: Score = {
        ...score,
        id: canonicalDocId,
        studentRegisterNo: cleanReg,
        eventId: cleanEvtId
      };
      ops.push({ data: cleanObjectForFirestore(finalScoreToSave), ref: canonicalDocRef });
    });

    for (let i = 0; i < ops.length; i += chunkSize) {
      const chunk = ops.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const op of chunk) {
        batch.set(op.ref, op.data, { merge: true });
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError('dbSaveStudentsAndScoresBatch', err);
  }
}

export async function dbClearAllNotifications() {
  localStorage.setItem('gcu_cleared_notifs_time', new Date().toISOString());
  try {
    const snap = await getDocs(notificationsCol);
    for (const d of snap.docs) {
      deleteDoc(doc(db, 'notifications', d.id)).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError('dbClearAllNotifications', err);
  }
}

export async function dbClearAllMessages() {
  localStorage.setItem('gcu_cleared_msgs_time', new Date().toISOString());
  try {
    const snap = await getDocs(messagesCol);
    for (const d of snap.docs) {
      deleteDoc(doc(db, 'messages', d.id)).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError('dbClearAllMessages', err);
  }
}

export async function dbSaveNotification(notif: Notification) {
  try {
    await setDoc(doc(db, 'notifications', notif.id), cleanObjectForFirestore(notif));
  } catch (err) {
    handleFirestoreError('dbSaveNotification', err);
  }
}

export async function dbSaveMessage(msg: MessageToCoordinator) {
  try {
    await setDoc(doc(db, 'messages', msg.id), cleanObjectForFirestore(msg));
  } catch (err) {
    handleFirestoreError('dbSaveMessage', err);
  }
}

// ==========================================
// FIREBASE AUTHENTICATION HELPERS
// ==========================================

export async function signUpStudentAuth(email: string, password: string, studentData: Omit<Student, 'uid' | 'isEmailVerified'>) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (studentData.name) {
    try {
      await updateProfile(user, { displayName: studentData.name });
    } catch (err) {
      console.warn('Could not update profile name:', err);
    }
  }

  try {
    await sendEmailVerification(user);
  } catch (err) {
    console.warn('Verification email send warning:', err);
  }

  const fullStudent: Student = {
    ...studentData,
    uid: user.uid,
    email: user.email || email,
    isEmailVerified: user.emailVerified
  };

  await dbSaveStudent(fullStudent);
  return { user, student: fullStudent };
}

export async function signInStudentAuth(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function sendResetPasswordLink(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function resendAuthEmailVerification() {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
    return true;
  }
  return false;
}

export async function checkAuthEmailVerified(): Promise<boolean> {
  if (auth.currentUser) {
    await auth.currentUser.reload();
    return auth.currentUser.emailVerified;
  }
  return false;
}

export async function signInWithGoogleAuth() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signInWithMicrosoftAuth(tenantId?: string) {
  const provider = new OAuthProvider('microsoft.com');
  if (tenantId) {
    provider.setCustomParameters({
      tenant: tenantId,
      prompt: 'select_account'
    });
  } else {
    provider.setCustomParameters({
      prompt: 'select_account'
    });
  }
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutStudentAuth() {
  await signOut(auth);
}

export function subscribeAuthUser(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}
