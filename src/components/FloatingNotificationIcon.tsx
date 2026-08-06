import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, X, CheckCheck, Trash2, Sparkles, Clock, Inbox, Info, AlertCircle } from 'lucide-react';
import { Notification, Student, UserRole, FacultyCoordinator } from '../types';

interface FloatingNotificationIconProps {
  notifications: Notification[];
  activeStudent?: Student | null;
  activeFaculty?: FacultyCoordinator | null;
  activeRole?: UserRole | 'landing' | 'superadmin';
  onClearNotifications?: () => void;
  onOpenEvent?: (eventId: string) => void;
}

export const FloatingNotificationIcon: React.FC<FloatingNotificationIconProps> = ({
  notifications = [],
  activeStudent,
  activeFaculty,
  activeRole,
  onClearNotifications,
  onOpenEvent,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  // Track read notification IDs in localStorage
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gcu_read_notification_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const panelRef = useRef<HTMLDivElement>(null);

  // Sync readIds to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gcu_read_notification_ids', JSON.stringify(readIds));
    } catch (e) {}
  }, [readIds]);

  // Determine if signed in
  const isSignedIn = Boolean(
    activeStudent || 
    activeFaculty || 
    activeRole === 'student' || 
    activeRole === 'convenor' || 
    activeRole === 'coordinator'
  );

  // Filter notifications relevant to current user context
  const relevantNotifications = useMemo(() => {
    if (!notifications || notifications.length === 0) return [];

    if (activeStudent) {
      const studentReg = (activeStudent.registerNo || '').trim().toLowerCase();
      const studentEmail = (activeStudent.email || '').trim().toLowerCase();
      const studentEvents = activeStudent.registeredEventIds || [];

      return notifications.filter((n) => {
        // If explicitly targeted to a student registerNo/email
        if (n.targetRegisterNo) {
          const target = n.targetRegisterNo.trim().toLowerCase();
          return target === studentReg || target === studentEmail;
        }
        // Broadcast for specific event
        if (n.eventId) {
          return studentEvents.includes(n.eventId);
        }
        // General broadcast
        return true;
      });
    }

    return notifications;
  }, [notifications, activeStudent]);

  // Count unread
  const unreadCount = useMemo(() => {
    return relevantNotifications.filter((n) => !readIds.includes(n.id)).length;
  }, [relevantNotifications, readIds]);

  // Displayed notifications based on active tab filter ('all' or 'unread')
  const displayedNotifications = useMemo(() => {
    if (filter === 'unread') {
      return relevantNotifications.filter((n) => !readIds.includes(n.id));
    }
    return relevantNotifications;
  }, [relevantNotifications, filter, readIds]);

  // Mark single notification as read
  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!readIds.includes(id)) {
      setReadIds((prev) => [...prev, id]);
    }
  };

  // Mark all relevant notifications as read
  const handleMarkAllRead = () => {
    const allIds = relevantNotifications.map((n) => n.id);
    setReadIds((prev) => Array.from(new Set([...prev, ...allIds])));
  };

  // Clear all notifications
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all notifications?')) {
      handleMarkAllRead();
      if (onClearNotifications) {
        onClearNotifications();
      }
    }
  };

  // Close panel on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Lock background scroll on mobile when drawer is open
  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Format timestamp helper
  const formatTimestamp = (ts: string) => {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return ts;
    }
  };

  // If user is not signed in and there are no notifications, don't show floating button
  if (!isSignedIn && relevantNotifications.length === 0) {
    return null;
  }

  return (
    <>
      {/* FIXED FLOATING NOTIFICATION ICON BUTTON */}
      <div className="fixed top-4 right-4 z-[9999]">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`relative p-3 rounded-2xl shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center border-2 ${
            isOpen
              ? 'bg-[#FF007A] text-white border-white shadow-[0_0_25px_rgba(255,0,122,0.8)]'
              : unreadCount > 0
              ? 'bg-[#1A032E]/90 text-[#00D1FF] border-[#00D1FF] hover:border-[#FF007A] shadow-[0_0_20px_rgba(0,209,255,0.4)] backdrop-blur-md'
              : 'bg-[#1A032E]/80 text-zinc-300 border-white/20 hover:border-white/50 backdrop-blur-md hover:text-white'
          }`}
          aria-label="Toggle notifications panel"
          title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          <Bell className={`w-5 h-5 md:w-6 md:h-6 ${unreadCount > 0 && !isOpen ? 'animate-bounce text-[#00D1FF]' : ''}`} />

          {/* UNREAD BADGE */}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 bg-[#FF007A] text-white text-[11px] font-black rounded-full border-2 border-[#1A032E] flex items-center justify-center shadow-lg animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* NOTIFICATION SLIDE-OUT PANEL / DRAWER */}
        {isOpen && (
          <div
            ref={panelRef}
            className="absolute top-14 right-0 w-[calc(100vw-2rem)] sm:w-96 md:w-[420px] max-h-[85vh] bg-[#140224]/95 border-2 border-[#00D1FF]/60 rounded-3xl shadow-[0_10px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl flex flex-col overflow-hidden text-white z-50 animate-fadeIn"
          >
            {/* PANEL HEADER */}
            <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-purple-950/80 via-[#1A032E] to-purple-950/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#00D1FF]/20 border border-[#00D1FF]/40 text-[#00D1FF]">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black italic tracking-wide text-white uppercase">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <span className="bg-[#FF007A] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {unreadCount} New
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    Announcements & event updates
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/20 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Close panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB CONTROLS & ACTION BUTTONS */}
            <div className="px-4 py-2.5 border-b border-white/10 bg-black/40 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filter === 'all'
                      ? 'bg-[#00D1FF] text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  All ({relevantNotifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filter === 'unread'
                      ? 'bg-[#FF007A] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="p-1.5 text-xs text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-mono"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[10px]">Read all</span>
                  </button>
                )}

                {relevantNotifications.length > 0 && onClearNotifications && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="p-1.5 text-xs text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-mono"
                    title="Clear notifications"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* NOTIFICATION LIST CONTENT */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
              {displayedNotifications.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-300">
                      {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono mt-1">
                      Event updates and broadcasts will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                displayedNotifications.map((notif) => {
                  const isRead = readIds.includes(notif.id);

                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        handleMarkAsRead(notif.id);
                        if (notif.eventId && onOpenEvent) {
                          setIsOpen(false);
                          onOpenEvent(notif.eventId);
                        }
                      }}
                      className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                        isRead
                          ? 'bg-black/30 border-white/10 opacity-75 hover:opacity-100 hover:border-white/30'
                          : 'bg-gradient-to-r from-purple-950/60 to-black/60 border-[#00D1FF]/50 shadow-[0_4px_20px_rgba(0,209,255,0.15)] hover:border-[#FF007A]'
                      }`}
                    >
                      {/* UNREAD INDICATOR DOT */}
                      {!isRead && (
                        <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 bg-[#00D1FF] rounded-full shadow-[0_0_8px_#00D1FF] animate-pulse" />
                      )}

                      <div className="space-y-1.5 pr-4">
                        {/* EVENT TAG / SENDER */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {notif.eventTitle && (
                            <span className="bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                              {notif.eventTitle}
                            </span>
                          )}
                          {notif.senderName && (
                            <span className="text-[10px] text-zinc-400 font-mono">
                              from <strong className="text-zinc-200">{notif.senderName}</strong>
                            </span>
                          )}
                        </div>

                        {/* TITLE */}
                        <h4 className="text-sm font-bold text-white group-hover:text-[#00D1FF] transition-colors leading-snug">
                          {notif.title}
                        </h4>

                        {/* CONTENT */}
                        <p className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap">
                          {notif.content}
                        </p>

                        {/* FOOTER TIMESTAMP & READ ACTION */}
                        <div className="pt-1 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            {formatTimestamp(notif.timestamp)}
                          </span>

                          {!isRead && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="text-cyan-400 hover:text-white font-bold transition-colors underline decoration-cyan-400/50"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* PANEL FOOTER */}
            <div className="p-3 bg-black/60 border-t border-white/10 text-center text-[10px] font-mono text-zinc-400 shrink-0 flex items-center justify-between px-4">
              <span>Garden City University Platform</span>
              <span className="text-[#00D1FF] font-bold">Real-time Notifications</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
