import React from 'react';
import { Event, Student, Score } from '../types';
import { Printer, Download, X } from 'lucide-react';
import { downloadMarksExcel } from './ExcelHelper';

interface OfficialScoreSheetModalProps {
  event: Event;
  registeredStudents: Student[];
  scores: Score[];
  occasionTitle?: string;
  onClose: () => void;
}

export const OfficialScoreSheetModal: React.FC<OfficialScoreSheetModalProps> = ({
  event,
  registeredStudents,
  scores,
  occasionTitle = 'Fresherism 2K26',
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  const eventScores = scores.filter(sc => 
    sc.eventId === event.id || 
    (sc.eventTitle && event.title && sc.eventTitle.trim().toLowerCase() === event.title.trim().toLowerCase())
  );

  // If no students registered, show 15 blank rows for judge manual evaluation
  const displayRows = registeredStudents.length > 0 ? registeredStudents : Array.from({ length: 15 });

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Printable styles wrapper */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #gcu-scoring-sheet-printable, #gcu-scoring-sheet-printable * {
            visibility: visible !important;
          }
          #gcu-scoring-sheet-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 12px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white text-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-zinc-300">
        
        {/* Action Header - Web only */}
        <div className="no-print bg-zinc-900 text-white px-6 py-4 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-black tracking-tight flex items-center gap-2">
              <Printer className="w-5 h-5 text-[#00D1FF]" />
              Official GCU Event Scoring Sheet Preview
            </h2>
            <p className="text-xs text-zinc-400">
              Matches official Garden City University physical scoring sheet format. Click Print / PDF to generate printout.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-gradient-to-r from-[#00D1FF] to-blue-600 hover:opacity-90 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>

            <button
              type="button"
              onClick={() => downloadMarksExcel(event, registeredStudents, scores, occasionTitle)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>Download Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
          <div
            id="gcu-scoring-sheet-printable"
            className="bg-white p-8 border border-black shadow-lg mx-auto text-black font-sans text-xs w-full max-w-4xl"
            style={{ minHeight: '1000px' }}
          >
            {/* 1. Official Header Box */}
            <div className="border border-black mb-4">
              <div className="text-center font-bold text-sm border-b border-black py-1 uppercase tracking-wide bg-slate-50">
                GARDEN CITY UNIVERSITY
              </div>
              <div className="text-center font-bold text-xs border-b border-black py-1 bg-slate-50">
                {occasionTitle} - Scoring Sheet
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 text-xs border-b border-black">
                <div className="p-1.5 border-r border-black font-semibold">
                  <span className="font-bold">Date of Event:</span> {event.date || '__________________'}
                </div>
                <div className="p-1.5 font-semibold">
                  {/* Blank placeholder right cell */}
                </div>
              </div>

              <div className="grid grid-cols-2 text-xs border-b border-black">
                <div className="p-1.5 border-r border-black">
                  <span className="font-bold">Type of Event:</span> {event.isFlagship ? 'Flagship' : 'Generic/Flagship'}
                </div>
                <div className="p-1.5">
                  <span className="font-bold">Timing:</span> {event.timeStart && event.timeEnd ? `${event.timeStart} - ${event.timeEnd}` : '__________________'}
                </div>
              </div>

              <div className="grid grid-cols-2 text-xs">
                <div className="p-1.5 border-r border-black">
                  <span className="font-bold">Name of Event:</span> <span className="font-semibold">{event.title}</span>
                </div>
                <div className="p-1.5">
                  <span className="font-bold">Faculty Coordinator:</span> <span className="font-semibold">{event.coordinatorName || '__________________'}</span>
                </div>
              </div>
            </div>

            {/* 2. Main Scoring Table */}
            <table className="w-full border-collapse border border-black text-center text-[11px] mb-12">
              <thead>
                <tr className="bg-slate-100 border-b border-black">
                  <th className="border border-black p-2 font-bold w-10">Sl No</th>
                  <th className="border border-black p-2 font-bold w-24">Register number</th>
                  <th className="border border-black p-2 font-bold text-left">Name of the student</th>
                  <th className="border border-black p-2 font-bold w-24">Mobile Number</th>
                  <th className="border border-black p-2 font-bold w-16">Register Pts</th>
                  <th className="border border-black p-2 font-bold w-16">Participated</th>
                  <th className="border border-black p-2 font-bold w-20">Participation Pts (15)</th>
                  <th className="border border-black p-2 font-bold w-16">Criterion 01 (20)</th>
                  <th className="border border-black p-2 font-bold w-16">Criterion 02 (20)</th>
                  <th className="border border-black p-2 font-bold w-16">Criterion 03 (20)</th>
                  <th className="border border-black p-2 font-bold w-16">Criterion 04 (20)</th>
                  <th className="border border-black p-2 font-bold w-20 bg-gray-200">Total Marks</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((item, idx) => {
                  const student = item as Student | undefined;
                  const normReg = student && student.registerNo ? student.registerNo.trim().toUpperCase() : '';
                  const matchingScores = student ? scores.filter(s => 
                    s.studentRegisterNo && 
                    s.studentRegisterNo.trim().toUpperCase() === normReg &&
                    (s.eventId === event.id || (s.eventTitle && event.title && s.eventTitle.trim().toLowerCase() === event.title.trim().toLowerCase()))
                  ) : [];
                  matchingScores.sort((a, b) => {
                    const aExact = a.eventId === event.id ? 1 : 0;
                    const bExact = b.eventId === event.id ? 1 : 0;
                    if (aExact !== bExact) return bExact - aExact;
                    if (a.scoreEntered && !b.scoreEntered) return -1;
                    if (!a.scoreEntered && b.scoreEntered) return 1;
                    return 0;
                  });
                  const sc = matchingScores[0];
                  
                  const isParticipated = sc ? Boolean(sc.participated || (sc.participationPoints ?? 0) > 0 || (sc.eventScore ?? 0) > 0 || sc.scoreEntered) : false;
                  const partStatusStr = student ? (sc ? (isParticipated ? 'YES' : 'NO') : 'NO') : '';
                  const regPts = student ? 5 : '';
                  const partMarks = student ? (isParticipated ? 15 : 0) : '';

                  const c1 = (isParticipated && sc && sc.scoreEntered) ? (sc.criterion1 ?? 0) : '';
                  const c2 = (isParticipated && sc && sc.scoreEntered) ? (sc.criterion2 ?? 0) : '';
                  const c3 = (isParticipated && sc && sc.scoreEntered) ? (sc.criterion3 ?? 0) : '';
                  const c4 = (isParticipated && sc && sc.scoreEntered) ? (sc.criterion4 ?? 0) : '';

                  const total = (isParticipated && sc && sc.scoreEntered) ? (sc.totalScore ?? (5 + 15 + Number(c1) + Number(c2) + Number(c3) + Number(c4))) : (student ? (sc?.totalScore ?? 5) : '');

                  return (
                    <tr key={idx} className="border-b border-black h-8">
                      <td className="border border-black p-1">{idx + 1}</td>
                      <td className="border border-black p-1 font-mono">{student?.registerNo || ''}</td>
                      <td className="border border-black p-1 text-left font-medium">{student?.name || ''}</td>
                      <td className="border border-black p-1 font-mono">{student?.mobile || ''}</td>
                      <td className="border border-black p-1 font-bold">{regPts}</td>
                      <td className="border border-black p-1 font-bold">{partStatusStr}</td>
                      <td className="border border-black p-1">{partMarks}</td>
                      <td className="border border-black p-1">{c1}</td>
                      <td className="border border-black p-1">{c2}</td>
                      <td className="border border-black p-1">{c3}</td>
                      <td className="border border-black p-1">{c4}</td>
                      <td className="border border-black p-1 font-bold bg-gray-100">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 3. Signature Footer Block */}
            <div className="pt-8 flex items-end justify-between px-4 text-xs">
              <div className="text-center font-bold">
                <p className="mb-1 uppercase tracking-wider">EVENT JUDGE</p>
                <p className="text-[10px] text-gray-600 font-normal">(Name with Signature & Date)</p>
              </div>

              <div className="text-center font-bold">
                <p className="mb-1 uppercase tracking-wider">Faculty Coordinator</p>
                <p className="text-[10px] text-gray-600 font-normal">(Signature & Date)</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
