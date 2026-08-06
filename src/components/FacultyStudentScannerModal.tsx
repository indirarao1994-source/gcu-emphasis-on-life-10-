import React, { useState, useEffect, useRef } from 'react';
import { Search, QrCode, User, Mail, Phone, BookOpen, Calendar, ShieldCheck, CheckCircle2, X, AlertCircle, Camera, RefreshCw, Sparkles } from 'lucide-react';
import jsQR from 'jsqr';
import { Student, Event } from '../types';

interface FacultyStudentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  events: Event[];
  initialRegisterNo?: string;
}

export const FacultyStudentScannerModal: React.FC<FacultyStudentScannerModalProps> = ({
  isOpen,
  onClose,
  students,
  events,
  initialRegisterNo = ''
}) => {
  const [searchQuery, setSearchQuery] = useState(initialRegisterNo);
  const [scannedStudent, setScannedStudent] = useState<Student | null>(() => {
    if (initialRegisterNo) {
      return students.find(s => (s.registerNo || '').toLowerCase() === initialRegisterNo.toLowerCase() || (s.email || '').toLowerCase() === initialRegisterNo.toLowerCase()) || null;
    }
    return null;
  });

  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string>('');
  const [scanMessage, setScanMessage] = useState<string>('Align Student QR ID Code inside scanner box');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Helper function to process scanned query string
  const processQuery = (rawQuery: string) => {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return;

    let cleanQuery = query;
    if (query.includes('studentid=')) {
      const match = query.match(/studentid=([^&]+)/i);
      if (match && match[1]) {
        cleanQuery = decodeURIComponent(match[1]).toLowerCase();
      }
    }

    const match = students.find(
      s => (s.registerNo || '').toLowerCase() === cleanQuery ||
           (s.email || '').toLowerCase() === cleanQuery ||
           (s.name || '').toLowerCase().includes(cleanQuery)
    );

    if (match) {
      setScannedStudent(match);
      setSearchQuery(match.registerNo);
      setScanMessage(`✅ Successfully Verified: ${match.name} (${match.registerNo})`);
    } else {
      setSearchQuery(rawQuery);
      setScanMessage(`⚠️ Scanned Code "${rawQuery}" not matched to registered student`);
    }
  };

  // Start / Stop Camera Video Feed & jsQR Scanning
  useEffect(() => {
    if (!isOpen || !isCameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
      return;
    }

    let isSubscribed = true;
    setCameraError('');

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
        });

        if (!isSubscribed) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }

        const scanFrame = () => {
          if (!isSubscribed || !videoRef.current || !canvasRef.current) return;

          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code && code.data) {
              processQuery(code.data);
            }
          }

          animFrameId.current = requestAnimationFrame(scanFrame);
        };

        animFrameId.current = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        console.error('Camera access error:', err);
        if (isSubscribed) {
          setCameraError(
            err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
              ? 'Camera permission denied. Please allow camera access in browser settings.'
              : 'Could not activate camera scanner on this device. Please use manual code search below.'
          );
        }
      }
    }

    startCamera();

    return () => {
      isSubscribed = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [isOpen, isCameraActive, students]);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    processQuery(searchQuery);
  };

  const registeredEvents = scannedStudent
    ? events.filter(e => scannedStudent.registeredEventIds.includes(e.id))
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn font-sans overflow-y-auto">
      <div className="bg-[#1A032E] border-2 border-[#00D1FF] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-[0_0_50px_rgba(0,209,255,0.3)] space-y-6 relative text-white my-8">
        
        {/* Close button */}
        <button
          onClick={() => {
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
            }
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex p-3 bg-gradient-to-br from-[#00D1FF]/30 to-purple-600/30 border border-[#00D1FF]/40 rounded-2xl text-[#00D1FF] shadow-lg mb-1">
            <QrCode className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-white uppercase italic">
            Faculty Student QR Scanner
          </h2>
          <p className="text-xs text-purple-200">
            Hold Student QR ID card in camera view or enter Register No
          </p>
        </div>

        {/* LIVE CAMERA SCANNER VIEW */}
        <div className="bg-[#0F011E] border-2 border-cyan-500/40 rounded-2xl overflow-hidden relative shadow-2xl">
          <canvas ref={canvasRef} className="hidden" />

          {isCameraActive && !cameraError ? (
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />

              {/* Scanning Target Overlay */}
              <div className="absolute inset-0 border-2 border-dashed border-[#00D1FF]/60 m-6 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#FF007A] to-transparent animate-pulse shadow-[0_0_15px_#FF007A]" />
              </div>

              {/* Status Badge */}
              <div className="absolute bottom-2 inset-x-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/40 text-[11px] text-cyan-200 font-mono text-center flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                <span className="truncate">{scanMessage}</span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center space-y-3 bg-[#0F011E]/80">
              {cameraError ? (
                <div className="space-y-2 text-rose-300">
                  <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                  <p className="text-xs font-bold">{cameraError}</p>
                </div>
              ) : (
                <div className="space-y-2 text-purple-300">
                  <Camera className="w-8 h-8 text-cyan-400 mx-auto opacity-70" />
                  <p className="text-xs font-bold">Camera feed is currently paused.</p>
                </div>
              )}
            </div>
          )}

          {/* Camera Controls Bar */}
          <div className="p-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setIsCameraActive(!isCameraActive)}
              className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-[11px]"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isCameraActive ? 'Pause Camera' : 'Turn On Camera'}</span>
            </button>

            {isCameraActive && (
              <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Feed
              </span>
            )}
          </div>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
            <input
              type="text"
              placeholder="Enter Register No (e.g. 26BECS123) or Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#0F011E] border-2 border-cyan-500/50 rounded-2xl text-white placeholder:text-purple-300 text-sm font-mono focus:border-[#00D1FF] focus:outline-none transition-all shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-[#00D1FF] via-cyan-500 to-blue-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify & Fetch Student Details</span>
          </button>
        </form>

        {/* SEARCH RESULTS / STUDENT CARD */}
        {scannedStudent ? (
          <div className="bg-gradient-to-br from-[#120024] to-[#0A0017] border-2 border-emerald-500/60 rounded-3xl p-5 space-y-4 shadow-xl relative overflow-hidden">
            {/* Verified Badge */}
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-black text-emerald-300 uppercase tracking-widest">
                  Verified Student Record
                </span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold rounded-lg">
                GCU '26 CONFIRMED
              </span>
            </div>

            {/* Student Header */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF007A] to-[#00D1FF] flex items-center justify-center font-black text-white text-xl shadow-lg shrink-0">
                {scannedStudent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-black text-white italic leading-tight">
                  {scannedStudent.name}
                </h3>
                <p className="text-xs font-mono font-bold text-cyan-300">
                  {scannedStudent.registerNo}
                </p>
                <p className="text-xs text-purple-200">
                  {scannedStudent.department} • {scannedStudent.school || 'Garden City University'}
                </p>
              </div>
            </div>

            {/* Contact & Program Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2.5 bg-[#0F011E] rounded-xl border border-purple-500/20 space-y-0.5">
                <span className="text-zinc-400 text-[9px] uppercase tracking-wider font-mono block">Mobile Number</span>
                <span className="font-mono font-bold text-white flex items-center gap-1">
                  <Phone className="w-3 h-3 text-cyan-400" /> {scannedStudent.mobile || 'N/A'}
                </span>
              </div>
              <div className="p-2.5 bg-[#0F011E] rounded-xl border border-purple-500/20 space-y-0.5">
                <span className="text-zinc-400 text-[9px] uppercase tracking-wider font-mono block">Email ID</span>
                <span className="font-mono font-bold text-white truncate flex items-center gap-1">
                  <Mail className="w-3 h-3 text-pink-400" /> {scannedStudent.email}
                </span>
              </div>
            </div>

            {/* Program Name */}
            <div className="p-2.5 bg-[#0F011E] rounded-xl border border-purple-500/20 space-y-0.5 text-xs">
              <span className="text-zinc-400 text-[9px] uppercase tracking-wider font-mono block">Enrolled Program</span>
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" /> {scannedStudent.programName || 'N/A'}
              </span>
            </div>

            {/* Registered Events */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#FF007A]" /> Registered Events
                </span>
                <span className="px-2 py-0.5 bg-[#FF007A]/20 border border-[#FF007A]/40 text-[#FF007A] font-black font-mono rounded text-[10px]">
                  {registeredEvents.length} Events Joined
                </span>
              </div>

              {registeredEvents.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {registeredEvents.map((evt) => (
                    <div key={evt.id} className="p-2.5 bg-[#0F011E] rounded-xl border border-purple-500/30 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-extrabold text-white">{evt.title}</p>
                        <p className="text-[10px] text-purple-300 font-mono">
                          {evt.category} • {evt.venue}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-extrabold rounded-md">
                        Registered ✓
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic bg-[#0F011E] p-3 rounded-xl border border-purple-500/20">
                  This student has not registered for any events yet.
                </p>
              )}
            </div>

          </div>
        ) : searchQuery ? (
          <div className="p-6 bg-rose-950/40 border-2 border-rose-500/50 rounded-2xl text-center space-y-2 text-rose-200">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm font-bold">No student found matching "{searchQuery}"</p>
            <p className="text-xs text-rose-300/80">Please check the Register Number or Email ID and try again.</p>
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-purple-500/30 rounded-3xl text-center space-y-1.5 text-purple-300">
            <User className="w-8 h-8 text-cyan-400 mx-auto opacity-70" />
            <p className="text-xs font-bold">Point camera at Student QR Code or enter Register No</p>
            <p className="text-[11px] text-purple-400">Scanning auto-detects and displays full student credentials</p>
          </div>
        )}

      </div>
    </div>
  );
};

