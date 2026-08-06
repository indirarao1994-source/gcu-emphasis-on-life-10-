import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, Users, Download, FileSpreadsheet, Send, Search, 
  Sparkles, CheckCircle2, Phone, Mail, GraduationCap, Bell, AlertCircle, RefreshCw
} from 'lucide-react';
import { Student, FacultyCoordinator, Notification } from '../types';
import { downloadNccStudentsExcel } from './ExcelHelper';
import { downloadNccStudentsCSV } from './CSVHelper';
import { dbSaveNotification, dbSaveStudent } from '../firebase';

interface NccCoordinatorDashboardProps {
  faculty: FacultyCoordinator;
  students: Student[];
  onAddNotification?: (notif: Notification) => void;
  onUpdateStudents?: (updatedList: Student[]) => void;
  onGoToLanding?: () => void;
}

export const NccCoordinatorDashboard: React.FC<NccCoordinatorDashboardProps> = ({
  faculty,
  students,
  onAddNotification,
  onGoToLanding
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [msgSuccess, setMsgSuccess] = useState('');
  const [msgError, setMsgError] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Filter NCC Cadets
  const nccCadets = useMemo(() => {
    return students.filter(s => s.isNccInterested === true);
  }, [students]);

  const filteredCadets = useMemo(() => {
    if (!searchTerm.trim()) return nccCadets;
    const q = searchTerm.toLowerCase();
    return nccCadets.filter(
      s => (s.name || '').toLowerCase().includes(q) ||
           (s.registerNo || '').toLowerCase().includes(q) ||
           (s.email || '').toLowerCase().includes(q) ||
           (s.department || '').toLowerCase().includes(q) ||
           (s.mobile || '').includes(q)
    );
  }, [nccCadets, searchTerm]);

  const handleSendNccBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSuccess('');
    setMsgError('');

    if (!broadcastTitle.trim() || !broadcastContent.trim()) {
      setMsgError('Please enter both broadcast title and alert message content.');
      return;
    }

    setSendingMsg(true);

    try {
      const notif: Notification = {
        id: `notif-ncc-${Date.now()}`,
        eventId: 'ncc-army-wing',
        eventTitle: '🇮🇳 NCC Army Wing 2026',
        title: broadcastTitle.trim(),
        content: broadcastContent.trim(),
        timestamp: new Date().toLocaleString(),
        senderName: `${faculty.name} (NCC Coordinator)`
      };

      await dbSaveNotification(notif);
      if (onAddNotification) {
        onAddNotification(notif);
      }

      setMsgSuccess(`✅ NCC Drill / Broadcast Alert dispatched to all ${nccCadets.length} registered NCC Cadets!`);
      setBroadcastTitle('');
      setBroadcastContent('');
      setSendingMsg(false);
    } catch (err) {
      console.error('Error broadcasting NCC alert:', err);
      setMsgError('Failed to send broadcast alert. Please try again.');
      setSendingMsg(false);
    }
  };

  const handleToggleNccStatus = async (student: Student) => {
    try {
      const updated: Student = {
        ...student,
        isNccInterested: !student.isNccInterested
      };
      await dbSaveStudent(updated);
    } catch (err) {
      console.error('Error toggling NCC status:', err);
    }
  };

  return (
    <div className="space-y-8 font-sans text-white pb-12">
      
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0F1D1A] via-[#120521] to-[#0A0D18] border-2 border-emerald-500/60 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-16 h-20 rounded-2xl bg-black/40 border-2 border-amber-400/50 p-1 flex items-center justify-center shadow-xl shrink-0 overflow-hidden">
              <img 
                src="/ncc_logo.svg" 
                alt="National Cadet Corps Emblem" 
                className="w-full h-full object-contain drop-shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs font-black uppercase text-emerald-300 tracking-widest">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                GCU NATIONAL CADET CORPS (NCC) • ARMY WING
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight italic text-white">
                NCC Cadets Management & Enrollment Portal
              </h1>
              <p className="text-xs text-zinc-300 max-w-2xl font-medium leading-relaxed">
                Welcome Coordinator <strong className="text-emerald-400">{faculty.name}</strong> ({faculty.email}). Manage interested 1st Semester cadets, download official enrollment rosters, and dispatch parade & physical fitness drill broadcasts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => downloadNccStudentsExcel(students)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-white/20"
            >
              <Download className="w-4 h-4 text-black" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <a
              href={downloadNccStudentsCSV(students)}
              download="gcu_ncc_army_wing_cadets_2026.csv"
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-white/20"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-14 rounded-xl bg-black/40 border border-emerald-500/40 p-1 flex items-center justify-center shrink-0">
              <img src="/ncc_logo.svg" alt="NCC Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Total Interested Cadets</p>
              <p className="text-2xl font-black text-white">{nccCadets.length}</p>
            </div>
          </div>

          <div className="bg-teal-950/40 border border-teal-500/30 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">Sem 1 Verified Cadets</p>
              <p className="text-2xl font-black text-white">
                {nccCadets.filter(c => c.sem1Declared).length}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">NCC Wing Status</p>
              <p className="text-sm font-black text-emerald-400 uppercase">ACTIVE ENROLLMENT</p>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Message & Drill Alert Box */}
      <div className="bg-zinc-900/80 border border-emerald-500/40 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
          <Bell className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-black text-white uppercase tracking-wider">
            Send Broadcast Alert / Parade Schedule to NCC Cadets
          </h2>
        </div>

        {msgSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-medium">
            {msgSuccess}
          </div>
        )}

        {msgError && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium">
            {msgError}
          </div>
        )}

        <form onSubmit={handleSendNccBroadcast} className="space-y-3">
          <div>
            <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1">Broadcast Title *</label>
            <input
              type="text"
              value={broadcastTitle}
              onChange={e => setBroadcastTitle(e.target.value)}
              placeholder="e.g. 🇮🇳 NCC Parade Drill Notice & Physical Test on Saturday"
              className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-emerald-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1">Alert Content / Instructions *</label>
            <textarea
              value={broadcastContent}
              onChange={e => setBroadcastContent(e.target.value)}
              placeholder="e.g. All registered NCC cadets are requested to assemble at GCU Sports Ground at 07:00 AM in physical training attire for height/weight verification and preliminary drill session."
              className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white h-20 focus:border-emerald-500 outline-none"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sendingMsg}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Send className="w-4 h-4 text-black" />
              <span>{sendingMsg ? 'Dispatching Notice...' : `Send Notice to ${nccCadets.length} Cadets`}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Student Cadets Roster */}
      <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>Registered NCC Cadets Directory ({filteredCadets.length})</span>
            </h2>
            <p className="text-xs text-zinc-400 font-medium">
              List of 1st Semester GCU students who expressed interest in NCC Army Wing.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by Name, Reg No, Dept..."
              className="w-full bg-[#0F011E] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        {filteredCadets.length === 0 ? (
          <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10 space-y-2">
            <p className="text-sm font-bold text-zinc-300">No NCC Cadets found matching your search.</p>
            <p className="text-xs text-zinc-400">Students can express interest from the Landing Page or Student Dashboard.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-zinc-400 bg-white/5">
                  <th className="p-3">#</th>
                  <th className="p-3">Register No</th>
                  <th className="p-3">Cadet Name</th>
                  <th className="p-3">Email & Mobile</th>
                  <th className="p-3">Department / Course</th>
                  <th className="p-3">Sem 1 Declared</th>
                  <th className="p-3">Express Date</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-200">
                {filteredCadets.map((c, idx) => (
                  <tr key={c.registerNo || idx} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 text-zinc-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-[#00D1FF]">{c.registerNo}</td>
                    <td className="p-3 font-bold text-white">{c.name}</td>
                    <td className="p-3 space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] text-zinc-300">
                        <Mail className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <span>{c.email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                        <Phone className="w-3 h-3 text-teal-400 flex-shrink-0" />
                        <span>{c.mobile || '-'}</span>
                      </div>
                    </td>
                    <td className="p-3 text-zinc-300 font-medium">
                      <div>{c.department}</div>
                      <div className="text-[10px] text-zinc-400">{c.programName}</div>
                    </td>
                    <td className="p-3">
                      {c.sem1Declared ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3" /> VERIFIED SEM 1
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-bold">PENDING</span>
                      )}
                    </td>
                    <td className="p-3 text-[10px] text-zinc-400 font-mono">
                      {c.nccRegisteredAt ? new Date(c.nccRegisteredAt).toLocaleDateString() : 'Registered'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleNccStatus(c)}
                        title="Remove Cadet from NCC List"
                        className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
