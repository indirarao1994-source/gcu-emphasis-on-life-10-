import React, { useState, useEffect } from 'react';
import { Sparkles, X, ShieldCheck, Award, CheckCircle2, FileSpreadsheet, Phone, Mail, User, BookOpen, Clock, KeyRound, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { Student, extractEmailFromUser, findStudentMatch } from '../types';
import { dbSaveStudent, signInWithMicrosoftAuth } from '../firebase';

interface NccInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeStudent: Student | null;
  students: Student[];
  onUpdateStudent?: (updated: Student) => void;
}

export const NccInfoModal: React.FC<NccInfoModalProps> = ({
  isOpen,
  onClose,
  activeStudent,
  students,
  onUpdateStudent
}) => {
  if (!isOpen) return null;

  const [registerNo, setRegisterNo] = useState(activeStudent?.registerNo || '');
  const [name, setName] = useState(activeStudent?.name || '');
  const [email, setEmail] = useState(activeStudent?.email || '');
  const [mobile, setMobile] = useState(activeStudent?.mobile || '');
  const [department, setDepartment] = useState(activeStudent?.department || 'School of CS & IT');
  const [programName, setProgramName] = useState(activeStudent?.programName || 'B.Tech CSE');

  const [isSem1Confirmed, setIsSem1Confirmed] = useState(true);
  const [isNccAgreed, setIsNccAgreed] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);

  // Sync state whenever activeStudent changes
  useEffect(() => {
    if (activeStudent) {
      setRegisterNo(activeStudent.registerNo || '');
      setName(activeStudent.name || '');
      setEmail(activeStudent.email || '');
      setMobile(activeStudent.mobile || '');
      setDepartment(activeStudent.department || 'School of CS & IT');
      setProgramName(activeStudent.programName || 'B.Tech CSE');
    }
  }, [activeStudent]);

  // Check if current email is valid GCU Microsoft email
  const isGcuEmail = email ? (email.toLowerCase().endsWith('@gcu.edu.in') || email.toLowerCase().endsWith('@student.gcu.edu.in')) : false;

  // Check if current active student is already registered for NCC
  const isAlreadyRegistered = activeStudent?.isNccInterested === true;

  // Microsoft Authentication Handler inside Modal
  const handleMicrosoftSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setMsLoading(true);

    try {
      const user = await signInWithMicrosoftAuth();
      const cleanEmail = extractEmailFromUser(user);
      if (cleanEmail) {
        if (!cleanEmail.endsWith('@gcu.edu.in') && !cleanEmail.endsWith('@student.gcu.edu.in')) {
          setErrorMsg('❌ Access Denied: Official GCU student Microsoft account (@student.gcu.edu.in or @gcu.edu.in) is compulsory for NCC Army Wing enrollment.');
          setMsLoading(false);
          return;
        }

        const prefix = cleanEmail.split('@')[0];
        let match = findStudentMatch(students, { uid: user?.uid, email: cleanEmail, registerNo: prefix });
        if (!match) {
          match = {
            uid: user?.uid || '',
            registerNo: /^\d+$/.test(prefix) ? prefix : 'GCU-' + prefix.toUpperCase(),
            name: user?.displayName || prefix.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            email: cleanEmail,
            mobile: user?.phoneNumber || '',
            school: 'Garden City University',
            department: 'School of CS & IT',
            programName: 'Degree Program',
            registeredEventIds: [],
            isExternal: false,
            authProvider: 'microsoft',
            isEmailVerified: true,
            isProfileComplete: false,
            sem1Declared: true,
            isNccInterested: false
          };
        }

        // Fill form fields
        setEmail(match.email);
        setName(match.name);
        setRegisterNo(match.registerNo);
        setMobile(match.mobile);
        setDepartment(match.department || 'School of CS & IT');
        setProgramName(match.programName || 'Degree Program');

        await dbSaveStudent(match);
        if (onUpdateStudent) {
          onUpdateStudent(match);
        }

        setSuccessMsg(`✅ Successfully authenticated via Microsoft 365 as ${match.email}!`);
      }
    } catch (err: any) {
      console.error('Microsoft authentication error:', err);
      setErrorMsg(err.message || 'Microsoft 365 Sign-In failed. Please try again.');
    } finally {
      setMsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();

    // MANDATORY MICROSOFT / OFFICIAL GCU EMAIL DOMAIN CHECK
    if (!cleanEmail || (!cleanEmail.endsWith('@gcu.edu.in') && !cleanEmail.endsWith('@student.gcu.edu.in'))) {
      setErrorMsg('❌ Compulsory Microsoft Sign-In required: You must use your official GCU student email (@student.gcu.edu.in or @gcu.edu.in). Click the "Sign in with Microsoft 365" button below to authenticate.');
      return;
    }

    if (!registerNo.trim() || !name.trim() || !mobile.trim()) {
      setErrorMsg('Please complete all required fields: Register Number, Full Name, Email Address, and Mobile Number.');
      return;
    }

    if (!isSem1Confirmed) {
      setErrorMsg('You must confirm that you are a Semester 1 (1st Year) student to express interest in NCC 2026.');
      return;
    }

    if (!isNccAgreed) {
      setErrorMsg('Please agree to the NCC Army Wing enrollment terms and physical training guidelines.');
      return;
    }

    setLoading(true);

    try {
      const cleanReg = registerNo.trim().toUpperCase();
      const existingStudent = students.find(s => s.registerNo.toUpperCase() === cleanReg || s.email.toLowerCase() === cleanEmail) || activeStudent;

      // UNIFIED PROFILE UPDATE: Ensure Register No, Email, Mobile, Name, Dept, Program update everywhere!
      const updatedStudent: Student = {
        ...(existingStudent || {}),
        registerNo: cleanReg,
        name: name.trim(),
        email: cleanEmail,
        mobile: mobile.trim() || existingStudent?.mobile || '',
        department: department.trim() || existingStudent?.department || 'School of CS & IT',
        programName: programName.trim() || existingStudent?.programName || 'B.Tech CSE',
        school: existingStudent?.school || 'Garden City University',
        registeredEventIds: existingStudent?.registeredEventIds || [],
        sem1Declared: true,
        isNccInterested: true,
        nccRegisteredAt: existingStudent?.nccRegisteredAt || new Date().toISOString(),
        authProvider: existingStudent?.authProvider || 'microsoft'
      };

      // Save to Firestore (real-time sync across entire app)
      await dbSaveStudent(updatedStudent);

      // Trigger app-wide state update so StudentDashboard, Certificates, Roster reflect changes
      if (onUpdateStudent) {
        onUpdateStudent(updatedStudent);
      }

      setSuccessMsg(`🇮🇳 Congratulations ${updatedStudent.name}! Your expression of interest for NCC Army Wing 2026 has been saved. Profile details (Register No: ${updatedStudent.registerNo}, Mobile: ${updatedStudent.mobile}) updated across your student account.`);
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error('NCC registration error:', err);
      setErrorMsg('Failed to save NCC registration. Please check your internet connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans">
      <div className="bg-gradient-to-b from-[#0F1D1A] via-[#120521] to-[#0A0D18] border-2 border-emerald-500/60 rounded-3xl p-5 sm:p-8 max-w-3xl w-full text-white shadow-2xl relative my-auto space-y-6">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-2 transition-all cursor-pointer border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Title */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-5">
          <div className="w-16 h-20 rounded-2xl bg-black/40 border-2 border-amber-400/50 p-1 flex items-center justify-center shadow-xl shrink-0 overflow-hidden">
            <img 
              src="/ncc_logo.svg" 
              alt="National Cadet Corps Emblem" 
              className="w-full h-full object-contain drop-shadow-md"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-black uppercase text-emerald-300 tracking-widest mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              NATIONAL CADET CORPS (NCC) • ARMY WING
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white italic">
              GCU Cadet Corps Enrollment 2026
            </h2>
            <p className="text-xs text-zinc-300 font-medium mt-0.5">
              Associate NCC Officer / Coordinator: <span className="text-emerald-400 font-bold">Prof. Vishnu Pandhare</span> (<a href="mailto:vishnupandhare@gcu.edu.in" className="underline hover:text-emerald-300">vishnupandhare@gcu.edu.in</a>)
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
          
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
            <h3 className="font-black text-emerald-300 uppercase tracking-wider text-xs flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              NCC Benefits & Career Advantage
            </h3>
            <ul className="space-y-1.5 text-zinc-200 text-[11.5px] leading-relaxed">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>'B' & 'C' Certificates:</strong> Nationally recognized Ministry of Defense credentials.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Direct SSB Interviews:</strong> Exemption from written entrance exams for Armed Forces (IMA / OTA).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Preference Weightage:</strong> Priority recruitment in Police, Paramilitary, Railways & Civil Services.</span>
              </li>
            </ul>
          </div>

          <div className="bg-teal-950/40 border border-teal-500/30 rounded-2xl p-4 space-y-2.5">
            <h3 className="font-black text-teal-300 uppercase tracking-wider text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              Eligibility & Microsoft Authentication
            </h3>
            <ul className="space-y-1.5 text-zinc-200 text-[11.5px] leading-relaxed">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                <span><strong>Target Cohort:</strong> Exclusively open for 1st Semester (Fresher) students of GCU.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                <span><strong>Mandatory Microsoft Sign-In:</strong> Sign in with <strong>@student.gcu.edu.in</strong> or <strong>@gcu.edu.in</strong> is compulsory.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                <span><strong>Unified Profile Sync:</strong> Register No, Email, Mobile & Department sync seamlessly everywhere.</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Microsoft Sign-In Compulsory Banner */}
        {!isGcuEmail && (
          <div className="bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 border-2 border-emerald-500/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/30 rounded-xl text-emerald-300 border border-emerald-400/40">
                  <KeyRound className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-white tracking-wider">
                    COMPULSORY: Authenticate with GCU Microsoft Account
                  </h4>
                  <p className="text-[11px] text-zinc-300">
                    Sign in with your official <strong className="text-emerald-300">@student.gcu.edu.in</strong> or <strong className="text-emerald-300">@gcu.edu.in</strong> account to express interest for NCC 2026.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={msLoading}
                onClick={handleMicrosoftSignIn}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2 shrink-0 border border-white/20"
              >
                <KeyRound className="w-4 h-4 text-black" />
                <span>{msLoading ? 'Authenticating...' : 'Sign in with Microsoft 365'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Authenticated Status Banner */}
        {isGcuEmail && (
          <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-2xl p-3 px-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-zinc-200">
                Authenticated via Microsoft 365: <strong className="text-emerald-300 font-mono">{email}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleMicrosoftSignIn}
              className="text-[10px] text-emerald-400 underline hover:text-emerald-300 cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        )}

        {/* Registration Form / Status */}
        {isAlreadyRegistered ? (
          <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-2xl p-5 text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-300 font-black text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              EXPRESSION OF INTEREST ALREADY REGISTERED!
            </div>
            <p className="text-xs text-zinc-200 max-w-xl mx-auto">
              Welcome Cadet <strong className="text-white">{activeStudent?.name}</strong>! You have successfully registered your interest for the <strong>NCC Army Wing 2026</strong> using <strong className="text-emerald-300">{activeStudent?.email}</strong>. NCC Coordinator <strong>Prof. Vishnu Pandhare</strong> will publish drill schedules and call for physical verification shortly.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-lg"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>🇮🇳 Express Interest for NCC Army Wing 2026</span>
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase">Unified Student Profile</span>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium space-y-2">
                <p>{errorMsg}</p>
                {!isGcuEmail && (
                  <button
                    type="button"
                    onClick={handleMicrosoftSignIn}
                    className="px-4 py-1.5 bg-emerald-500 text-black font-bold text-[11px] rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Click here to Sign In with Microsoft 365 (@student.gcu.edu.in)</span>
                  </button>
                )}
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-medium space-y-3">
                <p>{successMsg}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Proceed to Portal
                </button>
              </div>
            )}

            {!successMsg && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1">GCU Student Email (<span className="lowercase">@student.gcu.edu.in</span>) *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. 26bcar101@student.gcu.edu.in"
                      className={`w-full bg-[#0F011E] border rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 outline-none ${
                        isGcuEmail ? 'border-emerald-500/50' : 'border-amber-500/50'
                      }`}
                      required
                    />
                    {!isGcuEmail && (
                      <span className="text-[10px] text-amber-400 font-semibold block mt-0.5">
                        * Must end in @student.gcu.edu.in or @gcu.edu.in
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1">Register No / Student ID *</label>
                    <input
                      type="text"
                      value={registerNo}
                      onChange={e => setRegisterNo(e.target.value)}
                      placeholder="e.g. 26BCAR101"
                      className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white font-mono uppercase font-bold focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1">Mobile / WhatsApp Number *</label>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={e => setMobile(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1">Department / School</label>
                    <input
                      type="text"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      placeholder="e.g. School of CS & IT"
                      className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1">Program / Degree Course</label>
                    <input
                      type="text"
                      value={programName}
                      onChange={e => setProgramName(e.target.value)}
                      placeholder="e.g. B.Tech CSE / BBA"
                      className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {/* Self Declarations */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="flex items-start gap-2.5 cursor-pointer bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/20">
                    <input
                      type="checkbox"
                      checked={isSem1Confirmed}
                      onChange={e => setIsSem1Confirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 text-emerald-500 focus:ring-emerald-400 mt-0.5"
                    />
                    <span className="text-[11px] text-zinc-200 leading-snug">
                      <strong>Sem 1 Self-Declaration:</strong> I hereby declare that I am currently a <strong>Semester 1 (1st Year / Fresher)</strong> student at Garden City University for 2026.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer bg-teal-950/30 p-2.5 rounded-xl border border-teal-500/20">
                    <input
                      type="checkbox"
                      checked={isNccAgreed}
                      onChange={e => setIsNccAgreed(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 text-teal-500 focus:ring-teal-400 mt-0.5"
                    />
                    <span className="text-[11px] text-zinc-200 leading-snug">
                      I agree to undergo NCC parade physical selection and adhere to the discipline guidelines set by <strong>Prof. Vishnu Pandhare (NCC Coordinator)</strong>.
                    </span>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/20"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{loading ? 'Saving Registration & Profile...' : 'CONFIRM & REGISTER INTEREST FOR NCC 2026'}</span>
                  </button>
                </div>
              </>
            )}
          </form>
        )}

      </div>
    </div>
  );
};
