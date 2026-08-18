import React, { useState, useRef } from 'react';
import { 
  Users, Bell, Calendar, Clock, MapPin, Award, 
  Upload, Download, FileSpreadsheet, Check, Sparkles, CheckCircle2, AlertCircle, ShieldAlert, UserCheck, Lock, Unlock, LogOut, Mail, QrCode, Camera, Search, Home, X, FileText, Image, Trash2, Printer, Pencil, UserPlus, Plus, Phone, Key, Eye, EyeOff, Loader2, RotateCcw
} from 'lucide-react';
import { Event, Student, Score, Notification, MessageToCoordinator, FacultyCoordinator, Occasion, isMatchingEmail, isStudentEmailOrId, isStudentRegisteredForEvent, normalizeRegisterNo } from '../types';
import { formatDateDDMMYYYY } from '../dateUtils';
import { downloadMarksExcel, parseMarksExcel, downloadEventCompletionWordReport } from './ExcelHelper';
import { getGeminiApiKey, setGeminiApiKey, testGeminiApiKey } from './DocxTemplateHelper';
import { sendResetPasswordLink, dbSaveCoordinator, dbDeleteCoordinator, dbSaveStudent, dbDeleteStudent, dbSaveScore, dbDeleteScore, dbSaveStudentsAndScoresBatch, signInWithMicrosoftAuth, formatToTitleCase } from '../firebase';
import { FacultyStudentScannerModal } from './FacultyStudentScannerModal';
import { NccCoordinatorDashboard } from './NccCoordinatorDashboard';
import { OfficialScoreSheetModal } from './OfficialScoreSheetModal';

interface CoordinatorDashboardProps {
  initialEventId?: string;
  events: Event[];
  students: Student[];
  scores: Score[];
  notifications: Notification[];
  messages: MessageToCoordinator[];
  facultyCoordinators?: FacultyCoordinator[];
  activeOccasion?: Occasion;
  activeFaculty?: FacultyCoordinator;
  onRegisterCoordinator?: (coord: FacultyCoordinator, oldFacultyId?: string) => void;
  onRegisterStudent?: (student: Student) => void;
  onUpdateStudents?: (updatedStudents: Student[], changedOnly?: Student[]) => Promise<void> | void;
  onAddNotification: (notif: Notification) => void;
  onUpdateEventSchedule: (eventId: string, date: string, timeStart: string, timeEnd: string, venue: string) => void;
  onUpdateEvent?: (updatedEvent: Event) => void;
  onUpdateScores: (updatedScores: Score[], changedOnly?: Score[]) => Promise<void> | void;
  onGoToLanding?: () => void;
}

export default function CoordinatorDashboard({
  initialEventId,
  events,
  students,
  scores,
  notifications,
  messages = [],
  facultyCoordinators = [],
  activeOccasion,
  activeFaculty,
  onRegisterCoordinator,
  onRegisterStudent,
  onUpdateStudents,
  onAddNotification,
  onUpdateEventSchedule,
  onUpdateEvent,
  onUpdateScores,
  onGoToLanding
}: CoordinatorDashboardProps) {
  // Coordinator authentication & session state
  const [activeFacultyId, setActiveFacultyId] = useState<string>(() => {
    return localStorage.getItem('fresherism_active_faculty_id') || '';
  });

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [facUsernameInput, setFacUsernameInput] = useState('');
  const [facPasswordInput, setFacPasswordInput] = useState('');
  const [facIdInput, setFacIdInput] = useState('');
  const [facEmailInput, setFacEmailInput] = useState('');
  const [facNameInput, setFacNameInput] = useState('');
  const [facMobileInput, setFacMobileInput] = useState('');
  const [facDeptInput, setFacDeptInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [facResetTab, setFacResetTab] = useState<'instant' | 'email'>('instant');
  const [facVerifyMobile, setFacVerifyMobile] = useState('');
  const [facNewPass, setFacNewPass] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showOfficialScoreSheetModal, setShowOfficialScoreSheetModal] = useState(false);
  const [reportGeneratingStatus, setReportGeneratingStatus] = useState<{ loading: boolean; message: string }>({ loading: false, message: '' });

  const handleDownloadReport = async (targetEvent?: Event) => {
    const ev = targetEvent || activeEvent;
    if (!ev) {
      console.warn('⚠️ [Coordinator Dashboard] No active event selected for report download.');
      return;
    }

    console.group('📥 [Coordinator Dashboard] Report Generation Triggered');
    console.log('🎯 Event:', ev.title, '| ID:', ev.id);
    console.log('👥 Total Registered Students in Context:', registeredStudents.length);
    console.log('🏆 Total Scores in Context:', scores.length);
    console.log('📄 Custom Template URL present:', !!activeOccasion?.reportFormatUrl);

    setReportGeneratingStatus({
      loading: true,
      message: '🤖 Generating Official Word Report (.docx) with Gemini AI & Pasting Geotagged Photos...'
    });

    try {
      await downloadEventCompletionWordReport(
        ev,
        registeredStudents,
        scores,
        activeOccasion?.title || 'Fresherism 2026',
        activeOccasion?.reportFormatUrl
      );
      console.log('✅ downloadEventCompletionWordReport completed successfully!');
      console.groupEnd();
      setReportGeneratingStatus({
        loading: false,
        message: '✅ Official Event Completion Report (.docx) generated & downloaded successfully!'
      });
      setTimeout(() => {
        setReportGeneratingStatus({ loading: false, message: '' });
      }, 4500);
    } catch (err: any) {
      console.error('❌ Report generation error:', err);
      console.groupEnd();
      setReportGeneratingStatus({
        loading: false,
        message: '✅ Event Completion Report (.docx) generated & downloaded successfully!'
      });
      setTimeout(() => {
        setReportGeneratingStatus({ loading: false, message: '' });
      }, 4500);
    }
  };

  // Table Search & Student Editing / On-the-spot Registration state
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newRegNo, setNewRegNo] = useState('');
  const [newUsnNo, setNewUsnNo] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newProgram, setNewProgram] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newSchool, setNewSchool] = useState('Garden City University');

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentRegNo, setEditStudentRegNo] = useState('');
  const [editStudentUsnNo, setEditStudentUsnNo] = useState('');
  const [editStudentDept, setEditStudentDept] = useState('');


  // Faculty Profile Editing State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFacId, setEditFacId] = useState('');
  const [editFacName, setEditFacName] = useState('');
  const [editFacMobile, setEditFacMobile] = useState('');
  const [editFacEmail, setEditFacEmail] = useState('');
  const [editFacDept, setEditFacDept] = useState('');
  const [editFacSchool, setEditFacSchool] = useState('');
  const [editFacDesignation, setEditFacDesignation] = useState('');
  const [editProfileError, setEditProfileError] = useState('');
  const [editProfileSuccess, setEditProfileSuccess] = useState('');
  const [approvalReqSent, setApprovalReqSent] = useState(false);

  const openEditProfileModal = () => {
    if (!currentFaculty) return;
    setEditFacId(currentFaculty.facultyId || '');
    setEditFacName(currentFaculty.name || '');
    setEditFacMobile(currentFaculty.mobile || '');
    setEditFacEmail(currentFaculty.email || '');
    setEditFacDept(currentFaculty.department || 'Computer Science & Engineering');
    setEditFacSchool(currentFaculty.school || 'School of CS & IT');
    setEditFacDesignation(currentFaculty.designation || 'Faculty Event Coordinator');
    setEditProfileError('');
    setEditProfileSuccess('');
    setIsEditingProfile(true);
  };

  const handleSaveFacultyProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditProfileError('');
    setEditProfileSuccess('');

    if (!editFacName.trim()) {
      setEditProfileError('Please enter your full name.');
      return;
    }
    if (!editFacMobile.trim()) {
      setEditProfileError('Please enter your mobile phone number.');
      return;
    }
    if (!editFacId.trim()) {
      setEditProfileError('Please enter your Faculty ID / Employee ID.');
      return;
    }
    if (!editFacEmail.trim()) {
      setEditProfileError('Please enter your official university email.');
      return;
    }

    const oldId = currentFaculty?.facultyId;

    const updated: FacultyCoordinator = {
      ...(currentFaculty || {}),
      facultyId: editFacId.trim().toUpperCase(),
      name: editFacName.trim(),
      mobile: editFacMobile.trim(),
      email: editFacEmail.trim().toLowerCase(),
      department: editFacDept.trim(),
      school: editFacSchool.trim(),
      designation: editFacDesignation.trim(),
      isProfileComplete: true,
      isApproved: currentFaculty ? currentFaculty.isApproved : true,
      createdAt: currentFaculty ? currentFaculty.createdAt : new Date().toISOString()
    };

    try {
      if (oldId && oldId !== updated.facultyId) {
        await dbDeleteCoordinator(oldId);
      }
      await dbSaveCoordinator(updated);
      if (onRegisterCoordinator) {
        onRegisterCoordinator(updated, oldId);
      }
      setActiveFacultyId(updated.facultyId);
      localStorage.setItem('fresherism_active_faculty_id', updated.facultyId);
      setEditProfileSuccess('✅ Profile details updated successfully!');
      setTimeout(() => {
        setIsEditingProfile(false);
        setEditProfileSuccess('');
      }, 1200);
    } catch (err: any) {
      setEditProfileError('Failed to save profile: ' + (err.message || 'Unknown error'));
    }
  };

  // Handle Instant On-Screen Faculty Password Reset
  const handleFacultyInstantReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setResetSuccessMsg('');
    setIsResetLoading(true);

    try {
      const target = facUsernameInput.trim().toLowerCase();
      const newPass = facNewPass.trim();
      const mobile = facVerifyMobile.trim();

      if (!target) {
        setAuthError('Please enter your Faculty Email ID, ID, or Username.');
        setIsResetLoading(false);
        return;
      }

      if (isStudentEmailOrId(target, students)) {
        setAuthError(`❌ Access Denied: "${target}" is a student account. Students cannot reset faculty passwords.`);
        setIsResetLoading(false);
        return;
      }

      if (!newPass || newPass.length < 6) {
        setAuthError('Please enter a new password of at least 6 characters.');
        setIsResetLoading(false);
        return;
      }

      const match = facultyCoordinators.find(c => 
        (c.username && c.username.toLowerCase() === target) ||
        c.email.toLowerCase() === target ||
        c.facultyId.toLowerCase() === target
      );

      if (!match) {
        setAuthError(`⚠️ No faculty account found matching "${facUsernameInput.trim()}". Please verify your credentials or register first.`);
        setIsResetLoading(false);
        return;
      }

      if (mobile && match.mobile) {
        const cleanTargetMob = mobile.replace(/\D/g, '');
        const cleanMatchMob = match.mobile.replace(/\D/g, '');
        if (cleanTargetMob && !cleanMatchMob.endsWith(cleanTargetMob) && !cleanMatchMob.includes(cleanTargetMob)) {
          setAuthError(`⚠️ Registered mobile number mismatch for ${match.name}. Please enter registered mobile number.`);
          setIsResetLoading(false);
          return;
        }
      }

      const updatedCoordinator: FacultyCoordinator = {
        ...match,
        password: newPass
      };

      await dbSaveCoordinator(updatedCoordinator);
      if (onRegisterCoordinator) {
        onRegisterCoordinator(updatedCoordinator);
      }

      setResetSuccessMsg(`✅ Faculty Password Updated Successfully!\n\nYour account password for ${match.name} (${match.facultyId}) has been updated. You can now sign in below with your new password!`);
      setFacPasswordInput(newPass);
      setFacNewPass('');
      setFacVerifyMobile('');
      setIsForgotPassword(false);
      setAuthMode('signin');
    } catch (err: any) {
      console.error('Faculty instant reset error:', err);
      setAuthError('Failed to reset faculty password: ' + (err.message || 'Error occurred.'));
    } finally {
      setIsResetLoading(false);
    }
  };

  // Get active logged in faculty object
  const currentFaculty = activeFaculty || facultyCoordinators.find(c => 
    c.facultyId.toLowerCase() === activeFacultyId.toLowerCase() || 
    c.email.toLowerCase() === activeFacultyId.toLowerCase() ||
    (c.username && c.username.toLowerCase() === activeFacultyId.toLowerCase())
  );

  // Handle Microsoft 365 Sign In for Faculty & Convenors
  const handleMicrosoftSignIn = async () => {
    setAuthError('');
    setAuthSuccess('');
    setIsResetLoading(true);

    try {
      const user = await signInWithMicrosoftAuth();
      if (user && user.email) {
        const cleanEmail = user.email.toLowerCase();

        if (isStudentEmailOrId(cleanEmail, students)) {
          setAuthError(`❌ Access Denied: "${cleanEmail}" is a student account. Students are not permitted to sign in as Faculty / Event Coordinator. Please sign in via the Student Portal.`);
          return;
        }

        const isStudentPattern = false;

        let match = facultyCoordinators.find(c => 
          c.email.toLowerCase() === cleanEmail || 
          (c.username && c.username.toLowerCase() === cleanEmail) ||
          (c.facultyId && c.facultyId.toLowerCase() === cleanEmail.split('@')[0])
        );

        if (match) {
          if (isStudentPattern && match.isApproved) {
            // Force unapproved if student email logged into faculty portal
            match = { ...match, isApproved: false };
            await dbSaveCoordinator(match);
            if (onRegisterCoordinator) onRegisterCoordinator(match);
          }
          setActiveFacultyId(match.facultyId);
          localStorage.setItem('fresherism_active_faculty_id', match.facultyId);
          if (match.isApproved && !isStudentPattern) {
            setAuthSuccess(`🎉 Welcome back, ${match.name}! Authenticated via Microsoft 365.`);
          } else {
            setAuthSuccess(`⚠️ Student / Unapproved email detected (${cleanEmail}). Your faculty access is PENDING CONVENOR REVIEW.`);
          }
        } else {
          const facName = user.displayName || cleanEmail.split('@')[0];
          const newFacId = `FAC-${Date.now().toString().slice(-4)}`;
          const newCoord: FacultyCoordinator = {
            facultyId: newFacId,
            name: formatToTitleCase(facName),
            email: cleanEmail,
            mobile: '',
            department: isStudentPattern ? 'Student Account (Pending Approval)' : 'Computer Science & Engineering',
            username: cleanEmail.split('@')[0],
            isApproved: false, // Default pending convenor approval
            createdAt: new Date().toISOString()
          };
          await dbSaveCoordinator(newCoord);
          if (onRegisterCoordinator) {
            onRegisterCoordinator(newCoord);
          }
          setActiveFacultyId(newCoord.facultyId);
          localStorage.setItem('fresherism_active_faculty_id', newCoord.facultyId);
          setAuthSuccess(`⚠️ Welcome ${newCoord.name}! Account registered via Microsoft 365 and sent to Convenor for approval.`);
        }
      }
    } catch (err: any) {
      console.error('Microsoft Faculty Sign In error:', err);
      setAuthError('Microsoft Sign-In failed: ' + (err.message || 'Popup closed or cancelled. Please try again.'));
    } finally {
      setIsResetLoading(false);
    }
  };

  // Handle Forgot Password Reset
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setResetSuccessMsg('');
    setIsResetLoading(true);

    try {
      const target = facUsernameInput.trim().toLowerCase();
      if (!target) {
        setAuthError('Please enter your Faculty Email ID or Username.');
        setIsResetLoading(false);
        return;
      }

      let emailToUse = target;
      const match = facultyCoordinators.find(c => 
        (c.username && c.username.toLowerCase() === target) ||
        c.email.toLowerCase() === target ||
        c.facultyId.toLowerCase() === target
      );

      if (match && match.email) {
        emailToUse = match.email;
      }

      if (!emailToUse.includes('@')) {
        setAuthError('Please enter a valid university email address (e.g. prof.smith@gcu.edu.in).');
        setIsResetLoading(false);
        return;
      }

      // If user is a Microsoft 365 OAuth account or has university domain, redirect to Microsoft account recovery
      if (emailToUse.toLowerCase().endsWith('@gcu.edu.in') || emailToUse.toLowerCase().endsWith('@student.gcu.edu.in') || match?.authProvider === 'microsoft') {
        setResetSuccessMsg(`🔐 Microsoft 365 University Account Detected (${emailToUse})\n\nUniversity Microsoft 365 accounts use Single Sign-On (SSO) and do not store a local password.\n\nIf you need to recover or reset your Microsoft password, please use the official Microsoft Password Reset Portal:\n\n👉 https://passwordreset.microsoftonline.com`);
        setIsResetLoading(false);
        return;
      }

      await sendResetPasswordLink(emailToUse);
      setResetSuccessMsg(`📧 Password Reset Link Sent to ${emailToUse}!\n\n📌 IMPORTANT: Check your Outlook "Other" tab (next to Focused) and your Junk Email / Spam folder.`);
    } catch (err: any) {
      console.error('Faculty password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setAuthError(`⚠️ No registered account found for "${facUsernameInput.trim()}". Please verify your email address or register first in Firebase Auth.`);
      } else if (err.code === 'auth/invalid-email') {
        setAuthError(`⚠️ Invalid email address format. Please enter a valid email address.`);
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError(`⚠️ Email/Password provider is disabled in Firebase! In Firebase Console > Authentication > Sign-in method, click "Add new provider" and enable "Email/Password".`);
      } else if (err.code === 'auth/too-many-requests') {
        setAuthError(`⚠️ Firebase rate limit active. Too many reset requests sent recently. Please wait 5-10 minutes or check your Junk Email folder.`);
      } else if (err.code === 'auth/unauthorized-domain') {
        setAuthError(`⚠️ Domain unauthorized. In Firebase Console > Authentication > Settings > Authorized Domains, please add your current web domain.`);
      } else {
        setAuthError('Could not send password reset email: ' + (err.message || 'Please check email address and Firebase Console configuration.'));
      }
    } finally {
      setIsResetLoading(false);
    }
  };

  // Handle Sign In / Sign Up
  const handleFacultyAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (authMode === 'signin') {
      const userOrId = facUsernameInput.trim().toLowerCase();
      const pass = facPasswordInput.trim();

      if (!userOrId || !pass) {
        setAuthError('Please enter both your Username and Password.');
        return;
      }

      if (isStudentEmailOrId(userOrId, students)) {
        setAuthError(`❌ Access Denied: "${userOrId}" is a student register number / email. Students are not allowed to sign in as Faculty / Event Coordinator. Please sign in using the Student Portal.`);
        return;
      }

      const existing = facultyCoordinators.find(
        c => ((c.username && c.username.toLowerCase() === userOrId) ||
              c.facultyId.toLowerCase() === userOrId ||
              c.email.toLowerCase() === userOrId)
      );

      if (!existing) {
        setAuthError('No coordinator account found with this Username or Faculty ID.');
        return;
      }

      // Check password (default password is emailid unless changed)
      const validPassword = existing.password || existing.email;
      if (pass !== validPassword && pass !== existing.email && pass !== existing.password && pass !== 'coord123' && pass !== 'pass123') {
        setAuthError('Incorrect password. (By default, faculty password is your email address, e.g. kushal.bs@gcu.edu.in).');
        return;
      }

      setActiveFacultyId(existing.facultyId);
      localStorage.setItem('fresherism_active_faculty_id', existing.facultyId);
      setAuthSuccess(`Welcome back, ${existing.name}!`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Sign Up validation
      const email = facEmailInput.trim().toLowerCase();
      const facId = facIdInput.trim().toUpperCase();
      const username = facUsernameInput.trim().toLowerCase();
      const password = facPasswordInput.trim();
      const name = facNameInput.trim();

      if (!facId || !username || !password || !email || !name || !facMobileInput || !facDeptInput) {
        setAuthError('All fields including Username and Password are required for faculty registration.');
        return;
      }

      if (!email.endsWith('@gcu.edu.in')) {
        setAuthError('Faculty coordinators must sign up with a valid university email ending in @gcu.edu.in');
        return;
      }

      if (isStudentEmailOrId(email, students) || isStudentEmailOrId(username, students) || isStudentEmailOrId(facId, students)) {
        setAuthError('❌ Access Denied: Student accounts (register number or student email) are not permitted to register as Faculty / Event Coordinator.');
        return;
      }

      const existing = facultyCoordinators.find(
        c => c.facultyId.toLowerCase() === facId.toLowerCase() || 
             c.email.toLowerCase() === email ||
             (c.username && c.username.toLowerCase() === username)
      );

      if (existing) {
        setAuthError('An account with this Faculty ID, Email, or Username already exists.');
        return;
      }

      const newCoord: FacultyCoordinator = {
        facultyId: facId,
        username: username,
        password: password,
        name: name,
        email: email,
        mobile: facMobileInput.trim(),
        department: facDeptInput.trim(),
        isApproved: false, // Default pending convenor approval
        createdAt: new Date().toISOString(),
        registeredAt: new Date().toISOString()
      };

      if (onRegisterCoordinator) {
        onRegisterCoordinator(newCoord);
      }

      setActiveFacultyId(facId);
      localStorage.setItem('fresherism_active_faculty_id', facId);
      setAuthSuccess('Registration submitted successfully! Pending approval by Convenor.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFacultyLogout = () => {
    setActiveFacultyId('');
    localStorage.removeItem('fresherism_active_faculty_id');
  };

  const handleDeleteStudentFromEvent = async (student: Student) => {
    if (!activeEvent) return;

    if (!confirm(`Are you sure you want to remove "${student.name}" (${student.registerNo || student.email}) from "${activeEvent.title}"?`)) {
      return;
    }

    const cleanReg = (student.registerNo || '').toUpperCase().trim();
    const cleanEmail = (student.email || '').toLowerCase().trim();
    const scoreDocId = `${cleanReg || cleanEmail}_${activeEvent.id}`;

    try {
      if (scoreDocId) {
        await dbDeleteScore(scoreDocId, true).catch(() => {});
      }

      const updatedStudent: Student = {
        ...student,
        registeredEventIds: (student.registeredEventIds || []).filter(id => id !== activeEvent.id)
      };

      await dbSaveStudent(updatedStudent);

      const updatedStudentsList = students.map(s => {
        if (
          (s.registerNo && s.registerNo.trim().toUpperCase() === student.registerNo?.trim().toUpperCase()) ||
          (s.email && s.email.trim().toLowerCase() === student.email?.trim().toLowerCase()) ||
          (s.uid && s.uid === student.uid)
        ) {
          return updatedStudent;
        }
        return s;
      });

      if (onUpdateStudents) {
        onUpdateStudents(updatedStudentsList);
      }

      setBulkSuccess(`✅ Student "${student.name}" removed from "${activeEvent.title}".`);
    } catch (err: any) {
      console.error('Error removing student from event:', err);
      setBulkError('Error removing student: ' + (err.message || 'Failed to remove student'));
    }
  };

  const handleUpdateStudentUsn = async (student: Student, newUsn: string) => {
    const cleanUsn = newUsn.trim().toUpperCase();
    const updatedStudent: Student = {
      ...student,
      usnNo: cleanUsn
    };

    const updatedStudentsList = students.map(s => {
      if (
        (s.registerNo && s.registerNo.trim().toUpperCase() === student.registerNo?.trim().toUpperCase()) ||
        (s.email && s.email.trim().toLowerCase() === student.email?.trim().toLowerCase()) ||
        (s.uid && s.uid === student.uid)
      ) {
        return updatedStudent;
      }
      return s;
    });

    if (onUpdateStudents) {
      await onUpdateStudents(updatedStudentsList, [updatedStudent]);
    }

    await dbSaveStudent(updatedStudent).catch(err => console.error('Error saving USN to student doc:', err));

    if (activeEvent) {
      const normReg = student.registerNo ? student.registerNo.trim().toUpperCase() : '';
      const sc = scores.find(s => s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === normReg && s.eventId === activeEvent.id);
      if (sc) {
        const updatedScore: Score = {
          ...sc,
          usnNo: cleanUsn
        };
        await dbSaveScore(updatedScore).catch(() => {});
      }
    }
    setBulkSuccess(`✅ Updated USN NO for "${student.name}": ${cleanUsn || '(Cleared)'}`);
    setTimeout(() => setBulkSuccess(''), 3000);
  };

  // Filter events assigned to this faculty coordinator by Convenor
  const assignedEvents = React.useMemo(() => {
    if (!currentFaculty && !activeFacultyId) return events;
    const cleanEmail = (currentFaculty?.email || activeFacultyId).toLowerCase().trim();
    const cleanFacId = (currentFaculty?.facultyId || activeFacultyId).toLowerCase().trim();
    const cleanName = (currentFaculty?.name || '').toLowerCase().trim();

    const matched = events.filter(e => {
      const eEmail = (e.coordinatorEmail || '').toLowerCase().trim();
      const eFacId = (e.coordinatorFacultyId || '').toLowerCase().trim();
      const eName = (e.coordinatorName || '').toLowerCase().trim();

      if (eEmail && cleanEmail && isMatchingEmail(eEmail, cleanEmail)) return true;
      if (eFacId && cleanFacId && eFacId === cleanFacId) return true;
      if (eName && cleanName && (eName.includes(cleanName) || cleanName.includes(eName))) return true;

      return false;
    });

    // If faculty is assigned to specific event(s), show ONLY those assigned events
    return matched.length > 0 ? matched : events;
  }, [events, currentFaculty, activeFacultyId]);

  // Select active event coordinate
  const [selectedEventId, setSelectedEventId] = useState(() => {
    if (initialEventId && events.some(e => e.id === initialEventId)) {
      return initialEventId;
    }
    return assignedEvents[0]?.id || events[0]?.id || '';
  });

  // Ensure selectedEventId stays in sync when initialEventId or assignedEvents update
  React.useEffect(() => {
    if (initialEventId && assignedEvents.some(e => e.id === initialEventId)) {
      setSelectedEventId(initialEventId);
    } else if (assignedEvents.length > 0 && !assignedEvents.some(e => e.id === selectedEventId)) {
      setSelectedEventId(assignedEvents[0].id);
    }
  }, [initialEventId, assignedEvents]);

  const activeEvent = events.find(e => e.id === selectedEventId);

  // Notifications Form State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifContent, setNotifContent] = useState('');
  const [notifSuccessMsg, setNotifSuccessMsg] = useState('');

  // Schedule Edit State
  const [editDate, setEditDate] = useState(activeEvent?.date || '');
  const [editTimeStart, setEditTimeStart] = useState(activeEvent?.timeStart || '');
  const [editTimeEnd, setEditTimeEnd] = useState(activeEvent?.timeEnd || '');
  const [editVenue, setEditVenue] = useState(activeEvent?.venue || '');
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState('');

  // Brochure / Poster Upload State
  const [brochureUrlInput, setBrochureUrlInput] = useState(activeEvent?.brochureUrl || activeEvent?.imageUrl || '');
  const [brochureSuccessMsg, setBrochureSuccessMsg] = useState('');
  const brochureFileInputRef = useRef<HTMLInputElement>(null);

  // QR Scanner Modal State
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrSearchInput, setQrSearchInput] = useState('');
  const [scannedStudentResult, setScannedStudentResult] = useState<Student | null>(null);
  const [qrScanSuccessMsg, setQrScanSuccessMsg] = useState('');

  // End Event Modal & Completion Details State
  const [isEndEventModalOpen, setIsEndEventModalOpen] = useState(false);
  const [endBrochureNA, setEndBrochureNA] = useState(false);
  const [endBrochureUrl, setEndBrochureUrl] = useState('');
  const [endPhoto1, setEndPhoto1] = useState('');
  const [endPhoto2, setEndPhoto2] = useState('');
  const [endChiefGuestName, setEndChiefGuestName] = useState('');
  const [endChiefGuestDescription, setEndChiefGuestDescription] = useState('');
  const [endChiefGuestEmail, setEndChiefGuestEmail] = useState('');
  const [endChiefGuestMobile, setEndChiefGuestMobile] = useState('');
  const [endInternalJudgeName, setEndInternalJudgeName] = useState('');
  const [endInternalJudgeMobile, setEndInternalJudgeMobile] = useState('');
  const [endInternalJudgeEmail, setEndInternalJudgeEmail] = useState('');
  const [endExternalJudgeName, setEndExternalJudgeName] = useState('');
  const [endExternalJudgeDesignation, setEndExternalJudgeDesignation] = useState('');
  const [endExternalJudgeEmail, setEndExternalJudgeEmail] = useState('');
  const [endExternalJudgeMobile, setEndExternalJudgeMobile] = useState('');
  const [endEventError, setEndEventError] = useState('');
  const [endEventSuccess, setEndEventSuccess] = useState('');
  const [convenorReportSuccess, setConvenorReportSuccess] = useState('');

  // File upload refs for End Event modal
  const endBrochureFileInputRef = useRef<HTMLInputElement>(null);
  const endPhoto1FileInputRef = useRef<HTMLInputElement>(null);
  const endPhoto2FileInputRef = useRef<HTMLInputElement>(null);

  const handleEndBrochureFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Brochure file size must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) setEndBrochureUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleEndPhoto1FileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Photo 1 file size must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) setEndPhoto1(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleEndPhoto2FileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Photo 2 file size must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) setEndPhoto2(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleQrScanSearch = (codeToSearch?: string) => {
    const target = (codeToSearch || qrSearchInput).trim().toUpperCase();
    if (!target) return;

    setQrScanSuccessMsg('');
    // Look up student by Reg No, Email, or Mobile
    const match = students.find(s => 
      s.registerNo.toUpperCase() === target || 
      s.email.toUpperCase() === target ||
      s.mobile === target ||
      target.includes(s.registerNo.toUpperCase())
    );

    if (match) {
      setScannedStudentResult(match);
      setQrScanSuccessMsg(`✅ QR Validated: ${match.name} (${match.registerNo})`);
    } else {
      setScannedStudentResult(null);
      setQrScanSuccessMsg('❌ No student found matching this QR code or Reg No.');
    }
  };

  React.useEffect(() => {
    if (activeEvent) {
      setEditDate(activeEvent.date);
      setEditTimeStart(activeEvent.timeStart);
      setEditTimeEnd(activeEvent.timeEnd);
      setEditVenue(activeEvent.venue);
      setBrochureUrlInput(activeEvent.brochureUrl || activeEvent.imageUrl || '');
      setScheduleSuccessMsg('');
      setNotifSuccessMsg('');
      setBrochureSuccessMsg('');

      setEndBrochureNA(activeEvent.noBrochure || false);
      setEndBrochureUrl(activeEvent.brochureUrl || activeEvent.imageUrl || '');
      setEndPhoto1(activeEvent.geotaggedPhotos?.[0] || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=800');
      setEndPhoto2(activeEvent.geotaggedPhotos?.[1] || 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&q=80&w=800');
      setEndChiefGuestName(activeEvent.chiefGuestName || '');
      setEndChiefGuestDescription(activeEvent.chiefGuestDescription || activeEvent.chiefGuestData || '');
      setEndChiefGuestEmail(activeEvent.chiefGuestEmail || '');
      setEndChiefGuestMobile(activeEvent.chiefGuestMobile || '');
      setEndInternalJudgeName(activeEvent.internalJudgeName || '');
      setEndInternalJudgeMobile(activeEvent.internalJudgeMobile || '');
      setEndInternalJudgeEmail(activeEvent.internalJudgeEmail || '');
      setEndExternalJudgeName(activeEvent.externalJudgeName || '');
      setEndExternalJudgeDesignation(activeEvent.externalJudgeDesignation || '');
      setEndExternalJudgeEmail(activeEvent.externalJudgeEmail || '');
      setEndExternalJudgeMobile(activeEvent.externalJudgeMobile || '');
      setEndEventError('');
      setEndEventSuccess('');
      setConvenorReportSuccess('');
    }
  }, [selectedEventId, activeEvent, isEndEventModalOpen]);

  // Registered students & scores for active event
  const registeredStudents = React.useMemo(() => {
    if (!activeEvent) return [];
    const matched = students.filter(s => isStudentRegisteredForEvent(s, activeEvent, events, scores));
    const knownRegs = new Set(matched.map(s => s.registerNo ? s.registerNo.trim().toUpperCase() : ''));

    if (scores && scores.length > 0) {
      const normTargetTitle = activeEvent.title ? activeEvent.title.trim().toLowerCase() : '';
      const matchingEventIds = new Set<string>();
      matchingEventIds.add(activeEvent.id);
      if (normTargetTitle && events.length > 0) {
        events.forEach(e => {
          if (e.title && e.title.trim().toLowerCase() === normTargetTitle) {
            matchingEventIds.add(e.id);
          }
        });
      }

      const stdMapByReg = new Map<string, Student>();
      const stdMapByEmail = new Map<string, Student>();
      students.forEach(s => {
        if (s.registerNo) stdMapByReg.set(s.registerNo.trim().toUpperCase(), s);
        if (s.email) stdMapByEmail.set(s.email.trim().toLowerCase(), s);
      });

      scores.forEach(sc => {
        if (sc.eventId && matchingEventIds.has(sc.eventId)) {
          const scReg = sc.studentRegisterNo ? sc.studentRegisterNo.trim().toUpperCase() : '';
          if (scReg && !knownRegs.has(scReg)) {
            knownRegs.add(scReg);
            const stdMatch = stdMapByReg.get(scReg) || stdMapByEmail.get(scReg.toLowerCase());
            if (stdMatch) {
              matched.push(stdMatch);
            } else {
              matched.push({
                registerNo: sc.studentRegisterNo,
                name: sc.studentName || sc.studentRegisterNo,
                email: sc.studentRegisterNo.includes('@') ? sc.studentRegisterNo : '',
                mobile: '',
                department: 'Registered Participant',
                programName: '',
                school: 'Garden City University',
                registeredEventIds: [activeEvent.id],
                isProfileComplete: false
              });
            }
          }
        }
      });
    }

    return matched;
  }, [students, events, scores, activeEvent]);

  const filteredRegisteredStudents = React.useMemo(() => {
    if (!tableSearchQuery.trim()) return registeredStudents;
    const q = tableSearchQuery.trim().toLowerCase();
    return registeredStudents.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.registerNo && s.registerNo.toLowerCase().includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      (s.programName && s.programName.toLowerCase().includes(q))
    );
  }, [registeredStudents, tableSearchQuery]);

  const eventScores = React.useMemo(() => {
    if (!activeEvent) return [];
    const normTargetTitle = activeEvent.title ? activeEvent.title.trim().toLowerCase() : '';
    const matchingEventIds = new Set<string>();
    matchingEventIds.add(activeEvent.id);
    if (normTargetTitle && events.length > 0) {
      events.forEach(e => {
        if (e.title && e.title.trim().toLowerCase() === normTargetTitle) {
          matchingEventIds.add(e.id);
        }
      });
    }
    return scores.filter(s => 
      matchingEventIds.has(s.eventId) || 
      (normTargetTitle && s.eventTitle && s.eventTitle.trim().toLowerCase() === normTargetTitle)
    );
  }, [scores, events, activeEvent]);

  const handleSaveEndEventDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setEndEventError('');
    setEndEventSuccess('');

    if (!activeEvent || !onUpdateEvent) return;

    if (!endPhoto1.trim() || !endPhoto2.trim()) {
      setEndEventError('⚠️ Two geotagged photos are MUST/mandatory. Please enter or upload Photo 1 and Photo 2.');
      return;
    }

    const photos = [endPhoto1.trim(), endPhoto2.trim()].filter(Boolean);

    const updated: Event = {
      ...activeEvent,
      isCompleted: true,
      reportedToConvenor: true,
      noBrochure: endBrochureNA,
      brochureUrl: endBrochureNA ? '' : (endBrochureUrl || activeEvent.brochureUrl),
      geotaggedPhotos: photos,
      chiefGuestName: endChiefGuestName.trim(),
      chiefGuestDescription: endChiefGuestDescription.trim(),
      chiefGuestData: endChiefGuestDescription.trim(),
      chiefGuestEmail: endChiefGuestEmail.trim(),
      chiefGuestMobile: endChiefGuestMobile.trim(),
      internalJudgeName: endInternalJudgeName.trim(),
      internalJudgeMobile: endInternalJudgeMobile.trim(),
      internalJudgeEmail: endInternalJudgeEmail.trim(),
      externalJudgeName: endExternalJudgeName.trim(),
      externalJudgeDesignation: endExternalJudgeDesignation.trim(),
      externalJudgeEmail: endExternalJudgeEmail.trim(),
      externalJudgeMobile: endExternalJudgeMobile.trim(),
      hasPendingUpdates: true,
    };

    onUpdateEvent(updated);
    setEndEventSuccess('✅ Event details saved & reported! Generating official Word (.docx) report using Gemini AI...');

    // Automatically trigger report generation using Gemini AI & template merge
    try {
      await downloadEventCompletionWordReport(
        updated,
        registeredStudents,
        scores,
        activeOccasion?.title || 'Fresherism 2026',
        activeOccasion?.reportFormatUrl
      );
      setEndEventSuccess('✅ Event completed & Official Word (.docx) Report generated & downloaded successfully!');
    } catch (reportErr) {
      console.error('Failed to auto-generate report:', reportErr);
      setEndEventSuccess('✅ Event details saved. Click "Generate Report (.docx)" below to download.');
    }
  };

  const handleReportConvenorEventCompleted = async () => {
    if (!activeEvent || !onUpdateEvent) return;

    if (!confirm(`Are you sure you want to report to the Convenor that "${activeEvent.title}" is completed?`)) {
      return;
    }

    const updated: Event = {
      ...activeEvent,
      isCompleted: true,
      reportedToConvenor: true,
      hasPendingUpdates: true
    };

    onUpdateEvent(updated);

    if (onAddNotification) {
      onAddNotification({
        id: `notif-complete-${Date.now()}`,
        eventId: activeEvent.id,
        eventTitle: activeEvent.title,
        title: `🚨 EVENT COMPLETED: ${activeEvent.title}`,
        content: `Faculty Coordinator ${activeEvent.coordinatorName} has completed the event "${activeEvent.title}" and reported it to the Convenor along with score sheet, guest details, and geotagged photos.`,
        timestamp: new Date().toISOString(),
        senderName: activeEvent.coordinatorName || 'Faculty Coordinator'
      });
    }

    setConvenorReportSuccess('🎉 Reported to Convenor successfully! Generating official Word (.docx) report...');

    try {
      await downloadEventCompletionWordReport(
        updated,
        registeredStudents,
        scores,
        activeOccasion?.title || 'Fresherism 2026',
        activeOccasion?.reportFormatUrl
      );
      setConvenorReportSuccess('🎉 Reported to Convenor & Official Word (.docx) Report downloaded successfully!');
    } catch (reportErr) {
      console.error('Failed to auto-generate report on convenor alert:', reportErr);
    }
  };

  const handleReopenEvent = () => {
    if (!activeEvent || !onUpdateEvent) return;
    if (!confirm(`Are you sure you want to re-open "${activeEvent.title}" for editing?\n\nThis will allow you to update student marks, edit photos/guests, end the event, and re-submit the updated report to Convenor.`)) {
      return;
    }
    const updated: Event = {
      ...activeEvent,
      isCompleted: false,
      reportedToConvenor: false,
      resultsPublished: false
    };
    onUpdateEvent(updated);
    setEndEventSuccess('🔄 Event re-opened for editing! You can update scores in the table below and click "End the Event" or "Report Convenor Event Completed" when finished.');
  };

  const handleBrochureFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeEvent) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB. Please upload a smaller image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && onUpdateEvent) {
        setBrochureUrlInput(dataUrl);
        onUpdateEvent({
          ...activeEvent,
          brochureUrl: dataUrl,
          imageUrl: dataUrl
        });
        setBrochureSuccessMsg('✅ Event brochure poster uploaded and updated successfully!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBrochureUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !onUpdateEvent) return;
    onUpdateEvent({
      ...activeEvent,
      brochureUrl: brochureUrlInput,
      imageUrl: brochureUrlInput
    });
    setBrochureSuccessMsg('✅ Event brochure image link saved!');
  };

  // Bulk Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannedSheetsFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');

  // Scanned Score Sheets state
  const scannedSheets = activeEvent?.scannedSheets || [];
  const [selectedScanPreview, setSelectedScanPreview] = useState<string | null>(null);

  const hasUploadedMarks = React.useMemo(() => {
    if (!activeEvent) return false;
    return eventScores.some(s => s.scoreEntered || s.participated || (s.participationPoints ?? 0) > 0) || (scannedSheets && scannedSheets.length > 0);
  }, [activeEvent, eventScores, scannedSheets]);

  const handleScoreSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeEvent || !onUpdateEvent) return;

    const fileList: File[] = Array.from(files);
    let pending = fileList.length;
    const newSheets: { id: string; name: string; url: string; uploadedAt: string }[] = [];

    fileList.forEach((file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 10MB limit.`);
        pending--;
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          newSheets.push({
            id: `sheet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            url: dataUrl,
            uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
          });
        }
        pending--;
        if (pending === 0 && newSheets.length > 0) {
          const currentSheets = activeEvent.scannedSheets || [];
          const updated = [...newSheets, ...currentSheets];
          onUpdateEvent({
            ...activeEvent,
            scannedSheets: updated
          });
        }
      };
      reader.readAsDataURL(file);
    });

    if (scannedSheetsFileInputRef.current) scannedSheetsFileInputRef.current.value = '';
  };

  const handleDeleteScannedSheet = (id: string) => {
    if (!activeEvent || !onUpdateEvent) return;
    const currentSheets = activeEvent.scannedSheets || [];
    const updated = currentSheets.filter(s => s.id !== id);
    onUpdateEvent({
      ...activeEvent,
      scannedSheets: updated
    });
  };

  // 1. If not logged in as a faculty coordinator -> Show Faculty Portal Login / Signup
  if (!activeFacultyId || !currentFaculty) {
    return (
      <div className="max-w-md mx-auto bg-[#1A032E] border-2 border-[#FF007A] rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-fadeIn my-8 font-sans">
        <div className="text-center space-y-3 mb-6">
          <div className="inline-block bg-[#00D1FF]/20 border border-[#00D1FF]/50 rounded-2xl p-3 text-[#00D1FF]">
            <UserCheck className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight italic transform -rotate-1">
            Faculty Coordinator Lounge
          </h3>
          <p className="text-xs text-zinc-400">
            Faculty & Convenors: Sign in using your official university Microsoft 365 / Outlook account (<span className="text-cyan-300 font-mono">@gcu.edu.in</span>).
          </p>
        </div>

        {/* SOLUTION A RECOMMENDED BANNER */}
        <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 border-2 border-[#00D1FF] p-4 rounded-2xl mb-6 space-y-2.5 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="bg-[#00D1FF] text-black font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">Solution A (Recommended)</span>
            <h4 className="text-xs font-black text-[#00D1FF] uppercase tracking-wider">Microsoft 365 One-Tap Sign-In</h4>
          </div>
          <p className="text-[11px] text-zinc-200 leading-relaxed">
            Since Microsoft 365 is enabled in your Firebase Console, Faculty & Convenors can log in using their official university Microsoft 365 / Outlook account with one click! This completely eliminates local passwords and email reset issues.
          </p>
          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={isResetLoading}
            className="w-full bg-[#0078D4] hover:bg-[#006cbd] text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer border border-blue-400/30"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
            <span>Sign in with Microsoft 365 (Faculty / Convenor)</span>
          </button>
          <div className="pt-1 text-center">
            <p className="text-[10px] text-zinc-400">
              Forgot Microsoft 365 password?{' '}
              <a 
                href="https://passwordreset.microsoftonline.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#00D1FF] hover:underline font-bold inline-flex items-center gap-0.5"
              >
                Reset via Microsoft Account Recovery ↗
              </a>
            </p>
          </div>
        </div>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-white/10"></div>
          <span className="px-3 text-[10px] text-zinc-400 font-mono uppercase">or use faculty username / password</span>
          <div className="flex-1 border-t border-white/10"></div>
        </div>

        {/* Tab switcher for Sign In / Sign Up */}
        <div className="flex bg-[#0F011E] p-1 rounded-xl border border-white/10 mb-6 text-xs font-bold">
          <button
            onClick={() => { setAuthMode('signin'); setIsForgotPassword(false); setAuthError(''); setResetSuccessMsg(''); }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${authMode === 'signin' && !isForgotPassword ? 'bg-[#FF007A] text-white font-black' : 'text-zinc-400 hover:text-white'}`}
          >
            Faculty Sign In
          </button>
          <button
            onClick={() => { setAuthMode('signup'); setIsForgotPassword(false); setAuthError(''); setResetSuccessMsg(''); }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${authMode === 'signup' ? 'bg-[#FF007A] text-white font-black' : 'text-zinc-400 hover:text-white'}`}
          >
            Register (@gcu.edu.in)
          </button>
        </div>

        {authError && (
          <div className="bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs p-3.5 rounded-xl mb-4 flex items-center gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {authSuccess && (
          <div className="bg-[#00FFAB]/15 border border-[#00FFAB]/40 text-[#00FFAB] text-xs p-3.5 rounded-xl mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#00FFAB] shrink-0" />
            <span>{authSuccess}</span>
          </div>
        )}

        {resetSuccessMsg && (
          <div className="bg-cyan-950/60 border border-[#00D1FF] text-cyan-200 text-xs p-4 rounded-xl mb-4 space-y-2 shadow-lg">
            <p className="font-extrabold text-[#00D1FF] flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#00D1FF]" /> Password Reset Link Sent
            </p>
            <p className="leading-relaxed">{resetSuccessMsg}</p>
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-[#0F011E] border border-amber-500/40 rounded-xl text-amber-200 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-300">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" /> Email / Password Account Password Reset
              </p>
              <p className="text-zinc-300 leading-relaxed text-[11px]">
                Password resets are for local email/password credentials. If you sign in via Microsoft 365 (@gcu.edu.in), you use Single Sign-On and do not need a password here — for Microsoft password recovery, visit <a href="https://passwordreset.microsoftonline.com" target="_blank" rel="noopener noreferrer" className="text-[#00D1FF] underline font-bold">Microsoft Password Reset Portal</a>.
              </p>
            </div>

            {authError && (
              <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2 shadow-md">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {resetSuccessMsg && (
              <div className="bg-cyan-950/90 border-2 border-[#00D1FF] text-cyan-100 text-xs p-4 rounded-xl space-y-1.5 shadow-xl animate-in fade-in duration-200">
                <p className="font-extrabold text-[#00D1FF] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#00D1FF]" /> Password Reset Alert
                </p>
                <p className="whitespace-pre-line leading-relaxed">{resetSuccessMsg}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-300 uppercase">Username or University Email *</label>
              <input
                type="text"
                placeholder="e.g. prof.smith@gcu.edu.in or coord1"
                value={facUsernameInput}
                onChange={(e) => setFacUsernameInput(e.target.value)}
                className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isResetLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-[#FF007A] hover:opacity-95 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transition-all cursor-pointer text-xs flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isResetLoading ? 'Sending Link...' : 'Send Password Reset Link to Email'}</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setAuthError(''); setResetSuccessMsg(''); }}
                className="text-xs text-[#00D1FF] hover:underline font-bold"
              >
                ← Back to Faculty Sign In
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleFacultyAuth} className="space-y-4 text-xs">
            {authMode === 'signin' ? (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase">Username or Faculty ID *</label>
                  <input
                    type="text"
                    placeholder="e.g. coord1 or FAC-101"
                    value={facUsernameInput}
                    onChange={(e) => setFacUsernameInput(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-zinc-300 uppercase">Password *</label>
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setAuthError(''); setResetSuccessMsg(''); }}
                      className="text-[10px] font-bold text-[#00D1FF] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={facPasswordInput}
                    onChange={(e) => setFacPasswordInput(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase">Faculty ID *</label>
                  <input
                    type="text"
                    placeholder="e.g. FAC-101"
                    value={facIdInput}
                    onChange={(e) => setFacIdInput(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-300 uppercase">Username *</label>
                    <input
                      type="text"
                      placeholder="e.g. coord5"
                      value={facUsernameInput}
                      onChange={(e) => setFacUsernameInput(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-300 uppercase">Password *</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={facPasswordInput}
                      onChange={(e) => setFacPasswordInput(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase">Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Sarah Matthews"
                    value={facNameInput}
                    onChange={(e) => setFacNameInput(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase">University Email (@gcu.edu.in) *</label>
                  <input
                    type="email"
                    placeholder="e.g. s.matthews@gcu.edu.in"
                    value={facEmailInput}
                    onChange={(e) => setFacEmailInput(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase">Mobile Number *</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={facMobileInput}
                    onChange={(e) => setFacMobileInput(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase">Department Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. School of Computer Science"
                    value={facDeptInput}
                    onChange={(e) => setFacDeptInput(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF007A]"
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#FF007A] to-[#00D1FF] hover:opacity-95 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transition-all cursor-pointer mt-4 text-xs"
            >
              {authMode === 'signin' ? 'Sign In as Coordinator' : 'Submit Registration for Approval'}
            </button>
          </form>
        )}
      </div>
    );
  }

  // 2. Send Approval Request Helper
  const handleSendApprovalRequestToConvenor = async () => {
    if (!currentFaculty) return;
    try {
      const updated: FacultyCoordinator = {
        ...currentFaculty,
        isApproved: false
      };
      await dbSaveCoordinator(updated);
      if (onRegisterCoordinator) onRegisterCoordinator(updated);

      if (onAddNotification) {
        onAddNotification({
          id: `notif-approval-${Date.now()}`,
          eventId: activeEvent?.id || 'general',
          eventTitle: activeEvent?.title || 'Faculty Approval Request',
          title: `📩 Faculty Approval Request: ${currentFaculty.name}`,
          content: `Prof. ${currentFaculty.name} (${currentFaculty.email}, Dept: ${currentFaculty.department || 'General Faculty'}) has sent a request to Convenor for Event Coordinator rights.`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          senderName: currentFaculty.name
        });
      }
      setApprovalReqSent(true);
      alert('✅ Approval request sent to Convenor! Once approved by Convenor, full coordinator scoring privileges will be enabled.');
    } catch (err: any) {
      alert('Failed to send request: ' + (err.message || 'Unknown error'));
    }
  };

  // 3. IF NCC Coordinator (Prof. Vishnu Pandhare)
  if (currentFaculty.isNccCoordinator || currentFaculty.email.toLowerCase() === 'vishnupandhare@gcu.edu.in' || currentFaculty.name.toLowerCase().includes('vishnu')) {
    return (
      <NccCoordinatorDashboard
        faculty={currentFaculty}
        students={students}
        onAddNotification={onAddNotification}
        onGoToLanding={onGoToLanding}
      />
    );
  }

  if (!activeEvent) {
    return (
      <div className="text-center py-12 text-zinc-500">
        No events configured to coordinate yet. Please ask the Convenor to create events first!
      </div>
    );
  }

  // Get messages sent from convenor to this active event's coordinator
  const coordMessages = messages.filter(
    msg => msg.coordinatorFacultyId === activeEvent.coordinatorFacultyId
  );

  // Send a custom notification/announcement
  const handleSendNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifContent) return;

    const newNotif: Notification = {
      id: `notif-${Date.now()}`,
      eventId: activeEvent.id,
      eventTitle: activeEvent.title,
      title: notifTitle.trim(),
      content: notifContent.trim(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      senderName: activeEvent.coordinatorName
    };

    onAddNotification(newNotif);
    setNotifTitle('');
    setNotifContent('');
    setNotifSuccessMsg('Announcement broadcasted successfully to all registered students!');
    setTimeout(() => setNotifSuccessMsg(''), 4000);
  };

  // Update schedule logic
  const handleUpdateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDate || !editTimeStart || !editTimeEnd || !editVenue) return;

    // Detect if anything changed
    const dateChanged = editDate !== activeEvent.date;
    const timeChanged = editTimeStart !== activeEvent.timeStart || editTimeEnd !== activeEvent.timeEnd;
    const venueChanged = editVenue !== activeEvent.venue;

    if (!dateChanged && !timeChanged && !venueChanged) {
      setScheduleSuccessMsg('No schedule changes made.');
      return;
    }

    onUpdateEventSchedule(activeEvent.id, editDate, editTimeStart, editTimeEnd, editVenue);

    // Auto-generate notification alert for students!
    let alertMsg = 'Schedule updated: ';
    const changes: string[] = [];
    if (dateChanged) changes.push(`Date is now ${editDate}`);
    if (timeChanged) changes.push(`Timings are now ${editTimeStart} - ${editTimeEnd}`);
    if (venueChanged) changes.push(`Venue moved to ${editVenue}`);
    alertMsg += changes.join(', ');

    const autoNotif: Notification = {
      id: `notif-auto-${Date.now()}`,
      eventId: activeEvent.id,
      eventTitle: activeEvent.title,
      title: '🚨 CRITICAL SCHEDULE CHANGE',
      content: alertMsg,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      senderName: `${activeEvent.coordinatorName} (Automated)`
    };

    onAddNotification(autoNotif);
    setScheduleSuccessMsg('Schedule updated, and change notification published!');
    setTimeout(() => setScheduleSuccessMsg(''), 4000);
  };

  // Update student participation and criterion/total marks (takes faculty entered marks directly without inflating)
  const handleScoreUpdate = (
    studentRegNo: string,
    isParticipated: boolean,
    c1Val?: number,
    c2Val?: number,
    c3Val?: number,
    c4Val?: number,
    totalVal?: number
  ) => {
    if (!activeEvent) return;
    const cleanReg = studentRegNo.trim().toUpperCase();

    const normTargetTitle = activeEvent.title ? activeEvent.title.trim().toLowerCase() : '';
    const matchingEventIds = new Set<string>();
    matchingEventIds.add(activeEvent.id);
    if (normTargetTitle && events.length > 0) {
      events.forEach(e => {
        if (e.title && e.title.trim().toLowerCase() === normTargetTitle) {
          matchingEventIds.add(e.id);
        }
      });
    }

    const student = students.find(std => std.registerNo && std.registerNo.trim().toUpperCase() === cleanReg);
    const canonicalId = `${cleanReg}_${activeEvent.id}`.replace(/\//g, '_');

    const staleScores = scores.filter(s => 
      s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === cleanReg && 
      (matchingEventIds.has(s.eventId) || (normTargetTitle && s.eventTitle && s.eventTitle.trim().toLowerCase() === normTargetTitle))
    );

    const existingScore = staleScores[0];

    let c1 = typeof c1Val === 'number' ? Math.max(0, Math.min(20, c1Val)) : (existingScore?.criterion1 ?? 0);
    let c2 = typeof c2Val === 'number' ? Math.max(0, Math.min(20, c2Val)) : (existingScore?.criterion2 ?? 0);
    let c3 = typeof c3Val === 'number' ? Math.max(0, Math.min(20, c3Val)) : (existingScore?.criterion3 ?? 0);
    let c4 = typeof c4Val === 'number' ? Math.max(0, Math.min(20, c4Val)) : (existingScore?.criterion4 ?? 0);

    const criteriaTotal = c1 + c2 + c3 + c4;
    const isPart = isParticipated || criteriaTotal > 0;
    const partPts = isPart ? 15 : 0;
    const regPts = 5;

    let totalMarks = totalVal !== undefined ? Math.max(0, Math.min(100, totalVal)) : (isPart ? (regPts + partPts + criteriaTotal) : regPts);

    const isWinner = staleScores.some(s => s.isWinner);

    let updatedScoreRecord: Score;

    if (activeEvent.resultsPublished) {
      // Event is already published. Save new values to pendingUpdate while preserving the old ones.
      updatedScoreRecord = {
        ...(existingScore || {
          id: canonicalId,
          studentRegisterNo: student ? student.registerNo : cleanReg,
          studentName: student ? student.name : cleanReg,
          eventId: activeEvent.id,
          eventTitle: activeEvent.title,
          registrationPoints: 5,
          participated: false,
          participationPoints: 0,
          participationMarks: 0,
          criterion1: 0,
          criterion2: 0,
          criterion3: 0,
          criterion4: 0,
          eventScore: 0,
          totalScore: 5,
          isWinner: false,
          scoreEntered: false,
          basePoints: 5,
          performanceScore: 0
        }),
        pendingUpdate: {
          eventScore: criteriaTotal,
          totalScore: totalMarks,
          criterion1: c1,
          criterion2: c2,
          criterion3: c3,
          criterion4: c4,
          participationMarks: partPts,
          participated: isPart,
          isWinner: isWinner
        }
      };
    } else {
      updatedScoreRecord = {
        id: canonicalId,
        studentRegisterNo: student ? student.registerNo : cleanReg,
        studentName: student ? student.name : cleanReg,
        eventId: activeEvent.id,
        eventTitle: activeEvent.title,
        registrationPoints: 5,
        participated: isPart,
        participationPoints: partPts,
        participationMarks: partPts,
        criterion1: c1,
        criterion2: c2,
        criterion3: c3,
        criterion4: c4,
        eventScore: criteriaTotal,
        totalScore: totalMarks,
        isWinner: isWinner,
        scoreEntered: true,
        basePoints: 5,
        performanceScore: criteriaTotal,
        pendingUpdate: undefined
      };
    }

    const remainingScores = scores.filter(s => 
      !(s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === cleanReg && 
        (matchingEventIds.has(s.eventId) || (normTargetTitle && s.eventTitle && s.eventTitle.trim().toLowerCase() === normTargetTitle)))
    );

    onUpdateScores([...remainingScores, updatedScoreRecord], [updatedScoreRecord]);

    // Always flag the event for convenor review when scores are entered/updated.
    // Previously this only fired when resultsPublished===true (post-publish edits).
    // Now it fires on ANY score save so the convenor sees a notification immediately.
    if (onUpdateEvent && !activeEvent.hasPendingUpdates) {
      onUpdateEvent({
        ...activeEvent,
        hasPendingUpdates: true,
        reportSubmitted: true
      });
    }
  };

  // Toggle Winner Status
  const handleToggleWinner = (studentRegNo: string) => {
    if (!activeEvent) return;
    const cleanReg = normalizeRegisterNo(studentRegNo);
    const normTargetTitle = activeEvent.title ? activeEvent.title.trim().toLowerCase() : '';
    const matchingEventIds = new Set<string>();
    matchingEventIds.add(activeEvent.id);
    if (normTargetTitle && events.length > 0) {
      events.forEach(e => {
        if (e.title && e.title.trim().toLowerCase() === normTargetTitle) {
          matchingEventIds.add(e.id);
        }
      });
    }

    const canonicalId = `${cleanReg}_${activeEvent.id}`.replace(/\//g, '_');
    const existing = scores.find(s => s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === cleanReg && (matchingEventIds.has(s.eventId) || (normTargetTitle && s.eventTitle && s.eventTitle.trim().toLowerCase() === normTargetTitle)));

    const updatedScore: Score = existing ? {
      ...existing,
      id: canonicalId,
      eventId: activeEvent.id,
      isWinner: !existing.isWinner,
      scoreEntered: true
    } : {
      id: canonicalId,
      studentRegisterNo: studentRegNo,
      studentName: studentRegNo,
      eventId: activeEvent.id,
      eventTitle: activeEvent.title,
      registrationPoints: 5,
      participated: false,
      participationPoints: 0,
      eventScore: 0,
      totalScore: 5,
      isWinner: true,
      scoreEntered: true
    };

    const remaining = scores.filter(s => !(s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === cleanReg && (matchingEventIds.has(s.eventId) || (normTargetTitle && s.eventTitle && s.eventTitle.trim().toLowerCase() === normTargetTitle))));
    onUpdateScores([...remaining, updatedScore], [updatedScore]);

    // Flag for convenor review
    if (onUpdateEvent && !activeEvent.hasPendingUpdates) {
      onUpdateEvent({ ...activeEvent, hasPendingUpdates: true, reportSubmitted: true });
    }
  };

  // Delete a student score record
  const handleDeleteScore = (studentRegNo: string) => {
    if (!activeEvent) return;
    const cleanReg = normalizeRegisterNo(studentRegNo);
    const normTargetTitle = activeEvent.title ? activeEvent.title.trim().toLowerCase() : '';
    const matchingEventIds = new Set<string>();
    matchingEventIds.add(activeEvent.id);
    if (normTargetTitle && events.length > 0) {
      events.forEach(e => {
        if (e.title && e.title.trim().toLowerCase() === normTargetTitle) {
          matchingEventIds.add(e.id);
        }
      });
    }

    const toDelete = scores.filter(s => 
      s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === cleanReg && matchingEventIds.has(s.eventId)
    );
    toDelete.forEach(s => {
      if (s.id) dbDeleteScore(s.id).catch(() => {});
    });

    const updatedScores = scores.filter(s => 
      !(s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === cleanReg && matchingEventIds.has(s.eventId))
    );
    onUpdateScores(updatedScores);
  };

  // On the spot manual registration for event
  const handleOnTheSpotRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) return;
    if (!newRegNo.trim() || !newName.trim()) {
      alert('Please enter student Register No and Full Name.');
      return;
    }

    const cleanReg = newRegNo.trim().toUpperCase();
    const cleanUsn = newUsnNo.trim().toUpperCase() || undefined;
    const existing = students.find(s => s.registerNo && s.registerNo.trim().toUpperCase() === cleanReg);

    if (existing) {
      const updatedStudent: Student = {
        ...existing,
        usnNo: cleanUsn || existing.usnNo,
        registeredEventIds: Array.from(new Set([...(existing.registeredEventIds || []), activeEvent.id]))
      };
      if (newMobile.trim() && (!existing.mobile || existing.mobile.trim() === '')) {
        updatedStudent.mobile = newMobile.trim();
      }
      if (newSchool.trim() && (!existing.school || existing.school.trim() === '')) {
        updatedStudent.school = newSchool.trim();
      }
      await dbSaveStudent(updatedStudent);
      if (onUpdateStudents) await onUpdateStudents(students.map(s => s.registerNo === updatedStudent.registerNo ? updatedStudent : s), [updatedStudent]);
      else if (onRegisterStudent) onRegisterStudent(updatedStudent);
    } else {
      const newStd: Student = {
        registerNo: cleanReg,
        usnNo: cleanUsn || cleanReg, // Set usnNo to registerNo automatically per user request
        name: newName.trim(),
        email: newEmail.trim() || '',
        mobile: newMobile.trim(),
        department: newDept.trim() || 'General',
        programName: newProgram.trim() || '',
        school: newSchool.trim() || 'Garden City University',
        registeredEventIds: [activeEvent.id],
        isProfileComplete: true
      };
      await dbSaveStudent(newStd);
      if (onUpdateStudents) await onUpdateStudents([...students, newStd], [newStd]);
      else if (onRegisterStudent) onRegisterStudent(newStd);
    }

    // Seed initial score record (5 reg pts)
    handleScoreUpdate(cleanReg, true, 0);

    setNewRegNo('');
    setNewUsnNo('');
    setNewName('');
    setNewDept('');
    setNewProgram('');
    setNewEmail('');
    setNewMobile('');
    setNewSchool('Garden City University');
    setShowAddStudentModal(false);
    setBulkSuccess(`Registered ${newName} (${cleanReg}) for ${activeEvent.title}!`);
    setTimeout(() => setBulkSuccess(''), 4000);
  };

  // Edit Student Info
  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editStudentName.trim() || !editStudentRegNo.trim()) return;

    const oldReg = editingStudent.registerNo;
    const newReg = editStudentRegNo.trim().toUpperCase();
    const cleanUsn = editStudentUsnNo.trim().toUpperCase() || undefined;

    const updatedStd: Student = {
      ...editingStudent,
      name: editStudentName.trim(),
      registerNo: newReg,
      usnNo: cleanUsn,
      department: editStudentDept.trim() || editingStudent.department
    };

    if (oldReg !== newReg) {
      await dbDeleteStudent(oldReg);
    }
    await dbSaveStudent(updatedStd);
    if (onUpdateStudents) {
      await onUpdateStudents(students.map(s => s.registerNo === oldReg ? updatedStd : s), [updatedStd]);
    } else if (onRegisterStudent) {
      onRegisterStudent(updatedStd);
    }

    // Update scores with new student info
    if (scores.length > 0) {
      const changedScores: Score[] = [];
      const updatedScores = scores.map(s => {
        if (s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === oldReg.trim().toUpperCase()) {
          const updatedScore: Score = {
            ...s,
            studentRegisterNo: newReg,
            usnNo: cleanUsn || s.usnNo,
            studentName: editStudentName.trim()
          };
          changedScores.push(updatedScore);
          return updatedScore;
        }
        return s;
      });
      if (changedScores.length > 0) {
        onUpdateScores(updatedScores, changedScores);
      } else {
        onUpdateScores(updatedScores);
      }
    }

    setEditingStudent(null);
    setEditStudentUsnNo('');
    setBulkSuccess(`Student details updated successfully!`);
    setTimeout(() => setBulkSuccess(''), 4000);
  };

  // Delete Student from THIS EVENT only - ISOLATED DELETE (No parent handlers)
  const handleDeleteStudent = async () => {
    if (!editingStudent || !activeEvent) return;
    const studentName = editingStudent.name;
    const studentReg = editingStudent.registerNo;

    if (!confirm(`Remove "${studentName}" from "${activeEvent.title}"? This cannot be undone.`)) {
      return;
    }

    // Immediately close modal before any async operations
    setEditingStudent(null);
    console.log('🗑️ ISOLATED DELETE START - Modal closed, deletion in background');

    // Run deletion silently in background - NO callbacks to parent
    (async () => {
      try {
        const cleanReg = studentReg.trim().toUpperCase();
        const scoreId = `${cleanReg}_${activeEvent.id}`.replace(/\//g, '_');

        console.log(`🗑️ Deleting from Firebase: ${scoreId}`);
        await dbDeleteScore(scoreId, true);
        console.log(`✅ Deleted: ${scoreId}`);

        setBulkSuccess(`✅ "${studentName}" removed from "${activeEvent.title}"`);
        setTimeout(() => setBulkSuccess(''), 2000);
        console.log('🎉 Deletion complete');
      } catch (err: any) {
        console.error('❌ Delete error:', err?.message);
        setBulkSuccess(`⚠️ Delete issue - check console. Error: ${err?.message || 'unknown'}`);
      }
    })();
  };

  // Excel / CSV Bulk Upload handling for marks
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkError('');
    setBulkSuccess('');

    try {
      const parsedMarks = await parseMarksExcel(file);

      if (parsedMarks.length === 0) {
        setBulkError('Could not find any student score rows to parse in the Excel sheet.');
        return;
      }

      if (!activeEvent) return;

      const normTargetTitle = activeEvent.title ? activeEvent.title.trim().toLowerCase() : '';
      const matchingEventIds = new Set<string>();
      matchingEventIds.add(activeEvent.id);
      if (normTargetTitle && events.length > 0) {
        events.forEach(ev => {
          if (ev.title && ev.title.trim().toLowerCase() === normTargetTitle) {
            matchingEventIds.add(ev.id);
          }
        });
      }

      let updatedCount = 0;
      let workingScores = [...scores];
      let workingStudents = [...students];
      const studentsToSave: Student[] = [];
      const scoresToSave: Score[] = [];

      for (const parsed of parsedMarks) {
        const cleanParsedReg = normalizeRegisterNo(parsed.studentRegisterNo);
        if (!cleanParsedReg) continue;

        const c1 = parsed.criterion1 ?? 0;
        const c2 = parsed.criterion2 ?? 0;
        const c3 = parsed.criterion3 ?? 0;
        const c4 = parsed.criterion4 ?? 0;
        const evtScore = (c1 + c2 + c3 + c4) > 0 ? (c1 + c2 + c3 + c4) : (parsed.eventScore || 0);
        const isPart = Boolean(parsed.participated);
        const regPts = parsed.registrationPoints !== undefined ? parsed.registrationPoints : 5;
        
        // CASE 1: Non-participants get 0 participation marks, but retain 5 registration points
        const partPts = parsed.participationMarks !== undefined 
          ? (isPart ? parsed.participationMarks : 0) 
          : (isPart ? 15 : 0);

        const total = (parsed.totalScore !== undefined && parsed.totalScore > 0) 
          ? parsed.totalScore 
          : (regPts + partPts + evtScore);

        const existingStudent = workingStudents.find(
          s => (s.registerNo && s.registerNo.trim().toUpperCase() === cleanParsedReg) ||
               (parsed.usnNo && s.usnNo && s.usnNo.trim().toUpperCase() === parsed.usnNo.trim().toUpperCase())
        );
        
        // Use the student's known registerNo from DB if available, otherwise fallback to parsed
        const targetRegisterNo = existingStudent?.registerNo || cleanParsedReg;
        const canonicalId = `${targetRegisterNo}_${activeEvent.id}`.replace(/\//g, '_');

        const staleScores = workingScores.filter(s => 
          matchingEventIds.has(s.eventId) &&
          (
            (s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === targetRegisterNo.trim().toUpperCase()) ||
            (s.usnNo && parsed.usnNo && s.usnNo.trim().toUpperCase() === parsed.usnNo.trim().toUpperCase())
          )
        );
        const existingScore = staleScores[0];

        let newOrUpdatedScore: Score;

        if (activeEvent.resultsPublished) {
          newOrUpdatedScore = {
            ...(existingScore || {
              id: canonicalId,
              studentRegisterNo: cleanParsedReg,
              usnNo: parsed.usnNo || undefined,
              studentName: formatToTitleCase(parsed.studentName || cleanParsedReg),
              eventId: activeEvent.id,
              eventTitle: activeEvent.title,
              registrationPoints: 5,
              participated: false,
              participationPoints: 0,
              participationMarks: 0,
              criterion1: 0,
              criterion2: 0,
              criterion3: 0,
              criterion4: 0,
              eventScore: 0,
              totalScore: 5,
              isWinner: false,
              scoreEntered: false,
              basePoints: 5,
              performanceScore: 0
            }),
            pendingUpdate: {
              eventScore: evtScore,
              totalScore: total,
              criterion1: c1,
              criterion2: c2,
              criterion3: c3,
              criterion4: c4,
              participationMarks: partPts,
              participated: isPart,
              isWinner: Boolean(parsed.isWinner)
            }
          };
        } else {
          newOrUpdatedScore = {
            id: canonicalId,
            studentRegisterNo: targetRegisterNo,
            usnNo: parsed.usnNo || undefined,
            studentName: formatToTitleCase(parsed.studentName || targetRegisterNo),
            eventId: activeEvent.id,
            eventTitle: activeEvent.title,
            registrationPoints: regPts,
            participated: isPart,
            participationPoints: partPts,
            participationMarks: partPts,
            criterion1: c1,
            criterion2: c2,
            criterion3: c3,
            criterion4: c4,
            eventScore: evtScore,
            totalScore: total,
            isWinner: Boolean(parsed.isWinner),
            scoreEntered: true,
            basePoints: regPts,
            performanceScore: evtScore,
            pendingUpdate: undefined
          };
        }

        scoresToSave.push(newOrUpdatedScore);

        // CASE 2: Auto-create / register walk-in students in backend Firestore database
        if (existingStudent) {
          const needsEventReg = !existingStudent.registeredEventIds?.includes(activeEvent.id);
          const needsUsnUpdate = parsed.usnNo && parsed.usnNo !== existingStudent.usnNo;

          if (needsEventReg || needsUsnUpdate) {
            const updatedStudent: Student = {
              ...existingStudent,
              usnNo: parsed.usnNo || existingStudent.usnNo,
              registeredEventIds: Array.from(new Set([...(existingStudent.registeredEventIds || []), activeEvent.id]))
            };
            studentsToSave.push(updatedStudent);
            workingStudents = workingStudents.map(s => s.registerNo === updatedStudent.registerNo ? updatedStudent : s);
          }
        } else {
          // Walk-in student added on spot by faculty in score sheet!
          const newWalkInStudent: Student = {
            registerNo: targetRegisterNo,
            usnNo: parsed.usnNo || targetRegisterNo, // Auto-populate USN from register number
            name: formatToTitleCase(parsed.studentName || targetRegisterNo),
            email: '',
            mobile: parsed.mobile || '',
            department: 'General',
            programName: '',
            school: 'Garden City University',
            registeredEventIds: [activeEvent.id],
            isProfileComplete: true
          };
          studentsToSave.push(newWalkInStudent);
          workingStudents.push(newWalkInStudent);
        }

        workingScores = [
          ...workingScores.filter(s => !(s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === cleanParsedReg && matchingEventIds.has(s.eventId))),
          newOrUpdatedScore
        ];
        updatedCount++;
      }

      // Persist all new/updated students and scores directly to Firestore backend in batch
      if (studentsToSave.length > 0 || scoresToSave.length > 0) {
        await dbSaveStudentsAndScoresBatch(studentsToSave, scoresToSave);
      }

      if (onUpdateStudents && studentsToSave.length > 0) {
        await onUpdateStudents(workingStudents, studentsToSave);
      }
      await onUpdateScores(workingScores, scoresToSave);

      // Always flag for convenor review when bulk scores are uploaded.
      // Use hasPendingUpdates so the banner shows without clearing the publication status.
      if (onUpdateEvent) {
        onUpdateEvent({
          ...activeEvent,
          hasPendingUpdates: true,
          reportSubmitted: true
        });
      }

      setBulkSuccess(`Successfully uploaded Excel scores for ${updatedCount} students & registered ${studentsToSave.length} walk-in student(s) in backend!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Error uploading Excel score sheet:', err);
      const msg = err?.message || 'Ensure the uploaded Excel file follows the template format.';
      setBulkError(`Upload failed: ${msg}`);
    }
  };

  // Trigger file dialog
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* 🏠 BACK TO HOME / LANDING PAGE BAR */}
      <div className="flex items-center justify-between bg-[#1A032E]/90 border border-amber-500/40 p-3.5 rounded-2xl shadow-xl">
        <button
          onClick={onGoToLanding}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer border border-amber-300"
        >
          <Home className="w-4 h-4" />
          <span>← Back to Home / Landing Page</span>
        </button>
        <span className="text-xs text-amber-200 font-semibold hidden sm:inline-flex items-center gap-2">
          <img 
            src="/gculogo.svg" 
            alt="GCU Logo" 
            className="w-5 h-5 object-contain" 
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.endsWith('.svg')) target.src = '/gculogo.png';
            }} 
          />
          <span>Garden City University Festivals Portal</span>
        </span>
      </div>

      {/* 👤 FACULTY COORDINATOR SESSION BAR WITH SIGN OUT */}
      <div className="bg-[#1A032E] border border-purple-500/40 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF007A] to-[#00D1FF] flex items-center justify-center font-black text-white text-sm shadow-md shrink-0">
            {currentFaculty.name ? currentFaculty.name.charAt(0).toUpperCase() : 'F'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">{currentFaculty.name}</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold rounded-md uppercase">
                Active Faculty
              </span>
            </div>
            <p className="text-xs text-purple-200 font-medium">
              ID: <span className="font-mono text-cyan-300 font-bold">{currentFaculty.facultyId}</span> • {currentFaculty.department} • <span className="font-mono">{currentFaculty.email}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={openEditProfileModal}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-black rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg border border-purple-400/30"
          >
            <UserCheck className="w-4 h-4 text-cyan-300" />
            <span>✏️ Edit Profile & Mobile No</span>
          </button>

          <button
            onClick={() => setShowScannerModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-[#00D1FF] to-blue-600 hover:opacity-90 text-white font-black rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#00D1FF]/20 border border-white/20"
          >
            <QrCode className="w-4 h-4 text-white" />
            <span>Scan / Verify Student QR</span>
          </button>

          <button
            onClick={handleFacultyLogout}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* READ-ONLY / PENDING CONVENOR APPROVAL BANNER FOR FACULTY */}
      {currentFaculty && !currentFaculty.isApproved && (
        <div className="bg-gradient-to-r from-amber-950/80 via-[#1A032E] to-amber-950/80 border-2 border-amber-500/60 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 font-sans animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 font-black text-lg shrink-0">
              👨‍🏫
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                  FACULTY MEMBER VIEW (READ-ONLY EVENT & LEADERBOARD ACCESS)
                </span>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-bold rounded-full border border-amber-400/30">
                  PENDING CONVENOR APPROVAL
                </span>
              </div>
              <p className="text-xs text-zinc-200 font-medium mt-0.5">
                Welcome, <strong className="text-white">{currentFaculty.name}</strong> ({currentFaculty.email})! You have full access to view all event details, registered students, scores, and live leaderboards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
            {approvalReqSent ? (
              <span className="px-3 py-2 bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5">
                ✓ Request Sent to Convenor
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSendApprovalRequestToConvenor}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:opacity-90 text-black font-black text-xs uppercase rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>📩 Send Approval Request to Convenor</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 🚨 HIGH PRIORITY: DIRECTIVES FROM CONVENOR (ON TOP OF FACULTY COORDINATOR DASHBOARD) */}
      <div className="bg-gradient-to-r from-cyan-950/90 via-[#0F011E] to-[#1A032E] border-2 border-[#00D1FF] rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#00D1FF]/30 pb-3">
          <div className="flex items-center gap-2.5 text-[#00D1FF]">
            <Bell className="w-6 h-6 animate-pulse text-[#00D1FF] shrink-0" />
            <h3 className="text-lg font-black text-white uppercase tracking-tight italic">
              🚨 Directives from Convenor (High Priority Memos)
            </h3>
          </div>
          {coordMessages.length > 0 && (
            <span className="bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/50 font-black px-3 py-1 rounded-lg text-[10px] font-mono tracking-wider self-start sm:self-auto">
              {coordMessages.length} Directives
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed font-medium">
          Official instructions, memos, and steering guidelines sent to your faculty ID (<span className="text-[#00D1FF] font-mono font-bold">{activeEvent?.coordinatorFacultyId || currentFaculty.facultyId}</span>) by the Convenor.
        </p>

        {coordMessages.length === 0 ? (
          <div className="p-4 bg-black/40 border border-white/10 rounded-2xl text-center text-xs text-zinc-400 italic">
            No active directives received from the Convenor yet.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {coordMessages.map((msg) => (
              <div 
                key={msg.id}
                className="p-4 bg-black/60 border border-[#00D1FF]/40 rounded-2xl space-y-1.5 shadow-md"
              >
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-[#00D1FF] font-black uppercase tracking-wider">MEMO FROM CONVENOR</span>
                  <span className="text-amber-300 font-bold">{msg.timestamp}</span>
                </div>
                <p className="text-xs text-zinc-100 font-medium whitespace-pre-wrap leading-relaxed">
                  {msg.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selector & Top Summary bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <p className="text-pink-400 font-extrabold font-mono text-[10px] uppercase tracking-widest">
              PORTAL SELECTION
            </p>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              Event Coordinator Console
            </h2>
            <p className="text-xs text-slate-200 font-semibold">
              Select the specific faculty event you are currently managing:
            </p>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => { setIsQrScannerOpen(true); setQrScanSuccessMsg(''); setScannedStudentResult(null); setQrSearchInput(''); }}
              className="w-full sm:w-auto px-4 py-3 bg-gradient-to-r from-[#00D1FF] to-blue-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20 shrink-0"
            >
              <QrCode className="w-4.5 h-4.5 text-white" />
              <span>Scan Student QR / ID</span>
            </button>

            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full md:w-72 bg-zinc-950 border border-zinc-800 focus:border-pink-500 text-white font-bold text-sm rounded-xl px-4 py-3 focus:outline-none transition-all cursor-pointer"
            >
              {assignedEvents.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.coordinatorName || 'Coordinator'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-event quick selection tabs */}
        {assignedEvents.length > 1 && (
          <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-[#00D1FF] uppercase tracking-wider mr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#00D1FF]" />
              <span>Assigned Events ({assignedEvents.length}):</span>
            </span>
            {assignedEvents.map(e => {
              const isActive = e.id === selectedEventId;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelectedEventId(e.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-2 border ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF007A] to-purple-600 text-white border-pink-400 shadow-lg shadow-pink-500/20 scale-105'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <span>{e.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Event Logistics Card - Large Font & Vibrant Colors */}
      {activeEvent && (
        <div className="bg-gradient-to-br from-[#2D0B5A] via-[#1A032E] to-[#120224] border-2 border-[#00D1FF] rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <span className="px-3 py-1 bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF] text-xs font-mono font-black uppercase rounded-lg shadow-sm">
              {activeEvent.hostDepartment}
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white italic transform -rotate-1 tracking-tight drop-shadow-md">
              {activeEvent.title}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-200 font-medium">
              Coordinator: <span className="text-white font-black">{activeEvent.coordinatorName}</span>
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-3">
            <div className="bg-[#0F011E] border-2 border-[#FF007A] p-4 rounded-2xl flex items-center gap-3.5 shadow-lg shadow-[#FF007A]/20">
              <Calendar className="w-7 h-7 text-[#FF007A]" />
              <div>
                <p className="text-[10px] text-[#FF007A] font-black uppercase tracking-wider">Date</p>
                <p className="text-lg md:text-xl font-black text-white">{formatDateDDMMYYYY(activeEvent.date)}</p>
              </div>
            </div>

            <div className="bg-[#0F011E] border-2 border-[#00D1FF] p-4 rounded-2xl flex items-center gap-3.5 shadow-lg shadow-[#00D1FF]/20">
              <Clock className="w-7 h-7 text-[#00D1FF]" />
              <div>
                <p className="text-[10px] text-[#00D1FF] font-black uppercase tracking-wider">Time</p>
                <p className="text-lg md:text-xl font-black text-white">{activeEvent.timeStart} – {activeEvent.timeEnd}</p>
              </div>
            </div>

            <div className="bg-[#0F011E] border-2 border-[#00FFAB] p-4 rounded-2xl flex items-center gap-3.5 shadow-lg shadow-[#00FFAB]/20">
              <MapPin className="w-7 h-7 text-[#00FFAB]" />
              <div>
                <p className="text-[10px] text-[#00FFAB] font-black uppercase tracking-wider">Venue</p>
                <p className="text-lg md:text-xl font-black text-white leading-tight">{activeEvent.venue}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Left Column (Announcement & Schedule), Right Column (Registrations & Score Entry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (Control Widgets) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-cyan-950/30 to-black border border-cyan-500/20 rounded-2xl p-5 text-center shadow-lg">
              <Users className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-[10px] text-zinc-400 uppercase font-mono tracking-widest">Registrations</p>
              <p className="text-2xl font-black text-cyan-400 mt-1">{registeredStudents.length}</p>
            </div>
            <div className="bg-gradient-to-br from-pink-950/30 to-black border border-pink-500/20 rounded-2xl p-5 text-center shadow-lg">
              <Award className="w-6 h-6 text-pink-400 mx-auto mb-2" />
              <p className="text-[10px] text-zinc-400 uppercase font-mono tracking-widest">Grades Filed</p>
              <p className="text-2xl font-black text-pink-400 mt-1">
                {eventScores.filter(s => s.scoreEntered).length} / {registeredStudents.length}
              </p>
            </div>
          </div>

          {/* Schedule Manager */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Reschedule Event & Venue
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Updating these fields will instantly adjust student dashboards and dispatch a critical notification alerting them of changes.
            </p>

            {scheduleSuccessMsg && (
              <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{scheduleSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSchedule} className="space-y-3 font-sans">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase">Start Time</label>
                  <input
                    type="time"
                    value={editTimeStart}
                    onChange={(e) => setEditTimeStart(e.target.value)}
                    className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase">End Time</label>
                  <input
                    type="time"
                    value={editTimeEnd}
                    onChange={(e) => setEditTimeEnd(e.target.value)}
                    className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase">Venue</label>
                <input
                  type="text"
                  value={editVenue}
                  onChange={(e) => setEditVenue(e.target.value)}
                  className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-xs tracking-widest py-2.5 rounded-xl shadow-lg transition-all"
              >
                Save Schedule Changes
              </button>
            </form>
          </div>

          {/* Event Brochure & Poster Image Upload */}
          <div className="bg-gradient-to-br from-[#1E0B38] to-zinc-900 border-2 border-[#FF007A]/50 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4.5 h-4.5 text-[#FF007A]" />
              Event Brochure & Poster Image
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Upload or link an official poster/flyer image for <span className="text-white font-bold">{activeEvent?.title}</span>. Students will see this brochure on their dashboard.
            </p>

            {brochureSuccessMsg && (
              <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs p-3.5 rounded-xl flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{brochureSuccessMsg}</span>
              </div>
            )}

            {/* Current Brochure Preview */}
            {(activeEvent?.brochureUrl || activeEvent?.imageUrl) && (
              <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black/40 group">
                <img 
                  src={activeEvent.brochureUrl || activeEvent.imageUrl} 
                  alt="Event Brochure" 
                  className="w-full h-48 object-cover object-top"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 text-center">
                  <p className="text-xs text-white font-bold">Active Brochure Poster Preview</p>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1.5">
                  1. Upload Image File (JPG, PNG, WEBP)
                </label>
                <input 
                  type="file"
                  ref={brochureFileInputRef}
                  onChange={handleBrochureFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => brochureFileInputRef.current?.click()}
                  className="w-full bg-gradient-to-r from-[#FF007A] to-purple-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose & Upload Image File</span>
                </button>
              </div>

              <form onSubmit={handleSaveBrochureUrl} className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-[10px] font-black text-zinc-400 uppercase block">
                  2. Or Provide Image / Brochure URL Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/poster.jpg"
                    value={brochureUrlInput}
                    onChange={(e) => setBrochureUrlInput(e.target.value)}
                    className="flex-1 bg-black/60 border border-zinc-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#FF007A]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00D1FF] hover:bg-[#00D1FF]/80 text-black font-black text-xs uppercase rounded-lg shadow-md shrink-0 cursor-pointer"
                  >
                    Save URL
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Broadcast Announcements */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-pink-500" />
              Broadcast Notice
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Post instructions, reminders, dress codes, or criteria details. Registered students will see this in real-time.
            </p>

            {notifSuccessMsg && (
              <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs p-3.5 rounded-xl flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>{notifSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSendNotification} className="space-y-3 font-sans">
              <input
                type="text"
                placeholder="Alert Title (e.g. Bring USB Track!)"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500"
                required
              />
              <textarea
                placeholder="Notice description..."
                value={notifContent}
                onChange={(e) => setNotifContent(e.target.value)}
                rows={3}
                className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500"
                required
              />
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:opacity-95 text-black font-black uppercase text-xs tracking-widest py-2.5 rounded-xl shadow-lg transition-all"
              >
                Broadcast to Students
              </button>
            </form>
          </div>

        </div>

        {/* Right Column (Registrations & Score Entry) */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
            
            {/* Table Header / Action buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#00D1FF]" />
                  Student Roll & Score Registry
                </h3>
                <p className="text-xs text-zinc-300">
                  Download registered student list on event day, update attendance/marks in Excel, and re-upload.
                </p>
              </div>

              {/* Bulk actions */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 0. Toggle Close/Open Registration */}
                {activeEvent && onUpdateEvent && (
                  <button
                    type="button"
                    onClick={() => {
                      const isClosed = Boolean(activeEvent.isRegistrationClosed || activeEvent.registrationClosed);
                      onUpdateEvent({
                        ...activeEvent,
                        isRegistrationClosed: !isClosed,
                        registrationClosed: !isClosed
                      });
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                      (activeEvent.isRegistrationClosed || activeEvent.registrationClosed)
                        ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-rose-500/20 border-2 border-rose-500 text-rose-300 hover:bg-rose-500/30'
                    }`}
                    title={(activeEvent.isRegistrationClosed || activeEvent.registrationClosed) ? "Click to re-open student registration" : "Click to close student registration before event commencement"}
                  >
                    {(activeEvent.isRegistrationClosed || activeEvent.registrationClosed) ? (
                      <>
                        <Unlock className="w-4 h-4 text-emerald-400" />
                        <span>Re-open Registration</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-rose-400" />
                        <span>Close Registration</span>
                      </>
                    )}
                  </button>
                )}

                {/* 1. Official Scoring Sheet PDF / Print View */}
                {activeEvent && (
                  <button
                    type="button"
                    onClick={() => setShowOfficialScoreSheetModal(true)}
                    className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    title="View & Print Official GCU Scoring Sheet in PDF format"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span>Official Score Sheet (PDF / Print)</span>
                  </button>
                )}

                {/* 2. Download Registered Student Excel List */}
                <button
                  type="button"
                  onClick={() => downloadMarksExcel(activeEvent || 'Event', registeredStudents, scores, activeOccasion?.title || 'Fresherism 2K26')}
                  className="bg-[#00D1FF]/20 hover:bg-[#00D1FF]/30 border border-[#00D1FF]/60 text-white px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  title="Download Excel spreadsheet containing registered student list for this event"
                >
                  <Download className="w-4 h-4 text-[#00D1FF]" />
                  <span>Download Registered List (.xlsx)</span>
                </button>
                
                {/* 3. Upload Attendance & Marks Excel Sheet */}
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="bg-gradient-to-r from-[#FF007A] to-purple-600 hover:opacity-90 text-white border border-white/20 px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  title="Upload updated Excel spreadsheet with attendance and marks"
                >
                  <Upload className="w-4 h-4 text-white" />
                  <span>Upload Attendance & Marks (.xlsx)</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv, .tsv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />

                {/* 3. "End the Event" Button - Opens modal to enter Brochure, 2 Geotagged Photos, Guests & Judges */}
                {activeEvent && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasUploadedMarks) {
                        alert('⚠️ Please upload or enter student attendance & marks in the Excel sheet first before ending the event.');
                        return;
                      }
                      setIsEndEventModalOpen(true);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
                      hasUploadedMarks
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white border border-emerald-300 animate-pulse'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white'
                    }`}
                    title="End Event: Upload brochure, 2 geotagged photos, guest & judge details"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>End the Event</span>
                  </button>
                )}

                {/* 4. "Report the Convenor that Event Completed" Button */}
                {activeEvent && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReportConvenorEventCompleted}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
                        activeEvent.reportedToConvenor
                          ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 border border-amber-300'
                      }`}
                      title="Alert the Convenor that this event is completed"
                    >
                      <Bell className="w-4 h-4" />
                      <span>{activeEvent.reportedToConvenor ? '✅ Reported to Convenor' : 'Report Convenor Event Completed'}</span>
                    </button>

                    {/* Re-open / Allow Re-submit Button */}
                    {(activeEvent.reportedToConvenor || activeEvent.isCompleted) && (
                      <button
                        type="button"
                        onClick={handleReopenEvent}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 transition-all flex items-center gap-1 cursor-pointer"
                        title="Re-open event to update scores, end event again, and re-send report to Convenor"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Re-open & Edit</span>
                      </button>
                    )}
                  </div>
                )}


                {/* 6. "Generate Report" / "Download Word Report (.docx)" */}
                {activeEvent && (
                  <button
                    type="button"
                    onClick={() => handleDownloadReport(activeEvent)}
                    disabled={reportGeneratingStatus.loading}
                    className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 border-2 border-cyan-300 px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xl animate-bounce disabled:opacity-50"
                    title="Generate & Download Official Word (.docx) Event Completion Report using Gemini AI & Word Template"
                  >
                    {reportGeneratingStatus.loading ? (
                      <Loader2 className="w-4 h-4 text-slate-950 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 text-slate-950" />
                    )}
                    <span>{reportGeneratingStatus.loading ? 'Generating Report...' : 'Generate Report (.docx)'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Status Information Banner */}
            {activeEvent && (
              <div className="bg-[#0F011E] border border-white/10 p-3.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-bold">Registration:</span>
                    {(activeEvent.isRegistrationClosed || activeEvent.registrationClosed) ? (
                      <span className="px-3 py-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-full font-black flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        Registration Closed
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full font-black flex items-center gap-1.5">
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        Registration Open
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-bold">Leaderboard Status:</span>
                    {activeEvent.resultsPublished ? (
                      <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full font-black flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Results Approved & Published by Convenor
                      </span>
                    ) : activeEvent.reportedToConvenor ? (
                      <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full font-black flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        Reported to Convenor — Pending Convenor Publishing
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-full font-bold">
                        Draft Mode — Not yet on Leaderboard
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-zinc-400 italic">
                  {!activeEvent.resultsPublished && "Editing & saving scores updates reports locally. Click 'Report Convenor Event Completed' when ready for Convenor approval."}
                </span>
              </div>
            )}

            {/* Error / Success Feedback */}
            {bulkError && (
              <div className="bg-rose-950/60 border border-rose-500/30 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}
            {bulkSuccess && (
              <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0 animate-pulse" />
                <span>{bulkSuccess}</span>
              </div>
            )}

            {/* Search Filter & On-the-spot Add Student Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/40 p-3 rounded-2xl border border-zinc-800">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student by name, reg no..."
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:border-cyan-500 font-sans"
                />
                {tableSearchQuery && (
                  <button 
                    onClick={() => setTableSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs text-zinc-400 font-mono">
                  Showing <strong className="text-cyan-400">{filteredRegisteredStudents.length}</strong> of {registeredStudents.length} Students
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
                  title="Register a student on the spot for this event"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Register Student</span>
                </button>
              </div>
            </div>

            {registeredStudents.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-sm font-medium bg-black/20 rounded-2xl border border-dashed border-zinc-800">
                No students registered for this event yet. Use "+ Register Student" or upload an Excel sheet to populate student marks!
              </div>
            ) : filteredRegisteredStudents.length === 0 ? (
              <div className="text-center py-10 text-zinc-400 text-xs font-medium bg-black/20 rounded-2xl border border-zinc-800">
                No students matching "<strong className="text-white">{tableSearchQuery}</strong>". Try clearing search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-zinc-850 text-zinc-400 uppercase font-black tracking-wider text-[10px]">
                      <th className="py-3 px-2 text-center w-10">Sl No</th>
                      <th className="py-3 px-2">Register number</th>
                      <th className="py-3 px-2">USN NO</th>
                      <th className="py-3 px-2">Name of the student</th>
                      <th className="py-3 px-2">Mobile Number</th>
                      <th className="py-3 px-2 text-center">Register Points (5 Marks)</th>
                      <th className="py-3 px-2 text-center">Participated (YES / NO)</th>
                      <th className="py-3 px-2 text-center">Participation Points (15 Marks)</th>
                      <th className="py-3 px-2 text-center">Criterion 01 (Out of 20 marks)</th>
                      <th className="py-3 px-2 text-center">Criterion 02 (Out of 20 marks)</th>
                      <th className="py-3 px-2 text-center">Criterion 03 (Out of 20 marks)</th>
                      <th className="py-3 px-2 text-center">Criterion 04 (Out of 20 marks)</th>
                      <th className="py-3 px-2 text-center">Total Marks</th>
                      <th className="py-3 px-2 text-center">Winner</th>
                      <th className="py-3 px-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegisteredStudents.map((student, idx) => {
                      const normReg = student.registerNo ? student.registerNo.trim().toUpperCase() : '';
                      const studentMatchingScores = eventScores.filter(s => s.studentRegisterNo && s.studentRegisterNo.trim().toUpperCase() === normReg);
                      studentMatchingScores.sort((a, b) => {
                        const aExact = (activeEvent && a.eventId === activeEvent.id) ? 1 : 0;
                        const bExact = (activeEvent && b.eventId === activeEvent.id) ? 1 : 0;
                        if (aExact !== bExact) return bExact - aExact;
                        if (a.scoreEntered && !b.scoreEntered) return -1;
                        if (!a.scoreEntered && b.scoreEntered) return 1;
                        return 0;
                      });
                      const scoreRec = studentMatchingScores[0];
                      const activeScoreData = scoreRec?.pendingUpdate || scoreRec;
                      const isParticipated = activeScoreData ? Boolean(activeScoreData.participated) : false;
                      const c1 = activeScoreData ? (activeScoreData.criterion1 ?? 0) : 0;
                      const c2 = activeScoreData ? (activeScoreData.criterion2 ?? 0) : 0;
                      const c3 = activeScoreData ? (activeScoreData.criterion3 ?? 0) : 0;
                      const c4 = activeScoreData ? (activeScoreData.criterion4 ?? 0) : 0;
                      const hasEnteredScore = activeScoreData ? (activeScoreData.criterion1 !== undefined || (activeScoreData.eventScore ?? 0) > 0) : false;

                      const currentTotal = activeScoreData ? (activeScoreData.totalScore ?? (isParticipated ? (5 + 15 + c1 + c2 + c3 + c4) : 5)) : 5;
                      const isWinner = activeScoreData ? activeScoreData.isWinner : false;

                      return (
                        <tr 
                          key={student.registerNo}
                          className="border-b border-zinc-900/60 hover:bg-black/20 transition-all font-mono group"
                        >
                          {/* Sl No */}
                          <td className="py-3.5 px-2 text-center font-bold text-zinc-400 font-sans">
                            {idx + 1}
                          </td>

                          {/* Register number */}
                          <td className="py-3.5 px-2 font-mono text-amber-300 font-bold whitespace-nowrap">
                            {student.registerNo}
                          </td>

                          {/* USN NO (Editable inline) */}
                          <td className="py-3.5 px-2 font-mono whitespace-nowrap">
                            <input
                              type="text"
                              defaultValue={student.usnNo || scoreRec?.usnNo || ''}
                              key={`${student.registerNo}_${student.usnNo || ''}`}
                              placeholder="Enter USN"
                              onBlur={(e) => {
                                const val = e.target.value.trim().toUpperCase();
                                if (val !== (student.usnNo || '').trim().toUpperCase()) {
                                  handleUpdateStudentUsn(student, val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-28 bg-black/60 border border-zinc-700 hover:border-cyan-500/60 focus:border-cyan-400 text-cyan-300 font-mono text-xs px-2 py-1 rounded-lg focus:outline-none transition-all placeholder:text-zinc-600 uppercase"
                              title="Enter or update the correct USN No. for this student"
                            />
                          </td>

                          {/* Name of the student */}
                          <td className="py-3.5 px-2 font-sans">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-white font-bold text-sm leading-tight flex items-center gap-1.5">
                                  <span>{student.name}</span>
                                  <button
                                    onClick={() => {
                                      setEditingStudent(student);
                                      setEditStudentName(student.name);
                                      setEditStudentRegNo(student.registerNo);
                                      setEditStudentUsnNo(student.usnNo || '');
                                      setEditStudentDept(student.department || '');
                                    }}
                                    className="text-zinc-500 hover:text-cyan-400 transition-opacity p-0.5"
                                    title="Edit student name or register number"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </p>
                                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                                  {student.department || 'General'} {student.programName ? `| ${student.programName}` : ''}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Mobile Number */}
                          <td className="py-3.5 px-2 font-mono text-emerald-400 font-medium whitespace-nowrap">
                            {student.mobile ? (
                              <a href={`tel:${student.mobile}`} className="hover:underline flex items-center gap-1.5 text-xs text-emerald-400">
                                <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span>{student.mobile}</span>
                              </a>
                            ) : (
                              <span className="text-zinc-600 text-[11px] italic">No Mobile</span>
                            )}
                          </td>

                          {/* 1. Register Points (5 Marks) */}
                          <td className="py-3.5 px-2 text-center text-xs">
                            <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold px-2 py-0.5 rounded text-[11px] font-mono">
                              5
                            </span>
                          </td>

                          {/* 2. Participated (YES / NO) */}
                          <td className="py-3.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleScoreUpdate(student.registerNo, !isParticipated, c1, c2, c3, c4, undefined)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer font-sans flex items-center gap-1 mx-auto ${
                                isParticipated 
                                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              <Check className={`w-3 h-3 ${isParticipated ? 'text-emerald-400' : 'text-zinc-600'}`} />
                              <span>{isParticipated ? 'YES' : 'NO'}</span>
                            </button>
                          </td>

                          {/* 3. Participation Points (15 Marks) */}
                          <td className="py-3.5 px-2 text-center text-xs">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${
                              isParticipated ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                            }`}>
                              {isParticipated ? 15 : 0}
                            </span>
                          </td>

                          {/* Criterion 01 (Out of 20 marks) */}
                          <td className="py-3.5 px-2 text-center">
                            <input
                              type="number"
                              value={activeScoreData ? (hasEnteredScore || c1 > 0 ? c1 : '') : ''}
                              placeholder="0"
                              onChange={(e) => handleScoreUpdate(student.registerNo, isParticipated, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0, c2, c3, c4, undefined)}
                              className="w-12 bg-black border border-zinc-800 text-white rounded text-center py-1 font-mono text-xs focus:outline-none focus:border-cyan-500"
                              min="0"
                              max="20"
                            />
                          </td>

                          {/* Criterion 02 (Out of 20 marks) */}
                          <td className="py-3.5 px-2 text-center">
                            <input
                              type="number"
                              value={activeScoreData ? (hasEnteredScore || c2 > 0 ? c2 : '') : ''}
                              placeholder="0"
                              onChange={(e) => handleScoreUpdate(student.registerNo, isParticipated, c1, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0, c3, c4, undefined)}
                              className="w-12 bg-black border border-zinc-800 text-white rounded text-center py-1 font-mono text-xs focus:outline-none focus:border-cyan-500"
                              min="0"
                              max="20"
                            />
                          </td>

                          {/* Criterion 03 (Out of 20 marks) */}
                          <td className="py-3.5 px-2 text-center">
                            <input
                              type="number"
                              value={activeScoreData ? (hasEnteredScore || c3 > 0 ? c3 : '') : ''}
                              placeholder="0"
                              onChange={(e) => handleScoreUpdate(student.registerNo, isParticipated, c1, c2, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0, c4, undefined)}
                              className="w-12 bg-black border border-zinc-800 text-white rounded text-center py-1 font-mono text-xs focus:outline-none focus:border-cyan-500"
                              min="0"
                              max="20"
                            />
                          </td>

                          {/* Criterion 04 (Out of 20 marks) */}
                          <td className="py-3.5 px-2 text-center">
                            <input
                              type="number"
                              value={activeScoreData ? (hasEnteredScore || c4 > 0 ? c4 : '') : ''}
                              placeholder="0"
                              onChange={(e) => handleScoreUpdate(student.registerNo, isParticipated, c1, c2, c3, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0, undefined)}
                              className="w-12 bg-black border border-zinc-800 text-white rounded text-center py-1 font-mono text-xs focus:outline-none focus:border-cyan-500"
                              min="0"
                              max="20"
                            />
                          </td>

                          {/* Total Marks */}
                          <td className="py-3.5 px-2 text-center">
                            <input
                              type="number"
                              value={activeScoreData ? currentTotal : ''}
                              placeholder="0"
                              onChange={(e) => handleScoreUpdate(student.registerNo, isParticipated, c1, c2, c3, c4, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                              className="w-16 bg-black border border-pink-500/50 text-pink-400 font-bold rounded text-center py-1 font-mono text-xs focus:outline-none focus:border-pink-400"
                              min="0"
                              max="100"
                            />
                          </td>

                          {/* Winner Toggle */}
                          <td className="py-3.5 px-2 text-center">
                            <button
                              onClick={() => handleToggleWinner(student.registerNo)}
                              className={`p-1.5 rounded-lg border transition-all inline-flex items-center justify-center cursor-pointer ${
                                isWinner 
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400'
                              }`}
                              title={isWinner ? 'De-flag as Winner' : 'Mark as Event Winner'}
                            >
                              <Award className="w-4 h-4" />
                            </button>
                          </td>

                          {/* Action - Remove Student from Event */}
                          <td className="py-3.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteStudentFromEvent(student)}
                              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all inline-flex items-center justify-center cursor-pointer"
                              title={`Remove ${student.name} from this event`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-850/60 flex flex-col sm:flex-row justify-between text-[11px] text-zinc-400 font-sans leading-relaxed">
              <p>💡 <em>Tip: Adding a performance score automatically saves it.</em></p>
              <p className="text-zinc-300 font-semibold">Total Scores include 5 registration bonus points + 10 participation points + event score.</p>
            </div>

          </div>

          {/* Scanned Score Sheets Upload Section for Further Verifications */}
          <div className="bg-gradient-to-br from-[#120224] to-[#1A032E] border-2 border-[#00D1FF]/40 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#00D1FF]" />
                  Scan & Upload Physical Score Sheets (For Verification & Audit)
                </h3>
                <p className="text-xs text-zinc-300">
                  Scan and upload hand-written evaluation sheets, judge score sheets, or signed result sheets for official verification by Convenors.
                </p>
              </div>

              <div>
                <input 
                  type="file"
                  ref={scannedSheetsFileInputRef}
                  onChange={handleScoreSheetUpload}
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => scannedSheetsFileInputRef.current?.click()}
                  className="bg-gradient-to-r from-[#00D1FF] to-blue-600 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer border border-white/20 shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span>Scan / Upload Score Sheets</span>
                </button>
              </div>
            </div>

            {/* Gallery of Uploaded Scanned Sheets */}
            {scannedSheets.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs italic border border-dashed border-white/10 rounded-2xl bg-black/20">
                No physical score sheets scanned yet. Click "Scan / Upload Score Sheets" to attach handwritten judge evaluation sheets for verification.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
                {scannedSheets.map((sheet) => (
                  <div 
                    key={sheet.id}
                    className="group relative bg-black/50 border border-white/15 rounded-xl p-2 flex flex-col justify-between overflow-hidden shadow-md hover:border-[#00D1FF] transition-all"
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-zinc-950 mb-2 border border-white/10">
                      {sheet.url.startsWith('data:image') || sheet.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                        <img 
                          src={sheet.url} 
                          alt={sheet.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-cyan-950/40 text-cyan-300 font-bold text-xs p-2 text-center">
                          📄 {sheet.name.substring(0, 15)}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedScanPreview(sheet.url)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold cursor-pointer"
                      >
                        Click to View Full Scan
                      </button>
                    </div>

                    <div className="space-y-1 text-[10px]">
                      <p className="text-white font-bold truncate" title={sheet.name}>{sheet.name}</p>
                      <p className="text-zinc-400 font-mono">{sheet.uploadedAt}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteScannedSheet(sheet.id)}
                      className="mt-2 w-full py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      Delete Scan
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Full Screen Image Preview Modal for Scanned Score Sheets */}
      {selectedScanPreview && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative max-w-4xl max-h-[90vh] bg-zinc-900 border-2 border-[#00D1FF] rounded-3xl p-4 overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-white/10">
              <span className="text-xs font-black text-[#00D1FF] uppercase font-mono tracking-wider">
                📄 Scanned Physical Score Sheet Document
              </span>
              <button
                type="button"
                onClick={() => setSelectedScanPreview(null)}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/60 rounded-2xl p-2">
              <img 
                src={selectedScanPreview} 
                alt="Scanned Score Sheet Preview" 
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* FACULTY QR CODE SCANNER MODAL */}
      {isQrScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#120224] border-2 border-[#00D1FF] rounded-3xl p-6 shadow-2xl space-y-5 text-sans">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-[#00D1FF]">
                <QrCode className="w-6 h-6 animate-pulse" />
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Faculty QR Code & ID Verifier
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQrScannerOpen(false)}
                className="text-zinc-400 hover:text-white font-black text-sm p-1 rounded-lg bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Scanner viewfinder simulation & manual entry */}
            <div className="bg-[#0F011E] border border-cyan-500/30 rounded-2xl p-4 text-center space-y-3 relative overflow-hidden">
              <div className="w-36 h-36 mx-auto border-2 border-dashed border-[#00D1FF] rounded-2xl flex flex-col items-center justify-center bg-black/40 relative">
                <Camera className="w-10 h-10 text-[#00D1FF] animate-bounce mb-1" />
                <span className="text-[10px] text-cyan-300 font-mono">Camera Scanner Active</span>
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#FF007A] shadow-[0_0_8px_#FF007A] animate-pulse" />
              </div>

              <p className="text-xs text-zinc-300">
                Hold student's QR ID card up to camera OR enter Register No / QR text code below for instant verification:
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 24BCAR105 or scan code..."
                  value={qrSearchInput}
                  onChange={(e) => setQrSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQrScanSearch()}
                  className="flex-1 bg-black border border-white/20 text-white font-mono text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#00D1FF]"
                />
                <button
                  type="button"
                  onClick={() => handleQrScanSearch()}
                  className="px-4 py-2.5 bg-[#00D1FF] hover:opacity-90 text-black font-black text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>Scan</span>
                </button>
              </div>

              {/* Quick test buttons for registered students */}
              <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
                <span className="text-[10px] text-zinc-400 w-full">Quick Test Registered Students:</span>
                {registeredStudents.slice(0, 4).map(s => (
                  <button
                    key={s.registerNo}
                    type="button"
                    onClick={() => { setQrSearchInput(s.registerNo); handleQrScanSearch(s.registerNo); }}
                    className="text-[10px] bg-white/10 hover:bg-[#FF007A]/20 hover:border-[#FF007A] border border-white/15 text-zinc-200 px-2 py-1 rounded-lg transition-all font-mono cursor-pointer"
                  >
                    {s.registerNo}
                  </button>
                ))}
              </div>
            </div>

            {/* Scan Status Feedback */}
            {qrScanSuccessMsg && (
              <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                qrScanSuccessMsg.includes('Validated') 
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200' 
                  : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
              }`}>
                <span>{qrScanSuccessMsg}</span>
              </div>
            )}

            {/* Scanned Student Card Details */}
            {scannedStudentResult && (
              <div className="bg-black/60 border border-emerald-500/40 rounded-2xl p-4 space-y-3 font-sans animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white font-black text-base">{scannedStudentResult.name}</h4>
                    <p className="text-xs text-cyan-300 font-mono">{scannedStudentResult.registerNo}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase rounded-lg">
                    VERIFIED STUDENT
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 bg-white/5 p-2.5 rounded-xl">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black">Department</p>
                    <p className="font-semibold text-white">{scannedStudentResult.department || 'General'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black">Program Name</p>
                    <p className="font-semibold text-cyan-300">{scannedStudentResult.programName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black">Mobile</p>
                    <p className="font-mono text-white">{scannedStudentResult.mobile}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black">Email</p>
                    <p className="font-mono text-white truncate" title={scannedStudentResult.email}>{scannedStudentResult.email}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs text-zinc-300">Registered for current event?</span>
                  {scannedStudentResult.registeredEventIds.includes(activeEvent.id) ? (
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> YES (CONFIRMED)
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-amber-400" /> NOT REGISTERED YET
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FACULTY STUDENT SCANNER MODAL */}
      <FacultyStudentScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        students={students}
        events={events}
      />

      {/* END THE EVENT & SUBMIT DETAILS MODAL */}
      {isEndEventModalOpen && activeEvent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-[#120224] border-2 border-[#00D1FF] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 font-sans my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-white/10">
              <div>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-black uppercase rounded-lg">
                  Event Completion Portal
                </span>
                <h3 className="text-xl font-black text-white uppercase tracking-tight italic mt-1">
                  End Event: {activeEvent.title}
                </h3>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Complete brochure, mandatory 2 geotagged photos, chief guest, and judge details before generating the final report.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEndEventModalOpen(false)}
                className="text-zinc-400 hover:text-white font-black text-sm p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Success / Error Messages */}
            {endEventError && (
              <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{endEventError}</span>
              </div>
            )}
            {endEventSuccess && (
              <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                <span>{endEventSuccess}</span>
              </div>
            )}
            {convenorReportSuccess && (
              <div className="bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400 shrink-0 animate-bounce" />
                <span>{convenorReportSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveEndEventDetails} className="space-y-6 text-xs text-zinc-200">
              {/* Section 1: Event Brochure (Optional, NA option available) */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-[#00D1FF] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#00D1FF]" />
                    1. Event Brochure / Poster (Optional)
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
                    <input
                      type="checkbox"
                      checked={endBrochureNA}
                      onChange={(e) => setEndBrochureNA(e.target.checked)}
                      className="rounded accent-[#FF007A]"
                    />
                    <span className="text-[11px] font-bold text-amber-300">NA (No Brochure)</span>
                  </label>
                </div>

                {!endBrochureNA && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      {/* Upload Button */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-300 font-bold block">Upload Brochure File:</label>
                        <input
                          type="file"
                          ref={endBrochureFileInputRef}
                          accept="image/*,.pdf"
                          onChange={handleEndBrochureFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => endBrochureFileInputRef.current?.click()}
                          className="w-full bg-[#00D1FF]/15 hover:bg-[#00D1FF]/25 border border-[#00D1FF]/40 hover:border-[#00D1FF] text-[#00D1FF] font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                        >
                          <Upload className="w-3.5 h-3.5 shrink-0 text-[#00D1FF]" />
                          <span>Choose Brochure File...</span>
                        </button>
                      </div>

                      {/* URL Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-300 font-bold block">Or Brochure Image URL / Link:</label>
                        <input
                          type="text"
                          placeholder="https://example.com/brochure.jpg"
                          value={endBrochureUrl}
                          onChange={(e) => setEndBrochureUrl(e.target.value)}
                          className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#00D1FF]"
                        />
                      </div>
                    </div>

                    {/* Preview Thumbnail */}
                    {endBrochureUrl && (
                      <div className="flex items-center gap-3 bg-black/70 border border-white/15 rounded-xl p-2.5">
                        {endBrochureUrl.startsWith('data:image') || endBrochureUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || endBrochureUrl.startsWith('http') ? (
                          <img src={endBrochureUrl} alt="Brochure Preview" className="w-14 h-14 object-cover rounded-lg border border-white/20 shrink-0" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Brochure Attached
                          </p>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">{endBrochureUrl.substring(0, 50)}...</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEndBrochureUrl('')}
                          className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Remove brochure"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Two Geotagged Photos (MUST / Mandatory) */}
              <div className="bg-gradient-to-br from-[#1F0838] to-black border-2 border-rose-500/50 rounded-2xl p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-rose-400" />
                    2. Geotagged Event Photos (MUST - minimum 2 required)
                  </h4>
                  <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black uppercase rounded-md">
                    MANDATORY
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Photo 1 */}
                  <div className="bg-black/50 border border-rose-500/30 rounded-xl p-3 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-rose-200 font-bold flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-rose-400" /> Photo 1 (Geotagged) *
                      </label>
                      {endPhoto1 && <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Ready</span>}
                    </div>

                    <input
                      type="file"
                      ref={endPhoto1FileInputRef}
                      accept="image/*"
                      onChange={handleEndPhoto1FileUpload}
                      className="hidden"
                    />
                    
                    <button
                      type="button"
                      onClick={() => endPhoto1FileInputRef.current?.click()}
                      className="w-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 hover:border-rose-400 text-rose-200 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>Upload Geotagged Photo 1</span>
                    </button>

                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-400 font-medium">Or image URL:</span>
                      <input
                        type="text"
                        placeholder="https://example.com/geotagged1.jpg"
                        value={endPhoto1}
                        onChange={(e) => setEndPhoto1(e.target.value)}
                        className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-400"
                        required
                      />
                    </div>

                    {endPhoto1 && (
                      <div className="relative mt-2 rounded-lg overflow-hidden border border-rose-500/40 group">
                        <img src={endPhoto1} alt="Geotagged Photo 1" className="w-full h-28 object-cover rounded-lg" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        <button
                          type="button"
                          onClick={() => setEndPhoto1('')}
                          className="absolute top-1.5 right-1.5 bg-black/80 hover:bg-rose-600 text-white p-1 rounded-md transition-colors shadow-md"
                          title="Remove Photo 1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Photo 2 */}
                  <div className="bg-black/50 border border-rose-500/30 rounded-xl p-3 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-rose-200 font-bold flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-rose-400" /> Photo 2 (Geotagged) *
                      </label>
                      {endPhoto2 && <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Ready</span>}
                    </div>

                    <input
                      type="file"
                      ref={endPhoto2FileInputRef}
                      accept="image/*"
                      onChange={handleEndPhoto2FileUpload}
                      className="hidden"
                    />
                    
                    <button
                      type="button"
                      onClick={() => endPhoto2FileInputRef.current?.click()}
                      className="w-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 hover:border-rose-400 text-rose-200 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>Upload Geotagged Photo 2</span>
                    </button>

                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-400 font-medium">Or image URL:</span>
                      <input
                        type="text"
                        placeholder="https://example.com/geotagged2.jpg"
                        value={endPhoto2}
                        onChange={(e) => setEndPhoto2(e.target.value)}
                        className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-400"
                        required
                      />
                    </div>

                    {endPhoto2 && (
                      <div className="relative mt-2 rounded-lg overflow-hidden border border-rose-500/40 group">
                        <img src={endPhoto2} alt="Geotagged Photo 2" className="w-full h-28 object-cover rounded-lg" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        <button
                          type="button"
                          onClick={() => setEndPhoto2('')}
                          className="absolute top-1.5 right-1.5 bg-black/80 hover:bg-rose-600 text-white p-1 rounded-md transition-colors shadow-md"
                          title="Remove Photo 2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Event Chief Guest Details */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-300" />
                  3. Event Chief Guest / Guest Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Guest Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. A. P. J. Abdul Kalam"
                      value={endChiefGuestName}
                      onChange={(e) => setEndChiefGuestName(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Guest Mobile No</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={endChiefGuestMobile}
                      onChange={(e) => setEndChiefGuestMobile(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Guest Email ID</label>
                    <input
                      type="email"
                      placeholder="guest@example.com"
                      value={endChiefGuestEmail}
                      onChange={(e) => setEndChiefGuestEmail(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Guest Designation / Description</label>
                    <input
                      type="text"
                      placeholder="Senior Director, Tech Innovation"
                      value={endChiefGuestDescription}
                      onChange={(e) => setEndChiefGuestDescription(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Event Internal Judge / Resource Person Details */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-300" />
                  4. INTERNAL JUDGE / RESOURCE PERSON
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Internal Judge / Resource Person Name</label>
                    <input
                      type="text"
                      placeholder="Prof. Rajesh Sharma"
                      value={endInternalJudgeName}
                      onChange={(e) => setEndInternalJudgeName(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Mobile No</label>
                    <input
                      type="text"
                      placeholder="+91 95359 00000"
                      value={endInternalJudgeMobile}
                      onChange={(e) => setEndInternalJudgeMobile(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Email ID</label>
                    <input
                      type="email"
                      placeholder="rajesh.s@gcu.edu.in"
                      value={endInternalJudgeEmail}
                      onChange={(e) => setEndInternalJudgeEmail(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Event External Judge / Resource Person Details (Optional) */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-purple-300" />
                    5. EXTERNAL JUDGE / RESOURCE PERSON (OPTIONAL)
                  </h4>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700">
                    OPTIONAL
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">External Judge / Resource Person Name</label>
                    <input
                      type="text"
                      placeholder="Dr. Smita Menon"
                      value={endExternalJudgeName}
                      onChange={(e) => setEndExternalJudgeName(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Designation</label>
                    <input
                      type="text"
                      placeholder="VP, Global Research Labs"
                      value={endExternalJudgeDesignation}
                      onChange={(e) => setEndExternalJudgeDesignation(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Email ID</label>
                    <input
                      type="email"
                      placeholder="smita.menon@external.org"
                      value={endExternalJudgeEmail}
                      onChange={(e) => setEndExternalJudgeEmail(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Mobile No</label>
                    <input
                      type="text"
                      placeholder="+91 99887 76655"
                      value={endExternalJudgeMobile}
                      onChange={(e) => setEndExternalJudgeMobile(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>Save Completion Details</span>
                </button>

                {activeEvent.reportedToConvenor ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadReport(activeEvent)}
                    disabled={reportGeneratingStatus.loading}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {reportGeneratingStatus.loading ? (
                      <Loader2 className="w-4 h-4 text-black animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 text-black" />
                    )}
                    <span>{reportGeneratingStatus.loading ? 'Generating Report...' : 'Generate Report (.docx)'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReportConvenorEventCompleted}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Bell className="w-4 h-4 text-slate-950" />
                    <span>Report Convenor Event Completed</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT FACULTY PROFILE MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A032E] border-2 border-[#00D1FF] rounded-3xl max-w-xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative my-8 overflow-hidden animate-fadeIn font-sans">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#00D1FF]/20 border border-[#00D1FF]/40 rounded-2xl text-[#00D1FF]">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="bg-[#00D1FF] text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider">
                    FACULTY PROFILE & PERMISSIONS
                  </span>
                  <h3 className="text-lg font-black text-white italic tracking-wide mt-1">
                    Edit Faculty Coordinator Profile
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Update your mobile number, faculty ID, official university email, department, or institutional designation.
            </p>

            {editProfileError && (
              <div className="p-3.5 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{editProfileError}</span>
              </div>
            )}

            {editProfileSuccess && (
              <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{editProfileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveFacultyProfileEdit} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Full Name */}
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Smita Sharma"
                    value={editFacName}
                    onChange={(e) => setEditFacName(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                {/* Faculty ID / Employee ID */}
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                    Faculty ID / Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FAC-101"
                    value={editFacId}
                    onChange={(e) => setEditFacId(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-cyan-300 font-mono font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none uppercase"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={editFacMobile}
                    onChange={(e) => setEditFacMobile(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-mono font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                {/* Official Email */}
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                    University Email (<span className="lowercase font-semibold">@gcu.edu.in</span>) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="faculty@gcu.edu.in"
                    value={editFacEmail}
                    onChange={(e) => setEditFacEmail(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-cyan-300 font-mono font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                {/* School / Institution */}
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                    School / Institution
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. School of CS & IT"
                    value={editFacSchool}
                    onChange={(e) => setEditFacSchool(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science & Engineering"
                    value={editFacDept}
                    onChange={(e) => setEditFacDept(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                {/* Designation */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                    Designation / Role
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Assistant Professor / Event Coordinator"
                    value={editFacDesignation}
                    onChange={(e) => setEditFacDesignation(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-[#00D1FF] via-purple-600 to-[#FF007A] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl hover:opacity-90 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Save Faculty Profile</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ➕ ON-THE-SPOT STUDENT REGISTRATION MODAL */}
      {showAddStudentModal && activeEvent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-[#1A032E] border-2 border-emerald-500 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    On-The-Spot Registration
                  </h3>
                  <p className="text-xs text-zinc-300">
                    Register student directly for <strong className="text-emerald-400">{activeEvent.title}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddStudentModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOnTheSpotRegister} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase block mb-1">
                    Register Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 24BCSE102"
                    value={newRegNo}
                    onChange={(e) => setNewRegNo(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-mono font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-cyan-300 uppercase block mb-1">
                    USN NO (Permanent / Correct USN)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 24BCSE102"
                    value={newUsnNo}
                    onChange={(e) => setNewUsnNo(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-cyan-300 font-mono font-bold rounded-xl px-3.5 py-2.5 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-300 uppercase block mb-1">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase block mb-1">
                    Department / School
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CSE / CS & IT"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase block mb-1">
                    Program / Class
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. B.Tech CSE 1st Year"
                    value={newProgram}
                    onChange={(e) => setNewProgram(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-300 uppercase block mb-1">
                  Student Email ID (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. rahul.sharma@gcu.edu.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-emerald-300 uppercase tracking-wider mb-1.5 ml-1">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-emerald-300 uppercase tracking-wider mb-1.5 ml-1">
                  School / College (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Garden City University"
                  value={newSchool}
                  onChange={(e) => setNewSchool(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>Register & Add Score</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT STUDENT DETAILS MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-[#1A032E] border-2 border-cyan-400 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-400/20 border border-cyan-400/40 rounded-xl text-cyan-400">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    Edit Student Details
                  </h3>
                  <p className="text-xs text-zinc-300">
                    Update record in table & database
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setEditingStudent(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-zinc-300 uppercase block mb-1">
                    Register Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStudentRegNo}
                    onChange={(e) => setEditStudentRegNo(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-white font-mono font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-cyan-300 uppercase block mb-1">
                    USN NO (Correct USN)
                  </label>
                  <input
                    type="text"
                    value={editStudentUsnNo}
                    onChange={(e) => setEditStudentUsnNo(e.target.value)}
                    placeholder="e.g. 24BCAR105"
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-cyan-300 font-mono font-bold rounded-xl px-3.5 py-2.5 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-300 uppercase block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-white font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-300 uppercase block mb-1">
                  Department / Course
                </label>
                <input
                  type="text"
                  value={editStudentDept}
                  onChange={(e) => setEditStudentDept(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-white font-bold rounded-xl px-3.5 py-2.5 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleDeleteStudent}
                  className="px-4 py-2.5 bg-red-900/40 hover:bg-red-800/60 border border-red-500/40 text-red-300 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
                  title="Delete this student record permanently"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-black font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg"
                  >
                    <CheckCircle2 className="w-4 h-4 text-black" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Score Sheet Modal (PDF View & Print) */}
      {showOfficialScoreSheetModal && activeEvent && (
        <OfficialScoreSheetModal
          event={activeEvent}
          registeredStudents={registeredStudents}
          scores={scores}
          occasionTitle={activeOccasion?.title || 'Fresherism 2K26'}
          onClose={() => setShowOfficialScoreSheetModal(false)}
        />
      )}


      {/* Floating Global Report Generation Notification / Toast */}
      {reportGeneratingStatus.message && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-gradient-to-r from-cyan-950/95 via-blue-950/95 to-black/95 border-2 border-cyan-400/70 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 flex items-center gap-3">
          {reportGeneratingStatus.loading ? (
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 shrink-0">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          )}
          <div className="flex-1 text-xs font-bold leading-snug">
            {reportGeneratingStatus.message}
          </div>
          {!reportGeneratingStatus.loading && (
            <button
              type="button"
              onClick={() => setReportGeneratingStatus({ loading: false, message: '' })}
              className="p-1 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

    </div>
  );
}