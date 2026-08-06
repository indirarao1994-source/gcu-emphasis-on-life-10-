import React, { useState } from 'react';
import { ShieldCheck, GraduationCap, Sparkles, CheckCircle2, Lock, LogOut } from 'lucide-react';
import { Student } from '../types';
import { dbSaveStudent } from '../firebase';

interface Sem1SelfDeclarationModalProps {
  student: Student;
  onConfirmDeclaration: (updatedStudent: Student) => void;
  onLogout: () => void;
}

export const Sem1SelfDeclarationModal: React.FC<Sem1SelfDeclarationModalProps> = ({
  student,
  onConfirmDeclaration,
  onLogout
}) => {
  const [isSem1Checked, setIsSem1Checked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleConfirm = async () => {
    if (!isSem1Checked) {
      setErrorMsg('You must check the box to declare that you are a Semester 1 (1st Year) student to access Fresherism events.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const updated: Student = {
        ...student,
        sem1Declared: true
      };

      await dbSaveStudent(updated);
      onConfirmDeclaration(updated);
    } catch (err) {
      console.error('Error saving Sem 1 declaration:', err);
      setErrorMsg('Failed to save declaration. Please try again.');
      setLoading(false);
    }
  };

  const handleConfirmSenior = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const updated: Student = {
        ...student,
        sem1Declared: false,
        isSeniorAcknowledged: true
      };

      await dbSaveStudent(updated);
      onConfirmDeclaration(updated);
    } catch (err) {
      console.error('Error saving senior status:', err);
      setErrorMsg('Failed to save selection. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-gradient-to-b from-[#18022B] via-[#0F011E] to-[#120024] border-2 border-[#FF007A] rounded-3xl p-6 sm:p-8 max-w-xl w-full text-white shadow-2xl space-y-6 relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF007A] to-[#00D1FF] flex items-center justify-center text-2xl shadow-lg border border-white/20 flex-shrink-0">
            📜
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FF007A]/20 border border-[#FF007A]/40 text-[10px] font-black uppercase text-[#FF007A] tracking-widest mb-1">
              <GraduationCap className="w-3.5 h-3.5 text-[#FF007A]" />
              STUDENT STATUS VERIFICATION
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white italic">
              Fresherism & Events Access
            </h2>
          </div>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-zinc-200">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1.5">
            <p className="text-zinc-300">
              Student ID: <strong className="text-[#00D1FF] font-mono">{student.registerNo}</strong>
            </p>
            <p className="text-zinc-300">
              Student Name: <strong className="text-white font-bold">{student.name}</strong>
            </p>
            <p className="text-zinc-300">
              Department / Course: <strong className="text-zinc-100">{student.department} ({student.programName})</strong>
            </p>
          </div>

          <p className="text-zinc-300 font-medium">
            Select your academic status below to enter the portal. All students can view live event leaderboards, scores, and event schedules!
          </p>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Declaration Options */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer bg-gradient-to-r from-[#FF007A]/10 to-transparent p-3.5 rounded-2xl border border-[#FF007A]/30 hover:border-[#FF007A] transition-all">
              <input
                type="checkbox"
                checked={isSem1Checked}
                onChange={e => setIsSem1Checked(e.target.checked)}
                className="w-5 h-5 rounded border-white/30 text-[#FF007A] focus:ring-[#FF007A] mt-0.5 cursor-pointer flex-shrink-0"
              />
              <span className="text-xs text-white leading-relaxed font-bold">
                I hereby declare that I am a <span className="text-[#00D1FF]">Semester 1 (1st Year / Fresher)</span> student at GCU for 2026. <span className="text-amber-300 font-normal">(Required to register for Fresherism '26 events)</span>
              </span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-4 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              disabled={!isSem1Checked || loading}
              onClick={handleConfirm}
              className={`w-full sm:flex-1 px-5 py-3 bg-gradient-to-r from-[#00D1FF] to-[#FF007A] hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/20 ${
                !isSem1Checked ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>{loading ? 'Confirming...' : 'I AM SEM 1 (ENTER FRESHERISM EVENTS)'}</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleConfirmSenior}
              className="w-full sm:flex-1 px-5 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 hover:text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>I AM A SENIOR (VIEW LEADERBOARDS & EVENTS)</span>
            </button>
          </div>

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
