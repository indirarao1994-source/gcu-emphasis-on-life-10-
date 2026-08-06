import React, { useState, useMemo } from 'react';
import { Trophy, Medal, Award, Search, Sparkles, TrendingUp, UserCheck } from 'lucide-react';
import { Student, Score, Event } from '../types';

interface LeaderboardProps {
  students: Student[];
  scores: Score[];
  events: Event[];
  hideNumericMarks?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  registerNo: string;
  name: string;
  programName: string;
  eventsParticipated: number;
  totalScore: number;
  isExternal?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ students, scores, events, hideNumericMarks = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'internal' | 'external'>('all');

  // Compute Leaderboard ranking using ONLY published events
  const leaderboardData = useMemo(() => {
    const publishedEventIds = new Set(
      events.filter(e => e.resultsPublished).map(e => e.id)
    );

    const studentStatsMap = new Map<string, {
      studentId: string;
      registerNo: string;
      name: string;
      programName: string;
      eventsParticipatedSet: Set<string>;
      totalScore: number;
      isExternal: boolean;
    }>();

    // Process every student who registered for at least 1 event
    students.forEach(s => {
      const regUpper = (s.registerNo || s.email || s.uid || '').trim().toUpperCase();
      if (!regUpper) return;

      if (s.registeredEventIds && s.registeredEventIds.length > 0) {
        let totalStudentPoints = 0;
        let publishedEventsCount = 0;

        s.registeredEventIds.forEach(eid => {
          const isPublished = publishedEventIds.has(eid);
          if (isPublished) {
            publishedEventsCount++;
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
                totalStudentPoints += (typeof scoreRecord.totalScore === 'number' && scoreRecord.totalScore > 0 ? scoreRecord.totalScore : (regPts + partPts + evScore));
              } else {
                totalStudentPoints += 0;
              }
            } else {
              totalStudentPoints += 0;
            }
          } else {
            totalStudentPoints += 5;
          }
        });

        studentStatsMap.set(regUpper, {
          studentId: s.id,
          registerNo: s.registerNo || regUpper,
          name: s.name,
          programName: s.programName || s.department || s.school || 'General',
          eventsParticipatedSet: new Set<string>(s.registeredEventIds),
          totalScore: totalStudentPoints,
          isExternal: !!s.isExternal,
        });
      }
    });

    // Convert map to array and sort
    const entries: LeaderboardEntry[] = Array.from(studentStatsMap.values()).map(entry => ({
      rank: 0,
      studentId: entry.studentId,
      registerNo: entry.registerNo,
      name: entry.name,
      programName: entry.programName,
      eventsParticipated: entry.eventsParticipatedSet.size,
      totalScore: entry.totalScore,
      isExternal: entry.isExternal,
    }));

    // Sort descending by totalScore, tie-breaker by eventsParticipated descending, then name
    entries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      if (b.eventsParticipated !== a.eventsParticipated) {
        return b.eventsParticipated - a.eventsParticipated;
      }
      return a.name.localeCompare(b.name);
    });

    // Assign rank
    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    return entries;
  }, [students, scores, events]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return leaderboardData.filter(entry => {
      const matchesSearch = 
        entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.registerNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.programName.toLowerCase().includes(searchTerm.toLowerCase());

      if (filterType === 'internal') return matchesSearch && !entry.isExternal;
      if (filterType === 'external') return matchesSearch && entry.isExternal;
      return matchesSearch;
    });
  }, [leaderboardData, searchTerm, filterType]);

  const topThree = leaderboardData.slice(0, 3);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 my-10 px-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1A032E] via-[#2A0845] to-[#1A032E] border-2 border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center space-y-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-widest">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>OFFICIAL FESTIVAL LEADERBOARD</span>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white italic tracking-tight uppercase font-serif">
          STUDENT OVERALL RANKINGS
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl mx-auto">
          Cumulative performance leaderboard automatically aggregated across all festival events, registrations, attendance, and evaluation scores.
        </p>

        {/* Top 3 Podium Cards */}
        {topThree.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 max-w-4xl mx-auto">
            {/* Rank 2 - Silver */}
            {topThree[1] && (
              <div className="order-2 sm:order-1 bg-black/40 border border-zinc-400/40 rounded-2xl p-5 text-center flex flex-col items-center justify-between space-y-3 relative group hover:border-zinc-300 transition-all">
                <div className="w-12 h-12 rounded-full bg-zinc-300/20 border-2 border-zinc-300 flex items-center justify-center text-zinc-200 font-black text-xl shadow-lg">
                  🥈
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">RANK #2</span>
                  <h4 className="text-base font-black text-white truncate max-w-[180px]">{topThree[1].name}</h4>
                  <p className="text-[11px] font-mono text-zinc-400">{topThree[1].registerNo}</p>
                  <p className="text-[10px] text-zinc-300 truncate max-w-[180px]">{topThree[1].programName}</p>
                </div>
                <div className="bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-700 w-full">
                  <span className="text-xs text-zinc-400 font-semibold">Score: </span>
                  <span className="text-sm font-black text-zinc-200">{topThree[1].totalScore} pts</span>
                </div>
              </div>
            )}

            {/* Rank 1 - Gold */}
            {topThree[0] && (
              <div className="order-1 sm:order-2 bg-gradient-to-b from-amber-500/20 to-black/60 border-2 border-amber-400 rounded-2xl p-6 text-center flex flex-col items-center justify-between space-y-3 relative shadow-2xl scale-105 z-10">
                <div className="absolute -top-3 bg-amber-500 text-black font-black text-[10px] uppercase px-3 py-0.5 rounded-full tracking-wider shadow-md">
                  TOP PERFORMER
                </div>
                <div className="w-14 h-14 rounded-full bg-amber-400/30 border-2 border-amber-300 flex items-center justify-center text-amber-300 font-black text-2xl shadow-xl">
                  🥇
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest block">RANK #1 CHAMPION</span>
                  <h4 className="text-lg font-black text-amber-200 truncate max-w-[200px]">{topThree[0].name}</h4>
                  <p className="text-xs font-mono text-amber-300/80">{topThree[0].registerNo}</p>
                  <p className="text-[11px] text-zinc-300 truncate max-w-[200px]">{topThree[0].programName}</p>
                </div>
                <div className="bg-amber-500/30 px-4 py-2 rounded-xl border border-amber-400/50 w-full">
                  <span className="text-xs text-amber-200 font-semibold">Total Score: </span>
                  <span className="text-base font-black text-amber-300">{topThree[0].totalScore} pts</span>
                </div>
              </div>
            )}

            {/* Rank 3 - Bronze */}
            {topThree[2] && (
              <div className="order-3 bg-black/40 border border-amber-700/40 rounded-2xl p-5 text-center flex flex-col items-center justify-between space-y-3 relative group hover:border-amber-600 transition-all">
                <div className="w-12 h-12 rounded-full bg-amber-700/20 border-2 border-amber-600 flex items-center justify-center text-amber-500 font-black text-xl shadow-lg">
                  🥉
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block">RANK #3</span>
                  <h4 className="text-base font-black text-white truncate max-w-[180px]">{topThree[2].name}</h4>
                  <p className="text-[11px] font-mono text-zinc-400">{topThree[2].registerNo}</p>
                  <p className="text-[10px] text-zinc-300 truncate max-w-[180px]">{topThree[2].programName}</p>
                </div>
                <div className="bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-700 w-full">
                  <span className="text-xs text-zinc-400 font-semibold">Score: </span>
                  <span className="text-sm font-black text-amber-400">{topThree[2].totalScore} pts</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search & Filter Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#130224] border border-white/10 rounded-2xl p-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student, reg no, or program..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/50 border border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
          <span className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider hidden sm:inline">
            Category:
          </span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-black/40 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            All Students ({leaderboardData.length})
          </button>
          <button
            onClick={() => setFilterType('internal')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              filterType === 'internal'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-black/40 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            Internal
          </button>
          <button
            onClick={() => setFilterType('external')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              filterType === 'external'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-black/40 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            External
          </button>
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="bg-[#130224] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-black uppercase text-amber-400 tracking-wider">
                <th className="py-3 px-4 text-center w-16">Rank</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Register No.</th>
                <th className="py-3 px-4">Program Name</th>
                <th className="py-3 px-4 text-center">No. of Events Participated</th>
                <th className="py-3 px-4 text-right">{hideNumericMarks ? 'Rank Status' : 'Total Score'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-zinc-200">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400 italic">
                    No leaderboard scores found matching your search.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((row) => {
                  const isTopOne = row.rank === 1;
                  const isTopTwo = row.rank === 2;
                  const isTopThree = row.rank === 3;

                  return (
                    <tr 
                      key={row.studentId + '_' + row.registerNo}
                      className={`hover:bg-white/5 transition-colors ${
                        isTopOne ? 'bg-amber-500/10 font-bold' : isTopTwo ? 'bg-zinc-400/5' : isTopThree ? 'bg-amber-700/5' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center font-black">
                        {isTopOne && <span className="inline-block px-2 py-1 rounded-full bg-amber-400 text-black text-xs">🥇 #1</span>}
                        {isTopTwo && <span className="inline-block px-2 py-1 rounded-full bg-zinc-300 text-black text-xs">🥈 #2</span>}
                        {isTopThree && <span className="inline-block px-2 py-1 rounded-full bg-amber-700 text-white text-xs">🥉 #3</span>}
                        {!isTopOne && !isTopTwo && !isTopThree && (
                          <span className="text-zinc-400 font-mono font-bold">#{row.rank}</span>
                        )}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{row.name}</span>
                          {row.isExternal && (
                            <span className="text-[9px] bg-purple-500/20 border border-purple-400/40 text-purple-300 px-1.5 py-0.5 rounded uppercase font-bold">
                              External
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Register No */}
                      <td className="py-3.5 px-4 font-mono text-amber-300/90 font-semibold">
                        {row.registerNo}
                      </td>

                      {/* Program Name */}
                      <td className="py-3.5 px-4 text-zinc-300">
                        {row.programName}
                      </td>

                      {/* Events Participated */}
                      <td className="py-3.5 px-4 text-center font-semibold">
                        <span className="inline-flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 text-zinc-300">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{row.eventsParticipated} Event{row.eventsParticipated !== 1 ? 's' : ''}</span>
                        </span>
                      </td>

                      {/* Total Score or Rank Status */}
                      <td className="py-3.5 px-4 text-right font-black text-sm text-amber-400">
                        {hideNumericMarks ? (
                          <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                            Rank #{row.rank}
                          </span>
                        ) : (
                          `${row.totalScore} pts`
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
