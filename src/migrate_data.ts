import xlsx from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0389827203",
  appId: "1:864370343467:web:ee690e91bcdf1daf4d746e",
  apiKey: "AIzaSyB0d6ityQa520ALCGtGUk-14PnlD0jrjLc",
  authDomain: "gen-lang-client-0389827203.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-fresherismeventh-2745df38-b6b0-4b10-ad0b-8a8ea235d163",
  storageBucket: "gen-lang-client-0389827203.firebasestorage.app",
  messagingSenderId: "864370343467"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-fresherismeventh-2745df38-b6b0-4b10-ad0b-8a8ea235d163");

async function run() {
  console.log('Loading Excel...');
  const wb = xlsx.readFile('src/MasterData_Corrected.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Headers: S.No (0), Current Register No (1), USN NO (2), Student Name (3), Mobile Number (4), Email ID (5), Department (6), Program (7), Events Registered (8), UID (9)
  
  const masterData = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1] && !r[2] && !r[3]) continue;
    masterData.push({
      registerNo: (r[1] || '').toString().trim(),
      usnNo: (r[2] || '').toString().trim(),
      name: (r[3] || '').toString().trim(),
      mobile: (r[4] || '').toString().trim(),
      email: (r[5] || '').toString().trim(),
      department: (r[6] || '').toString().trim(),
      program: (r[7] || '').toString().trim(),
      uid: (r[9] || '').toString().trim()
    });
  }
  
  console.log(`Parsed ${masterData.length} records from Excel`);

  console.log('Fetching students from DB...');
  const studentsSnap = await getDocs(collection(db, 'students'));
  const dbStudents = [];
  studentsSnap.forEach(d => dbStudents.push({ docId: d.id, ...d.data() }));
  console.log(`Fetched ${dbStudents.length} students from DB`);

  const regToMaster = new Map();
  const uidToMaster = new Map();
  masterData.forEach(m => {
    if (m.registerNo) regToMaster.set(m.registerNo.toLowerCase(), m);
    if (m.uid) uidToMaster.set(m.uid, m);
  });

  // Group DB students by their resolved USN NO (or registerNo if no USN)
  const unifiedStudents = new Map();
  
  dbStudents.forEach(dbStudent => {
    let masterInfo = null;
    if (dbStudent.uid && uidToMaster.has(dbStudent.uid)) {
      masterInfo = uidToMaster.get(dbStudent.uid);
    } else if (dbStudent.registerNo && regToMaster.has(dbStudent.registerNo.toLowerCase())) {
      masterInfo = regToMaster.get(dbStudent.registerNo.toLowerCase());
    }

    let key = '';
    let resolvedUsn = dbStudent.usnNo || '';
    if (masterInfo && masterInfo.usnNo) resolvedUsn = masterInfo.usnNo;

    let resolvedReg = dbStudent.registerNo || '';
    if (masterInfo && masterInfo.registerNo) resolvedReg = masterInfo.registerNo;
    
    if (resolvedUsn) {
      key = resolvedUsn.toUpperCase();
    } else if (resolvedReg) {
      key = resolvedReg.toUpperCase();
    } else if (dbStudent.email) {
      key = dbStudent.email.toLowerCase();
    } else {
      key = dbStudent.uid || dbStudent.docId;
    }

    if (!unifiedStudents.has(key)) {
      unifiedStudents.set(key, {
        usnNo: resolvedUsn,
        registerNo: resolvedReg,
        name: (masterInfo && masterInfo.name) ? masterInfo.name : dbStudent.name,
        mobile: (masterInfo && masterInfo.mobile) ? masterInfo.mobile : (dbStudent.mobile || ''),
        email: (masterInfo && masterInfo.email) ? masterInfo.email : (dbStudent.email || ''),
        department: (masterInfo && masterInfo.department) ? masterInfo.department : (dbStudent.department || ''),
        programName: (masterInfo && masterInfo.program) ? masterInfo.program : (dbStudent.programName || ''),
        uid: (masterInfo && masterInfo.uid) ? masterInfo.uid : (dbStudent.uid || ''),
        registeredEventIds: new Set(dbStudent.registeredEventIds || []),
        // other fields
        school: dbStudent.school || '',
        isExternal: dbStudent.isExternal || false,
        externalCollegeName: dbStudent.externalCollegeName || '',
        authProvider: dbStudent.authProvider || 'password',
        isEmailVerified: dbStudent.isEmailVerified || false,
        isProfileComplete: dbStudent.isProfileComplete || false,
        sem1Declared: dbStudent.sem1Declared || false,
        declarationAccepted: dbStudent.declarationAccepted || false,
        _oldDocs: [dbStudent.docId]
      });
    } else {
      const existing = unifiedStudents.get(key);
      (dbStudent.registeredEventIds || []).forEach(e => existing.registeredEventIds.add(e));
      if (!existing.mobile && dbStudent.mobile) existing.mobile = dbStudent.mobile;
      if (!existing.email && dbStudent.email) existing.email = dbStudent.email;
      if (!existing.uid && dbStudent.uid) existing.uid = dbStudent.uid;
      existing._oldDocs.push(dbStudent.docId);
    }
  });

  // Make sure ALL master data records are present even if they had no DB entry
  masterData.forEach(m => {
    const key = m.usnNo ? m.usnNo.toUpperCase() : m.registerNo.toUpperCase();
    if (!unifiedStudents.has(key) && key) {
      unifiedStudents.set(key, {
        usnNo: m.usnNo,
        registerNo: m.registerNo,
        name: m.name,
        mobile: m.mobile,
        email: m.email,
        department: m.department,
        programName: m.program,
        uid: m.uid,
        registeredEventIds: new Set(),
        school: '',
        isExternal: false,
        externalCollegeName: '',
        authProvider: 'password',
        isEmailVerified: false,
        isProfileComplete: false,
        sem1Declared: false,
        declarationAccepted: false,
        _oldDocs: []
      });
    }
  });

  console.log(`Unified into ${unifiedStudents.size} unique students.`);

  // 1. Update scores
  console.log('Fetching scores from DB...');
  const scoresSnap = await getDocs(collection(db, 'scores'));
  const dbScores = [];
  scoresSnap.forEach(s => dbScores.push({ docId: s.id, ...s.data() }));

  const scoreUpdates = [];
  dbScores.forEach(score => {
    let needsUpdate = false;
    let newScoreData = { ...score };
    
    // Look up correct USN by studentRegisterNo
    let studentReg = score.studentRegisterNo;
    if (studentReg && regToMaster.has(studentReg.toLowerCase())) {
      const masterInfo = regToMaster.get(studentReg.toLowerCase());
      if (masterInfo.usnNo && score.usnNo !== masterInfo.usnNo) {
        newScoreData.usnNo = masterInfo.usnNo;
        needsUpdate = true;
      }
    } else {
      // Find in unified list
      for (const [key, st] of unifiedStudents.entries()) {
        if (st.registerNo && st.registerNo.toLowerCase() === studentReg?.toLowerCase()) {
           if (st.usnNo && score.usnNo !== st.usnNo) {
             newScoreData.usnNo = st.usnNo;
             needsUpdate = true;
           }
           break;
        }
      }
    }

    if (needsUpdate) {
      scoreUpdates.push(newScoreData);
    }
  });

  console.log(`Updating ${scoreUpdates.length} scores...`);
  for (let i = 0; i < scoreUpdates.length; i += 250) {
    const batch = writeBatch(db);
    const chunk = scoreUpdates.slice(i, i + 250);
    chunk.forEach(sc => {
      batch.set(doc(db, 'scores', sc.docId), sc, { merge: true });
    });
    await batch.commit();
  }
  console.log('Scores updated.');

  // 2. Overwrite students
  console.log('Replacing students collection...');
  let totalDocsToDelete = [];
  dbStudents.forEach(st => totalDocsToDelete.push(st.docId));
  
  // delete existing students in batches
  for (let i = 0; i < totalDocsToDelete.length; i += 250) {
    const batch = writeBatch(db);
    const chunk = totalDocsToDelete.slice(i, i + 250);
    chunk.forEach(id => batch.delete(doc(db, 'students', id)));
    await batch.commit();
  }

  // insert new students
  const newStudentDocs = [];
  for (const [key, st] of unifiedStudents.entries()) {
    const finalStudent = { ...st };
    delete finalStudent._oldDocs;
    finalStudent.registeredEventIds = Array.from(finalStudent.registeredEventIds);
    
    const reg = finalStudent.registerNo || '';
    const rawId = (reg && !reg.startsWith('GCU-TEMP-'))
      ? reg.trim().toUpperCase()
      : (finalStudent.email ? finalStudent.email.trim().toLowerCase() : (finalStudent.uid || `STD-${Date.now()}`));
    const safeDocId = rawId.replace(/\//g, '_');
    
    newStudentDocs.push({ id: safeDocId, data: finalStudent });
  }

  for (let i = 0; i < newStudentDocs.length; i += 250) {
    const batch = writeBatch(db);
    const chunk = newStudentDocs.slice(i, i + 250);
    chunk.forEach(st => {
      batch.set(doc(db, 'students', st.id), st.data);
    });
    await batch.commit();
  }
  
  console.log(`Saved ${newStudentDocs.length} unified students.`);
  console.log('Migration complete!');
}

run().catch(console.error);
