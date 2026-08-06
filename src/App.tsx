/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from 'react';
import { 
  Sparkles, Calendar, Users, Award, ShieldAlert, RotateCcw, 
  GraduationCap, UserCog, Settings2, Home, ShieldCheck
} from 'lucide-react';
import { Event, Student, Score, Notification, MessageToCoordinator, UserRole, FacultyCoordinator, Occasion, isMatchingEmail, findStudentMatch, normalizeRegisterNo, getStudentRegisteredEventIds } from './types';
import { 
  INITIAL_EVENTS, 
  INITIAL_STUDENTS, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_MESSAGES, 
  INITIAL_FACULTY_COORDINATORS,
  INITIAL_OCCASIONS,
  generateInitialScores 
} from './data/initialData';

import StudentDashboard from './components/StudentDashboard';
import ConvenorDashboard from './components/ConvenorDashboard';
import CoordinatorDashboard from './components/CoordinatorDashboard';
import { NccCoordinatorDashboard } from './components/NccCoordinatorDashboard';
import { Sem1SelfDeclarationModal } from './components/Sem1SelfDeclarationModal';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { LandingPagePortal } from './components/LandingPagePortal';
import { MandatoryProfileModal } from './components/MandatoryProfileModal';
import { FreshathonPromoModal } from './components/FreshathonPromoModal';

import FresherismLogo from './components/FresherismLogo';
import logo2Img from './assets/logo2.png';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { AppQRCodeModal } from './components/AppQRCodeModal';
import { FacultyStudentScannerModal } from './components/FacultyStudentScannerModal';
import { FloatingNotificationIcon } from './components/FloatingNotificationIcon';

import {
  seedFirestoreIfEmpty,
  subscribeEvents,
  subscribeStudents,
  subscribeCoordinators,
  subscribeScores,
  subscribeNotifications,
  subscribeMessages,
  subscribeOccasions,
  dbSaveEvent,
  dbDeleteEvent,
  dbClearAllEvents,
  dbSaveStudent,
  dbSaveCoordinator,
  dbDeleteCoordinator,
  dbDeleteStudent,
  dbSaveScore,
  dbDeleteScore,
  dbAddEventRegistration,
  dbRemoveEventRegistration,
  dbSaveNotification,
  dbClearAllNotifications,
  dbClearAllMessages,
  dbSaveMessage,
  dbSaveOccasion,
  dbDeleteOccasion,
  subscribeAuthUser,
  logoutStudentAuth
} from './firebase';

export default function App() {
  // Global Occasions & Active Occasion
  const [occasions, setOccasions] = useState<Occasion[]>(() => {
    const saved = localStorage.getItem('gcu_occasions');
    let list = saved ? JSON.parse(saved) : INITIAL_OCCASIONS;
    if (Array.isArray(list)) {
      list = list.map(occ => {
        if (occ.id === 'occ-fresherism-26' && (occ.convenorName === 'Prof. Kushal B. S.' || !occ.convenorName)) {
          return { ...occ, convenorName: 'Prof. Ashwini. S', convenorEmail: 'ashwini.s@gcu.edu.in' };
        }
        return occ;
      });
    }
    return list;
  });
  const [activeOccasionId, setActiveOccasionId] = useState<string>(() => {
    return localStorage.getItem('gcu_active_occasion_id') || INITIAL_OCCASIONS[0].id;
  });

  // Global States
  const [events, setEvents] = useState<Event[]>(() => {
    const cached = localStorage.getItem('gcu_events_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // Fallback to INITIAL_EVENTS
      }
    }
    return INITIAL_EVENTS;
  });

  const eventsRef = useRef<Event[]>(events);
  const rawScoresRef = useRef<Score[]>([]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  const [students, setStudents] = useState<Student[]>([]);
  const studentsRef = useRef<Student[]>(students);
  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const studentsLoadedRef = useRef(false);
  const pendingAuthUserRef = useRef<any>(null);
  const authFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facultyCoordinators, setFacultyCoordinators] = useState<FacultyCoordinator[]>(INITIAL_FACULTY_COORDINATORS);
  const facultyCoordinatorsRef = useRef<FacultyCoordinator[]>(facultyCoordinators);
  useEffect(() => {
    facultyCoordinatorsRef.current = facultyCoordinators;
  }, [facultyCoordinators]);
  
  const [scores, setScores] = useState<Score[]>(() => {
    const cached = localStorage.getItem('gcu_scores_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<MessageToCoordinator[]>([]);
  
  // Navigation & Session: Default to 'landing' for Page 1
  const [activeRole, setActiveRole] = useState<UserRole | 'landing' | 'superadmin'>('landing');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [activeFaculty, setActiveFaculty] = useState<FacultyCoordinator | null>(null);

  // Selected Occasion / Event for Convenor / Coordinator navigation
  const [selectedOccasionIdNav, setSelectedOccasionIdNav] = useState<string>(INITIAL_OCCASIONS[0].id);
  const [selectedEventIdNav, setSelectedEventIdNav] = useState<string>('');

  // Super Admin Credentials State
  const [superAdminUsername, setSuperAdminUsername] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [isSuperAdminAuth, setIsSuperAdminAuth] = useState(false);
  const [superAdminError, setSuperAdminError] = useState('');

  // Mandatory Profile Completion Guard
  const activeOccasionObj = occasions.find(o => o.id === activeOccasionId) || occasions[0];

  // Theme & Layout Personalization
  type ThemeOption = 'vibrant-royal' | 'sunny-light' | 'emerald-gold' | 'ocean-coral' | 'gcu' | 'midnight-gold';
  type LayoutDensity = 'standard' | 'compact' | 'fullwidth';

  const [currentTheme, setCurrentTheme] = useState<ThemeOption>(() => {
    return (localStorage.getItem('fresherism_theme') as ThemeOption) || 'vibrant-royal';
  });

  const [layoutDensity, setLayoutDensity] = useState<LayoutDensity>(() => {
    return (localStorage.getItem('fresherism_layout') as LayoutDensity) || 'standard';
  });

  const [showQRModal, setShowQRModal] = useState(false);
  const [scannedStudentIdFromUrl, setScannedStudentIdFromUrl] = useState<string>('');
  const [headerLogoFailed, setHeaderLogoFailed] = useState(false);

  // Freshathon Promo Modal State (No automatic popups or timers)
  const [showFreshathonModal, setShowFreshathonModal] = useState(false);
  const [autoFocusStudentSignIn, setAutoFocusStudentSignIn] = useState(false);
  const [pendingEventId, setPendingEventId] = useState<string>(() =>
    localStorage.getItem('gcu_pending_event_id') || ''
  );

  const handleCloseFreshathonModal = () => {
    setShowFreshathonModal(false);
  };

  const handleRequireStudentSignIn = (eventId?: string) => {
    if (eventId) {
      setPendingEventId(eventId);
      localStorage.setItem('gcu_pending_event_id', eventId);
    }
    setShowFreshathonModal(false);
    setActiveRole('landing');
    setAutoFocusStudentSignIn(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeRole !== 'landing') return;
    if (sessionStorage.getItem('freshathon_promo_shown')) return;
    sessionStorage.setItem('freshathon_promo_shown', '1');
    setShowFreshathonModal(true);
  }, [activeRole]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('studentId');
    if (sid) {
      setScannedStudentIdFromUrl(sid);
    }
  }, []);

  const handleThemeChange = (theme: ThemeOption) => {
    setCurrentTheme(theme);
    localStorage.setItem('fresherism_theme', theme);
  };

  const handleLayoutChange = (layout: LayoutDensity) => {
    setLayoutDensity(layout);
    localStorage.setItem('fresherism_layout', layout);
  };

  // Occasions Persistence
  const handleSaveOccasion = (occ: Occasion) => {
    const index = occasions.findIndex(o => o.id === occ.id);
    let next: Occasion[];
    if (index >= 0) {
      next = [...occasions];
      next[index] = occ;
    } else {
      next = [...occasions, occ];
    }
    setOccasions(next);
    setActiveOccasionId(occ.id);
    try {
      localStorage.setItem('gcu_occasions', JSON.stringify(next));
      localStorage.setItem('gcu_active_occasion_id', occ.id);
    } catch (e) {
      console.warn('LocalStorage save warning:', e);
    }
    dbSaveOccasion(occ).catch(err => console.error('Error saving occasion to Firestore:', err));
  };

  const handleDeleteOccasion = (id: string) => {
    if (occasions.length <= 1) return;
    const next = occasions.filter(o => o.id !== id);
    setOccasions(next);
    try {
      localStorage.setItem('gcu_occasions', JSON.stringify(next));
    } catch (e) {
      console.warn('LocalStorage delete warning:', e);
    }
    dbDeleteOccasion(id).catch(err => console.error('Error deleting occasion from Firestore:', err));
    if (activeOccasionId === id) {
      setActiveOccasionId(next[0].id);
      localStorage.setItem('gcu_active_occasion_id', next[0].id);
    }
  };

  const handleSelectActiveOccasion = (id: string) => {
    setActiveOccasionId(id);
    localStorage.setItem('gcu_active_occasion_id', id);
  };

  // Super Admin Login
  const handleSuperAdminLogin = (e: FormEvent) => {
    e.preventDefault();
    setSuperAdminError('');
    if (superAdminUsername.trim() === 'admin' && superAdminPassword === 'Admin@560049') {
      setIsSuperAdminAuth(true);
      setSuperAdminUsername('');
      setSuperAdminPassword('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setSuperAdminError('Invalid Super Admin credentials. Access denied.');
    }
  };

  // Firebase Firestore Realtime Integration
  useEffect(() => {
    seedFirestoreIfEmpty();

    authFallbackTimerRef.current = setTimeout(() => {
      if (!studentsLoadedRef.current) {
        console.warn('⚠️ Students snapshot timed out (6s) - resolving auth user with available data');
        studentsLoadedRef.current = true;
        setStudentsLoaded(true);
        if (pendingAuthUserRef.current) {
          const u = pendingAuthUserRef.current;
          pendingAuthUserRef.current = null;
          resolveAuthUserToProfile(u);
        }
      }
    }, 6000);

    const processAndSetScores = (fbScores: Score[], currentEventsList: Event[]) => {
      const canonicalScoresMap = new Map<string, Score>();
      const evts = currentEventsList.length > 0 ? currentEventsList : INITIAL_EVENTS;

      let localCached: Score[] = [];
      try {
        const cached = localStorage.getItem('gcu_scores_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) localCached = parsed;
        }
      } catch (e) {}

      // Process live Firestore scores first - Firestore is source of truth
      fbScores.forEach(sc => {
        if (!sc.studentRegisterNo || (!sc.eventId && !sc.eventTitle)) return;
        const cleanReg = sc.studentRegisterNo.trim().toUpperCase();
        
        let canonicalEvtId = (sc.eventId || '').trim();
        const normTitle = (sc.eventTitle || '').trim().toLowerCase();

        const matchEvt = evts.find(e => 
          (canonicalEvtId && e.id === canonicalEvtId) || 
          (normTitle && e.title && e.title.trim().toLowerCase() === normTitle)
        );
        if (matchEvt) {
          canonicalEvtId = matchEvt.id;
          sc.eventId = matchEvt.id;
          if (matchEvt.title) sc.eventTitle = matchEvt.title;
        } else if (!canonicalEvtId && normTitle) {
          canonicalEvtId = normTitle;
        }

        const safeDocId = `${cleanReg}_${canonicalEvtId}`.replace(/\//g, '_');
        sc.id = safeDocId;

        const key = `${cleanReg}___${canonicalEvtId}`;
        const existing = canonicalScoresMap.get(key);

        if (!existing) {
          canonicalScoresMap.set(key, { ...sc });
        } else {
          // If there are duplicate score documents in Firestore for the same student/event, latest one wins
          canonicalScoresMap.set(key, { ...existing, ...sc });
        }
      });

      localCached.forEach(sc => {
        if (!sc.studentRegisterNo || (!sc.eventId && !sc.eventTitle)) return;
        const cleanReg = sc.studentRegisterNo.trim().toUpperCase();
        let canonicalEvtId = (sc.eventId || '').trim();
        const normTitle = (sc.eventTitle || '').trim().toLowerCase();

        const matchEvt = evts.find(e => 
          (canonicalEvtId && e.id === canonicalEvtId) || 
          (normTitle && e.title && e.title.trim().toLowerCase() === normTitle)
        );
        if (matchEvt) canonicalEvtId = matchEvt.id;

        const key = `${cleanReg}___${canonicalEvtId}`;
        const existing = canonicalScoresMap.get(key);
        
        // Only use local cache if Firestore hasn't provided this score yet
        if (!existing) {
          canonicalScoresMap.set(key, { ...sc });
        }
      });

      const processedList = Array.from(canonicalScoresMap.values());
      setScores(processedList);
      rawScoresRef.current = processedList;
      try {
        localStorage.setItem('gcu_scores_cache', JSON.stringify(processedList));
      } catch (e) {}

      // Automatically sync student registeredEventIds state with processed scores
      setStudents(prev => {
        const enriched = prev.map(st => {
          const combinedRegs = getStudentRegisteredEventIds(st, processedList);
          if ((st.registeredEventIds?.length || 0) === combinedRegs.length && combinedRegs.every(id => st.registeredEventIds?.includes(id))) {
            return st;
          }
          return { ...st, registeredEventIds: combinedRegs };
        });
        studentsRef.current = enriched;
        return enriched;
      });

      setActiveStudent(prev => {
        if (!prev) return null;
        const combinedRegs = getStudentRegisteredEventIds(prev, processedList);
        return { ...prev, registeredEventIds: combinedRegs };
      });
    };

    const unsubEvents = subscribeEvents((fbEvents) => {
      if (fbEvents && fbEvents.length > 0) {
        setEvents(fbEvents);
        eventsRef.current = fbEvents;
        localStorage.setItem('gcu_events_cache', JSON.stringify(fbEvents));
        if (rawScoresRef.current.length > 0) {
          processAndSetScores(rawScoresRef.current, fbEvents);
        }
      }
    });

    const resolveAuthUserToProfile = (firebaseUser: any) => {
      if (!firebaseUser) return;
      const normEmail = (firebaseUser.email || '').trim().toLowerCase();
      const normUid   = (firebaseUser.uid   || '').trim();
      const cachedId  = (localStorage.getItem('fresherism_active_student_id') || '').trim();

      // Robust matching against students list
      const match = findStudentMatch(studentsRef.current, {
        uid: normUid,
        email: normEmail,
        registerNo: cachedId
      });

      if (match) {
        const combinedRegs = getStudentRegisteredEventIds(match, rawScoresRef.current);
        const enrichedMatch: Student = {
          ...match,
          uid: match.uid || normUid,
          email: match.email || normEmail,
          registeredEventIds: combinedRegs,
          isEmailVerified: firebaseUser.emailVerified || match.isEmailVerified
        };
        // Persist missing uid/email/registrations back to Firestore
        dbSaveStudent(enrichedMatch).catch(() => {});
        setActiveStudent(enrichedMatch);
        localStorage.setItem('fresherism_active_student_id',
          enrichedMatch.registerNo || enrichedMatch.email || enrichedMatch.uid);
        localStorage.removeItem('fresherism_active_faculty_id');
        return;
      }

      // Is this a faculty account? Then do NOT build a student profile.
      const facultyMatch = facultyCoordinatorsRef.current?.find(f =>
        f.email && normEmail && f.email.trim().toLowerCase() === normEmail
      );
      if (facultyMatch) {
        setActiveFaculty(facultyMatch);
        setActiveStudent(null);
        localStorage.setItem('fresherism_active_faculty_id', facultyMatch.facultyId);
        localStorage.removeItem('fresherism_active_student_id');
        return;
      }

      // Genuinely new user: hold identity but DO NOT clear existing session event registrations if present
      setActiveStudent(prev => {
        const prevRegs = prev?.registeredEventIds || [];
        const baseStudent: Student = {
          uid: firebaseUser.uid,
          registerNo: prev?.registerNo || '',
          name: prev?.name || firebaseUser.displayName || '',
          email: firebaseUser.email || prev?.email || '',
          mobile: prev?.mobile || '',
          department: prev?.department || '',
          programName: prev?.programName || '',
          school: prev?.school || 'Garden City University',
          isProfileComplete: prev?.isProfileComplete || false,
          registeredEventIds: prevRegs,
          isEmailVerified: firebaseUser.emailVerified
        };
        const combinedRegs = getStudentRegisteredEventIds(baseStudent, rawScoresRef.current);
        return {
          ...baseStudent,
          registeredEventIds: combinedRegs
        };
      });
    };

    const unsubAuth = subscribeAuthUser((firebaseUser) => {
      if (!firebaseUser) return;
      if (!studentsLoadedRef.current) {
        pendingAuthUserRef.current = firebaseUser;   // defer, do not guess
        return;
      }
      resolveAuthUserToProfile(firebaseUser);
    });

    const unsubStudents = subscribeStudents((fbStudents) => {
      // Deduplicate students by email / registerNo / uid with multi-attribute canonical matching
      const uniqueStudents: Student[] = [];

      fbStudents.forEach(st => {
        const existingMatch = findStudentMatch(uniqueStudents, {
          uid: st.uid,
          email: st.email,
          registerNo: st.registerNo
        });
        const existingIndex = existingMatch ? uniqueStudents.indexOf(existingMatch) : -1;

        if (existingIndex === -1) {
          uniqueStudents.push({ ...st });
        } else {
          const existing = uniqueStudents[existingIndex];
          // Merge fields to retain all completed data and combine event registrations
          const merged: Student = {
            ...existing,
            ...st,
            name: st.name || existing.name || '',
            email: st.email || existing.email || '',
            registerNo: (st.registerNo && !st.registerNo.startsWith('GCU-TEMP-')) ? st.registerNo : existing.registerNo,
            mobile: st.mobile || existing.mobile || '',
            department: st.department || existing.department || '',
            programName: st.programName || existing.programName || '',
            school: st.school || existing.school || 'Garden City University',
            isProfileComplete: existing.isProfileComplete || st.isProfileComplete || false,
            registeredEventIds: Array.from(new Set([
              ...(existing.registeredEventIds || []),
              ...(st.registeredEventIds || [])
            ]))
          };

          uniqueStudents[existingIndex] = merged;
        }
      });

      const enrichedStudents = uniqueStudents.map(st => {
        const combinedRegs = getStudentRegisteredEventIds(st, rawScoresRef.current);
        return {
          ...st,
          registeredEventIds: combinedRegs
        };
      });

      setStudents(enrichedStudents);
      studentsRef.current = enrichedStudents;

      if (authFallbackTimerRef.current) {
        clearTimeout(authFallbackTimerRef.current);
        authFallbackTimerRef.current = null;
      }

      if (!studentsLoadedRef.current) {
        studentsLoadedRef.current = true;
        setStudentsLoaded(true);
        if (pendingAuthUserRef.current) {
          const u = pendingAuthUserRef.current;
          pendingAuthUserRef.current = null;
          resolveAuthUserToProfile(u);
        }
      }

      const cachedActiveStudentId = localStorage.getItem('fresherism_active_student_id');
      setActiveStudent(prev => {
        const searchId = cachedActiveStudentId || prev?.registerNo || prev?.email || prev?.uid;
        if (searchId) {
          const match = findStudentMatch(enrichedStudents, {
            registerNo: searchId,
            email: prev?.email || searchId,
            uid: prev?.uid
          });
          if (match) {
            localStorage.setItem('fresherism_active_student_id', match.registerNo || match.email || match.uid);
            const combinedRegs = getStudentRegisteredEventIds(match, rawScoresRef.current);
            return {
              ...match,
              registeredEventIds: combinedRegs
            };
          }
        }
        return prev;
      });
    });

    const unsubCoordinators = subscribeCoordinators((fbCoordinators) => {
      const coordMap = new Map<string, FacultyCoordinator>();

      fbCoordinators.forEach(coord => {
        const key = coord.email ? coord.email.trim().toLowerCase() : coord.facultyId.trim().toLowerCase();
        if (!key) return;

        if (!coordMap.has(key)) {
          coordMap.set(key, coord);
        } else {
          const existing = coordMap.get(key)!;
          // Prefer completed profile over incomplete profile
          if ((coord.isProfileComplete || coord.mobile) && !existing.isProfileComplete && !existing.mobile) {
            coordMap.set(key, coord);
          } else if (!(coord.isProfileComplete || coord.mobile) && (existing.isProfileComplete || existing.mobile)) {
            // Keep existing
          } else {
            // Merge fields to keep saved mobile number and completion status
            const merged: FacultyCoordinator = {
              ...existing,
              ...coord,
              mobile: coord.mobile || existing.mobile || '',
              department: coord.department || existing.department || '',
              school: coord.school || existing.school || 'Garden City University',
              isProfileComplete: existing.isProfileComplete || coord.isProfileComplete || Boolean(coord.mobile || existing.mobile),
              isApproved: existing.isApproved || coord.isApproved || false
            };
            coordMap.set(key, merged);
          }
        }
      });

      const uniqueCoordinators = Array.from(coordMap.values());
      setFacultyCoordinators(uniqueCoordinators);

      const cachedActiveFacultyId = localStorage.getItem('fresherism_active_faculty_id');
      const cachedActiveStudentId = localStorage.getItem('fresherism_active_student_id');
      
      // ONLY switch session to faculty if faculty ID is cached AND no student session is active
      if (cachedActiveFacultyId && !cachedActiveStudentId) {
        const match = uniqueCoordinators.find(f => 
          f.facultyId === cachedActiveFacultyId || 
          (f.email && cachedActiveFacultyId.includes('@') && f.email.trim().toLowerCase() === cachedActiveFacultyId.trim().toLowerCase())
        );
        if (match) {
          setActiveFaculty(prev => {
            if (!prev || JSON.stringify(prev) !== JSON.stringify(match)) {
              return match;
            }
            return prev;
          });
          setActiveStudent(null);
        }
      }
    });

    const unsubScores = subscribeScores((fbScores) => {
      rawScoresRef.current = fbScores;
      processAndSetScores(fbScores, eventsRef.current.length > 0 ? eventsRef.current : INITIAL_EVENTS);
    });

    const unsubNotifs = subscribeNotifications((fbNotifs) => {
      setNotifications(fbNotifs);
    });

    const unsubMsgs = subscribeMessages((fbMsgs) => {
      setMessages(fbMsgs);
    });

    const unsubOccasions = subscribeOccasions((fbOccasions) => {
      if (fbOccasions && fbOccasions.length > 0) {
        const updated = fbOccasions.map(occ => {
          if (occ.id === 'occ-fresherism-26' && (occ.convenorName === 'Prof. Kushal B. S.' || !occ.convenorName)) {
            return { ...occ, convenorName: 'Prof. Ashwini. S', convenorEmail: 'ashwini.s@gcu.edu.in' };
          }
          return occ;
        });
        setOccasions(updated);
        try {
          localStorage.setItem('gcu_occasions', JSON.stringify(updated));
        } catch (e) {
          console.warn('LocalStorage error:', e);
        }
      }
    });

    return () => {
      if (authFallbackTimerRef.current) {
        clearTimeout(authFallbackTimerRef.current);
        authFallbackTimerRef.current = null;
      }
      unsubAuth();
      unsubEvents();
      unsubStudents();
      unsubCoordinators();
      unsubScores();
      unsubNotifs();
      unsubMsgs();
      unsubOccasions();
    };
  }, []);

  // Sync helpers
  const saveEvents = (newEvents: Event[]) => {
    setEvents(newEvents);
    newEvents.forEach(e => dbSaveEvent(e));
  };

  const saveStudents = async (newStudents: Student[], changedOnly: Student[]) => {
    const toWrite = changedOnly && changedOnly.length ? changedOnly : newStudents;
    const results = await Promise.all(toWrite.map(s => dbSaveStudent(s)));
    const failed = results.filter(r => !r.ok);
    if (failed.length) {
      console.warn('Some students failed to save:', failed);
      throw new Error(`Failed to save ${failed.length} students. Check logs.`);
    }
    setStudents(newStudents);
  };

  const handleSaveStudent = async (student: Student) => {
    const normReg = student.registerNo ? student.registerNo.trim().toUpperCase() : '';
    const exists = students.some(s => s.registerNo && s.registerNo.trim().toUpperCase() === normReg);
    
    let newStudentsList = students;
    if (exists) {
      newStudentsList = students.map(s => (s.registerNo && s.registerNo.trim().toUpperCase() === normReg) ? student : s);
    } else {
      newStudentsList = [...students, student];
    }
    
    await saveStudents(newStudentsList, [student]);
  };

  const saveScores = async (newScores: Score[], changedOnly?: Score[]) => {
    const canonicalMap = new Map<string, Score>();
    const currentEventsList = eventsRef.current;
    if (!currentEventsList || currentEventsList.length === 0) {
      throw new Error('Events are still loading. Please wait a few seconds and upload again.');
    }

    // Start with current scores in memory
    scores.forEach(sc => {
      if (!sc.studentRegisterNo || (!sc.eventId && !sc.eventTitle)) return;
      const cleanReg = sc.studentRegisterNo.trim().toUpperCase();
      let canonicalEvtId = (sc.eventId || '').trim();
      const normTitle = (sc.eventTitle || '').trim().toLowerCase();

      const matchEvt = currentEventsList.find(e => 
        (canonicalEvtId && e.id === canonicalEvtId) || 
        (normTitle && e.title && e.title.trim().toLowerCase() === normTitle)
      );
      if (matchEvt) {
        canonicalEvtId = matchEvt.id;
        sc.eventId = matchEvt.id;
        if (matchEvt.title) sc.eventTitle = matchEvt.title;
      }
      const key = `${cleanReg}___${canonicalEvtId}`;
      canonicalMap.set(key, { ...sc });
    });

    // Directly overwrite with newScores (e.g., from Excel upload or form edit)
    newScores.forEach(sc => {
      if (!sc.studentRegisterNo || (!sc.eventId && !sc.eventTitle)) return;
      const cleanReg = sc.studentRegisterNo.trim().toUpperCase();

      let canonicalEvtId = (sc.eventId || '').trim();
      const normTitle = (sc.eventTitle || '').trim().toLowerCase();

      const matchEvt = currentEventsList.find(e => 
        (canonicalEvtId && e.id === canonicalEvtId) || 
        (normTitle && e.title && e.title.trim().toLowerCase() === normTitle)
      );
      if (matchEvt) {
        canonicalEvtId = matchEvt.id;
        sc.eventId = matchEvt.id;
        if (matchEvt.title) sc.eventTitle = matchEvt.title;
      } else if (!canonicalEvtId && normTitle) {
        canonicalEvtId = normTitle;
      }

      const safeDocId = `${cleanReg}_${canonicalEvtId}`.replace(/\//g, '_');
      sc.id = safeDocId;

      const key = `${cleanReg}___${canonicalEvtId}`;
      const existing = canonicalMap.get(key);

      if (!existing) {
        canonicalMap.set(key, { ...sc });
      } else {
        // Direct overwrite to allow lowering scores via Excel upload
        canonicalMap.set(key, { ...existing, ...sc });
      }
    });

    const deduped = Array.from(canonicalMap.values());
    // FIX: When changedOnly=[], don't save anything. Only save if undefined (use deduped)
    const toWrite = typeof changedOnly !== 'undefined' ? changedOnly : deduped;

    const results = await Promise.all(toWrite.map(sc => dbSaveScore(sc)));
    const failed = results.filter(r => !r.ok);
    if (failed.length) {
      console.warn('Some scores failed to save:', failed);
      throw new Error(`Failed to save ${failed.length} scores. Check logs.`);
    }

    setScores(deduped);
    try {
      localStorage.setItem('gcu_scores_cache', JSON.stringify(deduped));
    } catch (e) {}
  };

  const saveNotifications = (newNotifs: Notification[]) => {
    setNotifications(newNotifs);
    newNotifs.forEach(n => dbSaveNotification(n));
  };

  const saveMessages = (newMsgs: MessageToCoordinator[]) => {
    setMessages(newMsgs);
    newMsgs.forEach(m => dbSaveMessage(m));
  };

  // Convenor: Approve or Reject faculty coordinator
  const handleApproveCoordinator = async (facultyId: string, approve: boolean) => {
    if (approve) {
      const target = facultyCoordinators.find(c => c.facultyId === facultyId);
      if (target) {
        const updated = { ...target, isApproved: true };
        await dbSaveCoordinator(updated);
        setFacultyCoordinators(prev => prev.map(c => c.facultyId === facultyId ? updated : c));
      }
    } else {
      await dbDeleteCoordinator(facultyId);
      setFacultyCoordinators(prev => prev.filter(c => c.facultyId !== facultyId));
    }
  };

  // Convenor: Delete Faculty Coordinator Account
  const handleDeleteCoordinator = async (facultyId: string) => {
    try {
      await dbDeleteCoordinator(facultyId);
      setFacultyCoordinators(prev => prev.filter(c => c.facultyId !== facultyId));
      if (activeFaculty && activeFaculty.facultyId === facultyId) {
        setActiveFaculty(null);
        localStorage.removeItem('fresherism_active_faculty_id');
      }
    } catch (err) {
      console.error('Error deleting coordinator:', err);
    }
  };

  // Convenor: Delete Student Account Data
  const handleDeleteStudent = async (registerNo: string) => {
    try {
      await dbDeleteStudent(registerNo);
      setStudents(prev => prev.filter(s => s.registerNo !== registerNo));
    } catch (err) {
      console.error('Error deleting student:', err);
    }
  };

  // Coordinator: Register new faculty coordinator or update profile
  const handleRegisterCoordinator = (newCoord: FacultyCoordinator, oldFacultyId?: string) => {
    const coordToSave: FacultyCoordinator = {
      ...newCoord,
      isProfileComplete: Boolean(newCoord.isProfileComplete || (newCoord.mobile && newCoord.mobile.trim().length >= 8))
    };

    if (oldFacultyId && oldFacultyId !== coordToSave.facultyId) {
      dbDeleteCoordinator(oldFacultyId).catch(err => console.error('Error deleting old coordinator:', err));
    }
    dbSaveCoordinator(coordToSave).catch(err => console.error('Error saving coordinator:', err));

    // Update activeFaculty if current session matches
    if (
      !activeFaculty ||
      activeFaculty.facultyId === oldFacultyId ||
      activeFaculty.facultyId === coordToSave.facultyId ||
      (activeFaculty.email && coordToSave.email && activeFaculty.email.toLowerCase() === coordToSave.email.toLowerCase())
    ) {
      setActiveFaculty(coordToSave);
      setActiveStudent(null);
      localStorage.setItem('fresherism_active_faculty_id', coordToSave.facultyId);
      localStorage.removeItem('fresherism_active_student_id');
    }

    // Update facultyCoordinators in state
    setFacultyCoordinators(prev => {
      const filtered = prev.filter(f => 
        f.facultyId !== oldFacultyId && 
        f.facultyId !== coordToSave.facultyId && 
        (!f.email || !coordToSave.email || f.email.toLowerCase() !== coordToSave.email.toLowerCase())
      );
      return [...filtered, coordToSave];
    });

    // Cascade new email, mobile, facultyId, name, department to events assigned to this faculty coordinator
    const updatedEvents = events.map(evt => {
      const isMatch = (evt.coordinatorEmail && coordToSave.email && isMatchingEmail(evt.coordinatorEmail, coordToSave.email)) ||
                      (evt.coordinatorFacultyId && (evt.coordinatorFacultyId === oldFacultyId || evt.coordinatorFacultyId === coordToSave.facultyId)) ||
                      (evt.coordinatorName && coordToSave.name && (evt.coordinatorName.toLowerCase().trim().includes(coordToSave.name.toLowerCase().trim()) || coordToSave.name.toLowerCase().trim().includes(evt.coordinatorName.toLowerCase().trim())));
      if (isMatch) {
        const updatedEvt = {
          ...evt,
          coordinatorEmail: coordToSave.email || evt.coordinatorEmail,
          coordinatorName: coordToSave.name || evt.coordinatorName,
          coordinatorMobile: coordToSave.mobile || evt.coordinatorMobile,
          coordinatorFacultyId: coordToSave.facultyId || evt.coordinatorFacultyId,
          hostDepartment: coordToSave.department || evt.hostDepartment
        };
        dbSaveEvent(updatedEvt).catch(e => console.error('Error syncing event coordinator info:', e));
        return updatedEvt;
      }
      return evt;
    });
    setEvents(updatedEvents);
  };

  // Convenor: Update an event completely or partially
  const handleUpdateEvent = (updatedEvent: Event) => {
    // 1. Update React local state & Firestore DB for events
    const updatedEvents = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
    setEvents(updatedEvents);
    dbSaveEvent(updatedEvent).catch(err => console.error('Error saving updated event:', err));

    // 2. Sync with facultyCoordinators directory so auto-reconcile doesn't revert coordinator name
    if (updatedEvent.coordinatorName && (updatedEvent.coordinatorEmail || updatedEvent.coordinatorFacultyId)) {
      const cleanEmail = (updatedEvent.coordinatorEmail || '').toLowerCase().trim();
      const cleanFacId = (updatedEvent.coordinatorFacultyId || '').toLowerCase().trim();

      setFacultyCoordinators(prevCoords => {
        const existingCoord = prevCoords.find(c => 
          (cleanEmail && c.email.toLowerCase().trim() === cleanEmail) ||
          (cleanFacId && c.facultyId.toLowerCase().trim() === cleanFacId)
        );

        if (existingCoord) {
          const updatedCoord: FacultyCoordinator = {
            ...existingCoord,
            name: updatedEvent.coordinatorName || existingCoord.name,
            email: updatedEvent.coordinatorEmail || existingCoord.email,
            mobile: updatedEvent.coordinatorMobile || existingCoord.mobile,
            facultyId: updatedEvent.coordinatorFacultyId || existingCoord.facultyId,
            department: updatedEvent.hostDepartment || existingCoord.department,
            isApproved: true
          };
          dbSaveCoordinator(updatedCoord).catch(err => console.error('Error updating faculty coord:', err));
          return prevCoords.map(c => c.facultyId === existingCoord.facultyId ? updatedCoord : c);
        } else {
          const newCoord: FacultyCoordinator = {
            facultyId: updatedEvent.coordinatorFacultyId || `FAC-${Date.now().toString().slice(-4)}`,
            name: updatedEvent.coordinatorName,
            email: updatedEvent.coordinatorEmail || '',
            mobile: updatedEvent.coordinatorMobile || '',
            department: updatedEvent.hostDepartment || 'General',
            isApproved: true,
            createdAt: new Date().toISOString(),
            isProfileComplete: true
          };
          dbSaveCoordinator(newCoord).catch(err => console.error('Error saving new faculty coord:', err));
          return [...prevCoords, newCoord];
        }
      });
    }
  };

  // Convenor: Delete an event
  const handleDeleteEvent = (eventId: string) => {
    dbDeleteEvent(eventId);
    const scoresToDelete = scores.filter(s => s.eventId === eventId);
    scoresToDelete.forEach(s => {
      if (s.id) dbDeleteScore(s.id).catch(() => {});
    });
    const updatedScores = scores.filter(s => s.eventId !== eventId);
    setScores(updatedScores);
    try {
      localStorage.setItem('gcu_scores_cache', JSON.stringify(updatedScores));
    } catch (e) {}

    const updatedStudents = students.map(s => ({
      ...s,
      registeredEventIds: s.registeredEventIds.filter(id => id !== eventId)
    }));
    const changedStudents = updatedStudents.filter(s => s.registeredEventIds.length !== students.find(orig => orig.registerNo === s.registerNo)?.registeredEventIds.length);
    saveStudents(updatedStudents, changedStudents);
  };

  // Convenor: Clear all events at once
  const handleClearAllEvents = async () => {
    await dbClearAllEvents();
    setEvents([]);
  };

  // Convenor: Clear broadcast alerts feed
  const handleClearAllNotifications = () => {
    const nowIso = new Date().toISOString();
    localStorage.setItem('gcu_cleared_notifs_time', nowIso);
    localStorage.setItem('gcu_cleared_msgs_time', nowIso);
    setNotifications([]);
    setMessages([]);
    dbClearAllNotifications();
    dbClearAllMessages();
  };

  // Register fresh new student or update profile
  const handleRegisterStudent = (newStudent: Student) => {
    const existingMatch = findStudentMatch(students, {
      registerNo: newStudent.registerNo,
      email: newStudent.email,
      uid: newStudent.uid
    });
    const existingIndex = existingMatch ? students.indexOf(existingMatch) : -1;

    let updatedStudents: Student[];
    if (existingIndex >= 0) {
      const oldStudent = students[existingIndex];
      
      const mergedStudent: Student = {
        ...oldStudent,
        ...newStudent,
        name: newStudent.name || oldStudent.name,
        email: newStudent.email || oldStudent.email,
        uid: newStudent.uid || oldStudent.uid || '',
        mobile: newStudent.mobile || oldStudent.mobile || '',
        registerNo: newStudent.registerNo || oldStudent.registerNo,
        school: newStudent.school || oldStudent.school || 'Garden City University',
        department: newStudent.department || oldStudent.department || '',
        programName: newStudent.programName || oldStudent.programName || '',
        externalCollegeName: newStudent.externalCollegeName || oldStudent.externalCollegeName || '',
        isProfileComplete: newStudent.isProfileComplete || oldStudent.isProfileComplete || false,
        registeredEventIds: Array.from(new Set([...(oldStudent.registeredEventIds || []), ...(newStudent.registeredEventIds || [])]))
      };

      // Clean up old temporary document ID in Firestore if registerNo changed (e.g., from GCU-1234 to 231102001)
      if (oldStudent.registerNo && oldStudent.registerNo !== mergedStudent.registerNo) {
        dbDeleteStudent(oldStudent.registerNo).catch(err => console.error('Error cleaning up old student doc:', err));
      }

      updatedStudents = [...students];
      updatedStudents[existingIndex] = mergedStudent;
      dbSaveStudent(mergedStudent).then(res => {
        if (!res.ok) console.error('Error saving merged student:', res.reason);
      });
      setStudents(updatedStudents);
      setActiveStudent(mergedStudent);
      if (mergedStudent.registerNo) {
        localStorage.setItem('fresherism_active_student_id', mergedStudent.registerNo);
      }
    } else {
      updatedStudents = [...students, newStudent];
      dbSaveStudent(newStudent).then(res => {
        if (!res.ok) console.error('Error saving new student:', res.reason);
      });
      setStudents(updatedStudents);
      setActiveStudent(newStudent);
      if (newStudent.registerNo) {
        localStorage.setItem('fresherism_active_student_id', newStudent.registerNo);
      }
    }
  };

  // Save student from profile modal
  const handleSaveStudentProfile = (updatedStudent: Student) => {
    handleRegisterStudent(updatedStudent);
  };

  // Save faculty from profile modal
  const handleSaveFacultyProfile = (updatedFaculty: FacultyCoordinator) => {
    handleRegisterCoordinator(updatedFaculty, activeFaculty?.facultyId);
  };

  // Select active student session
  const handleSelectStudent = (student: Student | null) => {
    setActiveStudent(student);
    if (student) {
      setActiveFaculty(null);
      localStorage.setItem('fresherism_active_student_id', student.registerNo);
      localStorage.removeItem('fresherism_active_faculty_id');
    } else {
      localStorage.removeItem('fresherism_active_student_id');
    }
  };

  // Select active faculty session
  const handleSelectFaculty = (faculty: FacultyCoordinator | null) => {
    setActiveFaculty(faculty);
    if (faculty) {
      setActiveStudent(null);
      localStorage.setItem('fresherism_active_faculty_id', faculty.facultyId);
      localStorage.removeItem('fresherism_active_student_id');
    } else {
      localStorage.removeItem('fresherism_active_faculty_id');
    }
  };

  // Clear student session
  const handleLogoutStudent = () => {
    logoutStudentAuth();
    setActiveStudent(null);
    localStorage.removeItem('fresherism_active_student_id');
    setActiveRole('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Clear faculty session
  const handleLogoutFaculty = () => {
    setActiveFaculty(null);
    localStorage.removeItem('fresherism_active_faculty_id');
    setActiveRole('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Join or leave event dynamically
  // Register for event
  const handleRegisterForEvent = async (studentRegNo: string, eventId: string) => {
    try {
      const normTarget = studentRegNo ? studentRegNo.trim().toLowerCase() : '';
      const currentStudent = students.find(s =>
        (s.id && activeStudent?.id && s.id === activeStudent.id) ||
        (s.uid && activeStudent?.uid && s.uid === activeStudent.uid) ||
        (s.registerNo && activeStudent?.registerNo && normalizeRegisterNo(s.registerNo) === normalizeRegisterNo(activeStudent.registerNo)) ||
        (s.email && activeStudent?.email && s.email.trim().toLowerCase() === activeStudent.email.trim().toLowerCase()) ||
        (s.registerNo && normTarget && s.registerNo.trim().toLowerCase() === normTarget) ||
        (s.email && normTarget && s.email.trim().toLowerCase() === normTarget) ||
        (s.uid && studentRegNo && s.uid.trim() === studentRegNo.trim())
      ) || (activeStudent ? { ...activeStudent } : undefined);

      if (!currentStudent) {
        console.warn('Student not found for registration:', studentRegNo);
        throw new Error('Your profile is still loading. Please wait a moment and try again.');
      }

      const regIdentifier = (currentStudent.registerNo || currentStudent.email || currentStudent.uid || '').trim().toUpperCase();
      const currentRegs = currentStudent.registeredEventIds || [];
      const isAlreadyRegistered = currentRegs.includes(eventId);

      if (isAlreadyRegistered) {
        console.warn('Student already registered for this event');
        return;
      }

      // Create new score record
      const event = events.find(e => e.id === eventId);
      const newScore: Score = {
        id: `${regIdentifier}_${eventId}`.replace(/\//g, '_'),
        studentRegisterNo: regIdentifier,
        studentName: currentStudent.name || regIdentifier,
        eventId: eventId,
        eventTitle: event ? event.title : 'Event',
        registrationPoints: 5,
        participated: false,
        participationPoints: 0,
        eventScore: 0,
        totalScore: 5,
        isWinner: false,
        scoreEntered: false,
        basePoints: 5,
        performanceScore: 0
      };

      await saveScores([...scores, newScore], [newScore]);

      // Atomic registration write to Firestore using arrayUnion
      await dbAddEventRegistration(currentStudent, eventId);

      // Local React state update
      const newRegs = Array.from(new Set([...currentRegs, eventId]));
      const updatedStudent = { ...currentStudent, registeredEventIds: newRegs };

      setActiveStudent(updatedStudent);
      setStudents(prev => {
        const exists = prev.some(s =>
          (s.uid && updatedStudent.uid && s.uid === updatedStudent.uid) ||
          (s.registerNo && updatedStudent.registerNo && s.registerNo === updatedStudent.registerNo) ||
          (s.email && updatedStudent.email && s.email === updatedStudent.email)
        );
        if (exists) {
          return prev.map(s =>
            (s.uid && updatedStudent.uid && s.uid === updatedStudent.uid) ||
            (s.registerNo && updatedStudent.registerNo && s.registerNo === updatedStudent.registerNo) ||
            (s.email && updatedStudent.email && s.email === updatedStudent.email)
              ? updatedStudent
              : s
          );
        }
        return [...prev, updatedStudent];
      });
    } catch (err) {
      console.error('Error registering for event:', err);
      throw err;
    }
  };

  // Unregister from event
  const handleUnregisterFromEvent = async (studentRegNo: string, eventId: string) => {
    try {
      const normTarget = studentRegNo ? studentRegNo.trim().toLowerCase() : '';
      const currentStudent = students.find(s =>
        (s.id && activeStudent?.id && s.id === activeStudent.id) ||
        (s.uid && activeStudent?.uid && s.uid === activeStudent.uid) ||
        (s.registerNo && activeStudent?.registerNo && normalizeRegisterNo(s.registerNo) === normalizeRegisterNo(activeStudent.registerNo)) ||
        (s.email && activeStudent?.email && s.email.trim().toLowerCase() === activeStudent.email.trim().toLowerCase()) ||
        (s.registerNo && normTarget && s.registerNo.trim().toLowerCase() === normTarget) ||
        (s.email && normTarget && s.email.trim().toLowerCase() === normTarget) ||
        (s.uid && studentRegNo && s.uid.trim() === studentRegNo.trim())
      ) || (activeStudent ? { ...activeStudent } : undefined);

      if (!currentStudent) {
        console.warn('Student not found for unregistration:', studentRegNo);
        throw new Error('Your profile is still loading. Please wait a moment and try again.');
      }

      const currentRegs = currentStudent.registeredEventIds || [];
      const isRegistered = currentRegs.includes(eventId);

      if (!isRegistered) {
        console.warn('Student not registered for this event');
        return;
      }

      // Check if score is graded before allowing deletion
      const studentRegLower = (currentStudent.registerNo || '').trim().toLowerCase();
      const studentEmailLower = (currentStudent.email || '').trim().toLowerCase();
      const studentUid = currentStudent.uid || '';

      const scoresToDelete = scores.filter(s => (
        s.studentRegisterNo &&
        ((studentRegLower && s.studentRegisterNo.trim().toLowerCase() === studentRegLower) ||
         (studentEmailLower && s.studentRegisterNo.trim().toLowerCase() === studentEmailLower) ||
         (studentUid && s.studentRegisterNo.trim() === studentUid)) &&
        s.eventId === eventId
      ));

      // Refuse to delete graded scores
      for (const score of scoresToDelete) {
        if (score.scoreEntered === true) {
          throw new Error('Cannot unregister from event with graded scores. Contact coordinator.');
        }
      }

      // Delete ungraded scores
      scoresToDelete.forEach(s => {
        if (s.id) dbDeleteScore(s.id).catch(() => {});
      });

      const updatedScores = scores.filter(s => !scoresToDelete.includes(s));
      setScores(updatedScores);
      try {
        localStorage.setItem('gcu_scores_cache', JSON.stringify(updatedScores));
      } catch (e) {}

      // Atomic unregistration write to Firestore
      await dbRemoveEventRegistration(currentStudent, eventId);

      // Local React state update
      const updatedEventIds = currentRegs.filter(id => id !== eventId);
      const updatedStudent = { ...currentStudent, registeredEventIds: updatedEventIds };

      setActiveStudent(updatedStudent);
      setStudents(prev => prev.map(s =>
        (s.uid && updatedStudent.uid && s.uid === updatedStudent.uid) ||
        (s.registerNo && updatedStudent.registerNo && s.registerNo === updatedStudent.registerNo) ||
        (s.email && updatedStudent.email && s.email === updatedStudent.email)
          ? updatedStudent
          : s
      ));
    } catch (err) {
      console.error('Error unregistering from event:', err);
      throw err;
    }
  };

  // Verify student email address
  const handleVerifyStudentEmail = (studentRegNo: string) => {
    const updatedStudents = students.map(s => {
      if (s.registerNo === studentRegNo) {
        const next: Student = {
          ...s,
          isEmailVerified: true
        };
        if (activeStudent && activeStudent.registerNo === studentRegNo) {
          setActiveStudent(next);
        }
        return next;
      }
      return s;
    });
    saveStudents(updatedStudents, [updatedStudents.find(s => s.registerNo === studentRegNo)!]);
  };

  // Create Event manually
  const handleAddEvent = (newEvent: Event) => {
    saveEvents([...events, newEvent]);

    if (newEvent.coordinatorName && (newEvent.coordinatorEmail || newEvent.coordinatorFacultyId)) {
      const cleanEmail = (newEvent.coordinatorEmail || '').toLowerCase().trim();
      const cleanFacId = (newEvent.coordinatorFacultyId || '').toLowerCase().trim();

      setFacultyCoordinators(prevCoords => {
        const existingCoord = prevCoords.find(c => 
          (cleanEmail && c.email.toLowerCase().trim() === cleanEmail) ||
          (cleanFacId && c.facultyId.toLowerCase().trim() === cleanFacId)
        );

        if (existingCoord) {
          const updatedCoord: FacultyCoordinator = {
            ...existingCoord,
            name: newEvent.coordinatorName || existingCoord.name,
            email: newEvent.coordinatorEmail || existingCoord.email,
            mobile: newEvent.coordinatorMobile || existingCoord.mobile,
            facultyId: newEvent.coordinatorFacultyId || existingCoord.facultyId,
            department: newEvent.hostDepartment || existingCoord.department
          };
          dbSaveCoordinator(updatedCoord).catch(err => console.error('Error updating faculty coord:', err));
          return prevCoords.map(c => c.facultyId === existingCoord.facultyId ? updatedCoord : c);
        } else {
          const newCoord: FacultyCoordinator = {
            facultyId: newEvent.coordinatorFacultyId || `FAC-${Date.now().toString().slice(-4)}`,
            name: newEvent.coordinatorName,
            email: newEvent.coordinatorEmail || '',
            mobile: newEvent.coordinatorMobile || '',
            department: newEvent.hostDepartment || 'General',
            isApproved: true,
            createdAt: new Date().toISOString(),
            isProfileComplete: true
          };
          dbSaveCoordinator(newCoord).catch(err => console.error('Error saving new faculty coord:', err));
          return [...prevCoords, newCoord];
        }
      });
    }
  };

  // Bulk import/update events from Excel
  const handleAddBulkEvents = (bulkEvents: Omit<Event, 'id'>[]) => {
    const currentEventsList = [...events];

    bulkEvents.forEach((bEvt, index) => {
      const cleanTitle = bEvt.title.trim().toLowerCase();
      const existingIndex = currentEventsList.findIndex(
        e => e.title.trim().toLowerCase() === cleanTitle
      );

      if (existingIndex !== -1) {
        // Update existing event details in place while keeping ID and existing metadata
        const updatedEvt: Event = {
          ...currentEventsList[existingIndex],
          title: bEvt.title,
          description: bEvt.description || currentEventsList[existingIndex].description,
          rules: bEvt.rules || currentEventsList[existingIndex].rules,
          date: bEvt.date || currentEventsList[existingIndex].date,
          timeStart: bEvt.timeStart || currentEventsList[existingIndex].timeStart,
          timeEnd: bEvt.timeEnd || currentEventsList[existingIndex].timeEnd,
          venue: bEvt.venue || currentEventsList[existingIndex].venue,
          hostDepartment: bEvt.hostDepartment || currentEventsList[existingIndex].hostDepartment,
          coordinatorFacultyId: bEvt.coordinatorFacultyId || currentEventsList[existingIndex].coordinatorFacultyId,
          coordinatorName: bEvt.coordinatorName || currentEventsList[existingIndex].coordinatorName,
          coordinatorMobile: bEvt.coordinatorMobile || currentEventsList[existingIndex].coordinatorMobile,
          coordinatorEmail: bEvt.coordinatorEmail || currentEventsList[existingIndex].coordinatorEmail,
          studentCoordinatorName: bEvt.studentCoordinatorName || currentEventsList[existingIndex].studentCoordinatorName,
        };
        currentEventsList[existingIndex] = updatedEvt;
        dbSaveEvent(updatedEvt).catch(e => console.error('Bulk update error:', e));
      } else {
        const newEvt: Event = {
          ...bEvt,
          id: `evt-bulk-${Date.now()}-${index}`
        };
        currentEventsList.push(newEvt);
        dbSaveEvent(newEvt).catch(e => console.error('Bulk insert error:', e));
      }
    });

    setEvents(currentEventsList);
  };

  // Dispatch message
  const handleSendMessageToCoordinator = (msg: MessageToCoordinator) => {
    saveMessages([...messages, msg]);
  };

  // Notification
  const handleAddNotification = (notif: Notification) => {
    saveNotifications([notif, ...notifications]);
  };

  // Reschedule event
  const handleUpdateEventSchedule = (eventId: string, date: string, timeStart: string, timeEnd: string, venue: string) => {
    const updatedEvents = events.map(evt => {
      if (evt.id === eventId) {
        return {
          ...evt,
          date,
          timeStart,
          timeEnd,
          venue
        };
      }
      return evt;
    });
    saveEvents(updatedEvents);
  };

  // Update scores
  const handleUpdateScores = async (updatedScores: Score[], changedOnly?: Score[]) => {
    await saveScores(updatedScores, changedOnly);
  };

  // Handle role transition from Landing Page
  const handleSelectRoleAndOccasion = (role: UserRole, occasionId: string, eventId?: string) => {
    setActiveRole(role);
    setSelectedOccasionIdNav(occasionId);
    if (eventId) setSelectedEventIdNav(eventId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Theme Background & Text Classes
  const getThemeBgClass = () => {
    switch (currentTheme) {
      case 'sunny-light':
        return 'bg-[#F1F5F9] text-slate-900';
      case 'emerald-gold':
        return 'bg-gradient-to-br from-[#042F2E] via-[#064E3B] to-[#047857] text-white';
      case 'ocean-coral':
        return 'bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0284C7] text-white';
      case 'gcu':
        return 'bg-gradient-to-br from-[#2D0A12] via-[#4A0E17] to-[#1F070C] text-white';
      case 'midnight-gold':
        return 'bg-gradient-to-br from-[#09090B] via-[#18181B] to-[#27272A] text-white';
      case 'vibrant-royal':
      default:
        return 'bg-gradient-to-br from-[#21023B] via-[#350A5E] to-[#4F007A] text-white';
    }
  };

  const getHeaderBgClass = () => {
    switch (currentTheme) {
      case 'sunny-light':
        return 'bg-slate-900 text-white border-b-2 border-slate-700 shadow-xl';
      case 'emerald-gold':
        return 'bg-[#064E3B]/95 text-white border-b border-emerald-400/20';
      case 'ocean-coral':
        return 'bg-[#0F172A]/95 text-white border-b border-cyan-400/20';
      case 'gcu':
        return 'bg-[#3B0E17]/95 text-white border-b border-orange-500/30 shadow-lg';
      case 'midnight-gold':
        return 'bg-[#18181B]/95 text-amber-300 border-b border-amber-500/30';
      case 'vibrant-royal':
      default:
        return 'bg-[#1E0438]/95 text-white border-b border-white/10';
    }
  };

  const getLayoutWidthClass = () => {
    switch (layoutDensity) {
      case 'compact':
        return 'max-w-5xl mx-auto px-3 py-4';
      case 'fullwidth':
        return 'w-full px-3 sm:px-8 py-6';
      case 'standard':
      default:
        return 'max-w-7xl mx-auto px-4 py-6';
    }
  };

  // Mandatory Profile Check
  const isProfileIncomplete = Boolean(
    (activeFaculty && (!activeFaculty.isProfileComplete || !activeFaculty.mobile || !activeFaculty.mobile.trim())) ||
    (!activeFaculty && activeStudent && (!activeStudent.isProfileComplete || !activeStudent.mobile || !activeStudent.registerNo || (!activeStudent.programName && !activeStudent.school?.toLowerCase().includes('external'))))
  );

  return (
    <div className={`min-h-screen ${getThemeBgClass()} flex flex-col font-sans select-none antialiased relative overflow-x-hidden transition-colors duration-500`}>
      
      {/* FLOATING NOTIFICATION ICON & NON-INTRUSIVE PANEL */}
      <FloatingNotificationIcon
        notifications={notifications}
        activeStudent={activeStudent}
        activeFaculty={activeFaculty}
        activeRole={activeRole}
        onClearNotifications={handleClearAllNotifications}
        onOpenEvent={(eventId) => {
          if (activeStudent && activeStudent.isProfileComplete) {
            setActiveRole('student');
            setSelectedEventIdNav(eventId);
            handleRegisterForEvent(activeStudent.registerNo, eventId).catch(console.warn);
          } else {
            handleRequireStudentSignIn(eventId);
          }
        }}
      />
      
      {/* GLOWING AMBIENT BACKGROUNDS */}
      {currentTheme !== 'sunny-light' && (
        <>
          <div className="absolute top-[-50px] right-[-50px] w-96 h-96 bg-[#FF007A] rounded-full blur-[120px] opacity-35 pointer-events-none" />
          <div className="absolute bottom-[-100px] left-[-50px] w-[500px] h-[500px] bg-[#00D1FF] rounded-full blur-[150px] opacity-20 pointer-events-none" />
        </>
      )}

      {/* 1. STICKY HEADER WITH TOP UTILITY BAR & CENTERED TITLE */}
      <header className={`sticky top-0 ${getHeaderBgClass()} backdrop-blur-md z-20 py-2.5 px-4 shadow-xl border-b border-white/10`}>
        <div className={`${getLayoutWidthClass()} flex flex-col items-center justify-center space-y-2`}>
          
          {/* Top Utility Row */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 text-xs">
            {/* Theme Options (No label) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => handleThemeChange('sunny-light')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 border ${
                  currentTheme === 'sunny-light'
                    ? 'bg-amber-400 text-slate-950 border-amber-300 ring-1 ring-amber-300 shadow-md font-extrabold'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/20'
                }`}
                title="Sunny Light Theme"
              >
                ☀️ <span>Light</span>
              </button>

              <button
                onClick={() => handleThemeChange('vibrant-royal')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 border ${
                  currentTheme === 'vibrant-royal'
                    ? 'bg-purple-600 text-white border-pink-400 ring-1 ring-pink-400 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/20'
                }`}
                title="Vibrant Royal Theme"
              >
                👑 <span>Royal</span>
              </button>

              <button
                onClick={() => handleThemeChange('emerald-gold')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 border ${
                  currentTheme === 'emerald-gold'
                    ? 'bg-emerald-600 text-amber-300 border-emerald-300 ring-1 ring-emerald-400 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/20'
                }`}
                title="Emerald Velvet Theme"
              >
                🌲 <span>Emerald</span>
              </button>

              <button
                onClick={() => handleThemeChange('ocean-coral')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 border ${
                  currentTheme === 'ocean-coral'
                    ? 'bg-sky-600 text-cyan-100 border-cyan-300 ring-1 ring-cyan-400 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/20'
                }`}
                title="Ocean Coral Theme"
              >
                🌊 <span>Ocean</span>
              </button>

              <button
                onClick={() => handleThemeChange('gcu')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 border ${
                  currentTheme === 'gcu'
                    ? 'bg-rose-800 text-amber-300 border-amber-400 ring-1 ring-amber-400 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/20'
                }`}
                title="GCU Crimson Theme"
              >
                🏛️ <span>GCU</span>
              </button>

              <button
                onClick={() => handleThemeChange('midnight-gold')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 border ${
                  currentTheme === 'midnight-gold'
                    ? 'bg-zinc-800 text-amber-300 border-amber-400 ring-1 ring-amber-400 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/20'
                }`}
                title="Luxury Obsidian Theme"
              >
                ✨ <span>Obsidian</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap ml-auto">
              <button
                onClick={() => {
                  setActiveRole('landing');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-3 py-1 bg-gradient-to-r from-[#FF007A] to-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-md hover:opacity-90 transition-all flex items-center gap-1.5 border border-white/20 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-amber-300" />
                <span>Festivals HQ</span>
              </button>

              {/* Active User Indicators */}
              {activeStudent && (
                <div className="px-2.5 py-1 bg-black/40 border border-white/20 text-xs font-bold text-cyan-300 rounded-lg flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-[#FF007A]" />
                  <span className="truncate max-w-[120px]">{activeStudent.name}</span>
                  <button onClick={handleLogoutStudent} className="text-rose-400 hover:underline text-[10px] ml-1">✕</button>
                </div>
              )}

              {activeFaculty && (
                <div className="px-2.5 py-1 bg-black/40 border border-cyan-400/40 text-xs font-bold text-cyan-300 rounded-lg flex items-center gap-1.5">
                  <UserCog className="w-3.5 h-3.5 text-[#00D1FF]" />
                  <span className="truncate max-w-[120px]">{activeFaculty.name}</span>
                  <button onClick={handleLogoutFaculty} className="text-rose-400 hover:underline text-[10px] ml-1">✕</button>
                </div>
              )}

              <button
                onClick={() => setShowQRModal(true)}
                className="px-2.5 py-1 bg-black/40 hover:bg-black/60 text-white font-bold text-xs rounded-lg border border-white/20 transition-all cursor-pointer flex items-center gap-1.5"
                title="View & Scan App QR Code"
              >
                📱 <span>App QR</span>
              </button>
            </div>
          </div>

          {/* Centered Main Title with Brand Logo */}
          <div 
            className="flex items-center justify-center gap-3 sm:gap-4 text-center cursor-pointer group py-1" 
            onClick={() => { setActiveRole('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            <img 
              src="/gculogo.svg" 
              alt="Garden City University Logo" 
              className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform shrink-0" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.endsWith('.svg')) {
                  target.src = '/gculogo.png';
                } else if (target.src.endsWith('.png')) {
                  target.src = '/gculogo.webp';
                }
              }}
            />
            <div className="flex flex-col items-center text-center">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-[0.18em] sm:tracking-[0.25em] uppercase font-serif leading-tight">
                GARDEN CITY UNIVERSITY
              </h1>
              <p className="text-xs sm:text-sm md:text-base font-black text-orange-500 tracking-[0.22em] sm:tracking-[0.3em] uppercase font-serif animate-flicker mt-0.5">
                EMPHASIS ON LIFE
              </p>
            </div>
          </div>

        </div>
      </header>

      {/* 2. DYNAMIC BODY PORTALS */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 relative">
        
        {/* PAGE 1: LANDING PAGE PORTAL */}
        {activeRole === 'landing' && (
          <LandingPagePortal 
            occasions={occasions}
            activeOccasionId={activeOccasionId}
            events={events}
            students={students}
            scores={scores}
            facultyCoordinators={facultyCoordinators}
            activeStudent={activeStudent}
            activeFaculty={activeFaculty}
            onSelectStudent={handleSelectStudent}
            onSelectFaculty={handleSelectFaculty}
            onRegisterStudent={handleRegisterStudent}
            onRegisterFaculty={(f) => {
              dbSaveCoordinator(f);
              setActiveFaculty(f);
            }}
            onSelectRoleAndOccasion={handleSelectRoleAndOccasion}
            onOpenSuperAdmin={() => {
              setActiveRole('superadmin');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            theme={currentTheme}
            autoFocusStudentSignIn={autoFocusStudentSignIn}
            onClearAutoFocusStudentSignIn={() => setAutoFocusStudentSignIn(false)}
          />
        )}

        {/* STUDENT DASHBOARD */}
        {activeRole === 'student' && (
          <StudentDashboard
            students={students}
            events={events}
            scores={scores}
            notifications={notifications}
            activeStudent={activeStudent}
            activeOccasion={activeOccasionObj}
            occasions={occasions}
            onShowFreshathon={() => setShowFreshathonModal(true)}
            onRegisterStudent={handleRegisterStudent}
            onSelectStudent={handleSelectStudent}
            onToggleEventRegistration={handleRegisterForEvent}
            onVerifyStudentEmail={handleVerifyStudentEmail}
            onGoToLanding={() => {
              setActiveRole('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* CONVENOR DASHBOARD */}
        {activeRole === 'convenor' && (
          <ConvenorDashboard 
            events={events}
            students={students}
            scores={scores}
            messages={messages}
            notifications={notifications}
            facultyCoordinators={facultyCoordinators}
            convenorEmail={activeFaculty?.email || activeOccasionObj.convenorEmail || 'kushal.bs@gcu.edu.in'}
            occasions={occasions}
            activeOccasion={activeOccasionObj}
            onSelectOccasion={handleSelectActiveOccasion}
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onClearAllEvents={handleClearAllEvents}
            onAddBulkEvents={handleAddBulkEvents}
            onSendMessageToCoordinator={handleSendMessageToCoordinator}
            onAddNotification={handleAddNotification}
            onClearNotifications={handleClearAllNotifications}
            onApproveCoordinator={handleApproveCoordinator}
            onDeleteCoordinator={handleDeleteCoordinator}
            onDeleteStudent={handleDeleteStudent}
            onRegisterCoordinator={handleRegisterCoordinator}
            onGoToLanding={() => {
              setActiveRole('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* EVENT COORDINATOR DASHBOARD */}
        {activeRole === 'coordinator' && (
          <CoordinatorDashboard 
            initialEventId={selectedEventIdNav}
            events={events}
            students={students}
            scores={scores}
            notifications={notifications}
            messages={messages}
            facultyCoordinators={facultyCoordinators}
            activeOccasion={activeOccasionObj}
            activeFaculty={activeFaculty || undefined}
            onRegisterCoordinator={handleRegisterCoordinator}
            onRegisterStudent={handleSaveStudent}
            onUpdateStudents={saveStudents}
            onAddNotification={handleAddNotification}
            onUpdateEventSchedule={handleUpdateEventSchedule}
            onUpdateEvent={handleUpdateEvent}
            onUpdateScores={handleUpdateScores}
            onGoToLanding={() => {
              setActiveRole('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* SUPER ADMIN PORTAL PAGE */}
        {activeRole === 'superadmin' && (
          !isSuperAdminAuth ? (
            <div className="max-w-md mx-auto bg-[#1A032E] border-2 border-amber-500 rounded-3xl p-8 shadow-2xl relative overflow-hidden my-12 text-center space-y-6">
              <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-400 inline-block">
                <ShieldCheck className="w-10 h-10" />
              </div>

              <div>
                <span className="bg-amber-500 text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider">
                  SUPER ADMIN SYSTEM ACCESS
                </span>
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tight mt-1">
                  Credentials Portal
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  Please enter authorized super administrator login credentials.
                </p>
              </div>

              {superAdminError && (
                <div className="p-3 bg-rose-950/80 border border-rose-500 text-rose-200 text-xs rounded-xl font-bold">
                  ⚠️ {superAdminError}
                </div>
              )}

              <form onSubmit={handleSuperAdminLogin} className="space-y-4 text-left">
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="admin"
                    value={superAdminUsername}
                    onChange={(e) => setSuperAdminUsername(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={superAdminPassword}
                    onChange={(e) => setSuperAdminPassword(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase py-3.5 px-4 rounded-xl shadow-xl transition-all cursor-pointer"
                >
                  Sign In to Super Admin Dashboard →
                </button>
              </form>
            </div>
          ) : (
            <SuperAdminDashboard
              occasions={occasions}
              activeOccasionId={activeOccasionId}
              onSelectActiveOccasion={handleSelectActiveOccasion}
              onSaveOccasion={handleSaveOccasion}
              onDeleteOccasion={handleDeleteOccasion}
              onSignOut={() => setIsSuperAdminAuth(false)}
              theme={currentTheme}
              onToggleTheme={() => handleThemeChange(currentTheme === 'sunny-light' ? 'vibrant-royal' : 'sunny-light')}
            />
          )
        )}

      </main>

      {/* 3. MANDATORY PROFILE COMPLETION MODAL */}
      <MandatoryProfileModal
        isOpen={isProfileIncomplete && activeRole !== 'landing'}
        student={activeFaculty ? null : activeStudent}
        faculty={activeFaculty}
        onSaveStudent={handleSaveStudentProfile}
        onSaveFaculty={handleSaveFacultyProfile}
      />

      {/* MANDATORY SEMESTER 1 SELF-DECLARATION / STATUS VERIFICATION FOR STUDENTS */}
      {activeStudent && !isProfileIncomplete && !activeStudent.sem1Declared && !activeStudent.isSeniorAcknowledged && (
        <Sem1SelfDeclarationModal
          student={activeStudent}
          onConfirmDeclaration={(updated) => {
            handleRegisterStudent(updated);
          }}
          onLogout={handleLogoutStudent}
        />
      )}

      {/* PWA INSTALL PROMPT */}
      <PWAInstallPrompt />

      {/* APP QR CODE MODAL */}
      <AppQRCodeModal 
        isOpen={showQRModal} 
        onClose={() => setShowQRModal(false)} 
        appUrl="https://gcu-eol.ai.studio" 
      />

      {/* URL SCANNED STUDENT QR VERIFICATION MODAL */}
      <FacultyStudentScannerModal
        isOpen={Boolean(scannedStudentIdFromUrl)}
        onClose={() => setScannedStudentIdFromUrl('')}
        students={students}
        events={events}
        initialRegisterNo={scannedStudentIdFromUrl}
      />

      {/* FRESHATHON SPRINTING TOWARDS GLORY 3D PROMO MODAL */}
      <FreshathonPromoModal
        isOpen={showFreshathonModal}
        onClose={handleCloseFreshathonModal}
        activeStudent={activeStudent}
        isLandingPage={activeRole === 'landing'}
        events={events}
        onRegisterForEvent={(eventId) => {
          if (activeStudent) {
            handleRegisterForEvent(activeStudent.registerNo, eventId);
          }
        }}
        onRequireSignIn={handleRequireStudentSignIn}
      />

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-[#1A032E]/30 py-6 text-center text-xs text-zinc-400 font-mono relative z-20">
        <p>© 2026 Garden City University - Emphasis On Life Students Activities Platform</p>
      </footer>

    </div>
  );
}