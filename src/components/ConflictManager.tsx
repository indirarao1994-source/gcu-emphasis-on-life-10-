/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertTriangle, XCircle, Calendar, Clock, ArrowRight } from 'lucide-react';
import { Event } from '../types';
import { formatDateDDMMYYYY } from '../dateUtils';

interface Conflict {
  event1: Event;
  event2: Event;
  date: string;
  timeRange1: string;
  timeRange2: string;
}

// Function to convert HH:MM string to minutes since midnight
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Check if two time ranges overlap on the same day
export function areEventsOverlapping(e1: Event, e2: Event): boolean {
  if (e1.date !== e2.date || e1.id === e2.id) {
    return false;
  }
  const start1 = timeToMinutes(e1.timeStart);
  const end1 = timeToMinutes(e1.timeEnd);
  const start2 = timeToMinutes(e2.timeStart);
  const end2 = timeToMinutes(e2.timeEnd);

  return Math.max(start1, start2) < Math.min(end1, end2);
}

// Find all conflicts in a set of event IDs
export function findEventConflicts(eventIds: string[], allEvents: Event[]): Conflict[] {
  const selectedEvents = allEvents.filter(e => eventIds.includes(e.id));
  const conflicts: Conflict[] = [];

  for (let i = 0; i < selectedEvents.length; i++) {
    for (let j = i + 1; j < selectedEvents.length; j++) {
      const e1 = selectedEvents[i];
      const e2 = selectedEvents[j];
      if (areEventsOverlapping(e1, e2)) {
        conflicts.push({
          event1: e1,
          event2: e2,
          date: e1.date,
          timeRange1: `${e1.timeStart} - ${e1.timeEnd}`,
          timeRange2: `${e2.timeStart} - ${e2.timeEnd}`
        });
      }
    }
  }

  return conflicts;
}

interface ConflictManagerProps {
  registeredEventIds: string[];
  allEvents: Event[];
  onUnregister: (eventId: string) => void;
}

export default function ConflictManager({
  registeredEventIds,
  allEvents,
  onUnregister
}: ConflictManagerProps) {
  const conflicts = findEventConflicts(registeredEventIds, allEvents);

  if (conflicts.length === 0) {
    return (
      <div className="bg-emerald-950/20 border-l-4 border-emerald-500 rounded-r-2xl p-5 shadow-inner backdrop-blur-md">
        <h3 className="text-emerald-400 font-display font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-1.5">
          🎉 Perfect Schedule!
        </h3>
        <p className="text-zinc-300 text-xs">
          No scheduling conflicts detected. Your registered events have perfectly non-overlapping timings!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#1A032E] border-2 border-[#FF007A] p-6 rounded-2xl shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF007A]/5 rounded-bl-full pointer-events-none" />
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[#FF007A] text-white rounded-lg animate-pulse">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-white font-display font-black text-base uppercase tracking-wider">
            Schedule Conflicts Detected ⚠️ ({conflicts.length})
          </h3>
          <p className="text-zinc-400 text-xs">
            Some of your registered events take place simultaneously. We highly recommend updating your selection.
          </p>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        {conflicts.map((conflict, idx) => (
          <div
            key={idx}
            className="bg-[#0F011E]/80 border-l-4 border-[#FF007A] border-t border-r border-b border-white/10 rounded-r-xl rounded-l-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                <Calendar className="w-3.5 h-3.5 text-[#00D1FF]" />
                <span>{formatDateDDMMYYYY(conflict.date)}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="bg-[#FF007A]/10 border border-[#FF007A]/20 px-3 py-2 rounded-lg">
                  <p className="text-white font-bold text-xs">{conflict.event1.title}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1 font-mono">
                    <Clock className="w-3 h-3 text-[#FFAC1C]" />
                    <span>{conflict.timeRange1}</span>
                  </div>
                </div>

                <div className="text-[#FF007A] font-black self-center text-xs tracking-widest font-mono italic">VS</div>

                <div className="bg-[#00D1FF]/10 border border-[#00D1FF]/20 px-3 py-2 rounded-lg">
                  <p className="text-white font-bold text-xs">{conflict.event2.title}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1 font-mono">
                    <Clock className="w-3 h-3 text-[#FFAC1C]" />
                    <span>{conflict.timeRange2}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 self-end md:self-center">
              <button
                onClick={() => onUnregister(conflict.event1.id)}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 hover:border-rose-500 text-rose-300 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer"
                title={`Drop ${conflict.event1.title}`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Drop {conflict.event1.title.split(' - ')[0]}</span>
              </button>
              <button
                onClick={() => onUnregister(conflict.event2.id)}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 hover:border-rose-500 text-rose-300 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer"
                title={`Drop ${conflict.event2.title}`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Drop {conflict.event2.title.split(' - ')[0]}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
