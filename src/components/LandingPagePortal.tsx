import React, { useState, useEffect, useMemo } from 'react';
import { Occasion, Student, FacultyCoordinator, Event, UserRole, Score, isMatchingEmail, isStudentEmailOrId, findStudentMatch } from '../types';
import { formatDateDDMMYYYY, formatDateRangeDDMMYYYY } from '../dateUtils';
import { 
  Sparkles, Calendar, ChevronLeft, ChevronRight, User, GraduationCap, 
  Building2, ShieldCheck, CheckCircle2, Lock, ArrowRight, Globe, AlertCircle, Phone, BookOpen, FileText, Mail
} from 'lucide-react';
import { signInWithGoogleAuth, signInWithMicrosoftAuth } from '../firebase';
import FresherismLogo from './FresherismLogo';
import Leaderboard from './Leaderboard';
import logo2Img from '../assets/logo2.png';
import { NccInfoModal } from './NccInfoModal';

const DEFAULT_GUEST_BIOS: Record<string, string> = {
  'Dr. N. C. Shivaprakash': `Dr. N. C. Shivaprakash is a distinguished Indian academician, eminent scientist, and former Professor at the prestigious Indian Institute of Science (IISc), Bangalore. With over three decades of pioneering research in Instrumentation, Applied Physics, and Sensor Technology, he has published over 150 international research papers and guided scores of Ph.D. scholars.

A passionate visionary in higher education policy, Dr. Shivaprakash has served on national advisory committees, university executive councils, and NBA/NAAC accreditation boards across India. He is widely recognized for mentoring youth, fostering innovation ecosystems, and inspiring thousands of young engineers and scientists.

As Chief Guest of Honor for Fresherism '26, Dr. Shivaprakash presides over the inaugurals to inspire the incoming cohort of Garden City University students to strive for academic brilliance, leadership, and holistic growth.`
};

interface LandingPagePortalProps {
  occasions: Occasion[];
  activeOccasionId?: string;
  events: Event[];
  students: Student[];
  scores: Score[];
  facultyCoordinators: FacultyCoordinator[];
  activeStudent: Student | null;
  activeFaculty: FacultyCoordinator | null;
  onSelectStudent: (student: Student) => void;
  onSelectFaculty: (faculty: FacultyCoordinator) => void;
  onRegisterStudent: (student: Student) => void;
  onRegisterFaculty: (faculty: FacultyCoordinator) => void;
  onSelectRoleAndOccasion: (role: UserRole, occasionId: string, eventId?: string) => void;
  onOpenSuperAdmin: () => void;
  theme: string;
  autoFocusStudentSignIn?: boolean;
  onClearAutoFocusStudentSignIn?: () => void;
}

export const LandingPagePortal: React.FC<LandingPagePortalProps> = ({
  occasions,
  activeOccasionId,
  events,
  students,
  scores,
  facultyCoordinators,
  activeStudent,
  activeFaculty,
  onSelectStudent,
  onSelectFaculty,
  onRegisterStudent,
  onRegisterFaculty,
  onSelectRoleAndOccasion,
  onOpenSuperAdmin,
  theme,
  autoFocusStudentSignIn,
  onClearAutoFocusStudentSignIn
}) => {
  // Carousel State
  const [currentOccasionIndex, setCurrentOccasionIndex] = useState(0);
  const [guestImgError, setGuestImgError] = useState(false);
  const [showNccModal, setShowNccModal] = useState(false);
  const roleChoicesRef = React.useRef<HTMLDivElement>(null);

  // Active occasions filtered by Super Admin (only show active ones)
  const visibleOccasions = useMemo(() => {
    const active = occasions.filter(o => o.id === activeOccasionId || o.isActive === true);
    return active.length > 0 ? active : (occasions.length > 0 ? [occasions[0]] : []);
  }, [occasions, activeOccasionId]);

  // Sync currentOccasionIndex with activeOccasionId & visibleOccasions
  useEffect(() => {
    if (activeOccasionId && visibleOccasions.length > 0) {
      const idx = visibleOccasions.findIndex(o => o.id === activeOccasionId);
      if (idx >= 0) {
        setCurrentOccasionIndex(idx);
      } else {
        setCurrentOccasionIndex(0);
      }
    }
  }, [activeOccasionId, visibleOccasions]);

  useEffect(() => {
    setGuestImgError(false);
  }, [currentOccasionIndex]);

  // Role Selection Steps
  const [primaryRole, setPrimaryRole] = useState<'none' | 'student' | 'faculty'>('none');
  const [studentType, setStudentType] = useState<'none' | 'internal' | 'external'>('none');
  const [facultySubRole, setFacultySubRole] = useState<'none' | 'convenor' | 'coordinator' | 'only_faculty'>('none');

  useEffect(() => {
    if (autoFocusStudentSignIn) {
      setPrimaryRole('student');
      setStudentType('none');
      if (roleChoicesRef.current) {
        roleChoicesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (onClearAutoFocusStudentSignIn) {
        onClearAutoFocusStudentSignIn();
      }
    }
  }, [autoFocusStudentSignIn]);

  // Selected Occasion & Event for Convenor / Coordinator
  const [selectedOccasionId, setSelectedOccasionId] = useState<string>(visibleOccasions[0]?.id || '');
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  useEffect(() => {
    if (visibleOccasions.length > 0 && !visibleOccasions.some(o => o.id === selectedOccasionId)) {
      setSelectedOccasionId(visibleOccasions[0].id);
    }
  }, [visibleOccasions]);

  // Auth Error / Success feedback
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Convenor Direct Passcode Login State
  const [convenorUsername, setConvenorUsername] = useState('');
  const [convenorPassword, setConvenorPassword] = useState('');
  const [showDirectConvenorLogin, setShowDirectConvenorLogin] = useState(false);

  const handleDirectConvenorAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanUser = convenorUsername.trim().toLowerCase();

    if (
      (cleanUser === 'convenor' || cleanUser === 'ashwini' || cleanUser === 'ashwini.s@gcu.edu.in' || cleanUser === 'convenor@gcu.edu.in') &&
      convenorPassword.trim() === 'India@2026'
    ) {
      const occ = visibleOccasions.find(o => o.id === selectedOccasionId) || visibleOccasions[0];
      const convenorFaculty: FacultyCoordinator = {
        facultyId: 'FAC-CONVENOR-HQ',
        name: occ?.convenorName || 'Prof. Ashwini. S (Convenor)',
        email: occ?.convenorEmail || 'ashwini.s@gcu.edu.in',
        mobile: '+91 98765 43210',
        department: 'Convenor HQ',
        school: 'Garden City University',
        isApproved: true,
        createdAt: new Date().toISOString(),
        isProfileComplete: true
      };

      onSelectFaculty(convenorFaculty);
      localStorage.setItem('fresherism_active_faculty_id', convenorFaculty.facultyId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onSelectRoleAndOccasion('convenor', occ.id);
    } else {
      setAuthError('Invalid Convenor Credentials. Please check your username and password.');
    }
  };

  const currentOccasion = visibleOccasions[currentOccasionIndex] || visibleOccasions[0] || {
    id: 'occ-default',
    title: 'Fresherism-26',
    eventDates: 'AUG 3 – 15, 2026',
    logoUrl: '/logo2.png',
    description: 'Annual Flagship Cultural & Technical Talent Fest',
    chiefGuestName: 'Dr. N. C. Shivaprakash',
    chiefGuestPhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    chiefGuestDescription: 'Former Professor, IISc Bangalore & Distinguished Academician',
    convenorName: 'Prof. Ashwini. S',
    convenorEmail: 'ashwini.s@gcu.edu.in',
    capLimit: 3,
    isOpenToExternal: true
  };

  const displayLogoUrl = (currentOccasion.logoUrl && currentOccasion.logoUrl.trim() && !currentOccasion.logoUrl.includes('photo-1540575467063') && !currentOccasion.logoUrl.includes('unsplash.com'))
    ? currentOccasion.logoUrl.trim()
    : logo2Img;

  const displayGuestName = (currentOccasion.chiefGuestName && currentOccasion.chiefGuestName.trim())
    ? currentOccasion.chiefGuestName.trim()
    : 'Dr. N. C. Shivaprakash';

  const displayGuestDesc = (currentOccasion.chiefGuestDescription && currentOccasion.chiefGuestDescription.trim())
    ? currentOccasion.chiefGuestDescription.trim()
    : 'Former Professor, IISc Bangalore & Distinguished Academician';

  const displayGuestPhoto = (currentOccasion.chiefGuestPhotoUrl && currentOccasion.chiefGuestPhotoUrl.trim() && !currentOccasion.chiefGuestPhotoUrl.includes('photo-1507003211169'))
    ? currentOccasion.chiefGuestPhotoUrl.trim()
    : 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=800';

  const displayConvenorName = (currentOccasion.convenorName && currentOccasion.convenorName.trim())
    ? currentOccasion.convenorName.trim()
    : 'Prof. Ashwini. S';

  const displayConvenorEmail = (currentOccasion.convenorEmail && currentOccasion.convenorEmail.trim())
    ? currentOccasion.convenorEmail.trim()
    : 'ashwini.s@gcu.edu.in';

  const nextOccasion = () => {
    if (visibleOccasions.length <= 1) return;
    setCurrentOccasionIndex((prev) => (prev + 1) % visibleOccasions.length);
  };

  const prevOccasion = () => {
    if (visibleOccasions.length <= 1) return;
    setCurrentOccasionIndex((prev) => (prev - 1 + visibleOccasions.length) % visibleOccasions.length);
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const user = await signInWithGoogleAuth();
      if (user && user.email) {
        let match = findStudentMatch(students, { uid: user.uid, email: user.email });
        if (!match) {
          match = {
            uid: user.uid,
            registerNo: '',
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            mobile: user.phoneNumber || '',
            school: 'External Participant',
            department: 'External University',
            programName: 'External Scholar',
            isExternal: true,
            externalCollegeName: '',
            authProvider: 'google',
            isEmailVerified: user.emailVerified,
            isProfileComplete: false
          };
          onRegisterStudent(match);
        } else {
          const updatedMatch = {
            ...match,
            uid: match.uid || user.uid,
            email: match.email || user.email,
            isEmailVerified: user.emailVerified || match.isEmailVerified
          };
          onRegisterStudent(updatedMatch);
          onSelectStudent(updatedMatch);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        onSelectRoleAndOccasion('student', selectedOccasionId);
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Google Authentication failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleMicrosoftSignIn = async (isFacultyAuth: boolean) => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const user = await signInWithMicrosoftAuth();
      if (user && user.email) {
        const cleanEmail = user.email.trim().toLowerCase();
        const localPart = cleanEmail.split('@')[0];
        const startsWithDigit = /^[0-9]/.test(localPart);
        const startsWithLetter = /^[a-zA-Z]/.test(localPart);

        if (isFacultyAuth) {
          if (!cleanEmail.endsWith('@gcu.edu.in')) {
            setAuthError('Faculty sign in requires an official @gcu.edu.in email ID.');
            setAuthLoading(false);
            return;
          }

          if (startsWithDigit || cleanEmail.endsWith('@student.gcu.edu.in') || isStudentEmailOrId(cleanEmail, students)) {
            setAuthError(`❌ Access Denied: "${cleanEmail}" is identified as a Student account. Students cannot sign in as Faculty / Event Coordinator. Please sign in under the Student Portal.`);
            setAuthLoading(false);
            return;
          }

          let match = facultyCoordinators.find(f => 
            f.email.toLowerCase() === cleanEmail || 
            isMatchingEmail(f.email, cleanEmail)
          );

          const assignedEvt = events.find(e => 
            (e.coordinatorEmail && isMatchingEmail(e.coordinatorEmail, cleanEmail)) ||
            (e.coordinatorEmail && cleanEmail && e.coordinatorEmail.toLowerCase() === cleanEmail) ||
            (e.coordinatorFacultyId && match && e.coordinatorFacultyId.toLowerCase() === match.facultyId.toLowerCase()) ||
            (e.hostDepartment && match && match.department && e.hostDepartment.toLowerCase().trim() === match.department.toLowerCase().trim() && match.department.toLowerCase() !== 'general faculty')
          );

          const isAssignedCoordinator = !!assignedEvt;
          const foundMobile = match?.mobile || assignedEvt?.coordinatorMobile || '';

          if (!match) {
            match = {
              facultyId: assignedEvt?.coordinatorFacultyId || ('FAC-' + Date.now().toString().slice(-5)),
              name: assignedEvt?.coordinatorName || user.displayName || cleanEmail.split('@')[0].replace(/[._-]/g, ' '),
              email: cleanEmail,
              mobile: foundMobile,
              department: assignedEvt?.hostDepartment || 'General Faculty',
              school: 'Garden City University',
              isApproved: true,
              createdAt: new Date().toISOString(),
              isProfileComplete: Boolean(foundMobile && foundMobile.trim().length >= 8)
            };
            onRegisterFaculty(match);
          } else {
            const needsUpdate = !match.isApproved || (!match.mobile && foundMobile);
            if (needsUpdate) {
              match = { 
                ...match, 
                isApproved: true,
                mobile: match.mobile || foundMobile,
                isProfileComplete: Boolean((match.mobile || foundMobile) && (match.mobile || foundMobile).trim().length >= 8)
              };
              onRegisterFaculty(match);
            }
          }
          onSelectFaculty(match);
          onSelectRoleAndOccasion('coordinator', assignedEvt?.occasionId || selectedOccasionId, assignedEvt?.id);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          if (!cleanEmail.endsWith('@student.gcu.edu.in') && !cleanEmail.endsWith('@gcu.edu.in')) {
            setAuthError('Internal students must sign in with their official @student.gcu.edu.in or @gcu.edu.in email address.');
            setAuthLoading(false);
            return;
          }

          const isKnownStudent = students.some(s => s.email?.toLowerCase() === cleanEmail || s.registerNo?.toLowerCase() === localPart);
          if (startsWithLetter && !cleanEmail.endsWith('@student.gcu.edu.in') && !isKnownStudent) {
            setAuthError(`❌ Access Denied: "${cleanEmail}" starts with an alphabet letter, which identifies it as a Faculty / Event Coordinator account. Faculty members must sign in under the Faculty / Event Coordinator Portal.`);
            setAuthLoading(false);
            return;
          }

          let match = findStudentMatch(students, { uid: user.uid, email: cleanEmail, registerNo: localPart });
          if (!match) {
            match = {
              uid: user.uid,
              registerNo: startsWithDigit ? localPart.toUpperCase() : 'GCU-' + localPart.toUpperCase(),
              name: user.displayName || localPart,
              email: user.email,
              mobile: '',
              school: 'Garden City University',
              department: '',
              programName: '',
              isExternal: false,
              authProvider: 'microsoft',
              isEmailVerified: true,
              isProfileComplete: false
            };
            onRegisterStudent(match);
          } else {
            const updatedMatch = {
              ...match,
              uid: match.uid || user.uid,
              email: match.email || user.email,
              isEmailVerified: true
            };
            onRegisterStudent(updatedMatch);
            onSelectStudent(updatedMatch);
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
          onSelectRoleAndOccasion('student', selectedOccasionId);
        }
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Microsoft 365 Authentication failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleProceedAsConvenor = () => {
    setAuthError('');
    if (!activeFaculty) {
      setAuthError('Please sign in with your Microsoft 365 account first.');
      return;
    }
    const occ = occasions.find(o => o.id === selectedOccasionId);
    if (!occ) {
      setAuthError('Please select a valid Occasion.');
      return;
    }
    if (activeFaculty.email.toLowerCase() !== occ.convenorEmail.toLowerCase()) {
      setAuthError(`Access Denied. Your email (${activeFaculty.email}) does not match the designated Convenor email (${occ.convenorEmail}) for ${occ.title}.`);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onSelectRoleAndOccasion('convenor', selectedOccasionId);
  };

  const handleProceedAsCoordinator = () => {
    setAuthError('');
    if (!activeFaculty) {
      setAuthError('Please sign in with your Microsoft 365 account first.');
      return;
    }
    if (!selectedEventId) {
      setAuthError('Please select an event to manage.');
      return;
    }
    const evt = events.find(e => e.id === selectedEventId);
    if (!evt) {
      setAuthError('Selected event not found.');
      return;
    }

    const facMatch = facultyCoordinators.find(c => 
      c.facultyId.toLowerCase() === activeFaculty.facultyId.toLowerCase() ||
      c.email.toLowerCase() === activeFaculty.email.toLowerCase() ||
      isMatchingEmail(c.email, activeFaculty.email)
    );

    const isDirectMatch = 
      (evt.coordinatorEmail && activeFaculty.email && isMatchingEmail(evt.coordinatorEmail, activeFaculty.email)) ||
      (evt.coordinatorFacultyId && activeFaculty.facultyId && evt.coordinatorFacultyId.toLowerCase() === activeFaculty.facultyId.toLowerCase()) ||
      (facMatch && (
        (evt.coordinatorFacultyId && evt.coordinatorFacultyId.toLowerCase() === facMatch.facultyId.toLowerCase()) ||
        (evt.coordinatorEmail && facMatch.email && isMatchingEmail(evt.coordinatorEmail, facMatch.email))
      )) ||
      (evt.hostDepartment && activeFaculty.department && evt.hostDepartment.toLowerCase().trim() === activeFaculty.department.toLowerCase().trim() && activeFaculty.department.toLowerCase() !== 'general faculty');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    onSelectRoleAndOccasion('coordinator', selectedOccasionId, selectedEventId);
  };

  const filteredEventsForOccasion = events.filter(e => !e.occasionId || e.occasionId === selectedOccasionId);

  const facultyAssignedEvents = React.useMemo(() => {
    if (!activeFaculty) return [];
    const cleanEmail = activeFaculty.email?.toLowerCase().trim();
    const cleanFacId = activeFaculty.facultyId?.toLowerCase().trim();
    const cleanName = activeFaculty.name?.toLowerCase().trim();

    return events.filter(e => 
      (e.coordinatorEmail && cleanEmail && isMatchingEmail(e.coordinatorEmail, cleanEmail)) ||
      (e.coordinatorFacultyId && cleanFacId && e.coordinatorFacultyId.toLowerCase().trim() === cleanFacId) ||
      (e.coordinatorName && cleanName && (e.coordinatorName.toLowerCase().trim().includes(cleanName) || cleanName.includes(e.coordinatorName.toLowerCase().trim())))
    );
  }, [activeFaculty, events]);

  React.useEffect(() => {
    if (activeFaculty && facultyAssignedEvents.length > 0) {
      if (!selectedEventId || !facultyAssignedEvents.some(e => e.id === selectedEventId)) {
        setSelectedEventId(facultyAssignedEvents[0].id);
      }
    }
  }, [activeFaculty, facultyAssignedEvents]);

  // UNAUTHENTICATED SIGN-IN GATEWAY: Do not reveal full detailed occasion data until user signs in as Student or Faculty
  if (!activeStudent && !activeFaculty) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 font-sans space-y-8">
        
        {/* Sign In Banner header */}
        <div className="text-center space-y-3 bg-gradient-to-r from-[#1E0438] via-[#2A004D] to-[#120224] p-6 sm:p-8 rounded-3xl border-2 border-[#00D1FF] shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#00D1FF]/20 border border-[#00D1FF]/40 text-xs font-black uppercase text-[#00D1FF] tracking-widest">
            <Lock className="w-3.5 h-3.5" />
            GCU OFFICIAL ACTIVITIES &amp; EVENTS PORTAL
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-sans">
            Sign In To Access Student &amp; Faculty Portal
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl mx-auto font-medium leading-relaxed">
            Welcome! Sign in with your official university account to view event schedules, register for occasions, track live scores, or manage event coordinations.
          </p>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="p-4 bg-rose-950/90 border-2 border-rose-500 rounded-2xl text-rose-200 text-xs font-bold shadow-xl flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
            <button onClick={() => setAuthError('')} className="text-rose-300 hover:text-white font-black text-xs cursor-pointer">✕</button>
          </div>
        )}

        {/* 2 Primary Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* CARD 1: STUDENT ACCESS PORTAL */}
          <div className="bg-gradient-to-b from-[#18022B] to-[#0F011E] border-2 border-[#00D1FF]/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl flex flex-col justify-between relative overflow-hidden group hover:border-[#00D1FF] transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-[#00D1FF]/20 border-2 border-[#00D1FF]/60 flex items-center justify-center text-[#00D1FF] text-2xl shadow-xl">
                  <GraduationCap className="w-8 h-8 text-[#00D1FF]" />
                </div>
                <span className="px-3 py-1 bg-[#00D1FF]/20 text-[#00D1FF] font-black text-[10px] uppercase rounded-full border border-[#00D1FF]/40">
                  STUDENT PORTAL
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-wide">
                  Student Sign In
                </h3>
                <p className="text-xs text-zinc-300 mt-1 font-medium leading-relaxed">
                  Sign in with your official university account (<strong className="text-[#00D1FF]">@student.gcu.edu.in</strong> or <strong className="text-[#00D1FF]">@gcu.edu.in</strong>) to view occasions, enter Fresherism 2026, or join NCC.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => handleMicrosoftSignIn(false)}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#00D1FF] to-blue-600 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/20"
                >
                  <Globe className="w-4 h-4 text-black" />
                  <span>{authLoading ? 'Signing In...' : <>Sign In with Microsoft 365 (<span className="lowercase font-bold">@student.gcu.edu.in</span>)</>}</span>
                </button>
              </div>
            </div>
          </div>

          {/* CARD 2: FACULTY & COORDINATOR ACCESS PORTAL */}
          <div className="bg-gradient-to-b from-[#18022B] to-[#0F011E] border-2 border-amber-400/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl flex flex-col justify-between relative overflow-hidden group hover:border-amber-400 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border-2 border-amber-400/60 flex items-center justify-center text-amber-400 text-2xl shadow-xl">
                  <Building2 className="w-8 h-8 text-amber-400" />
                </div>
                <span className="px-3 py-1 bg-amber-400/20 text-amber-300 font-black text-[10px] uppercase rounded-full border border-amber-400/40">
                  FACULTY &amp; CONVENOR
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-wide">
                  Faculty &amp; Coordinator Sign In
                </h3>
                <p className="text-xs text-zinc-300 mt-1 font-medium leading-relaxed">
                  For Event Coordinators, Convenors, and Faculty members (<strong className="text-amber-300">@gcu.edu.in</strong>) to manage event schedules, attendance, and scores.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => handleMicrosoftSignIn(true)}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/20"
                >
                  <ShieldCheck className="w-4 h-4 text-black" />
                  <span>{authLoading ? 'Signing In...' : <>Sign In as Faculty (Microsoft 365 <span className="lowercase font-bold">@gcu.edu.in</span>)</>}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDirectConvenorLogin(!showDirectConvenorLogin)}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-amber-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/15"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                  <span>Convenor Passcode Direct Login</span>
                </button>
              </div>

              {showDirectConvenorLogin && (
                <form onSubmit={handleDirectConvenorAuth} className="p-4 bg-black/60 rounded-2xl border border-amber-400/40 space-y-3 text-left animate-in fade-in">
                  <div>
                    <label className="text-[10px] font-black uppercase text-amber-300 block mb-1">Username / Convenor Email</label>
                    <input
                      type="text"
                      required
                      placeholder="convenor or ashwini.s@gcu.edu.in"
                      value={convenorUsername}
                      onChange={e => setConvenorUsername(e.target.value)}
                      className="w-full bg-[#1A032E] border border-white/20 text-white rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-amber-300 block mb-1">Convenor Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={convenorPassword}
                      onChange={e => setConvenorPassword(e.target.value)}
                      className="w-full bg-[#1A032E] border border-white/20 text-white rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-amber-400 text-black font-black text-xs uppercase py-2.5 rounded-xl hover:bg-amber-300 cursor-pointer shadow-lg"
                  >
                    Authenticate Convenor Access →
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>

        {/* Super Admin Access Link */}
        <div className="text-center pt-4">
          <button
            onClick={onOpenSuperAdmin}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black/60 hover:bg-black/90 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Super Admin System Access Portal</span>
          </button>
        </div>

        {/* NCC Info Modal */}
        <NccInfoModal
          isOpen={showNccModal}
          onClose={() => setShowNccModal(false)}
          activeStudent={activeStudent}
          students={students}
          onUpdateStudent={(updated) => {
            onRegisterStudent(updated);
          }}
        />

      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto px-4 py-6 font-sans">
      
      {/* AUTHENTICATED USER SESSION BAR */}
      <div className="bg-gradient-to-r from-[#1A032E] via-[#2A004D] to-[#0F011E] border-2 border-emerald-400/60 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-black text-lg">
            {activeStudent ? '🎓' : '👨‍🏫'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                AUTHENTICATED SESSION ACTIVE
              </span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded-full border border-emerald-400/30">
                {activeStudent ? 'STUDENT' : 'FACULTY'}
              </span>
            </div>
            <h4 className="text-sm font-black text-white">
              {activeStudent ? activeStudent.name : activeFaculty?.name} <span className="text-zinc-400 font-mono text-xs">({activeStudent ? (activeStudent.email || activeStudent.registerNo) : activeFaculty?.email})</span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeStudent && (
            <button
              onClick={() => onSelectRoleAndOccasion('student', selectedOccasionId)}
              className="px-4 py-2 bg-[#00D1FF] hover:bg-[#00D1FF]/90 text-black font-black text-xs uppercase rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Go To Student Dashboard →</span>
            </button>
          )}

          {activeFaculty && (
            <button
              onClick={() => onSelectRoleAndOccasion('coordinator', selectedOccasionId)}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Go To Faculty Portal →</span>
            </button>
          )}
        </div>
      </div>

      {/* STUDENT SPECIFIC SEPARATE OPTIONS FOR FRESHERISM & NCC */}
      {activeStudent && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* OPTION 1: FRESHERISM 2026 (SEM 1 FRESHERS ONLY) */}
          <div className="bg-gradient-to-br from-[#2E044D] via-[#1A032E] to-[#0F011E] border-2 border-[#FF007A] rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-[#FF007A]/20 border border-[#FF007A]/50 text-[#FF007A] text-[10px] font-black uppercase rounded-full tracking-widest">
                  1ST YEAR / SEM 1 FRESHERS FEST
                </span>
                {activeStudent.sem1Declared && (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-400/40">
                    SEM 1 VERIFIED ✓
                  </span>
                )}
              </div>

              <h3 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                <span>🎉 Fresherism '26</span>
              </h3>
              <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                The flagship annual talent, cultural, and technical festival for GCU Semester 1 students. Requires 1st Year Semester 1 self-declaration undertaking before entering event registrations.
              </p>
            </div>

            <button
              onClick={() => {
                onSelectRoleAndOccasion('student', 'occ-fresherism-26');
              }}
              className="w-full py-3.5 bg-gradient-to-r from-[#FF007A] to-purple-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/20 mt-2"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>Enter Fresherism 2026 Events →</span>
            </button>
          </div>

          {/* OPTION 2: NCC ARMY WING 2026 (SEPARATE JOIN vs PARTICIPATE OPTIONS) */}
          <div className="bg-gradient-to-br from-emerald-950 via-zinc-900 to-teal-950 border-2 border-emerald-500/70 rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-black uppercase rounded-full tracking-widest">
                  GCU NCC ARMY WING
                </span>
                {activeStudent.isNccInterested && (
                  <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-300 text-[10px] font-bold rounded-full border border-amber-400/40">
                    INTEREST REGISTERED ✓
                  </span>
                )}
              </div>

              <h3 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                <span>🇮🇳 National Cadet Corps (NCC)</span>
              </h3>
              <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                Join the elite National Cadet Corps Army Wing under Coordinator Prof. Vishnu Pandhare or participate in physical fitness tests, drills, and parade activities.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowNccModal(true)}
                className="py-3 px-3 bg-gradient-to-r from-amber-400 to-emerald-400 hover:opacity-90 text-black font-black text-[11px] uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>⚡ Join NCC 2026</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectRoleAndOccasion('student', 'occ-ncc-2026');
                }}
                className="py-3 px-3 bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-400/50 text-emerald-200 font-black text-[11px] uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🎖️ NCC Events &amp; Parades</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 1. UPCOMING OCCASION CAROUSEL BANNER */}
      <div className="relative bg-gradient-to-r from-[#1E0438] via-[#2D0A4E] to-[#120224] border-2 border-[#00D1FF] rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF007A]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#00D1FF]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Carousel Header & Controls */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-[#FF007A] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-md animate-pulse">
              UPCOMING FESTIVAL CAROUSEL
            </span>
            <span className="text-xs text-cyan-300 font-mono font-bold hidden sm:inline">
              Occasion {currentOccasionIndex + 1} of {visibleOccasions.length}
            </span>
          </div>

          {visibleOccasions.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={prevOccasion}
                className="p-2 bg-black/40 hover:bg-[#FF007A] text-white rounded-xl border border-white/20 transition-all cursor-pointer shadow-md"
                title="Previous Occasion"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextOccasion}
                className="p-2 bg-black/40 hover:bg-[#FF007A] text-white rounded-xl border border-white/20 transition-all cursor-pointer shadow-md"
                title="Next Occasion"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Carousel Content in 5 Stacked Full-Width Rows */}
        <div className="space-y-5 relative z-10">
          
          {/* ROW 1: Logo Spanning Full Width of Parent Component */}
          <div className="w-full bg-black/40 border border-white/15 rounded-2xl p-2 sm:p-4 flex items-center justify-center shadow-xl overflow-hidden">
            {currentOccasion.logoUrl && currentOccasion.logoUrl.trim() && !currentOccasion.logoUrl.includes('photo-1540575467063') && !currentOccasion.logoUrl.includes('unsplash.com') && currentOccasion.logoUrl !== '/logo2.png' ? (
              <img 
                src={currentOccasion.logoUrl.trim()} 
                alt={`${currentOccasion.title} Logo`}
                className="w-full h-auto max-h-[280px] sm:max-h-[360px] object-contain rounded-xl shadow-2xl mx-auto"
                onError={(e) => { 
                  (e.target as HTMLElement).style.display = 'none'; 
                }}
              />
            ) : (
              <FresherismLogo size="lg" showUniversityHeader={true} showDatesBadge={true} bgMode="dark" />
            )}
          </div>

          {/* ROW 2: Name of the Guest */}
          <div className="w-full bg-gradient-to-r from-purple-950/90 via-[#2A004D] to-purple-950/90 p-4 sm:p-5 rounded-2xl border border-amber-400/50 text-center shadow-xl space-y-1.5">
            <span className="inline-block text-[11px] font-black uppercase tracking-widest text-amber-300 bg-slate-950 px-4 py-1 rounded-full border border-amber-400 shadow-md">
              ⭐ CHIEF GUEST OF HONOR
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-wide">
              {displayGuestName}
            </h2>
            <p className="text-sm sm:text-base font-bold text-amber-300">
              {displayGuestDesc}
            </p>
          </div>

          {/* ROW 3: Two Columns (Column 1: Photo of the guest, Column 2: Description) */}
          <div className="w-full bg-gradient-to-r from-[#2A004D] via-[#1A032E] to-[#0F011E] p-6 rounded-2xl border border-amber-500/40 shadow-xl flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
            
            {/* Column 1: Photo of the Guest */}
            <div className="shrink-0 flex items-center justify-center">
              {!guestImgError ? (
                <img
                  src={displayGuestPhoto}
                  alt={displayGuestName}
                  className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-2xl object-cover object-top border-4 border-amber-400 shadow-2xl bg-slate-950 p-1"
                  onError={() => setGuestImgError(true)}
                />
              ) : (
                <div className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-2xl border-4 border-amber-400 shadow-2xl bg-gradient-to-b from-purple-900 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-3">
                  <div className="w-20 h-20 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 shadow-lg">
                    <User className="w-10 h-10" />
                  </div>
                  <span className="text-xs font-black text-amber-300 uppercase tracking-widest px-3 py-1 bg-black/60 rounded-full border border-amber-400/40">
                    CHIEF GUEST OF HONOR
                  </span>
                  <p className="text-sm font-bold text-white line-clamp-2">{displayGuestName}</p>
                </div>
              )}
            </div>

            {/* Column 2: Description (Justified, without "Presiding as..." box) */}
            <div className="flex-1 space-y-3 text-sm sm:text-base text-zinc-200 leading-relaxed font-medium pt-1">
              <h4 className="text-xs font-black uppercase tracking-widest text-amber-300 font-mono text-left">
                ABOUT THE CHIEF GUEST
              </h4>
              <p className="text-justify text-zinc-200 leading-relaxed font-medium whitespace-pre-wrap">
                {currentOccasion.chiefGuestData && currentOccasion.chiefGuestData.trim()
                  ? currentOccasion.chiefGuestData.trim()
                  : (currentOccasion.chiefGuestDescription && currentOccasion.chiefGuestDescription.trim()
                      ? currentOccasion.chiefGuestDescription.trim()
                      : (DEFAULT_GUEST_BIOS[displayGuestName] || DEFAULT_GUEST_BIOS['Dr. N. C. Shivaprakash']))}
              </p>
            </div>

          </div>

          {/* ROW 4: Festival Overview & Highlights (Heading centered, description text justified) */}
          <div className="w-full bg-black/40 p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-center border-b border-white/10 pb-3 text-center">
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-cyan-300 bg-cyan-500/10 px-4 py-1.5 rounded-xl border border-cyan-500/30">
                ✨ FESTIVAL OVERVIEW & HIGHLIGHTS
              </span>
            </div>

            <p className="text-sm sm:text-base text-zinc-200 leading-relaxed font-medium text-justify whitespace-pre-wrap">
              {currentOccasion.description || 'Garden City University presents an invigorating multi-day festival featuring cultural performances, technical hackathons, fine arts showcases, literary debates, and athletic tournaments across all departments.'}
            </p>

            <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-300 font-mono gap-2 text-center sm:text-left">
              <div>
                Convenor: <strong className="text-white font-bold">{displayConvenorName}</strong>
              </div>
              <div>
                Convenor Email: <strong className="text-cyan-300 font-bold">{displayConvenorEmail}</strong>
              </div>
            </div>
          </div>

          {/* ROW 5: The Date */}
          <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-slate-950 p-4 rounded-2xl border-2 border-amber-300 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-950 text-amber-400 rounded-xl font-bold text-xl border border-amber-400/50 shrink-0">
                🗓️
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 block">FESTIVAL DATES & TIMELINE</span>
                <span className="text-base sm:text-xl font-black tracking-wider uppercase font-mono">
                  {formatDateRangeDDMMYYYY(currentOccasion.fromDate, currentOccasion.toDate, currentOccasion.eventDates || '03-08-2026 – 15-08-2026')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-4 py-2 bg-slate-950 text-amber-300 text-xs font-black rounded-xl uppercase tracking-widest border border-amber-400/40 shadow-md">
                LIVE REGISTRATIONS OPEN
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 2. AUTH ERROR BANNER */}
      {authError && (
        <div className="bg-rose-950/80 border-2 border-rose-500 text-rose-200 text-xs p-4 rounded-2xl flex items-center gap-3 shadow-xl animate-bounce">
          <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
          <div className="flex-1">
            <p className="font-extrabold uppercase text-rose-300 tracking-wider">Authentication Error</p>
            <p className="mt-0.5">{authError}</p>
          </div>
          <button onClick={() => setAuthError('')} className="text-rose-300 hover:text-white font-bold text-sm">✕</button>
        </div>
      )}

      {/* 3. PRIMARY ROLE CHOICE OR SIGNED-IN FACULTY PORTAL */}
      {activeFaculty ? (
        <div className="bg-[#1A032E] border-2 border-[#00D1FF] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00D1FF] to-blue-600 flex items-center justify-center font-black text-white text-xl shadow-md shrink-0">
                {activeFaculty.name ? activeFaculty.name.charAt(0).toUpperCase() : 'F'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">{activeFaculty.name}</h3>
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold rounded-md uppercase">
                    Faculty Signed In
                  </span>
                </div>
                <p className="text-xs text-cyan-300 font-mono font-semibold">
                  ID: {activeFaculty.facultyId} • {activeFaculty.department} • {activeFaculty.email}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onSelectFaculty(null as any);
                localStorage.removeItem('fresherism_active_faculty_id');
              }}
              className="px-4 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
            >
              Sign Out / Switch Faculty
            </button>
          </div>

          <p className="text-xs text-zinc-300 font-medium">
            Welcome, Faculty Member! Select your faculty portal mode below to manage events or view festival rosters:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto pt-2">
            {/* CONVENOR ACCESS */}
            <div className="p-5 bg-gradient-to-br from-[#2E004F] to-[#120024] border-2 border-amber-400/60 rounded-2xl text-left space-y-3">
              <div className="flex items-center gap-2 text-amber-300">
                <span className="text-xl">🏆</span>
                <h4 className="text-sm font-black uppercase">Festival Convenor HQ</h4>
              </div>
              <p className="text-xs text-zinc-300">
                Steering Committee Access for <span className="text-amber-300 font-bold">{currentOccasion.title}</span>.
              </p>
              <button
                type="button"
                onClick={handleProceedAsConvenor}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase py-3 rounded-xl shadow-lg transition-all cursor-pointer border border-amber-300"
              >
                Launch Convenor Dashboard →
              </button>
            </div>

            {/* COORDINATOR ACCESS */}
            <div className="p-5 bg-gradient-to-br from-[#002B48] to-[#0A1224] border-2 border-[#00D1FF]/60 rounded-2xl text-left space-y-3">
              <div className="flex items-center gap-2 text-[#00D1FF]">
                <span className="text-xl">📋</span>
                <h4 className="text-sm font-black uppercase">Event Coordinator Console</h4>
              </div>
              <p className="text-xs text-zinc-300">
                Manage registered student lists, evaluation scores, attendance & completion reports.
              </p>

              <div className="space-y-2 pt-1">
                {facultyAssignedEvents.length > 0 ? (
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full bg-black/80 border border-[#00D1FF]/60 text-white font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#00D1FF] cursor-pointer"
                  >
                    {facultyAssignedEvents.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.title} ({e.coordinatorName || 'Assigned'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs rounded-xl">
                    No event assigned to <strong className="text-white">{activeFaculty?.email}</strong> by Convenor yet.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleProceedAsCoordinator}
                  className="w-full bg-gradient-to-r from-[#00D1FF] to-blue-600 hover:opacity-90 text-white font-black text-xs uppercase py-3 rounded-xl shadow-lg transition-all cursor-pointer border border-white/20"
                >
                  Launch Event Console →
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Leaderboard Showcase */}
      <div className="bg-[#120224] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-lg font-black text-white uppercase italic tracking-wide text-center">
          🏆 Overall Department & Student Leaderboard
        </h3>
        <Leaderboard
          students={students}
          scores={scores}
          events={events}
        />
      </div>

    </div>
  );
};
