import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Zap, Flag, Calendar, MapPin, CheckCircle2, X, Lock, ArrowRight, Activity, Flame, ShieldAlert } from 'lucide-react';
import { Student, Event } from '../types';

interface FreshathonPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeStudent: Student | null;
  isLandingPage: boolean;
  events: Event[];
  onRegisterForEvent: (eventId: string, tShirtSize?: string) => void;
  onUpdateStudentProfile?: (student: Student) => void;
  onRequireSignIn: (eventId?: string) => void;
}

export const FreshathonPromoModal: React.FC<FreshathonPromoModalProps> = ({
  isOpen,
  onClose,
  activeStudent,
  isLandingPage,
  events,
  onRegisterForEvent,
  onUpdateStudentProfile,
  onRequireSignIn
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showLoginNotice, setShowLoginNotice] = useState(false);

  // T-Shirt Size State (S, M, L, XL, XXL, XXXL)
  const [selectedTShirtSize, setSelectedTShirtSize] = useState<string>(
    activeStudent?.tShirtSize || 'M'
  );
  const [isEditingTShirt, setIsEditingTShirt] = useState(false);
  const [tShirtSuccessMsg, setTShirtSuccessMsg] = useState('');

  useEffect(() => {
    if (activeStudent?.tShirtSize) {
      setSelectedTShirtSize(activeStudent.tShirtSize);
    }
  }, [activeStudent]);

  // Find Freshathon event or fallback
  const freshathonEvent = events.find(e => 
    e.id === 'evt-freshathon-sprint' || 
    (e.title && e.title.toLowerCase().includes('freshathon'))
  ) || {
    id: 'evt-freshathon-sprint',
    title: 'Freshathon - Sprinting Towards Glory',
    date: '2026-08-15',
    timeStart: '06:30',
    venue: 'GCU Main Track & Sports Complex Ground'
  };

  const isAlreadyRegistered = activeStudent && activeStudent.registeredEventIds?.includes(freshathonEvent.id);

  // 3D Parallax tilt effect handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  const handleActionClick = () => {
    setShowLoginNotice(false);

    // If not logged in as student -> MUST sign in first
    if (!activeStudent) {
      setShowLoginNotice(true);
      setTimeout(() => {
        onClose();
        onRequireSignIn(freshathonEvent.id);
      }, 1800);
      return;
    }

    // Logged in as student
    if (isAlreadyRegistered) {
      setRegistrationSuccess(true);
      return;
    }

    // Register student for Freshathon with T-Shirt size
    onRegisterForEvent(freshathonEvent.id, selectedTShirtSize);
    setRegistrationSuccess(true);
  };

  const handleSaveUpdatedTShirt = () => {
    if (!activeStudent) return;
    const updatedStudent: Student = {
      ...activeStudent,
      tShirtSize: selectedTShirtSize
    };
    if (onUpdateStudentProfile) {
      onUpdateStudentProfile(updatedStudent);
    }
    setIsEditingTShirt(false);
    setTShirtSuccessMsg(`✅ Updated T-Shirt Size to ${selectedTShirtSize}!`);
    setTimeout(() => setTShirtSuccessMsg(''), 4000);
  };

  if (!isOpen) return null;

  // Calculate 3D tilt transformation
  const tiltX = -mousePos.y * 20;
  const tiltY = mousePos.x * 20;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* 3D Container with Perspective */}
      <div 
        className="relative w-full max-w-lg transition-transform duration-200 ease-out perspective-1000"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ perspective: '1200px' }}
      >
        {/* Glowing 3D Card with controlled max-height and scrolling */}
        <div 
          className="relative max-h-[85vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-[#1E0438] via-[#120224] to-[#0A0014] border-2 border-amber-400/80 shadow-[0_0_50px_rgba(245,158,11,0.35)] p-5 sm:p-7 text-white transition-all duration-300"
          style={{
            transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(20px)`,
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Animated Background Glow & Sparkles */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Sticky Close Button (Always visible at top-right) */}
          <div className="sticky top-0 z-50 flex justify-end -mt-1 -mr-1 mb-2 pointer-events-auto">
            <button 
              onClick={onClose}
              className="p-2 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white font-bold transition-all cursor-pointer shadow-lg border border-white/40 flex items-center justify-center gap-1 text-xs"
              title="Close Modal"
            >
              <X className="w-4 h-4" />
              <span className="text-[10px] uppercase font-black pr-1">Close</span>
            </button>
          </div>

          {/* Top Blinking Badge */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-black font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-orange-500/40 animate-bounce">
              <Flame className="w-4 h-4 text-black animate-spin" style={{ animationDuration: '3s' }} />
              <span className="font-black text-[11px] sm:text-xs">
                🚨 GRAND FINALE ALERT • 100 POINTS GUARANTEED 🚨
              </span>
            </div>
          </div>

          {/* 3D Trophy / 100 PTS Hero Icon Section */}
          <div className="relative flex flex-col items-center justify-center my-2 text-center" style={{ transform: 'translateZ(40px)' }}>
            <div className="relative group">
              {/* Pulsing Ring */}
              <div className="absolute -inset-3 bg-gradient-to-r from-amber-400 via-emerald-400 to-orange-500 rounded-full blur-md opacity-80 animate-pulse" />
              
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-2xl flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-[#1A032E] flex flex-col items-center justify-center border-2 border-amber-300">
                  <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400 animate-pulse" />
                  <span className="text-[10px] font-black text-amber-300 tracking-tighter uppercase -mt-1">
                    100 PTS
                  </span>
                </div>
              </div>

              {/* Tricolor Independence Day Ribbon Accent */}
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-orange-500 via-white to-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full border border-black shadow-md flex items-center gap-1">
                <Flag className="w-3 h-3 text-orange-600 fill-orange-600" />
                <span>AUG 15</span>
              </div>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-400 mt-4 text-center uppercase italic">
              Freshathon
            </h2>
            <p className="text-sm sm:text-base font-bold text-amber-200/90 tracking-wide mt-0.5 uppercase">
              Sprinting Towards Glory
            </p>
            <p className="text-xs text-zinc-300 max-w-sm mt-2 leading-relaxed">
              Grand Finale Independence Day Mini-Marathon! Run for pride, health & glory. Every participant earns <strong className="text-amber-300 font-extrabold underline decoration-amber-400">100 Points</strong> for GCU Leaderboard!
            </p>
          </div>

          {/* Event Quick Details Card */}
          <div className="my-4 p-3.5 rounded-2xl bg-white/5 border border-amber-400/30 backdrop-blur-md space-y-2 text-xs" style={{ transform: 'translateZ(30px)' }}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Date
              </span>
              <span className="font-bold text-amber-300">August 15, 2026 (Independence Day)</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Venue & Time
              </span>
              <span className="font-bold text-white">06:30 AM • GCU Students Knowledge Park (Hoskote)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <Zap className="w-3.5 h-3.5 text-amber-400 animate-bounce" /> Point Reward
              </span>
              <span className="font-extrabold text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/40">
                +100 POINTS
              </span>
            </div>
          </div>

          {/* T-SHIRT SIZE SELECTION & EDITING SECTION */}
          <div className="my-4 p-4 rounded-2xl bg-[#0F011E] border-2 border-amber-400/60 shadow-xl space-y-2 text-left" style={{ transform: 'translateZ(35px)' }}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                <span>👕 Official Marathon T-Shirt Size</span>
              </label>
              {isAlreadyRegistered && !isEditingTShirt && (
                <button
                  type="button"
                  onClick={() => setIsEditingTShirt(true)}
                  className="px-2.5 py-1 bg-amber-400/20 hover:bg-amber-400/40 border border-amber-400 text-amber-300 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer"
                >
                  Edit Size
                </button>
              )}
            </div>

            {(!isAlreadyRegistered || isEditingTShirt) ? (
              <div className="space-y-2">
                <select
                  value={selectedTShirtSize}
                  onChange={(e) => setSelectedTShirtSize(e.target.value)}
                  className="w-full bg-[#1A032E] border-2 border-amber-400/60 text-white rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value="S">Small (S)</option>
                  <option value="M">Medium (M)</option>
                  <option value="L">Large (L)</option>
                  <option value="XL">Extra Large (XL)</option>
                  <option value="XXL">Double Extra Large (XXL)</option>
                  <option value="XXXL">Triple Extra Large (XXXL)</option>
                </select>

                {isAlreadyRegistered && isEditingTShirt && (
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingTShirt(false)}
                      className="px-3 py-1 bg-zinc-800 text-zinc-300 font-bold rounded-lg text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveUpdatedTShirt}
                      className="px-4 py-1 bg-amber-400 text-black font-black uppercase rounded-lg text-xs hover:bg-amber-300 shadow-md cursor-pointer"
                    >
                      Save Size
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/10">
                <span className="text-zinc-300 font-medium text-xs">Selected Size:</span>
                <span className="px-3 py-0.5 bg-amber-400 text-black font-black rounded-lg text-xs uppercase shadow">
                  {activeStudent?.tShirtSize || selectedTShirtSize || 'M'}
                </span>
              </div>
            )}
          </div>

          {/* Feedback Notices */}
          {tShirtSuccessMsg && (
            <div className="mb-3 p-3 rounded-xl bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{tShirtSuccessMsg}</span>
            </div>
          )}

          {showLoginNotice && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 text-xs font-bold flex items-center gap-2 animate-headShake">
              <Lock className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="uppercase text-[11px] font-black text-rose-300">Sign In Required!</p>
                <p className="font-medium text-[11px] text-zinc-200">
                  You must sign in or register as a student to participate in Freshathon. Redirecting to student login...
                </p>
              </div>
            </div>
          )}

          {registrationSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/90 border-2 border-emerald-400 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="uppercase text-[11px] font-black text-emerald-300">Registration Confirmed!</p>
                <p className="font-medium text-[11px] text-zinc-200">
                  You are registered for Freshathon (T-Shirt Size: <strong>{selectedTShirtSize}</strong>)! Prepare your running shoes for Aug 15th!
                </p>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div style={{ transform: 'translateZ(50px)' }}>
            {isAlreadyRegistered ? (
              <div className="w-full py-3.5 px-4 rounded-xl bg-emerald-600/30 border-2 border-emerald-400 text-emerald-300 font-black text-xs sm:text-sm uppercase tracking-wider text-center flex items-center justify-center gap-2 shadow-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>YOU ARE REGISTERED FOR FRESHATHON (SIZE: {activeStudent?.tShirtSize || selectedTShirtSize})</span>
              </div>
            ) : (
              <button
                onClick={handleActionClick}
                disabled={showLoginNotice}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl shadow-orange-500/50 hover:shadow-orange-400/80 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer border border-amber-200"
              >
                <Sparkles className="w-5 h-5 text-slate-950 animate-spin" style={{ animationDuration: '4s' }} />
                <span>
                  {!activeStudent ? 'SIGN IN TO REGISTER FOR FRESHATHON' : '⚡ REGISTER NOW FOR FRESHATHON (100 PTS)'}
                </span>
                <ArrowRight className="w-5 h-5 text-slate-950" />
              </button>
            )}

            <p className="text-[10px] text-center text-zinc-400 mt-2 font-mono">
              {!activeStudent 
                ? '🔒 Student login required for event registration' 
                : '🏆 Instant 100 Points added to your profile'}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
