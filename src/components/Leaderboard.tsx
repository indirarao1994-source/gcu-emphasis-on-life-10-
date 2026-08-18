import React, { useState, useMemo } from 'react';
import { Trophy, Medal, Award, Search, Sparkles, TrendingUp, UserCheck } from 'lucide-react';
import { Student, Score, Event } from '../types';
import { computeUnifiedLeaderboard, UnifiedLeaderboardEntry } from '../utils/LeaderboardUtils';

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
  usnNo?: string;
  name: string;
  programName: string;
  eventsParticipated: number;
  totalScore: number;
  isExternal?: boolean;
}

// Ensure LeaderboardEntry is compatible with UnifiedLeaderboardEntry
type CompatibleLeaderboardEntry = UnifiedLeaderboardEntry;


export const Leaderboard: React.FC<LeaderboardProps> = ({ students, scores, events, hideNumericMarks = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'internal' | 'external'>('all');

  // Compute Leaderboard ranking using ONLY published events & score sheets uploaded by faculty
  // Merges duplicate student registrations across different temporary register nos into single USN NO if available
  const leaderboardData = useMemo(() => {
    const unifiedEntries = computeUnifiedLeaderboard(students, scores, events);
    // Map UnifiedLeaderboardEntry to the structure expected by the rest of Leaderboard component
    return unifiedEntries.map(entry => ({
      ...entry,
      eventsParticipated: entry.eventsParticipatedCount
    }));
  }, [students, scores, events]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return leaderboardData.filter(entry => {
      const matchesSearch = 
        entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.registerNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.usnNo && entry.usnNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
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


      </div>

      {/* Offline Banner */}
      <div className="mt-8 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/20 rounded-2xl p-6 sm:p-10 flex flex-col items-center justify-center gap-6 text-center backdrop-blur-sm shadow-2xl">
        <div className="p-4 bg-amber-500/20 rounded-full shrink-0">
          <Award className="w-12 h-12 text-amber-400 animate-pulse" />
        </div>
        <div className="space-y-3">
          <p className="text-lg sm:text-xl font-bold text-amber-300 leading-relaxed max-w-xl mx-auto">
            The leaderboard is temporarily offline while the organizing committee verifies and updates final official scores. Please check back later.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
