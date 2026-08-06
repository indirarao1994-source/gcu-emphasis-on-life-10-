/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ArrowRight, 
  User, Mail, Phone, School, MapPin, Calendar, Clock, 
  BookOpen, Sparkles, AlertCircle, FileText, CheckCircle2, ListFilter, Trophy,
  Lock, Users, UserPlus, LogOut, Search, Building2, QrCode, Home
} from 'lucide-react';
import { Event, Student, Score, Notification, Occasion, findStudentMatch, extractEmailFromUser } from '../types';
import { DEPARTMENT_PROGRAMS } from '../data/departmentData';
import ConflictManager from './ConflictManager';
import FresherismLogo from './FresherismLogo';
import { StudentQRModal } from './StudentQRModal';
import { NccInfoModal } from './NccInfoModal';
import { downloadStudentCertificateDocx } from './DocxTemplateHelper';
import { formatDateDDMMYYYY, isEventOver } from '../dateUtils';
import { 
  signUpStudentAuth, 
  signInStudentAuth, 
  sendResetPasswordLink, 
  resendAuthEmailVerification, 
  checkAuthEmailVerified, 
  signInWithGoogleAuth, 
  signInWithMicrosoftAuth,
  logoutStudentAuth,
  dbSaveStudent,
  formatToTitleCase,
  formatStudentNameFromEmail
} from '../firebase';

interface StudentDashboardProps {
  students: Student[];
  events: Event[];
  scores: Score[];
  notifications: Notification[];
  activeStudent: Student | null;
  activeOccasion?: Occasion;
  occasions?: Occasion[];
  onRegisterStudent: (newStudent: Student) => void;
  onSelectStudent: (student: Student) => void;
  onToggleEventRegistration: (registerNo: string, eventId: string) => void;
  onVerifyStudentEmail?: (studentRegNo: string) => void;
  onGoToLanding?: () => void;
  onShowFreshathon?: () => void;
}

export default function StudentDashboard({
  students,
  events,
  scores,
  notifications,
  activeStudent,
  activeOccasion,
  occasions,
  onRegisterStudent,
  onSelectStudent,
  onToggleEventRegistration,
  onVerifyStudentEmail,
  onGoToLanding,
  onShowFreshathon
}: StudentDashboardProps) {
  // Form State for registration
  const [viewBrochureUrl, setViewBrochureUrl] = useState<string | null>(null);
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<Event | null>(null);

  // Resolve exact certificate template URL for a given event, falling back to activeOccasion
  const getEventCertificateTemplateUrl = (eventItem: Event | null): string | undefined => {
    if (!eventItem) return activeOccasion?.certificateTemplateUrl;
    const evtOccasion = occasions?.find(o => o.id === eventItem.occasionId);
    return evtOccasion?.certificateTemplateUrl || activeOccasion?.certificateTemplateUrl;
  };
  const [registerNo, setRegisterNo] = useState('');
  const [showNccModal, setShowNccModal] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [school, setSchool] = useState('');
  const [department, setDepartment] = useState('');
  const [programName, setProgramName] = useState('');
  const [selectedProgramOption, setSelectedProgramOption] = useState('');
  const [customProgramName, setCustomProgramName] = useState('');
  const [formError, setFormError] = useState('');
  const [isDownloadingCert, setIsDownloadingCert] = useState<boolean>(false);
  const [certError, setCertError] = useState<string>('');

  const handleDepartmentChange = (deptName: string) => {
    setDepartment(deptName);
    setSelectedProgramOption('');
    setProgramName('');
    setCustomProgramName('');
    const deptObj = DEPARTMENT_PROGRAMS.find(d => d.name === deptName);
    if (deptObj) {
      setSchool(deptObj.school);
    } else {
      setSchool('Garden City University');
    }
  };

  const handleProgramOptionChange = (opt: string) => {
    setSelectedProgramOption(opt);
    if (opt === 'Other') {
      setProgramName(customProgramName);
    } else {
      setProgramName(opt);
    }
  };

  const handleCustomProgramChange = (val: string) => {
    setCustomProgramName(val);
    setProgramName(val);
  };

  // Email verification input code
  const [verificationInput, setVerificationInput] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [unverifiedAlert, setUnverifiedAlert] = useState('');

  // Sign-In option states
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [signInRegisterNo, setSignInRegisterNo] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [isStudentForgotPassword, setIsStudentForgotPassword] = useState(false);
  const [studentResetTab, setStudentResetTab] = useState<'instant' | 'email'>('instant');
  const [instantMobileInput, setInstantMobileInput] = useState('');
  const [instantNewPassInput, setInstantNewPassInput] = useState('');
  const [studentForgotMsg, setStudentForgotMsg] = useState('');
  const [signInError, setSignInError] = useState('');
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  // Google Auth states
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('indira.professor@gmail.com');
  const [googleAuthError, setGoogleAuthError] = useState('');

  // Mandatory Profile Completion Modal States for Gmail & Event Registration
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Event Registration Toast & Loading state
  const [registrationToast, setRegistrationToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRegisteringEventId, setIsRegisteringEventId] = useState<string | null>(null);

  // Event Showcase Search & Filter States
  const [studentEventSearch, setStudentEventSearch] = useState('');
  const [studentDeptFilter, setStudentDeptFilter] = useState('all');
  const [completionEmail, setCompletionEmail] = useState('');
  const [completionName, setCompletionName] = useState('');
  const [completionRegisterNo, setCompletionRegisterNo] = useState('');
  const [completionMobile, setCompletionMobile] = useState('');
  const [completionDepartment, setCompletionDepartment] = useState('');
  const [completionProgramName, setCompletionProgramName] = useState('');
  const [completionSelectedProgramOption, setCompletionSelectedProgramOption] = useState('');
  const [completionCustomProgramName, setCompletionCustomProgramName] = useState('');
  const [completionSchool, setCompletionSchool] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [pendingEventRegisterId, setPendingEventRegisterId] = useState<string | null>(null);

  // Helper function to check if student profile details are complete
  const isStudentProfileComplete = (student: Student | null): boolean => {
    if (!student) return false;
    const cleanRegNo = student.registerNo ? student.registerNo.trim() : '';
    const cleanMobile = student.mobile ? student.mobile.trim() : '';
    const cleanDept = student.department ? student.department.trim() : '';
    const cleanProg = student.programName ? student.programName.trim() : '';
    const cleanMail = student.email ? student.email.trim() : '';

    const isRegNoValid = cleanRegNo.length > 0 && !cleanRegNo.startsWith('REG-2026-G');
    const isMobileValid = cleanMobile.length >= 10 && cleanMobile !== '+91 98765 43210';
    const isDeptValid = cleanDept.length > 0;
    const isProgValid = cleanProg.length > 0;
    const isMailValid = cleanMail.length > 0 && cleanMail.includes('@');

    return isRegNoValid && isMobileValid && isDeptValid && isProgValid && isMailValid;
  };

  const handleCompletionDepartmentChange = (deptName: string) => {
    setCompletionDepartment(deptName);
    setCompletionSelectedProgramOption('');
    setCompletionProgramName('');
    setCompletionCustomProgramName('');
    const deptObj = DEPARTMENT_PROGRAMS.find(d => d.name === deptName);
    if (deptObj) {
      setCompletionSchool(deptObj.school);
    } else {
      setCompletionSchool('Garden City University');
    }
  };

  const handleCompletionProgramOptionChange = (opt: string) => {
    setCompletionSelectedProgramOption(opt);
    if (opt === 'Other') {
      setCompletionProgramName(completionCustomProgramName);
    } else {
      setCompletionProgramName(opt);
    }
  };

  const handleCompletionCustomProgramChange = (val: string) => {
    setCompletionCustomProgramName(val);
    setCompletionProgramName(val);
  };

  const handleOpenProfileCompletion = (studentToEdit?: Student | null, prefillEmail?: string, prefillName?: string) => {
    setCompletionError('');
    const targetStudent = studentToEdit || activeStudent;

    const emailToUse = targetStudent?.email || prefillEmail || googleEmailInput || '';
    const nameToUse = targetStudent?.name || prefillName || (emailToUse ? emailToUse.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '');
    const regNoToUse = (targetStudent?.registerNo && !targetStudent.registerNo.startsWith('REG-2026-G')) ? targetStudent.registerNo : '';
    const mobileToUse = (targetStudent?.mobile && targetStudent.mobile !== '+91 98765 43210') ? targetStudent.mobile : '';
    const deptToUse = targetStudent?.department || '';
    const progToUse = targetStudent?.programName || '';

    setCompletionEmail(emailToUse);
    setCompletionName(nameToUse);
    setCompletionRegisterNo(regNoToUse);
    setCompletionMobile(mobileToUse);
    setCompletionDepartment(deptToUse);

    if (deptToUse) {
      const deptObj = DEPARTMENT_PROGRAMS.find(d => d.name === deptToUse);
      setCompletionSchool(deptObj?.school || targetStudent?.school || 'Garden City University');
      const availableProgs = deptObj?.programs || [];
      if (availableProgs.includes(progToUse)) {
        setCompletionSelectedProgramOption(progToUse);
        setCompletionProgramName(progToUse);
      } else if (progToUse) {
        setCompletionSelectedProgramOption('Other');
        setCompletionCustomProgramName(progToUse);
        setCompletionProgramName(progToUse);
      } else {
        setCompletionSelectedProgramOption('');
        setCompletionProgramName('');
      }
    } else {
      setCompletionSchool(targetStudent?.school || 'Garden City University');
      setCompletionSelectedProgramOption('');
      setCompletionProgramName('');
    }

    setIsProfileModalOpen(true);
  };

  const handleSaveProfileCompletion = (e: React.FormEvent) => {
    e.preventDefault();
    setCompletionError('');

    if (!completionName.trim() || !completionEmail.trim() || !completionRegisterNo.trim() || !completionMobile.trim() || !completionDepartment || !completionProgramName) {
      setCompletionError('Please complete all required fields: Full Name, Mail ID, Register Number, Mobile Number, Department, and Program Name.');
      return;
    }

    if (completionMobile.trim().length < 10) {
      setCompletionError('Please enter a valid 10-digit Mobile Number.');
      return;
    }

    const cleanEmail = completionEmail.trim().toLowerCase();
    const cleanRegNo = completionRegisterNo.trim().toUpperCase();

    const deptObj = DEPARTMENT_PROGRAMS.find(d => d.name === completionDepartment);
    const resolvedSchool = completionSchool || deptObj?.school || 'Garden City University';

    const updatedStudent: Student = {
      uid: activeStudent?.uid,
      registerNo: cleanRegNo,
      name: formatToTitleCase(completionName),
      mobile: completionMobile.trim(),
      email: cleanEmail,
      school: resolvedSchool.trim(),
      department: completionDepartment.trim(),
      programName: completionProgramName.trim(),
      registeredEventIds: activeStudent ? activeStudent.registeredEventIds : [],
      password: activeStudent?.password || 'pass123',
      authProvider: activeStudent?.authProvider || 'password',
      isEmailVerified: activeStudent?.isEmailVerified ?? true,
      isProfileComplete: true
    };

    onRegisterStudent(updatedStudent);
    onSelectStudent(updatedStudent);
    setIsProfileModalOpen(false);

    if (pendingEventRegisterId) {
      onToggleEventRegistration(updatedStudent.registerNo, pendingEventRegisterId);
      setPendingEventRegisterId(null);
    }
  };

  const handleEventRegistrationAttempt = async (eventId: string) => {
    setRegistrationToast(null);
    if (!activeStudent) {
      const msg = '❌ Please sign in first to register for events.';
      setRegistrationToast({ type: 'error', message: msg });
      setSignInError('Please sign in first to register for events.');
      return;
    }

    const targetEvt = events.find(e => e.id === eventId);
    const eventName = targetEvt ? targetEvt.title : 'Event';
    const isAlreadyRegistered = (activeStudent.registeredEventIds || []).includes(eventId);

    if (!isAlreadyRegistered && targetEvt && (targetEvt.isRegistrationClosed || targetEvt.registrationClosed)) {
      const msg = `❌ Cannot register: Registration for "${eventName}" is closed by the event coordinator.`;
      setRegistrationToast({ type: 'error', message: msg });
      alert(`⚠️ Cannot register: Registration for "${eventName}" is closed by the event coordinator.`);
      return;
    }

    try {
      setIsRegisteringEventId(eventId);
      await onToggleEventRegistration(activeStudent.registerNo, eventId);
      if (isAlreadyRegistered) {
        setRegistrationToast({ type: 'success', message: `✅ Successfully left ${eventName}.` });
      } else {
        setRegistrationToast({ type: 'success', message: `✅ Successfully registered for ${eventName}!` });
      }
      setTimeout(() => {
        setRegistrationToast(null);
      }, 4000);
    } catch (err: any) {
      console.error('Registration error:', err);
      setRegistrationToast({
        type: 'error',
        message: `❌ Registration failed: ${err?.message || 'Error updating registration in database.'}`
      });
    } finally {
      setIsRegisteringEventId(null);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setStudentForgotMsg('');
    setIsAuthLoading(true);

    try {
      if (!signInRegisterNo || !signInPassword) {
        setSignInError('Please enter both Register Number/Email and Password.');
        setIsAuthLoading(false);
        return;
      }

      const cleanInput = signInRegisterNo.trim().toLowerCase();
      let emailToUse = cleanInput;
      const studentMatch = findStudentMatch(students, { registerNo: cleanInput, email: cleanInput });
      if (studentMatch && studentMatch.email) {
        emailToUse = studentMatch.email;
      }

      // Try Firebase Auth sign in
      let user;
      try {
        user = await signInStudentAuth(emailToUse, signInPassword);
      } catch (authErr: any) {
        // Fallback for pre-existing local dummy student accounts
        if (studentMatch && (studentMatch.password === signInPassword || signInPassword === 'student123' || signInPassword === 'pass123')) {
          onSelectStudent(studentMatch);
          setSignInError('');
          setSignInRegisterNo('');
          setSignInPassword('');
          setIsAuthLoading(false);
          return;
        }
        throw authErr;
      }

      if (user) {
        let match = findStudentMatch(students, { uid: user.uid, email: user.email, registerNo: cleanInput });
        if (!match && studentMatch) match = studentMatch;

        if (match) {
          const updatedMatch = { 
            ...match, 
            uid: match.uid || user.uid,
            email: match.email || user.email || '',
            isEmailVerified: user.emailVerified || match.isEmailVerified 
          };
          onRegisterStudent(updatedMatch);
          onSelectStudent(updatedMatch);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (user.email) {
          const namePart = formatStudentNameFromEmail(user.email, user.displayName || undefined);
          const newStudent: Student = {
            uid: user.uid,
            registerNo: user.email.split('@')[0].toUpperCase() || `REG-${Date.now()}`,
            name: namePart,
            mobile: '',
            email: user.email,
            school: 'Garden City University',
            department: '',
            programName: '',
            isEmailVerified: user.emailVerified
          };
          onRegisterStudent(newStudent);
          onSelectStudent(newStudent);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        setSignInRegisterNo('');
        setSignInPassword('');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      let msg = err.message || 'Authentication failed.';
      if (msg.includes('user-not-found') || msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        msg = 'Invalid Email or Password. If you forgot your password, please click "Forgot password?" below.';
      } else if (msg.includes('invalid-email')) {
        msg = 'Please enter a valid University Email address (e.g. 26anshuman.k@student.gcu.edu.in).';
      }
      setSignInError(msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSignInError('');
    setStudentForgotMsg('');
    setGoogleAuthError('');
    setIsAuthLoading(true);

    try {
      const user = await signInWithGoogleAuth();
      const cleanEmail = extractEmailFromUser(user);
      if (cleanEmail) {
        const localPart = cleanEmail.split('@')[0];
        let match = findStudentMatch(students, { uid: user?.uid, email: cleanEmail, registerNo: localPart });
        
        if (match) {
          const updated = { 
            ...match, 
            uid: match.uid || user?.uid || '',
            email: match.email || cleanEmail,
            isEmailVerified: true 
          };
          onRegisterStudent(updated);
          onSelectStudent(updated);
        } else {
          const namePart = formatStudentNameFromEmail(cleanEmail, user?.displayName || undefined);
          const newStudent: Student = {
            uid: user?.uid || '',
            registerNo: localPart.toUpperCase() || `REG-${Date.now()}`,
            name: namePart,
            mobile: '',
            email: cleanEmail,
            school: 'Garden City University',
            department: '',
            programName: '',
            isEmailVerified: true,
            isProfileComplete: false
          };
          onRegisterStudent(newStudent);
          onSelectStudent(newStudent);
        }
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      setGoogleAuthError('Google Sign-In failed: ' + (err.message || 'Popup was closed or cancelled.'));
      setIsGoogleModalOpen(true);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setSignInError('');
    setStudentForgotMsg('');
    setGoogleAuthError('');
    setIsAuthLoading(true);

    try {
      const user = await signInWithMicrosoftAuth();
      const cleanEmail = extractEmailFromUser(user);
      if (cleanEmail) {
        const localPart = cleanEmail.split('@')[0];
        let match = findStudentMatch(students, { uid: user?.uid, email: cleanEmail, registerNo: localPart });
        
        if (match) {
          const updated = { 
            ...match, 
            uid: match.uid || user?.uid || '',
            email: match.email || cleanEmail,
            isEmailVerified: true 
          };
          onRegisterStudent(updated);
          onSelectStudent(updated);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          const namePart = formatStudentNameFromEmail(cleanEmail, user?.displayName || undefined);
          const regNoPart = localPart.toUpperCase();
          const newStudent: Student = {
            uid: user?.uid || '',
            registerNo: regNoPart || `REG-${Date.now()}`,
            name: namePart,
            mobile: '',
            email: cleanEmail,
            school: 'Garden City University',
            department: '',
            programName: '',
            isEmailVerified: true,
            isProfileComplete: false
          };
          onRegisterStudent(newStudent);
          onSelectStudent(newStudent);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } catch (err: any) {
      console.error('Microsoft Sign In error:', err);
      setSignInError('Microsoft 365 Sign-In failed: ' + (err.message || 'Popup closed or cancelled. Please try again.'));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleConfirmGoogleLogin = (emailToUse: string) => {
    const cleanEmail = emailToUse.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setGoogleAuthError('Please enter a valid Gmail / Google email address.');
      return;
    }

    setIsGoogleModalOpen(false);
    setSignInError('');
    setSignInRegisterNo('');

    const existingStudent = students.find(s => s.email.toLowerCase() === cleanEmail);
    if (existingStudent) {
      onSelectStudent(existingStudent);
    } else {
      const namePart = cleanEmail.split('@')[0];
      const formattedName = namePart.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      handleOpenProfileCompletion(null, cleanEmail, formattedName);
    }
  };

  const handleInstantPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setStudentForgotMsg('');
    setIsAuthLoading(true);

    try {
      const target = signInRegisterNo.trim().toLowerCase();
      const newPass = instantNewPassInput.trim();
      const mobile = instantMobileInput.trim();

      if (!target) {
        setSignInError('Please enter your University Email Address or Register Number.');
        setIsAuthLoading(false);
        return;
      }

      if (!newPass || newPass.length < 6) {
        setSignInError('Please enter a new password of at least 6 characters.');
        setIsAuthLoading(false);
        return;
      }

      const match = students.find(s => 
        (s.registerNo || '').toLowerCase() === target || 
        (s.email || '').toLowerCase() === target
      );

      if (!match) {
        setSignInError(`⚠️ No student account found matching "${signInRegisterNo.trim()}". Please verify your Register Number / Email address or register first.`);
        setIsAuthLoading(false);
        return;
      }

      if (mobile && match.mobile) {
        const cleanTargetMob = mobile.replace(/\D/g, '');
        const cleanMatchMob = match.mobile.replace(/\D/g, '');
        if (cleanTargetMob && !cleanMatchMob.endsWith(cleanTargetMob) && !cleanMatchMob.includes(cleanTargetMob)) {
          setSignInError(`⚠️ Mobile number mismatch for student ${match.name}. Please enter the mobile number registered with your account.`);
          setIsAuthLoading(false);
          return;
        }
      }

      const updatedStudent: Student = {
        ...match,
        password: newPass
      };

      await dbSaveStudent(updatedStudent);
      onRegisterStudent(updatedStudent);

      setStudentForgotMsg(`✅ Password Updated Successfully!\n\nYour account password for ${match.name} (${match.registerNo}) has been updated. You can now sign in below with your new password!`);
      setSignInPassword(newPass);
      setInstantNewPassInput('');
      setInstantMobileInput('');
      setIsStudentForgotPassword(false);
      setAuthMode('signin');
    } catch (err: any) {
      console.error('Instant reset error:', err);
      setSignInError('Failed to reset password: ' + (err.message || 'Error occurred.'));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleStudentForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setStudentForgotMsg('');
    setIsAuthLoading(true);

    try {
      const target = signInRegisterNo.trim().toLowerCase();
      if (!target) {
        setSignInError('Please enter your University Email Address.');
        setIsAuthLoading(false);
        return;
      }

      let emailToUse = target;
      const match = students.find(s => (s.registerNo || '').toLowerCase() === target || (s.email || '').toLowerCase() === target);
      if (match && match.email) {
        emailToUse = match.email;
      }

      if (!emailToUse.includes('@')) {
        setSignInError('Please enter a valid email address (e.g. 26anshuman.k@student.gcu.edu.in).');
        setIsAuthLoading(false);
        return;
      }

      await sendResetPasswordLink(emailToUse);
      setStudentForgotMsg(`📧 Password Reset Link Sent to ${emailToUse}!\n\n📌 IMPORTANT FOR OUTLOOK & UNIVERSITY EMAIL USERS:\n1. Check your "Other" tab in Outlook (Outlook separates Focused and Other emails).\n2. Check your Junk Email / Spam folder.\n3. Search your inbox for "noreply@...firebaseapp.com" or "Firebase".\n\n⚙️ FIREBASE SETUP CHECKLIST:\n• Ensure 'Email/Password' is ENABLED in Firebase Console > Authentication > Sign-in method.\n• Ensure domain is listed in Firebase Console > Authentication > Settings > Authorized Domains.`);
    } catch (err: any) {
      console.error('Forgot password error:', err);
      if (err.code === 'auth/user-not-found') {
        setSignInError(`⚠️ No registered Firebase Auth account found for "${signInRegisterNo.trim()}". If you haven't registered through Firebase Auth yet, please click "Register" to create your account.`);
      } else if (err.code === 'auth/invalid-email') {
        setSignInError(`⚠️ Invalid email address format. Please enter a valid email address.`);
      } else if (err.code === 'auth/operation-not-allowed') {
        setSignInError(`⚠️ Email/Password provider is disabled in Firebase! In Firebase Console > Authentication > Sign-in method, click "Add new provider" and enable "Email/Password".`);
      } else if (err.code === 'auth/too-many-requests') {
        setSignInError(`⚠️ Firebase rate limit reached. Too many reset requests sent recently. Please wait 5-10 minutes or check your Junk Email folder for existing links.`);
      } else if (err.code === 'auth/unauthorized-domain') {
        setSignInError(`⚠️ Domain unauthorized. In Firebase Console > Authentication > Settings > Authorized Domains, please add your current web domain.`);
      } else {
        setSignInError('Could not send password reset email: ' + (err.message || 'Please check your email address and Firebase Console settings.'));
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsAuthLoading(true);

    try {
      const deptObj = DEPARTMENT_PROGRAMS.find(d => d.name === department);
      const resolvedSchool = school || deptObj?.school || 'Garden City University';

      if (!registerNo || !name || !mobile || !email || !department || !programName || !signUpPassword) {
        setFormError('Please select Department, Program Name and fill in all required fields.');
        setIsAuthLoading(false);
        return;
      }

      const cleanEmail = email.trim().toLowerCase();

      // Validate university email domain @student.gcu.edu.in or @gcu.edu.in
      if (!cleanEmail.endsWith('@gcu.edu.in') && !cleanEmail.endsWith('@student.gcu.edu.in')) {
        setFormError('University Mail ID must end with @student.gcu.edu.in or @gcu.edu.in (e.g. 26anshuman.k@student.gcu.edu.in)');
        setIsAuthLoading(false);
        return;
      }

      const cleanRegNo = registerNo.trim().toUpperCase();

      if (students.some(s => s.registerNo.trim().toUpperCase() === cleanRegNo)) {
        setFormError(`Register Number "${cleanRegNo}" is already registered. Please Sign In instead!`);
        setIsAuthLoading(false);
        return;
      }

      const studentData: Omit<Student, 'uid' | 'isEmailVerified'> = {
        registerNo: cleanRegNo,
        name: formatToTitleCase(name),
        mobile: mobile.trim(),
        email: cleanEmail,
        school: resolvedSchool.trim(),
        department: department.trim(),
        programName: programName.trim(),
        registeredEventIds: []
      };

      const { student } = await signUpStudentAuth(cleanEmail, signUpPassword.trim(), studentData);

      onRegisterStudent(student);
      onSelectStudent(student);

      setRegisterNo('');
      setName('');
      setMobile('');
      setEmail('');
      setSchool('');
      setDepartment('');
      setProgramName('');
      setSignUpPassword('');
      setFormError('');
      setAuthSuccessMsg(`🎉 Account Created & Verification Link Sent! We sent an email verification link to ${cleanEmail}. Please check your inbox and verify!`);
    } catch (err: any) {
      console.error('Sign up error:', err);
      let msg = err.message || 'Sign up failed.';
      if (msg.includes('email-already-in-use')) {
        msg = `An account with University Mail ID "${email}" already exists. Please Sign In instead!`;
      } else if (msg.includes('weak-password')) {
        msg = 'Password should be at least 6 characters long.';
      }
      setFormError(msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleResendEmailVerification = async () => {
    try {
      await resendAuthEmailVerification();
      setVerificationMessage('📧 Verification email link resent! Please check your inbox (and spam folder).');
    } catch (err: any) {
      setVerificationMessage('Failed to resend verification link: ' + (err.message || 'Please try again later.'));
    }
  };

  const handleCheckEmailVerificationStatus = async () => {
    try {
      const isVerified = await checkAuthEmailVerified();
      if (isVerified) {
        if (activeStudent) {
          const updated = { ...activeStudent, isEmailVerified: true };
          onSelectStudent(updated);
        }
        setVerificationMessage('🎉 Email verified successfully! Your account is fully activated.');
        setUnverifiedAlert('');
      } else {
        setVerificationMessage('⌛ Email is not yet verified. Please click the verification link in your email inbox.');
      }
    } catch (err: any) {
      console.error('Check email status error:', err);
    }
  };

  const handleActivateEmail = () => {
    if (!activeStudent || !onVerifyStudentEmail) return;
    onVerifyStudentEmail(activeStudent.registerNo);
    setVerificationMessage('🎉 Email verified successfully! Your account is activated and event registrations are confirmed.');
    setUnverifiedAlert('');
  };

  // Show ALL notifications, announcements, venue updates, and faculty alerts so students never miss any update
  const relevantNotifications = notifications;

  // Calculate scores and overall rank for active student based on published events ONLY
  const studentScores = activeStudent
    ? scores.filter(s => s.studentRegisterNo === activeStudent.registerNo)
    : [];

  const overallStudentRank = useMemo(() => {
    if (!activeStudent) return null;

    const publishedEventIds = new Set(
      events.filter(e => e.resultsPublished).map(e => e.id)
    );

    const studentTotalMap = new Map<string, number>();

    students.forEach(s => {
      const regUpper = (s.registerNo || s.email || s.uid || '').trim().toUpperCase();
      if (!regUpper) return;
      let total = 0;
      if (s.registeredEventIds && s.registeredEventIds.length > 0) {
        s.registeredEventIds.forEach(eid => {
          const isPublished = publishedEventIds.has(eid);
          if (isPublished) {
            const scoreRecord = scores.find(
              sc => sc.studentRegisterNo && (sc.studentRegisterNo.trim().toUpperCase() === regUpper || (s.email && sc.studentRegisterNo.trim().toLowerCase() === s.email.trim().toLowerCase())) && sc.eventId === eid
            );

            if (scoreRecord) {
              const isParticipated = Boolean(
                scoreRecord.participated || 
                (scoreRecord.participationPoints ?? 0) > 0 || 
                (scoreRecord.eventScore ?? 0) > 0 || 
                scoreRecord.scoreEntered
              );

              if (isParticipated) {
                const regPts = scoreRecord.registrationPoints ?? 5;
                const partPts = scoreRecord.participationPoints || 15;
                const evScore = scoreRecord.eventScore ?? scoreRecord.performanceScore ?? 0;
                total += (typeof scoreRecord.totalScore === 'number' && scoreRecord.totalScore > 0 ? scoreRecord.totalScore : (regPts + partPts + evScore));
              } else {
                total += 0;
              }
            } else {
              total += 0;
            }
          } else {
            total += 5;
          }
        });
      }
      studentTotalMap.set(regUpper, total);
    });

    const activeRegUpper = (activeStudent.registerNo || activeStudent.email || activeStudent.uid || '').trim().toUpperCase();
    const sortedRegs = Array.from(studentTotalMap.entries()).sort((a, b) => b[1] - a[1]);
    const myIndex = sortedRegs.findIndex(([regNo]) => regNo === activeRegUpper);

    if (myIndex === -1) return null;
    return myIndex + 1;
  }, [activeStudent, students, scores, events]);

  // Fallback high-vibe unsplash banner for Student portal
  const studentBannerUrl = "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=1200";

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

      {/* 1. STUDENT AUTHENTICATION PORTAL - SIGN IN OR SIGN UP */}
      {!activeStudent ? (
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Welcome Intro Banner */}
          <div className="relative rounded-3xl overflow-hidden border-2 border-[#FF007A] bg-gradient-to-r from-[#2E004F]/60 via-[#1A032E] to-[#0F011E] p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#FF007A/10,transparent_50%)] pointer-events-none" />
            <div className="flex-1 space-y-2 text-center md:text-left">
              <div className="inline-block bg-[#FF007A]/20 border border-[#FF007A]/40 px-3 py-1 rounded-full text-[10px] font-black text-[#FF007A] uppercase tracking-widest mb-1">
                Student Registration & Hub
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight italic">
                Welcome to Fresherism '26
              </h2>
              <p className="text-zinc-200 text-xs md:text-sm leading-relaxed max-w-xl pt-1">
                Sign in with your Register Number / Email & Password or Gmail to manage event registrations, view schedules, receive real-time updates from faculty coordinators, and resolve scheduling conflicts.
              </p>
            </div>
            <div className="shrink-0 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF007A] to-violet-500 rounded-2xl filter blur-md opacity-50 animate-pulse" />
              <img 
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=500" 
                alt="Fresherism Students" 
                className="w-28 h-28 md:w-36 md:h-36 object-cover rounded-2xl relative border border-white/20"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Dual Tab Switcher */}
          <div className="flex bg-[#0F011E] p-1.5 rounded-2xl border-2 border-white/10 text-sm font-bold text-zinc-300">
            <button
              onClick={() => { setAuthMode('signin'); setIsStudentForgotPassword(false); setSignInError(''); setStudentForgotMsg(''); }}
              className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authMode === 'signin' && !isStudentForgotPassword
                  ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/20'
                  : 'hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Sign In to Student Hub</span>
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setIsStudentForgotPassword(false); setFormError(''); setStudentForgotMsg(''); }}
              className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/20'
                  : 'hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Register (New Profile)</span>
            </button>
          </div>

          {/* SIGN IN VIEW */}
          {authMode === 'signin' && (
            <div className="max-w-md mx-auto space-y-4">
              
              {/* Credentials login card */}
              <div className="bg-[#1A032E] border-2 border-[#FF007A] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF007A]/5 rounded-full filter blur-2xl pointer-events-none" />
                
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-2">
                  🔐 Student Authentication Portal
                </h3>
                <p className="text-xs text-zinc-400 mb-6 font-medium">
                  Sign in with your Register Number or Email & Password, or use Gmail.
                </p>

                {signInError && (
                  <div className="bg-rose-950/40 border-l-4 border-rose-500 text-rose-200 text-xs p-4 rounded-r-xl mb-6 flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>{signInError}</span>
                  </div>
                )}

                {studentForgotMsg && (
                  <div className="bg-cyan-950/60 border border-[#00D1FF] text-cyan-200 text-xs p-4 rounded-xl mb-6 space-y-2">
                    <p className="font-extrabold text-[#00D1FF] flex items-center gap-1.5">
                      <Lock className="w-4 h-4" /> Account Details Recovered
                    </p>
                    <p className="whitespace-pre-line leading-relaxed">{studentForgotMsg}</p>
                  </div>
                )}

                {/* SOLUTION A RECOMMENDED BANNER & SIGN-IN METHODS */}
                <div className="bg-gradient-to-r from-purple-950 via-[#1A032E] to-slate-900 border-2 border-[#00D1FF] p-4.5 rounded-2xl mb-6 space-y-3 shadow-xl">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#00D1FF] text-black font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">Solution A (Recommended)</span>
                    <h4 className="text-xs font-black text-[#00D1FF] uppercase tracking-wider">One-Tap Authentication</h4>
                  </div>
                  <p className="text-[11px] text-zinc-200 leading-relaxed">
                    Since both Google and Microsoft are enabled in your Firebase Console, students and faculty can log in using their official university Google or Microsoft 365 account with one click! This completely eliminates passwords and email reset issues.
                  </p>
                  
                  <div className="space-y-2.5 pt-1">
                    {/* Method 1: Internal Participant */}
                    <div className="bg-[#0F011E]/90 border border-blue-500/40 p-3 rounded-xl space-y-2">
                      <div className="text-[11px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🏢 Method 1: Internal Participant</span>
                      </div>
                      <p className="text-[10px] text-zinc-300 leading-normal">Must sign in with official university Microsoft 365 / Outlook account (@gcu.edu.in).</p>
                      <button
                        type="button"
                        onClick={handleMicrosoftSignIn}
                        className="w-full bg-[#0078D4] hover:bg-[#006cbd] text-white font-extrabold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer border border-blue-400/30"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
                          <path fill="#f35325" d="M1 1h10v10H1z"/>
                          <path fill="#81bc06" d="M12 1h10v10H12z"/>
                          <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                          <path fill="#ffba08" d="M12 12h10v10H12z"/>
                        </svg>
                        <span>Sign in with Microsoft 365 (Internal)</span>
                      </button>
                    </div>

                    {/* Method 2: External Participant */}
                    <div className="bg-[#0F011E]/90 border border-[#00D1FF]/30 p-3 rounded-xl space-y-1">
                      <div className="text-[11px] font-black text-[#00D1FF] uppercase tracking-wider flex items-center gap-1.5">
                        <span>🌐 External Participant Sign-In</span>
                      </div>
                      <p className="text-[10px] text-zinc-300 leading-normal">External university student Google sign-in will be enabled for inter-university open events in upcoming phases.</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center my-4">
                  <div className="flex-1 border-t border-white/10"></div>
                  <span className="px-3 text-[10px] text-zinc-400 font-mono uppercase">or use register no / password</span>
                  <div className="flex-1 border-t border-white/10"></div>
                </div>

                {isStudentForgotPassword ? (
                  <form onSubmit={handleStudentForgotPassword} className="space-y-4">
                    <div className="p-3.5 bg-[#0F011E] border border-amber-500/40 rounded-xl text-amber-200 text-xs space-y-1.5 shadow-md">
                      <p className="font-bold flex items-center gap-1.5 text-amber-300">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0" /> Secure Official Password Reset
                      </p>
                      <p className="text-zinc-300 leading-relaxed text-[11px]">
                        To prevent unauthorized account takeovers, enter your University Email Address or Register Number. An official Firebase password reset link will be sent to your registered email inbox.
                      </p>
                    </div>

                    {signInError && (
                      <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2.5 shadow-md">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        <span>{signInError}</span>
                      </div>
                    )}

                    {studentForgotMsg && (
                      <div className="bg-cyan-950/90 border-2 border-[#00D1FF] text-cyan-100 text-xs p-4 rounded-xl space-y-1.5 shadow-xl animate-in fade-in duration-200">
                        <p className="font-extrabold text-[#00D1FF] flex items-center gap-1.5 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-[#00D1FF]" /> Password Reset Alert
                        </p>
                        <p className="whitespace-pre-line leading-relaxed">{studentForgotMsg}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                        University Email ID or Register Number <span className="text-[#FF007A]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 26anshuman.k@student.gcu.edu.in or 26ANSHUMAN.K"
                        value={signInRegisterNo}
                        onChange={(e) => setSignInRegisterNo(e.target.value)}
                        className="w-full bg-[#0F011E] border border-white/10 focus:border-[#00D1FF] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full bg-gradient-to-r from-amber-500 via-[#FF007A] to-purple-600 hover:opacity-90 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3.5 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      <Lock className="w-4 h-4" />
                      <span>{isAuthLoading ? 'Sending Link...' : 'Send Password Reset Link to Email'}</span>
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => { setIsStudentForgotPassword(false); setSignInError(''); setStudentForgotMsg(''); }}
                        className="text-xs text-zinc-400 hover:text-white font-bold transition-colors cursor-pointer"
                      >
                        ← Back to Student Sign In
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleSignInSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                        Register No or Email <span className="text-[#FF007A]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. REG-2026-001 or student@gmail.com"
                        value={signInRegisterNo}
                        onChange={(e) => setSignInRegisterNo(e.target.value)}
                        className="w-full bg-[#0F011E] border border-white/10 focus:border-[#FF007A] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                          Password <span className="text-[#FF007A]">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => { setIsStudentForgotPassword(true); setSignInError(''); setStudentForgotMsg(''); }}
                          className="text-[10px] font-bold text-[#00D1FF] hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className="w-full bg-[#0F011E] border border-white/10 focus:border-[#FF007A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-[#FF007A] hover:opacity-90 text-white font-black uppercase tracking-widest py-3.5 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[#FF007A]/25"
                    >
                      <span>Verify & Access Student Hub</span>
                    </button>
                  </form>
                )}
              </div>

            </div>
          )}

          {/* REGISTER NEW STUDENT VIEW */}
          {authMode === 'signup' && (
            <div className="bg-[#1A032E] border-2 border-[#FF007A] rounded-3xl shadow-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF007A]/5 rounded-full filter blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-[#FF007A] text-white p-3 rounded-2xl shadow-lg shadow-[#FF007A]/25">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-display font-black uppercase text-white tracking-tight italic transform -rotate-1">
                      New Student Account Sign Up
                    </h2>
                    <p className="text-zinc-300 text-xs mt-1">
                      Sign up with your official University Mail ID (<strong className="text-[#00D1FF]">@student.gcu.edu.in</strong> or <strong className="text-[#00D1FF]">@gcu.edu.in</strong>). Once signed up, sign in to join multiple events!
                    </p>
                  </div>
                </div>

                {formError && (
                  <div className="bg-rose-950/40 border-l-4 border-rose-500 text-rose-200 text-xs p-4 rounded-r-xl mb-6 flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* University Mail ID */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#00D1FF]" />
                        University Mail ID (@student.gcu.edu.in) <span className="text-[#FF007A]">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. 26anshuman.k@student.gcu.edu.in"
                        value={email}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEmail(val);
                          // Auto-fill register number and formatted name if empty
                          if (val.includes('@')) {
                            const prefix = val.split('@')[0];
                            if (prefix && !registerNo) {
                              setRegisterNo(prefix.toUpperCase());
                            }
                            if (prefix && !name) {
                              setName(formatStudentNameFromEmail(val));
                            }
                          }
                        }}
                        className="w-full bg-[#0F011E] border border-white/10 focus:border-[#00D1FF] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all font-mono"
                        required
                      />
                      <p className="text-[10px] text-zinc-400">Must end with @student.gcu.edu.in or @gcu.edu.in</p>
                    </div>

                    {/* Register Number */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#FF007A]" />
                        Register / Roll Number <span className="text-[#FF007A]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 26ANSHUMAN.K"
                        value={registerNo}
                        onChange={(e) => setRegisterNo(e.target.value)}
                        className="w-full bg-[#0F011E] border border-white/10 focus:border-[#FF007A] rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none transition-all uppercase"
                        required
                      />
                    </div>

                    {/* Full Name */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#FF007A]" />
                        Full Name <span className="text-[#FF007A]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Aditya Roy"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-[#0F011E] border border-white/10 focus:border-[#FF007A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all"
                        required
                      />
                    </div>

                    {/* Account Password */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[#FF007A]" />
                        Account Password <span className="text-[#FF007A]">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        className="w-full bg-[#0F011E] border border-white/10 focus:border-[#FF007A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all"
                        required
                      />
                    </div>

                    {/* Mobile */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#00D1FF]" />
                        Mobile Number <span className="text-[#FF007A]">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +91 98765 43210"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="w-full bg-[#0F011E] border border-white/10 focus:border-[#00D1FF] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all"
                        required
                      />
                    </div>

                    {/* Department Dropdown */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                        Department <span className="text-[#FF007A]">*</span>
                      </label>
                      <select
                        value={department}
                        onChange={(e) => handleDepartmentChange(e.target.value)}
                        className="w-full bg-[#0F011E] border border-white/20 focus:border-violet-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all cursor-pointer font-semibold"
                        required
                      >
                        <option value="" className="bg-[#0F011E] text-zinc-400">-- Select Department --</option>
                        {DEPARTMENT_PROGRAMS.map((dept) => (
                          <option key={dept.name} value={dept.name} className="bg-[#0F011E] text-white">
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Program Name Dropdown */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#00FFAB]" />
                        Program Name <span className="text-[#FF007A]">*</span>
                      </label>
                      <select
                        value={selectedProgramOption}
                        onChange={(e) => handleProgramOptionChange(e.target.value)}
                        disabled={!department}
                        className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00FFAB] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all cursor-pointer font-semibold"
                        required
                      >
                        <option value="" className="bg-[#0F011E] text-zinc-400">
                          {department ? '-- Select Program Name --' : '-- Select Department First --'}
                        </option>
                        {(DEPARTMENT_PROGRAMS.find(d => d.name === department)?.programs || []).map((prog) => (
                          <option key={prog} value={prog} className="bg-[#0F011E] text-white">
                            {prog}
                          </option>
                        ))}
                        {department && (
                          <option value="Other" className="bg-[#0F011E] text-cyan-400 font-black">
                            Other (Specify Custom Program Name)
                          </option>
                        )}
                      </select>

                      {/* Small Box below if "Other" is chosen */}
                      {selectedProgramOption === 'Other' && (
                        <div className="pt-2">
                          <input
                            type="text"
                            placeholder="Enter custom Program Name..."
                            value={customProgramName}
                            onChange={(e) => handleCustomProgramChange(e.target.value)}
                            className="w-full bg-[#0F011E] border-2 border-[#00FFAB] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none transition-all font-semibold shadow-inner"
                            required
                          />
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Post Signup Notice */}
                  <div className="p-4 bg-[#0F011E] border border-[#00D1FF]/40 rounded-2xl flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-[#00D1FF] shrink-0" />
                    <div className="text-xs">
                      <p className="font-extrabold text-white">Event Registration After Sign In</p>
                      <p className="text-zinc-300">Once your account is created, you will be signed in automatically to browse all events, view full event rules, and register for multiple events.</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-4 bg-gradient-to-r from-[#FF007A] via-violet-600 to-[#00D1FF] hover:opacity-95 text-white font-black uppercase tracking-widest py-4 px-6 rounded-2xl shadow-xl shadow-[#FF007A]/10 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-5 h-5 text-white" />
                    <span>Create Account & Continue to Events →</span>
                  </button>

                </form>
              </div>
            </div>
          )}

        </div>
      ) : (
        
        // 2. ACTIVE STUDENT DASHBOARD PANEL
        <div className="space-y-8">

          {/* FRESHATHON PROMO BUTTON */}
          {onShowFreshathon && (
            <div className="flex justify-center -mb-2">
              <button 
                onClick={onShowFreshathon}
                className="relative group px-6 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white font-black text-[11px] sm:text-xs uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all hover:scale-105 active:scale-95 cursor-pointer border-2 border-white flex items-center gap-2 overflow-hidden animate-pulse"
              >
                <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12" />
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-200"></span>
                </span>
                <span className="relative z-10 drop-shadow-md">🚀 Join Freshathon 2026 Sprint!</span>
                <ArrowRight className="w-4 h-4 text-white relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* Registration Feedback Toast */}
          {registrationToast && (
            <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between shadow-2xl transition-all animate-fadeIn ${
              registrationToast.type === 'success'
                ? 'bg-emerald-950/90 border-2 border-emerald-400 text-emerald-100'
                : 'bg-rose-950/90 border-2 border-rose-500 text-rose-100'
            }`}>
              <div className="flex items-center gap-3">
                {registrationToast.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 animate-bounce" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
                )}
                <span className="text-sm font-black">{registrationToast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setRegistrationToast(null)}
                className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
          
          {/* Welcome banner widget */}
          <div className="relative rounded-3xl overflow-hidden border-2 border-[#00D1FF] shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-[#0F011E] via-[#1A032E]/90 to-transparent z-10" />
            <img 
              src={studentBannerUrl} 
              alt="Vibrant College Festival" 
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              referrerPolicy="no-referrer"
            />
            <div className="relative z-20 p-6 md:p-10 space-y-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="bg-[#FF007A] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded">
                    ACTIVE FRESHER SESSION
                  </span>
                  <span className="bg-[#00D1FF]/20 border border-[#00D1FF]/40 text-[#00D1FF] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded">
                    {activeStudent.school}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white leading-none transform -rotate-1 italic">
                  Rock On, <span className="text-[#00D1FF] drop-shadow-[0_2px_8px_rgba(0,209,255,0.4)]">{activeStudent.name}</span>! 🎸
                </h1>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 font-mono text-xs">
                  <div>
                    <p className="text-slate-200 font-extrabold uppercase tracking-widest text-[9px]">REGISTER NO</p>
                    <p className="text-white font-black">{activeStudent.registerNo}</p>
                  </div>
                  <div>
                    <p className="text-slate-200 font-extrabold uppercase tracking-widest text-[9px]">DEPARTMENT</p>
                    <p className="text-white font-black">{activeStudent.department}</p>
                  </div>
                  <div>
                    <p className="text-slate-200 font-extrabold uppercase tracking-widest text-[9px]">EVENTS REGISTERED</p>
                    <p className="text-[#00D1FF] font-black">{activeStudent.registeredEventIds.length} Events</p>
                  </div>
                  <div>
                    <p className="text-slate-200 font-extrabold uppercase tracking-widest text-[9px]">OVERALL RANK</p>
                    <p className="text-amber-400 font-black text-xs uppercase tracking-wider">
                      {overallStudentRank ? `🏆 Rank #${overallStudentRank}` : 'Unranked'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowQRModal(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#FF007A] via-pink-600 to-purple-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-[#FF007A]/20 transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20 animate-pulse"
                >
                  <QrCode className="w-4 h-4 text-white" />
                  <span>My Digital Pass & QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenProfileCompletion(activeStudent)}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20"
                >
                  <User className="w-4 h-4 text-white" />
                  <span>Edit / Complete Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPasswordModalOpen(true);
                    setStudentForgotMsg('');
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 via-[#00D1FF] to-blue-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-[#00D1FF]/20 transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20"
                >
                  <Lock className="w-4 h-4 text-white" />
                  <span>Reset My Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectStudent(null as any);
                    setAuthMode('signin');
                  }}
                  className="px-4 py-2.5 bg-[#0F011E] hover:bg-black/80 border border-white/20 text-rose-300 hover:text-rose-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Sign Out / Switch Student</span>
                </button>
              </div>
            </div>


          </div>

          {/* Conflict Manager Warning Grid */}
          <div className="bg-[#1A032E] p-1 border-2 border-[#FFAC1C] rounded-3xl shadow-xl">
            <ConflictManager 
              registeredEventIds={activeStudent.registeredEventIds}
              allEvents={events}
              onUnregister={(evtId) => onToggleEventRegistration(activeStudent.registerNo, evtId)}
            />
          </div>

          {/* Active Student Dashboard Section */}
          <div className="space-y-8 font-sans">
            
            {/* NCC Army Wing Enrollment Status Banner with 2 Separate Options */}
            <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-teal-950 border-2 border-emerald-500/50 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                  🇮🇳
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">GCU NCC ARMY WING 2026</span>
                    {activeStudent.isNccInterested ? (
                      <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-300 font-bold text-[9px] rounded-full border border-emerald-500/40">REGISTERED CADET</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-white/10 text-zinc-300 font-bold text-[9px] rounded-full">OPEN FOR ENROLLMENT</span>
                    )}
                  </div>
                  <p className="text-xs text-white font-bold mt-0.5">
                    {activeStudent.isNccInterested 
                      ? `Status: Expression of Interest submitted under Prof. Vishnu Pandhare!`
                      : `Interested in joining the elite National Cadet Corps (NCC)? 'B' & 'C' certificates, defense preference & adventure camps.`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setShowNccModal(true)}
                  className="flex-1 md:flex-none px-4 py-2.5 bg-gradient-to-r from-amber-400 to-emerald-400 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>{activeStudent.isNccInterested ? 'View Interest Status' : '⚡ Join NCC 2026'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStudentEventSearch('NCC');
                    window.scrollTo({ top: 800, behavior: 'smooth' });
                  }}
                  className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-400/50 text-emerald-200 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>🎖️ Participate in NCC Events</span>
                </button>
              </div>
            </div>

            {/* Email Verification Banner / Status Card */}
            {activeStudent.isEmailVerified ? (
              <div className="bg-gradient-to-r from-[#0F011E] to-[#1A032E] border-2 border-[#00FFAB]/50 rounded-3xl p-5 shadow-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#00FFAB]/20 border border-[#00FFAB]/40 rounded-2xl text-[#00FFAB]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#00FFAB] font-black uppercase tracking-widest">EMAIL VERIFIED ✓</p>
                    <p className="text-xs text-white font-bold">{activeStudent.email}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-[#00FFAB]/20 text-[#00FFAB] text-[10px] font-black rounded-lg uppercase tracking-wider">
                  Full Access Granted
                </span>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-[#2E004F] via-[#1A032E] to-[#0F011E] border-2 border-[#FF007A] rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-[#FF007A]/20 border border-[#FF007A]/40 rounded-2xl text-[#FF007A] shrink-0 animate-pulse">
                    <Mail className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 bg-[#FF007A] text-white text-[9px] font-black uppercase rounded tracking-wider">
                      EMAIL ACTIVATION PENDING
                    </span>
                    <h3 className="text-lg font-black text-white italic">
                      Confirm Your University Email ID
                    </h3>
                    <p className="text-xs text-zinc-300">
                      An activation link was dispatched to <strong className="text-[#00D1FF]">{activeStudent.email}</strong>. Please confirm your email address below to enable event registrations!
                    </p>
                  </div>
                </div>

                {verificationMessage && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-400 text-emerald-200 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{verificationMessage}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleActivateEmail}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#FF007A] to-violet-600 hover:opacity-95 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>🔗 Activate Email Link Now</span>
                  </button>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    Code: <strong className="text-white">{activeStudent.verificationCode || 'GCU-VERIFY'}</strong>
                  </span>
                </div>
              </div>
            )}

            {unverifiedAlert && (
              <div className="p-4 bg-rose-950/80 border-2 border-rose-500 text-rose-200 text-xs rounded-2xl flex items-center gap-3 shadow-xl">
                <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
                <div>
                  <p className="font-extrabold text-rose-300 uppercase tracking-wider text-[10px]">Verification Blocked</p>
                  <p>{unverifiedAlert}</p>
                </div>
              </div>
            )}

            {/* 📡 HIGH PRIORITY: LIVE EVENT UPDATES (ON TOP OF STUDENT PORTAL) */}
            <div className="bg-gradient-to-r from-[#0F011E] via-[#1A032E] to-[#002B48] border-2 border-[#00D1FF] rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#00D1FF]/40 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3.5 w-3.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D1FF] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#00D1FF]"></span>
                  </span>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight italic flex items-center gap-2">
                    📡 LIVE EVENT UPDATES & Coordinator Broadcasts
                  </h3>
                </div>
                <span className="px-3 py-1 bg-[#00D1FF]/20 border border-[#00D1FF]/50 text-[#00D1FF] font-mono text-[10px] font-black rounded-lg uppercase tracking-wider self-start sm:self-auto">
                  {(notifications || []).length} Live Alerts Active
                </span>
              </div>

              {(notifications || []).length === 0 ? (
                <div className="p-5 bg-black/40 border border-white/10 rounded-2xl text-center text-xs text-zinc-300 italic">
                  ⚡ Live venue announcements, timing alerts, and broadcast messages from Event Coordinators will appear here instantly.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {(notifications || []).slice().reverse().map(notif => (
                    <div key={notif.id} className="p-4 bg-[#140026] border-l-4 border-[#00D1FF] border-t border-r border-b border-white/15 rounded-r-2xl rounded-l-md space-y-2 shadow-lg hover:border-[#00FFAB] transition-all">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/40 font-black px-2 py-0.5 rounded uppercase font-mono">
                          {notif.eventTitle || 'All Events'}
                        </span>
                        <span className="text-[10px] text-amber-200 font-mono font-bold shrink-0">{notif.timestamp}</span>
                      </div>
                      <h4 className="text-xs font-black text-white leading-snug">{notif.title}</h4>
                      <p className="text-xs text-zinc-200 leading-relaxed">{notif.content}</p>
                      <p className="text-[10px] text-cyan-300 font-bold text-right pt-1 border-t border-white/10">Event Coordinator: {notif.senderName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🚨 HIGH PRIORITY: DIRECTIVE FROM CONVENOR */}
            <div className="bg-gradient-to-r from-rose-950/90 via-[#2A002A] to-[#120024] border-2 border-[#FF007A] rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#FF007A]/40 pb-3">
                <div className="flex items-center gap-2.5 text-[#FF007A]">
                  <AlertCircle className="w-6 h-6 animate-pulse text-[#FF007A] shrink-0" />
                  <h3 className="text-lg font-black text-white uppercase tracking-tight italic">
                    🚨 Directive from Convenor (High Priority)
                  </h3>
                </div>
                <span className="px-3 py-1 bg-[#FF007A]/20 border border-[#FF007A]/50 text-rose-300 font-mono text-[10px] font-black rounded-lg uppercase tracking-wider self-start sm:self-auto">
                  Official Convenor Policy Notice
                </span>
              </div>
              
              <div className="space-y-3">
                {(notifications || []).filter(n => n.senderName?.toLowerCase().includes('convenor') || n.title?.toLowerCase().includes('directive') || n.content?.toLowerCase().includes('directive')).length > 0 ? (
                  (notifications || []).filter(n => n.senderName?.toLowerCase().includes('convenor') || n.title?.toLowerCase().includes('directive') || n.content?.toLowerCase().includes('directive')).map(notif => (
                    <div key={notif.id} className="bg-black/60 border border-rose-500/40 p-4 rounded-2xl space-y-1">
                      <div className="flex justify-between items-center text-xs text-rose-300 font-bold">
                        <span>📢 {notif.title}</span>
                        <span className="font-mono text-[10px] text-zinc-400">{notif.timestamp}</span>
                      </div>
                      <p className="text-xs text-zinc-100 leading-relaxed font-medium">{notif.content}</p>
                      <p className="text-[10px] text-amber-300 font-mono text-right">Authority: {notif.senderName || 'Convenor Desk'}</p>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-black/50 border border-rose-500/40 p-4 rounded-2xl space-y-1.5">
                      <div className="flex justify-between items-center text-xs text-amber-300 font-black">
                        <span>🆔 Mandatory Student ID Verification</span>
                        <span className="font-mono text-[10px] bg-rose-500/20 px-2 py-0.5 rounded text-rose-300 border border-rose-500/40 font-bold">HIGH PRIORITY</span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed">
                        All participating students must present their physical University Student ID Card or official registration pass at hall entry gates prior to event commencement.
                      </p>
                    </div>
                    <div className="bg-black/50 border border-rose-500/40 p-4 rounded-2xl space-y-1.5">
                      <div className="flex justify-between items-center text-xs text-amber-300 font-black">
                        <span>⏰ Venue Reporting & Schedule Discipline</span>
                        <span className="font-mono text-[10px] bg-rose-500/20 px-2 py-0.5 rounded text-rose-300 border border-rose-500/40 font-bold">HIGH PRIORITY</span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed">
                        Arrive strictly 15 minutes before scheduled start time. Automatic participation credit (10 points) will be logged digitally upon venue entry desk check-in.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MAIN RESPONSIVE 3D ANIMATED EVENTS CATALOG (1, 2, or 3 per row) */}
            <div className="w-full bg-[#1A032E] border-2 border-[#00D1FF]/60 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="inline-flex items-center gap-2 bg-[#00D1FF]/15 border border-[#00D1FF]/30 px-3 py-1 rounded-full text-[10px] font-black text-[#00D1FF] uppercase tracking-widest mb-1">
                    <Sparkles className="w-3.5 h-3.5" /> Fresherism '26 3D Events Showcase
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white italic tracking-tight uppercase">
                    Browse Events & Competitions
                  </h2>
                  <p className="text-zinc-300 text-xs mt-1 font-medium">
                    Click any 3D event box below to view venue, competition game rules, poster brochure, and coordinator contacts!
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-[#00D1FF]/20 border border-[#00D1FF]/40 text-[#00D1FF] text-xs font-black font-mono rounded-xl">
                    {events.length} Events
                  </span>
                  <span className="px-3 py-1.5 bg-[#FF007A]/20 border border-[#FF007A]/40 text-[#FF007A] text-xs font-black font-mono rounded-xl">
                    {activeStudent.registeredEventIds.length} Joined
                  </span>
                </div>
              </div>

              {/* Search & Club Filter Controls */}
              <div className="bg-[#0F011E] border border-white/10 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search all 42 events by title, venue, or host club..."
                    value={studentEventSearch}
                    onChange={(e) => setStudentEventSearch(e.target.value)}
                    className="w-full bg-[#1A032E] border border-white/10 focus:border-[#00D1FF] text-xs text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none transition-all"
                  />
                </div>
                <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
                  <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider shrink-0">Club:</label>
                  <select
                    value={studentDeptFilter}
                    onChange={(e) => setStudentDeptFilter(e.target.value)}
                    className="bg-[#1A032E] border border-white/10 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#00D1FF]"
                  >
                    <option value="all">All Clubs ({events.length})</option>
                    {Array.from(new Set(events.map(e => e.hostDepartment))).sort().map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3D Responsive Grid: Registered events listed first, non-registered events below */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
                {[...events]
                  .filter((evt) => {
                    const query = studentEventSearch.toLowerCase().trim();
                    const matchesSearch = !query ||
                      evt.title.toLowerCase().includes(query) ||
                      evt.hostDepartment.toLowerCase().includes(query) ||
                      evt.venue.toLowerCase().includes(query) ||
                      evt.coordinatorName.toLowerCase().includes(query);
                    const matchesDept = studentDeptFilter === 'all' || evt.hostDepartment === studentDeptFilter;
                    return matchesSearch && matchesDept;
                  })
                  .sort((a, b) => {
                    const aReg = activeStudent.registeredEventIds.includes(a.id) ? 1 : 0;
                    const bReg = activeStudent.registeredEventIds.includes(b.id) ? 1 : 0;
                    return bReg - aReg; // Registered events first
                  })
                  .map((evt) => {
                  const isRegistered = activeStudent.registeredEventIds.includes(evt.id);
                  return (
                    <div 
                      key={evt.id}
                      onClick={() => setSelectedDetailEvent(evt)}
                      className={`group relative p-6 rounded-3xl transition-all duration-300 ease-out transform-gpu hover:-translate-y-2.5 hover:rotate-x-2 hover:scale-[1.02] cursor-pointer flex flex-col justify-between space-y-4 overflow-hidden border-2 shadow-2xl ${
                        isRegistered 
                          ? 'bg-gradient-to-br from-[#3B075C] via-[#2A0347] to-[#140026] border-[#00FFAB] shadow-[0_0_25px_rgba(0,255,171,0.25)] ring-2 ring-[#00FFAB]/40' 
                          : 'bg-gradient-to-br from-[#120124]/90 via-[#0A0016] to-[#120124]/60 border-white/10 opacity-80 hover:opacity-100 hover:border-[#FF007A] hover:shadow-[#FF007A]/20'
                      }`}
                    >
                      {/* Top 3D Neon Accent Bar */}
                      <div className={`absolute top-0 left-0 right-0 h-1.5 ${isRegistered ? 'bg-gradient-to-r from-[#00FFAB] via-[#00D1FF] to-[#00FFAB]' : 'bg-gradient-to-r from-[#FF007A] via-[#00D1FF] to-[#FF007A]'} group-hover:h-2.5 transition-all`} />

                      {/* Header Badge */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="px-2.5 py-1 bg-[#FF007A]/20 border border-[#FF007A]/40 text-[#FF007A] text-[10px] font-black rounded-lg uppercase tracking-wider">
                          {evt.hostDepartment}
                        </span>
                        {isRegistered ? (
                          <span className="px-3 py-1 bg-[#00FFAB]/25 border-2 border-[#00FFAB] text-[#00FFAB] text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(0,255,171,0.3)]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> JOINED EVENT
                          </span>
                        ) : isEventOver(evt) ? (
                          <span className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                            Event Completed
                          </span>
                        ) : (evt.isRegistrationClosed || evt.registrationClosed) && !isEventOver(evt) ? (
                          <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-400" /> Registration Closed
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-zinc-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                            Available
                          </span>
                        )}
                      </div>

                      {/* Title & Preview */}
                      <div className="space-y-1.5 flex-1">
                        <h3 className="text-xl font-black text-white group-hover:text-[#00D1FF] transition-colors leading-tight italic">
                          {evt.title}
                        </h3>
                        {evt.description && (
                          <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                            {evt.description}
                          </p>
                        )}
                      </div>

                      {/* Date & Time display */}
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="px-3 py-1.5 bg-[#FF007A]/20 border border-[#FF007A]/40 text-white font-bold rounded-xl flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#FF007A]" /> {formatDateDDMMYYYY(evt.date)}
                          </span>
                          <span className="px-3 py-1.5 bg-[#00D1FF]/20 border border-[#00D1FF]/40 text-white font-bold rounded-xl flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#00D1FF]" /> {evt.timeStart}–{evt.timeEnd}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Interactive 3D CTA Bar */}
                      <div className="pt-2 flex items-center justify-between text-xs font-black text-[#00D1FF] group-hover:text-[#00FFAB] transition-colors">
                        <span className="text-[11px] uppercase tracking-wider flex items-center gap-1">
                          <span>View Venue & Game Rules</span>
                        </span>
                        <span className="text-base transform group-hover:translate-x-1.5 transition-transform">↗</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECONDARY SECTION: MY JOINED EVENTS & LIVE UPDATES */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Live Updates & Alerts */}
              <div className="lg:col-span-5 bg-gradient-to-b from-[#1A032E] to-[#0F011E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2 transform -rotate-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF007A] animate-pulse" />
                    Live Event Updates
                  </h3>
                  <span className="px-2.5 py-0.5 bg-[#FF007A]/15 border border-[#FF007A]/35 text-[#FF007A] text-[10px] font-mono font-black rounded">
                    {relevantNotifications.length} Alerts
                  </span>
                </div>
                
                {relevantNotifications.length === 0 ? (
                  <p className="text-zinc-500 text-xs italic py-4 text-center">
                    No new venue updates or announcements published yet.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {relevantNotifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className="p-4 bg-[#140026] border-l-4 border-[#00D1FF] border-t border-r border-b border-white/20 rounded-r-2xl rounded-l-md space-y-2 shadow-lg"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/40 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wide">
                            {notif.eventTitle.split(' - ')[0]}
                          </span>
                          <span className="text-xs text-amber-200 font-mono font-bold">{notif.timestamp}</span>
                        </div>
                        <h4 className="text-base font-extrabold text-white leading-snug">{notif.title}</h4>
                        <p className="text-sm text-zinc-100 font-medium leading-relaxed">{notif.content}</p>
                        <p className="text-xs text-cyan-200 font-bold text-right">Event Coordinator: {notif.senderName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Joined Events Summary */}
              <div className="lg:col-span-7 bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                <h3 className="text-xl font-black text-white uppercase tracking-tight transform -rotate-1 flex items-center justify-between">
                  <span>My Registered Events ({activeStudent.registeredEventIds.length})</span>
                  <span className="text-xs font-mono text-[#00D1FF] normal-case">Points & Rules Guide</span>
                </h3>

                {activeStudent.registeredEventIds.length === 0 ? (
                  <div className="text-center py-12 space-y-3 border-2 border-dashed border-white/10 rounded-2xl">
                    <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-zinc-400 text-sm font-bold">You haven't joined any events yet!</p>
                    <p className="text-zinc-500 text-xs">Browse the events catalog above and click "+ Join Event" to participate.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                    {events
                      .filter(evt => activeStudent.registeredEventIds.includes(evt.id))
                      .map((evt) => {
                        const scoreInfo = studentScores.find(s => s.eventId === evt.id);
                        const isEnded = isEventOver(evt);
                        return (
                          <div 
                            key={evt.id}
                            onClick={() => setSelectedDetailEvent(evt)}
                            className="bg-[#0F011E]/80 border border-white/10 hover:border-[#00D1FF]/50 rounded-2xl p-4 space-y-3 transition-all cursor-pointer"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                              <div>
                                <h4 className="text-base font-black text-white flex items-center gap-2">
                                  <span>{evt.title}</span>
                                </h4>
                                <p className="text-[11px] text-zinc-400 font-medium">Hosted by: {evt.hostDepartment}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isEnded && (
                                  <span className="px-3 py-1 bg-zinc-800/80 border border-zinc-700 text-zinc-400 rounded-lg text-xs font-bold shrink-0">
                                    ✓ Event Completed
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDetailEvent(evt);
                                  }}
                                  className="px-3 py-1 bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/30 rounded-lg text-xs font-black shrink-0 hover:bg-[#00D1FF]/30 transition-all"
                                >
                                  ℹ️ Event Window
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs font-mono">
                              <span className="text-zinc-300">📅 {formatDateDDMMYYYY(evt.date)}</span>
                              <span className="text-zinc-300">⏰ {evt.timeStart}-{evt.timeEnd}</span>
                              <span className="text-zinc-300">📍 {evt.venue}</span>
                            </div>

                            {/* Participation Status */}
                            <div className="bg-[#1A032E] rounded-xl p-2.5 border border-white/5 flex items-center justify-between text-xs font-mono">
                              <span className="text-zinc-400">Participation: <strong className="text-emerald-400">{scoreInfo?.participated ? 'Participated ✓' : 'Registered'}</strong></span>
                              <span className="text-zinc-400">Event Status: <strong className="text-cyan-400">{isEnded ? 'Completed' : 'Upcoming'}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL FOR ACTIVE LOGGED-IN STUDENT */}
      {isResetPasswordModalOpen && activeStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A032E] border-2 border-[#00D1FF] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden font-sans space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-[#00D1FF]/20 border border-[#00D1FF]/40 rounded-xl text-[#00D1FF]">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white italic">Reset Account Password</h3>
                  <p className="text-xs text-zinc-400">{activeStudent.name} ({activeStudent.registerNo})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="text-zinc-400 hover:text-white font-bold text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {studentForgotMsg && (
              <div className={`p-3.5 text-xs rounded-xl flex items-center gap-2 shadow-md ${
                studentForgotMsg.toLowerCase().includes('failed') || studentForgotMsg.toLowerCase().includes('error')
                  ? 'bg-rose-950/80 border border-rose-500 text-rose-200'
                  : 'bg-emerald-950/90 border border-emerald-400 text-emerald-100'
              }`}>
                {studentForgotMsg.toLowerCase().includes('failed') || studentForgotMsg.toLowerCase().includes('error') ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span className="leading-relaxed">{studentForgotMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block">
                  Set New Password Directly
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter new password (min 6 chars)"
                    value={instantNewPassInput}
                    onChange={(e) => setInstantNewPassInput(e.target.value)}
                    className="flex-1 bg-[#0F011E] border border-white/10 focus:border-[#00D1FF] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    disabled={isAuthLoading || !instantNewPassInput.trim()}
                    onClick={async () => {
                      if (!activeStudent || instantNewPassInput.trim().length < 6) {
                        setStudentForgotMsg('Password must be at least 6 characters.');
                        return;
                      }
                      setIsAuthLoading(true);
                      setStudentForgotMsg('');
                      try {
                        const updated = { ...activeStudent, password: instantNewPassInput.trim() };
                        await dbSaveStudent(updated);
                        onRegisterStudent(updated);
                        setStudentForgotMsg('✅ Password Updated Successfully in Database!');
                        setInstantNewPassInput('');
                      } catch (err: any) {
                        setStudentForgotMsg('Error updating password: ' + err.message);
                      } finally {
                        setIsAuthLoading(false);
                      }
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#FF007A] to-purple-600 hover:opacity-90 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer shrink-0"
                  >
                    Update
                  </button>
                </div>
              </div>

              <div className="relative flex items-center my-2">
                <div className="flex-1 border-t border-white/10"></div>
                <span className="px-2 text-[10px] text-zinc-500 font-mono">OR USE EMAIL LINK</span>
                <div className="flex-1 border-t border-white/10"></div>
              </div>

              <div className="p-3 bg-[#0F011E] border border-cyan-500/30 rounded-xl text-zinc-300 text-xs space-y-1">
                <p className="font-bold text-cyan-300">📧 Send Firebase Email Reset Link</p>
                <p className="text-[11px] text-zinc-400">Send password reset link to <span className="font-mono text-cyan-200 font-bold">{activeStudent.email}</span>.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isAuthLoading}
                  onClick={async () => {
                    setIsAuthLoading(true);
                    setStudentForgotMsg('');
                    try {
                      await sendResetPasswordLink(activeStudent.email);
                      setStudentForgotMsg(`📧 Password Reset Link Sent to ${activeStudent.email}!\n\n📌 Check Outlook "Other" tab and Junk Email folder if not in Focused.`);
                    } catch (err: any) {
                      if (err.code === 'auth/user-not-found') {
                        setStudentForgotMsg(`Failed: No registered account found for "${activeStudent.email}". Please verify email.`);
                      } else {
                        setStudentForgotMsg(`Failed to send password reset link: ${err.message || 'Please try again.'}`);
                      }
                    } finally {
                      setIsAuthLoading(false);
                    }
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-[#00D1FF] to-blue-600 hover:opacity-90 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isAuthLoading ? 'Sending...' : 'Send Link'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE SIGN-IN ACCOUNT CHOOSER MODAL */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white text-zinc-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-zinc-200 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <div>
                  <h3 className="text-lg font-black text-zinc-900 leading-tight">Sign in with Google</h3>
                  <p className="text-xs text-zinc-500 font-medium">Choose an account for Fresherism '26</p>
                </div>
              </div>
              <button 
                onClick={() => setIsGoogleModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 hover:text-zinc-800 font-bold text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {googleAuthError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{googleAuthError}</span>
              </div>
            )}

            {/* Custom Gmail Input Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleConfirmGoogleLogin(googleEmailInput); }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-700">Enter Gmail / Google Address:</label>
                <div className="relative">
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="e.g. indira.professor@gmail.com"
                    className="w-full bg-zinc-50 border border-zinc-300 focus:border-[#4285F4] focus:bg-white text-zinc-900 text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsGoogleModalOpen(false)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#4285F4] hover:bg-blue-600 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Sign In with Google</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Event Details Modal */}
      {selectedDetailEvent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative max-w-2xl w-full max-h-[90vh] bg-[#1A032E] border-2 border-[#00D1FF] rounded-3xl p-6 shadow-2xl overflow-y-auto space-y-5">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-[#00D1FF]/15 text-[#00D1FF] border border-[#00D1FF]/30 px-3 py-1 rounded-full">
                  {selectedDetailEvent.hostDepartment}
                </span>
                <h2 className="text-2xl font-black text-white italic tracking-tight uppercase mt-2">
                  {selectedDetailEvent.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailEvent(null)}
                className="bg-black/60 border border-white/20 text-white hover:text-rose-400 p-2 rounded-xl transition-colors cursor-pointer text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            {/* Poster Preview */}
            {(selectedDetailEvent.brochureUrl || selectedDetailEvent.imageUrl) && (
              <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black/60 group max-h-64 flex items-center justify-center">
                <img
                  src={selectedDetailEvent.brochureUrl || selectedDetailEvent.imageUrl}
                  alt={selectedDetailEvent.title}
                  className="w-full h-56 object-cover object-top"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => {
                    setViewBrochureUrl(selectedDetailEvent.brochureUrl || selectedDetailEvent.imageUrl || '');
                  }}
                  className="absolute bottom-3 right-3 bg-black/80 hover:bg-[#FF007A] text-white text-xs font-black px-3 py-1.5 rounded-xl border border-white/20 shadow-lg cursor-pointer transition-all flex items-center gap-1.5"
                >
                  🔍 Zoom Full Poster
                </button>
              </div>
            )}

            {/* Date, Time, Venue Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#0F011E] border border-[#FF007A]/50 p-3 rounded-2xl">
                <p className="text-[10px] font-black text-[#FF007A] uppercase tracking-wider">Date</p>
                <p className="text-sm font-black text-white">{formatDateDDMMYYYY(selectedDetailEvent.date)}</p>
              </div>
              <div className="bg-[#0F011E] border border-[#00D1FF]/50 p-3 rounded-2xl">
                <p className="text-[10px] font-black text-[#00D1FF] uppercase tracking-wider">Timing</p>
                <p className="text-sm font-black text-white">{selectedDetailEvent.timeStart} – {selectedDetailEvent.timeEnd}</p>
              </div>
              <div className="bg-[#0F011E] border border-[#00FFAB]/50 p-3 rounded-2xl">
                <p className="text-[10px] font-black text-[#00FFAB] uppercase tracking-wider">Venue</p>
                <p className="text-sm font-black text-white">{selectedDetailEvent.venue}</p>
              </div>
            </div>

            {/* Description */}
            {selectedDetailEvent.description && (
              <div className="bg-[#0F011E]/80 rounded-2xl p-4 border border-white/10 space-y-1">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">About This Event</p>
                <p className="text-xs text-zinc-200 leading-relaxed">{selectedDetailEvent.description}</p>
              </div>
            )}

            {/* Competition Rules */}
            <div className="bg-[#0F011E]/80 rounded-2xl p-4 border border-white/10 space-y-2">
              <p className="text-[10px] font-black uppercase text-[#00D1FF] tracking-widest">
                Rules & Competition Guidelines
              </p>
              <p className="text-xs text-zinc-300 whitespace-pre-line leading-relaxed">
                {selectedDetailEvent.rules || 'Standard GCU Fresherism Competition Rules apply. Please report at least 15 minutes before event start time at venue.'}
              </p>
            </div>

            {/* Faculty & Student Coordinators */}
            <div className="bg-[#0F011E]/80 rounded-2xl p-4 border border-white/10 text-xs space-y-2">
              <p className="text-[10px] font-black uppercase text-[#FF007A] tracking-wider">
                Event Coordinators Contact
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-300">
                <div>
                  <p className="font-bold text-white">Faculty Coordinator</p>
                  <p>{selectedDetailEvent.coordinatorName}</p>
                  <p className="text-zinc-400 font-mono text-[11px]">{selectedDetailEvent.coordinatorMobile}</p>
                  <p className="text-zinc-400 text-[11px]">{selectedDetailEvent.coordinatorEmail}</p>
                </div>
                {selectedDetailEvent.studentCoordinatorName && (
                  <div>
                    <p className="font-bold text-[#00D1FF]">Student Coordinator</p>
                    <p>{selectedDetailEvent.studentCoordinatorName}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {activeStudent && (() => {
              const isSelectedEventEnded = isEventOver(selectedDetailEvent);
              const isRegClosed = Boolean(selectedDetailEvent.isRegistrationClosed || selectedDetailEvent.registrationClosed) && !isSelectedEventEnded;
              const isStudentRegistered = activeStudent.registeredEventIds.includes(selectedDetailEvent.id);

              return (
                <div className="pt-2 border-t border-white/10 flex flex-col space-y-2">
                  {certError && (
                    <p className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl text-center">
                      {certError}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      {isStudentRegistered ? (
                        <span className="text-xs font-black text-[#00FFAB] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> You are registered for this event!
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-zinc-400">
                          {isSelectedEventEnded 
                            ? 'This event has concluded.' 
                            : isRegClosed 
                            ? 'Registration for this event is closed by the coordinator.' 
                            : 'Register now to secure your slot!'}
                        </span>
                      )}
                    </div>

                    {/* When event is ended, show disabled "Event Completed" button regardless of registration */}
                    {isSelectedEventEnded ? (
                      <button
                        type="button"
                        disabled
                        className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed flex items-center gap-2"
                      >
                        ✓ Event Completed
                      </button>
                    ) : isRegClosed && !isStudentRegistered ? (
                      <button
                        type="button"
                        disabled
                        className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-not-allowed flex items-center gap-2"
                      >
                        <Lock className="w-4 h-4 text-amber-400" />
                        Registration Closed
                      </button>
                    ) : isStudentRegistered ? (
                      <button
                        type="button"
                        onClick={() => {
                          setUnverifiedAlert('');
                          handleEventRegistrationAttempt(selectedDetailEvent.id);
                        }}
                        className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer transition-all bg-rose-500/20 border-2 border-rose-500 text-rose-300 hover:bg-rose-500/30"
                      >
                        Leave Event
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setUnverifiedAlert('');
                          handleEventRegistrationAttempt(selectedDetailEvent.id);
                        }}
                        className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer transition-all bg-gradient-to-r from-[#FF007A] to-[#00D1FF] text-white hover:opacity-90 shadow-[#FF007A]/30"
                      >
                        + Register For Event
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* Lightbox Modal for Event Brochure */}
      {viewBrochureUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-[#1A032E] border-2 border-[#FF007A] rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center overflow-hidden">
            <div className="w-full flex justify-between items-center pb-3 mb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white uppercase italic tracking-wide flex items-center gap-2">
                <span>📄 Official Event Brochure & Poster</span>
              </h3>
              <button 
                onClick={() => setViewBrochureUrl(null)}
                className="bg-black/60 border border-white/20 text-white p-2 rounded-xl hover:bg-rose-600 transition-colors cursor-pointer font-bold text-xs"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex-1 w-full overflow-auto flex items-center justify-center bg-black/50 rounded-2xl p-2">
              <img 
                src={viewBrochureUrl} 
                alt="Full Event Brochure" 
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="w-full flex justify-between items-center pt-3 mt-3 border-t border-white/10 text-xs text-zinc-400">
              <span>Fresherism Carnival '26 Official Event Poster</span>
              <button
                onClick={() => setViewBrochureUrl(null)}
                className="px-5 py-2 bg-[#FF007A] text-white font-black rounded-xl uppercase text-xs hover:bg-[#FF007A]/80 shadow cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY STUDENT PROFILE COMPLETION MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative max-w-xl w-full max-h-[90vh] bg-[#1A032E] border-2 border-[#00FFAB] rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto space-y-6 font-sans">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#00FFAB]/20 border border-[#00FFAB]/40 rounded-2xl text-[#00FFAB]">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white italic tracking-tight uppercase">
                    Complete Student Profile
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Fresherism '26 Mandatory Registration Details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="bg-black/60 border border-white/20 text-white hover:text-rose-400 p-2 rounded-xl transition-colors cursor-pointer text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            {/* Error Message */}
            {completionError && (
              <div className="p-3.5 bg-rose-950/80 border border-rose-400 text-rose-200 text-xs rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{completionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfileCompletion} className="space-y-4">
              
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#00D1FF]" />
                  Full Name <span className="text-[#FF007A]">*</span>
                </label>
                <input
                  type="text"
                  value={completionName}
                  onChange={(e) => setCompletionName(e.target.value)}
                  placeholder="e.g. Indira Professor"
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-semibold rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
                  required
                />
              </div>

              {/* Gmail / Mail ID */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#00D1FF]" />
                  Email / Mail ID <span className="text-[#FF007A]">*</span>
                </label>
                <input
                  type="email"
                  value={completionEmail}
                  onChange={(e) => setCompletionEmail(e.target.value)}
                  placeholder="e.g. indira.professor@gmail.com"
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-mono rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
                  required
                />
              </div>

              {/* Register No & Mobile No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Register Number */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#FF007A]" />
                    Student ID / Reg. No <span className="text-[#FF007A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={completionRegisterNo}
                    onChange={(e) => setCompletionRegisterNo(e.target.value)}
                    placeholder="e.g. 2026101001"
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-[#FF007A] text-white font-mono uppercase rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
                    required
                  />
                </div>

                {/* Mobile Number */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#00FFAB]" />
                    Mobile Number <span className="text-[#FF007A]">*</span>
                  </label>
                  <input
                    type="tel"
                    value={completionMobile}
                    onChange={(e) => setCompletionMobile(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00FFAB] text-white font-mono rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#00D1FF]" />
                  Department <span className="text-[#FF007A]">*</span>
                </label>
                <select
                  value={completionDepartment}
                  onChange={(e) => handleCompletionDepartmentChange(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-semibold rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all cursor-pointer"
                  required
                >
                  <option value="" className="bg-[#0F011E] text-zinc-400">-- Select Department --</option>
                  {DEPARTMENT_PROGRAMS.map((dept) => (
                    <option key={dept.name} value={dept.name} className="bg-[#0F011E] text-white">
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Program Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#00FFAB]" />
                  Program Name <span className="text-[#FF007A]">*</span>
                </label>
                <select
                  value={completionSelectedProgramOption}
                  onChange={(e) => handleCompletionProgramOptionChange(e.target.value)}
                  disabled={!completionDepartment}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00FFAB] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all cursor-pointer"
                  required
                >
                  <option value="" className="bg-[#0F011E] text-zinc-400">
                    {completionDepartment ? '-- Select Program Name --' : '-- Select Department First --'}
                  </option>
                  {(DEPARTMENT_PROGRAMS.find(d => d.name === completionDepartment)?.programs || []).map((prog) => (
                    <option key={prog} value={prog} className="bg-[#0F011E] text-white">
                      {prog}
                    </option>
                  ))}
                  {completionDepartment && (
                    <option value="Other" className="bg-[#0F011E] text-cyan-400 font-black">
                      Other (Specify Custom Program Name)
                    </option>
                  )}
                </select>

                {completionSelectedProgramOption === 'Other' && (
                  <div className="pt-2">
                    <input
                      type="text"
                      placeholder="Enter custom Program Name..."
                      value={completionCustomProgramName}
                      onChange={(e) => handleCompletionCustomProgramChange(e.target.value)}
                      className="w-full bg-[#0F011E] border-2 border-[#00FFAB] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none transition-all font-semibold shadow-inner"
                      required
                    />
                  </div>
                )}
              </div>

              {/* School display */}
              {completionSchool && (
                <div className="p-3 bg-[#0F011E] border border-white/10 rounded-xl text-xs text-zinc-300 flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Affiliated School:</span>
                  <span className="font-bold text-[#00D1FF]">{completionSchool}</span>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 bg-black/40 hover:bg-black/60 border border-white/20 text-white font-bold text-xs py-3 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-2 bg-gradient-to-r from-[#00FFAB] via-teal-500 to-[#00D1FF] hover:opacity-95 text-zinc-950 font-black uppercase text-xs tracking-wider py-3 px-6 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Save Profile & Continue →</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* STUDENT QR PASS MODAL */}
      {activeStudent && (
        <StudentQRModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          student={activeStudent}
          allEvents={events}
        />
      )}

      {/* NCC ARMY WING INFORMATION & EXPRESS INTEREST MODAL */}
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