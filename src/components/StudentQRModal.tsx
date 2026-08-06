import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Download, X, CheckCircle, ShieldCheck, User, Calendar, BookOpen, Phone, Mail, Award, Building2 } from 'lucide-react';
import { Student, Event } from '../types';

interface StudentQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  allEvents: Event[];
}

export const StudentQRModal: React.FC<StudentQRModalProps> = ({
  isOpen,
  onClose,
  student,
  allEvents,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !student) return null;

  const appBaseUrl = 'https://gcu-eol.ai.studio';
  // Scan URL that faculty can open on any browser
  const qrUrl = `${appBaseUrl}/?studentId=${encodeURIComponent(student.registerNo)}`;

  const registeredEvents = allEvents.filter(e => student.registeredEventIds.includes(e.id));

  const handleDownloadPass = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `Pass_${student.registerNo.replace(/[^a-zA-Z0-9]/g, '_')}_QR.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn font-sans overflow-y-auto">
      <div 
        ref={cardRef}
        className="bg-gradient-to-b from-[#1E0136] via-[#120024] to-[#0A0017] border-2 border-[#FF007A] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_0_50px_rgba(255,0,122,0.3)] space-y-6 relative text-white my-8"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Pass Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#FF007A]/20 to-[#00D1FF]/20 border border-[#FF007A]/40 rounded-full text-[#00D1FF] text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00D1FF]" />
            Official GCU Digital Pass
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">
            FRESHERISM '26
          </h2>
          <p className="text-xs text-purple-200 font-medium">
            Scan to verify student registration & event details
          </p>
        </div>

        {/* QR CODE CARD */}
        <div className="flex flex-col items-center justify-center p-5 bg-white rounded-3xl border-4 border-amber-400 shadow-2xl space-y-3 relative group">
          <div ref={canvasRef} className="p-2 bg-white rounded-2xl shadow-inner">
            <QRCodeCanvas
              value={qrUrl}
              size={210}
              bgColor="#FFFFFF"
              fgColor="#1A032E"
              level="H"
              marginSize={1}
            />
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-xs font-mono font-black text-purple-950 uppercase tracking-widest">
              {student.registerNo}
            </p>
            <p className="text-[10px] text-purple-700 font-bold">
              Garden City University Official QR
            </p>
          </div>
        </div>

        {/* STUDENT INFO DETAILS */}
        <div className="bg-[#0F011E]/80 border border-purple-500/30 rounded-2xl p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
            <span className="text-zinc-400 uppercase tracking-wider font-mono text-[10px]">Student Name</span>
            <span className="font-extrabold text-white text-sm flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#00D1FF]" /> {student.name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-zinc-400 uppercase tracking-wider font-mono text-[9px] block">Register No</span>
              <span className="font-mono font-bold text-cyan-300 text-xs">{student.registerNo}</span>
            </div>
            <div>
              <span className="text-zinc-400 uppercase tracking-wider font-mono text-[9px] block">Department</span>
              <span className="font-bold text-purple-200 text-xs truncate block">{student.department || 'N/A'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-zinc-400 uppercase tracking-wider font-mono text-[9px] block">School</span>
              <span className="font-bold text-purple-200 text-xs truncate block">{student.school || 'GCU'}</span>
            </div>
            <div>
              <span className="text-zinc-400 uppercase tracking-wider font-mono text-[9px] block">Program</span>
              <span className="font-bold text-amber-300 text-xs truncate block">{student.programName || 'N/A'}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-purple-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 uppercase tracking-wider font-mono text-[10px] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#FF007A]" /> Joined Events
              </span>
              <span className="px-2 py-0.5 bg-[#FF007A]/20 border border-[#FF007A]/40 text-[#FF007A] font-black font-mono rounded text-[10px]">
                {registeredEvents.length} Events
              </span>
            </div>
            {registeredEvents.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {registeredEvents.map(evt => (
                  <span key={evt.id} className="px-2 py-1 bg-purple-900/40 border border-purple-500/40 text-purple-200 text-[10px] font-bold rounded-lg truncate max-w-[180px]">
                    ✓ {evt.title}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-400 italic">No events registered yet</p>
            )}
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleDownloadPass}
            className="py-3 bg-gradient-to-r from-[#FF007A] to-pink-600 hover:opacity-90 text-white text-xs font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Save QR Code
          </button>
          <button
            onClick={onClose}
            className="py-3 bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 border border-purple-500/40 text-xs font-bold rounded-2xl transition-all text-center cursor-pointer"
          >
            Close Pass
          </button>
        </div>

      </div>
    </div>
  );
};
