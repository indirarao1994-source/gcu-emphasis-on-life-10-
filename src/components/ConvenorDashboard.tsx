/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  PlusCircle, Download, Upload, BarChart3, Mail, Award, 
  Calendar, MapPin, Sparkles, BookOpen, Clock, Phone, AlertCircle, CheckCircle2, UserCheck, UserPlus, FileSpreadsheet,
  Edit3, Trash2, Megaphone, UserX, Trophy, Filter, Check, X, Users, Settings2, Search, Home, Printer, Bell
} from 'lucide-react';
import { Event, Student, Score, MessageToCoordinator, FacultyCoordinator, Notification, Occasion, StudentMasterRecord, isMatchingEmail } from '../types';
import { formatDateDDMMYYYY, formatDateRangeDDMMYYYY } from '../dateUtils';
import { 
  downloadEventExcel, 
  parseEventsExcel, 
  exportScoreSheetIndividual, 
  exportScoreSheetsMultiple, 
  exportScoreSheetsAll, 
  exportScoreSheetsTop100 
} from './ExcelHelper';
import { downloadStudentRegistrationsCSV, downloadLeaderboardCSV, downloadStudentSummaryWithEventCount } from './CSVHelper';
import { dbSaveCoordinator, dbDeleteCoordinator } from '../firebase';
import { OfficialScoreSheetModal } from './OfficialScoreSheetModal';

interface ConvenorDashboardProps {
  events: Event[];
  students: Student[];
  scores: Score[];
  messages: MessageToCoordinator[];
  notifications?: Notification[];
  facultyCoordinators?: FacultyCoordinator[];
  convenorEmail?: string;
  occasions?: Occasion[];
  activeOccasion?: Occasion;
  onSelectOccasion?: (id: string) => void;
  onUploadMasterStudents?: (masterList: StudentMasterRecord[]) => void;
  onUpdateOccasionCertificate?: (templateUrl: string) => void;
  onAddEvent: (newEvent: Event) => void;
  onUpdateEvent?: (updatedEvent: Event) => void;
  onDeleteEvent?: (eventId: string) => void;
  onClearAllEvents?: () => Promise<void>;
  onAddBulkEvents: (newEvents: Omit<Event, 'id'>[]) => void;
  onSendMessageToCoordinator: (msg: MessageToCoordinator) => void;
  onAddNotification?: (notif: Notification) => void;
  onClearNotifications?: () => void;
  onApproveCoordinator?: (facultyId: string, approve: boolean) => void;
  onDeleteCoordinator?: (facultyId: string) => void;
  onDeleteStudent?: (registerNo: string) => void;
  onRegisterCoordinator?: (coord: FacultyCoordinator, oldFacultyId?: string) => void;
  onUpdateConvenorSecurity?: (newPassword: string, newEmail?: string) => void;
  onGoToLanding?: () => void;
}

export default function ConvenorDashboard({
  events,
  students,
  scores,
  messages,
  notifications = [],
  facultyCoordinators = [],
  convenorEmail = 'convenor@gcu.edu.in',
  occasions = [],
  activeOccasion,
  onSelectOccasion,
  onUploadMasterStudents,
  onUpdateOccasionCertificate,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onClearAllEvents,
  onAddBulkEvents,
  onSendMessageToCoordinator,
  onAddNotification,
  onClearNotifications,
  onApproveCoordinator,
  onDeleteCoordinator,
  onDeleteStudent,
  onRegisterCoordinator,
  onUpdateConvenorSecurity,
  onGoToLanding
}: ConvenorDashboardProps) {
  // Navigation inside Convenor Dashboard
  type SubTab = 'analytics' | 'events' | 'coordinators' | 'messages' | 'leaderboard' | 'scoresheets' | 'capaudit' | 'security';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('analytics');

  // Score Sheet Selection States
  const [selectedSingleEventId, setSelectedSingleEventId] = useState<string>('');
  const [selectedMultipleEventIds, setSelectedMultipleEventIds] = useState<string[]>([]);
  const [printableScoreSheetEvent, setPrintableScoreSheetEvent] = useState<Event | null>(null);

  // Security & Password Change States
  const [convenorSecurityEmail, setConvenorSecurityEmail] = useState(convenorEmail);
  const [convenorNewPass, setConvenorNewPass] = useState('');
  const [convenorConfirmPass, setConvenorConfirmPass] = useState('');
  const [securitySuccessMsg, setSecuritySuccessMsg] = useState('');
  const [securityErrorMsg, setSecurityErrorMsg] = useState('');

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityErrorMsg('');
    setSecuritySuccessMsg('');

    if (convenorNewPass && convenorNewPass !== convenorConfirmPass) {
      setSecurityErrorMsg('New password and confirm password do not match.');
      return;
    }

    if (convenorNewPass && convenorNewPass.length < 6) {
      setSecurityErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (onUpdateConvenorSecurity) {
      onUpdateConvenorSecurity(convenorNewPass || 'India@2026', convenorSecurityEmail);
      setSecuritySuccessMsg('🔒 Security credentials updated successfully! Changes saved persistently.');
      setConvenorNewPass('');
      setConvenorConfirmPass('');
    }
  };

  // Pending faculty coordinators check
  const pendingCoordinators = facultyCoordinators.filter(c => !c.isApproved);

  // Edit Event State
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Publish / Approve Event Results Modal State ("Yes Update Results")
  const [publishConfirmModalEvent, setPublishConfirmModalEvent] = useState<Event | null>(null);
  const [selectedStudentForBreakdown, setSelectedStudentForBreakdown] = useState<Student | null>(null);

  const handlePublishEventResults = (eventToPublish: Event) => {
    const updatedEvent: Event = {
      ...eventToPublish,
      resultsPublished: true,
      resultsPublishedAt: new Date().toISOString()
    };

    onUpdateEvent(updatedEvent);

    if (onAddNotification) {
      onAddNotification({
        id: `notif-pub-${Date.now()}`,
        eventId: eventToPublish.id,
        eventTitle: eventToPublish.title,
        title: `🏆 OFFICIAL LEADERBOARD UPDATED: ${eventToPublish.title}`,
        content: `Convenor has reviewed and officially published updated results for ${eventToPublish.title}. Student ranks are updated on the live Leaderboard!`,
        timestamp: new Date().toISOString(),
        senderName: 'Convenor Steering Committee'
      });
    }

    setPublishConfirmModalEvent(null);
  };

  // Event Directory Search & Filter States
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventDeptFilter, setEventDeptFilter] = useState('all');

  // Broadcast Message State (To Students)
  const [broadcastTarget, setBroadcastTarget] = useState<string>('all'); // 'all' or eventId
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState('');

  // Analytics Filters & Group Mode
  const [filterEventId, setFilterEventId] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [analyticsGroupMode, setAnalyticsGroupMode] = useState<'event' | 'department' | 'date'>('event');

  // Leaderboard / Topper Picker limit
  const [topperCount, setTopperCount] = useState<number>(75);

  // Handlers for edit, delete, broadcast
  const handleDeleteEventClick = (eventId: string, title: string) => {
    if (onDeleteEvent && window.confirm(`Are you sure you want to delete event "${title}"?`)) {
      onDeleteEvent(eventId);
    }
  };

  const handleSaveEditEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !onUpdateEvent) return;
    onUpdateEvent(editingEvent);
    setEditingEvent(null);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastContent) return;
    const newNotif: Notification = {
      id: `notif-broadcast-${Date.now()}`,
      eventId: broadcastTarget === 'all' ? 'global' : broadcastTarget,
      eventTitle: broadcastTarget === 'all' ? 'Global Broadcast' : (events.find(ev => ev.id === broadcastTarget)?.title || 'Event'),
      title: broadcastTitle.trim(),
      content: broadcastContent.trim(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      senderName: 'Convenor HQ'
    };
    if (onAddNotification) {
      onAddNotification(newNotif);
    }
    setBroadcastTitle('');
    setBroadcastContent('');
    setBroadcastSuccess('Broadcast message published to students!');
    setTimeout(() => setBroadcastSuccess(''), 4000);
  };

  // One-by-one Form state (Creating Event)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('2026-08-05');
  const [timeStart, setTimeStart] = useState('10:00');
  const [timeEnd, setTimeEnd] = useState('12:00');
  const [venue, setVenue] = useState('');
  const [hostDept, setHostDept] = useState('');
  const [facId, setFacId] = useState('');
  const [coordName, setCoordName] = useState('');
  const [coordMobile, setCoordMobile] = useState('');
  const [coordEmail, setCoordEmail] = useState('');
  const [studentCoordName, setStudentCoordName] = useState('');
  const [rules, setRules] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Bulk Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [replaceOnUpload, setReplaceOnUpload] = useState(true);
  const [isClearingEvents, setIsClearingEvents] = useState(false);

  const handleClearEventsConfirm = async () => {
    if (!onClearAllEvents) return;
    if (window.confirm(`⚠️ CONFIRM CLEAR ALL EVENTS:\nAre you sure you want to delete ALL ${events.length} existing events from the database?\n\nThis will clear all current events so you can upload your new Excel sheet cleanly.`)) {
      setIsClearingEvents(true);
      setBulkError('');
      setBulkSuccess('');
      try {
        await onClearAllEvents();
        setBulkSuccess('🗑️ All existing events have been permanently deleted from the database!');
      } catch (err) {
        setBulkError('Failed to clear events. Please try again.');
      } finally {
        setIsClearingEvents(false);
      }
    }
  };

  // Messenger State
  const [messageCoordinatorId, setMessageCoordinatorId] = useState(events[0]?.coordinatorFacultyId || '');
  const [messageText, setMessageText] = useState('');
  const [messageSuccess, setMessageSuccess] = useState('');

  // Edit Faculty Coordinator State (Convenor management)
  const [editingFaculty, setEditingFaculty] = useState<FacultyCoordinator | null>(null);
  const [editCoordId, setEditCoordId] = useState('');
  const [editCoordName, setEditCoordName] = useState('');
  const [editCoordMobile, setEditCoordMobile] = useState('');
  const [editCoordEmail, setEditCoordEmail] = useState('');
  const [editCoordDepartment, setEditCoordDepartment] = useState('');
  const [editCoordSchool, setEditCoordSchool] = useState('');
  const [editCoordError, setEditCoordError] = useState('');
  const [editCoordSuccess, setEditCoordSuccess] = useState('');

  const handleStartEditFaculty = (coord: FacultyCoordinator) => {
    setEditingFaculty(coord);
    setEditCoordId(coord.facultyId || '');
    setEditCoordName(coord.name || '');
    setEditCoordMobile(coord.mobile || '');
    setEditCoordEmail(coord.email || '');
    setEditCoordDepartment(coord.department || '');
    setEditCoordSchool(coord.school || '');
    setEditCoordError('');
    setEditCoordSuccess('');
  };

  const handleSaveFacultyByConvenor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    setEditCoordError('');
    setEditCoordSuccess('');

    if (!editCoordName.trim() || !editCoordMobile.trim() || !editCoordId.trim() || !editCoordEmail.trim()) {
      setEditCoordError('Please fill in Name, Mobile, Faculty ID, and Email.');
      return;
    }

    const oldId = editingFaculty.facultyId;

    const updated: FacultyCoordinator = {
      ...editingFaculty,
      facultyId: editCoordId.trim().toUpperCase(),
      name: editCoordName.trim(),
      mobile: editCoordMobile.trim(),
      email: editCoordEmail.trim().toLowerCase(),
      department: editCoordDepartment.trim(),
      school: editCoordSchool.trim(),
      isProfileComplete: true
    };

    try {
      if (oldId && oldId !== updated.facultyId) {
        await dbDeleteCoordinator(oldId);
      }
      await dbSaveCoordinator(updated);
      if (onRegisterCoordinator) {
        onRegisterCoordinator(updated, oldId);
      }
      setEditCoordSuccess('✅ Faculty member details updated successfully!');
      setTimeout(() => {
        setEditingFaculty(null);
        setEditCoordSuccess('');
      }, 1000);
    } catch (err: any) {
      setEditCoordError('Error updating faculty: ' + (err.message || 'Unknown error'));
    }
  };

  // Pre-Approve New Faculty Member State (Convenor)
  const [searchApprovedFaculty, setSearchApprovedFaculty] = useState('');
  const [quickMailInput, setQuickMailInput] = useState('');
  const [quickMailMsg, setQuickMailMsg] = useState('');
  const [isAddingFacultyModalOpen, setIsAddingFacultyModalOpen] = useState(false);
  const [addFacId, setAddFacId] = useState('');
  const [addFacName, setAddFacName] = useState('');
  const [addFacMobile, setAddFacMobile] = useState('');
  const [addFacEmail, setAddFacEmail] = useState('');
  const [addFacDepartment, setAddFacDepartment] = useState('');
  const [addFacSchool, setAddFacSchool] = useState('');
  const [addFacError, setAddFacError] = useState('');
  const [addFacSuccess, setAddFacSuccess] = useState('');

  // Quick Approve Mail ID
  const handleQuickApproveMail = async () => {
    if (!quickMailInput.trim()) {
      setQuickMailMsg('⚠️ Please enter an email ID or register number.');
      return;
    }
    const clean = quickMailInput.trim().toLowerCase();
    let match = facultyCoordinators.find(c => c.email.toLowerCase() === clean || (c.username && c.username.toLowerCase() === clean));
    
    if (match) {
      const updated = { ...match, isApproved: true };
      await dbSaveCoordinator(updated);
      if (onRegisterCoordinator) onRegisterCoordinator(updated);
      setQuickMailMsg(`✅ Approved ${match.name} (${match.email}) as Faculty Coordinator!`);
    } else {
      const newFacId = `FAC-${Date.now().toString().slice(-4)}`;
      const newCoord: FacultyCoordinator = {
        facultyId: newFacId,
        name: clean.split('@')[0],
        email: clean,
        mobile: '',
        department: 'Approved Faculty Coordinator',
        isApproved: true,
        createdAt: new Date().toISOString()
      };
      await dbSaveCoordinator(newCoord);
      if (onRegisterCoordinator) onRegisterCoordinator(newCoord);
      setQuickMailMsg(`✅ Pre-approved email ${clean}! Granted Faculty Coordinator access.`);
    }
    setQuickMailInput('');
  };

  // Quick Delete Mail ID (Deletes from both Faculty Coordinators and Students)
  const handleQuickDeleteMail = async () => {
    if (!quickMailInput.trim()) {
      setQuickMailMsg('⚠️ Please enter an email ID or register number.');
      return;
    }
    const clean = quickMailInput.trim().toLowerCase();
    let deletedCount = 0;

    // Delete matching faculty coordinator
    const matchedFac = facultyCoordinators.filter(c => 
      c.email.toLowerCase() === clean || 
      (c.username && c.username.toLowerCase() === clean) ||
      c.facultyId.toLowerCase() === clean ||
      c.email.toLowerCase().includes(clean)
    );

    for (const f of matchedFac) {
      if (onDeleteCoordinator) {
        await onDeleteCoordinator(f.facultyId);
      } else {
        await dbDeleteCoordinator(f.facultyId);
      }
      deletedCount++;
    }

    // Delete matching student
    const matchedStudents = students.filter(s => 
      (s.email && s.email.toLowerCase() === clean) ||
      (s.registerNo && s.registerNo.toLowerCase() === clean) ||
      (s.email && s.email.toLowerCase().includes(clean)) ||
      (s.registerNo && s.registerNo.toLowerCase().includes(clean))
    );

    for (const st of matchedStudents) {
      if (onDeleteStudent) {
        await onDeleteStudent(st.registerNo);
      }
      deletedCount++;
    }

    if (deletedCount > 0) {
      setQuickMailMsg(`🗑️ Permanently deleted ${deletedCount} record(s) matching "${clean}" from Faculty Coordinators & Student database!`);
    } else {
      setQuickMailMsg(`⚠️ No matching faculty or student account found for "${clean}".`);
    }
    setQuickMailInput('');
  };

  // Quick Disapprove / Revoke Mail ID
  const handleQuickDisapproveMail = async () => {
    if (!quickMailInput.trim()) {
      setQuickMailMsg('⚠️ Please enter an email ID or register number.');
      return;
    }
    const clean = quickMailInput.trim().toLowerCase();
    const matchedFac = facultyCoordinators.filter(c => 
      c.email.toLowerCase() === clean || 
      (c.username && c.username.toLowerCase() === clean) ||
      c.facultyId.toLowerCase() === clean ||
      c.email.toLowerCase().includes(clean)
    );

    if (matchedFac.length > 0) {
      for (const f of matchedFac) {
        const updated = { ...f, isApproved: false };
        await dbSaveCoordinator(updated);
        if (onRegisterCoordinator) onRegisterCoordinator(updated);
      }
      setQuickMailMsg(`⚠️ Revoked approval for ${matchedFac.length} faculty record(s) matching "${clean}". Status moved to Pending Approval.`);
    } else {
      setQuickMailMsg(`⚠️ No matching approved faculty coordinator found for "${clean}".`);
    }
    setQuickMailInput('');
  };

  // Disapprove / Revoke Faculty Coordinator Access
  const handleDisapproveFaculty = async (coord: FacultyCoordinator) => {
    if (window.confirm(`⚠️ REVOKE FACULTY ACCESS CONFIRMATION\n\nAre you sure you want to DISAPPROVE / REVOKE access for "${coord.name}" (${coord.email})?\n\nTheir access will be revoked immediately and moved to Pending Approval.`)) {
      const updated = { ...coord, isApproved: false };
      await dbSaveCoordinator(updated);
      if (onRegisterCoordinator) onRegisterCoordinator(updated);
      alert(`⚠️ Access for ${coord.name} (${coord.email}) has been REVOKED and moved to Pending Approval.`);
    }
  };

  // Delete Faculty Coordinator Account (and associated student data if student logged into faculty)
  const handleDeleteCoordinatorAccount = async (coord: FacultyCoordinator) => {
    if (window.confirm(`⚠️ PERMANENT DELETION CONFIRMATION\n\nAre you sure you want to delete Faculty Coordinator "${coord.name}" (${coord.email})?\n\nThis will revoke their access and delete their account record.`)) {
      if (onDeleteCoordinator) {
        await onDeleteCoordinator(coord.facultyId);
      } else {
        await dbDeleteCoordinator(coord.facultyId);
      }

      // Check for matching student account (e.g., 23btce234@gcu.edu.in / 23BTCE234)
      const studentMatch = students.find(s => 
        (s.email && s.email.toLowerCase() === coord.email.toLowerCase()) ||
        (s.registerNo && coord.username && s.registerNo.toLowerCase() === coord.username.toLowerCase()) ||
        (s.registerNo && s.registerNo.toLowerCase() === coord.email.split('@')[0].toLowerCase())
      );
      if (studentMatch && onDeleteStudent) {
        await onDeleteStudent(studentMatch.registerNo);
      }
      alert(`✅ Account and data for ${coord.name} (${coord.email}) deleted successfully.`);
    }
  };

  const handleAddPreApprovedFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFacError('');
    setAddFacSuccess('');

    if (!addFacName.trim() || !addFacId.trim() || !addFacEmail.trim()) {
      setAddFacError('Please fill in Faculty Name, Faculty ID, and University Email.');
      return;
    }

    const cleanEmail = addFacEmail.trim().toLowerCase();
    const cleanFacId = addFacId.trim().toUpperCase();

    const newCoord: FacultyCoordinator = {
      facultyId: cleanFacId,
      name: addFacName.trim(),
      email: cleanEmail,
      mobile: addFacMobile.trim(),
      department: addFacDepartment.trim() || 'Computer Science & Engineering',
      school: addFacSchool.trim() || 'School of CS & IT',
      isApproved: true, // Pre-approved by Convenor!
      createdAt: new Date().toISOString(),
      isProfileComplete: true
    };

    try {
      await dbSaveCoordinator(newCoord);
      setAddFacSuccess(`✅ Pre-approved ${newCoord.name} (${cleanEmail})! They can now log in directly.`);
      setTimeout(() => {
        setIsAddingFacultyModalOpen(false);
        setAddFacId('');
        setAddFacName('');
        setAddFacMobile('');
        setAddFacEmail('');
        setAddFacDepartment('');
        setAddFacSchool('');
        setAddFacSuccess('');
      }, 1200);
    } catch (err: any) {
      setAddFacError('Failed to save pre-approved faculty: ' + (err.message || 'Unknown error'));
    }
  };

  // Sync selected coordinator message target when list loads
  React.useEffect(() => {
    if (events.length > 0 && !messageCoordinatorId) {
      setMessageCoordinatorId(events[0].coordinatorFacultyId);
    }
  }, [events, messageCoordinatorId]);

  // Handle Event submit
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !date || !timeStart || !timeEnd || !venue || !hostDept || !facId || !coordName || !coordMobile || !coordEmail || !rules) {
      setFormError('Please fill in all required event details.');
      return;
    }

    const newEvent: Event = {
      id: `evt-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      date,
      timeStart,
      timeEnd,
      venue: venue.trim(),
      hostDepartment: hostDept.trim(),
      coordinatorFacultyId: facId.trim().toUpperCase(),
      coordinatorName: coordName.trim(),
      coordinatorMobile: coordMobile.trim(),
      coordinatorEmail: coordEmail.trim(),
      studentCoordinatorName: studentCoordName.trim(),
      rules: rules.trim(),
      imageUrl: brochureUrl.trim() || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=600',
      brochureUrl: brochureUrl.trim() || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=600'
    };

    onAddEvent(newEvent);

    // Auto-approve/update faculty coordinator in database
    const cleanEmail = coordEmail.trim().toLowerCase();
    const cleanFacId = facId.trim().toUpperCase();
    const existingCoord = facultyCoordinators.find(
      c => c.email.toLowerCase() === cleanEmail || c.facultyId.toLowerCase() === cleanFacId.toLowerCase()
    );
    const updatedCoord: FacultyCoordinator = {
      ...(existingCoord || {}),
      facultyId: cleanFacId,
      name: coordName.trim(),
      email: cleanEmail,
      mobile: coordMobile.trim(),
      department: hostDept.trim(),
      isApproved: true, // Convenor assigned event -> Auto approved!
      createdAt: existingCoord?.createdAt || new Date().toISOString(),
      isProfileComplete: true
    };
    try {
      await dbSaveCoordinator(updatedCoord);
    } catch (err) {
      console.warn('Failed to auto-save assigned faculty coordinator:', err);
    }
    
    // reset form
    setTitle('');
    setDescription('');
    setVenue('');
    setHostDept('');
    setFacId('');
    setCoordName('');
    setCoordMobile('');
    setCoordEmail('');
    setStudentCoordName('');
    setBrochureUrl('');
    setRules('');
    setFormError('');
    setFormSuccess('Event published successfully!');
    setTimeout(() => setFormSuccess(''), 4000);
  };

  // Handle Bulk Event Excel file uploads
  const handleBulkEventUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkError('');
    setBulkSuccess('');

    try {
      const parsedEvents = await parseEventsExcel(file);

      if (parsedEvents.length === 0) {
        setBulkError('Could not find any event records in the uploaded Excel file.');
        return;
      }

      onAddBulkEvents(parsedEvents);

      // Save/approve assigned faculty from bulk upload
      for (const evt of parsedEvents) {
        if (evt.coordinatorEmail) {
          const cleanEmail = evt.coordinatorEmail.trim().toLowerCase();
          const cleanFacId = (evt.coordinatorFacultyId || 'FAC-' + Date.now().toString().slice(-4)).toUpperCase();
          const existingCoord = facultyCoordinators.find(
            c => c.email.toLowerCase() === cleanEmail || c.facultyId.toLowerCase() === cleanFacId.toLowerCase()
          );
          const updatedCoord: FacultyCoordinator = {
            ...(existingCoord || {}),
            facultyId: cleanFacId,
            name: evt.coordinatorName || cleanEmail.split('@')[0],
            email: cleanEmail,
            mobile: evt.coordinatorMobile || '',
            department: evt.hostDepartment || 'General',
            isApproved: true,
            createdAt: existingCoord?.createdAt || new Date().toISOString(),
            isProfileComplete: true
          };
          await dbSaveCoordinator(updatedCoord);
        }
      }

      setBulkSuccess(`Successfully bulk imported ${parsedEvents.length} new events from Excel!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setBulkError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv spreadsheet file matching the template.');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Send Direct Message to coordinator
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageCoordinatorId || !messageText) return;

    const targetCoord = events.find(evt => evt.coordinatorFacultyId === messageCoordinatorId);
    
    const newMsg: MessageToCoordinator = {
      id: `msg-${Date.now()}`,
      coordinatorFacultyId: messageCoordinatorId,
      coordinatorName: targetCoord ? targetCoord.coordinatorName : 'Unknown Coordinator',
      eventTitle: targetCoord ? targetCoord.title : 'General',
      message: messageText.trim(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    onSendMessageToCoordinator(newMsg);
    setMessageText('');
    setMessageSuccess(`Direct memo dispatched to ${newMsg.coordinatorName}!`);
    setTimeout(() => setMessageSuccess(''), 4000);
  };

  // Compute stats for events, dates, and venues
  const getEventStats = () => {
    return events.map(evt => {
      const matchingStudents = students.filter(s => s.registeredEventIds.includes(evt.id));
      return {
        id: evt.id,
        title: evt.title,
        date: evt.date,
        venue: evt.venue,
        coordinator: evt.coordinatorName,
        registrations: matchingStudents.length
      };
    }).sort((a, b) => b.registrations - a.registrations);
  };

  const getDateStats = () => {
    const dates = Array.from(new Set(events.map(e => e.date))).sort();
    return dates.map(d => {
      const dayEvents = events.filter(e => e.date === d);
      const dayRegCount = students.filter(s => 
        s.registeredEventIds.some(eid => dayEvents.some(de => de.id === eid))
      ).length;

      return {
        date: d,
        eventCount: dayEvents.length,
        events: dayEvents.map(e => e.title),
        registrations: dayRegCount
      };
    });
  };

  const getVenueStats = () => {
    const venues = Array.from(new Set(events.map(e => e.venue))).sort();
    return venues.map(v => {
      const venueEvents = events.filter(e => e.venue === v);
      const venueRegCount = students.filter(s => 
        s.registeredEventIds.some(eid => venueEvents.some(ve => ve.id === eid))
      ).length;

      return {
        venue: v,
        eventCount: venueEvents.length,
        events: venueEvents.map(e => e.title),
        registrations: venueRegCount
      };
    });
  };

  // COMPUTE DYNAMIC LEADERBOARD
  // Sort students by aggregate total scores across all events registered
  interface LeaderboardRow {
    rank: number;
    registerNo: string;
    name: string;
    email: string;
    mobile: string;
    eventsRegistered: string[];
    eventsWon: string[];
    totalScore: number;
  }

  const computeLeaderboard = (): LeaderboardRow[] => {
    const rows: LeaderboardRow[] = students.map(student => {
      // Find all score records for this student
      const studentScoreRecs = scores.filter(s => s.studentRegisterNo === student.registerNo);
      
      // registered events names
      const registeredEventNames = student.registeredEventIds.map(eid => {
        const ev = events.find(e => e.id === eid);
        return ev ? ev.title.split(' - ')[0] : 'Event';
      });

      // won events names
      const wonEventNames = studentScoreRecs
        .filter(s => s.isWinner)
        .map(s => s.eventTitle.split(' - ')[0]);

      // total score is sum of total scores of their registered events
      // wait, what if they don't have score entered yet? They still get their 10 base points!
      // Let's sum basePoints + performanceScore for each registered event in the scores array
      // Wait, what if a score record doesn't exist? (Students registered but no score object yet).
      // They should get 10 points! So we count 10 base points for each event in registeredEventIds
      let totalSum = 0;
      student.registeredEventIds.forEach(eid => {
        const rec = studentScoreRecs.find(s => s.eventId === eid);
        if (rec) {
          totalSum += rec.totalScore;
        } else {
          totalSum += 5; // Default registration points (5)
        }
      });

      return {
        rank: 0,
        registerNo: student.registerNo,
        name: student.name,
        email: student.email,
        mobile: student.mobile,
        eventsRegistered: registeredEventNames,
        eventsWon: wonEventNames,
        totalScore: totalSum
      };
    });

    // Sort descending by total score, then by number of events
    rows.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return b.eventsRegistered.length - a.eventsRegistered.length;
    });

    // Calculate ranks (dense rank for ties)
    let currentRank = 1;
    for (let i = 0; i < rows.length; i++) {
      if (i > 0 && rows[i].totalScore < rows[i - 1].totalScore) {
        currentRank = i + 1;
      }
      rows[i].rank = currentRank;
    }

    return rows.slice(0, topperCount);
  };

  const leaderboardRows = computeLeaderboard();

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* 🏠 BACK TO HOME / LANDING PAGE BAR */}
      <div className="flex items-center justify-between bg-[#1A032E]/90 border border-amber-500/40 p-3.5 rounded-2xl shadow-xl">
        <button
          onClick={onGoToLanding}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer border border-amber-300"
        >
          <Home className="w-4 h-4" />
          <span>← Back to Home / Landing Page</span>
        </button>
        <span className="text-xs text-amber-200 font-semibold hidden sm:inline-flex items-center gap-2">
          <img 
            src="/gculogo.svg" 
            alt="GCU Logo" 
            className="w-5 h-5 object-contain" 
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.endsWith('.svg')) target.src = '/gculogo.png';
            }}
          />
          <span>Garden City University Festivals Portal</span>
        </span>
      </div>

      {/* PENDING APPROVAL NOTIFICATION BANNER */}
      {events.filter(e => e.reportedToConvenor && !e.resultsPublished).length > 0 && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-orange-950 border-2 border-amber-500 rounded-2xl p-4 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-center text-amber-400 shrink-0">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider">
                📢 {events.filter(e => e.reportedToConvenor && !e.resultsPublished).length} Event(s) Completed & Reported by Faculty Coordinator
              </h4>
              <p className="text-xs text-zinc-300">
                Faculty coordinators have submitted final evaluation marks. Review the student marks and click "Yes Update Results" to approve and update the official Leaderboard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const pending = events.filter(e => e.reportedToConvenor && !e.resultsPublished);
              if (pending.length === 1) {
                setPublishConfirmModalEvent(pending[0]);
              } else {
                setActiveSubTab('events');
              }
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer border border-emerald-300 shrink-0 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Review & Update Results</span>
          </button>
        </div>
      )}

      {/* Convenor Banner */}
      <div className="bg-gradient-to-r from-[#2E004F]/60 via-[#1A032E] to-[#0F011E] border-2 border-[#FF007A] rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF007A]/10 rounded-full filter blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-1 text-center md:text-left">
          <p className="text-[#00D1FF] font-mono text-[10px] uppercase tracking-widest font-black">Convenor Control Panel</p>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic transform -rotate-1">
            👑 Fresherism Steering Committee
          </h1>
          <p className="text-xs text-zinc-300 font-medium">
            Monitor registration trends, publish schedules, audit results, and view the live leaderboard.
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap gap-2 relative z-10">
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'analytics' 
                ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/25' 
                : 'bg-[#1A032E] border border-white/10 text-zinc-300 hover:text-white hover:border-[#FF007A]/30'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Infographics & Analytics</span>
          </button>

          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'events' 
                ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/25' 
                : 'bg-[#1A032E] border border-white/10 text-zinc-300 hover:text-white hover:border-[#FF007A]/30'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Manage Events ({events.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('coordinators')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
              activeSubTab === 'coordinators' 
                ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/25' 
                : 'bg-[#1A032E] border border-white/10 text-zinc-300 hover:text-white hover:border-[#FF007A]/30'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Faculty Approvals</span>
            {pendingCoordinators.length > 0 && (
              <span className="bg-amber-400 text-black font-black text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingCoordinators.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveSubTab('messages')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'messages' 
                ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/25' 
                : 'bg-[#1A032E] border border-white/10 text-zinc-300 hover:text-white hover:border-[#FF007A]/30'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Broadcasts & Messages</span>
          </button>

          <button
            onClick={() => setActiveSubTab('leaderboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'leaderboard' 
                ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/25' 
                : 'bg-[#1A032E] border border-white/10 text-zinc-300 hover:text-white hover:border-[#FF007A]/30'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Toppers & Leaderboard</span>
          </button>

          <button
            onClick={() => setActiveSubTab('scoresheets')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'scoresheets' 
                ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/25' 
                : 'bg-[#1A032E] border border-white/10 text-zinc-300 hover:text-white hover:border-[#FF007A]/30'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#00D1FF]" />
            <span>Score Sheets Export</span>
          </button>

          <button
            onClick={() => setActiveSubTab('capaudit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'capaudit' 
                ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/25' 
                : 'bg-[#1A032E] border border-white/10 text-zinc-300 hover:text-white hover:border-[#FF007A]/30'
            }`}
          >
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span>Master Data & Cap Audit</span>
          </button>

          <button
            onClick={() => setActiveSubTab('security')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'security' 
                ? 'bg-[#FF007A] text-white font-black shadow-lg shadow-[#FF007A]/25' 
                : 'bg-[#1A032E] border border-white/10 text-zinc-300 hover:text-white hover:border-[#FF007A]/30'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>Security & Settings</span>
          </button>
        </div>
      </div>

      {/* 🚨 LIVE BROADCAST MESSAGES MONITOR FOR CONVENOR (ON TOP) */}
      <div className="bg-gradient-to-r from-[#240038] via-[#1A032E] to-[#0A0016] border-2 border-[#FF007A] rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#FF007A]/30 pb-3">
          <div className="flex items-center gap-2.5 text-[#FF007A]">
            <Megaphone className="w-6 h-6 animate-pulse text-[#FF007A]" />
            <h3 className="text-lg font-black text-white uppercase tracking-tight italic">
              🚨 Live Broadcast Alerts & Coordinator Messages Feed
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-[#FF007A]/20 border border-[#FF007A]/50 text-rose-300 font-mono text-[10px] font-black rounded-lg uppercase tracking-wider">
              {notifications.length} Broadcast Alerts
            </span>
            {notifications.length > 0 && onClearNotifications && (
              <button
                type="button"
                onClick={onClearNotifications}
                className="px-3 py-1 bg-rose-500/20 border border-rose-500/50 text-rose-300 hover:bg-rose-500/40 text-[10px] font-black rounded-lg uppercase tracking-wider cursor-pointer transition-all"
              >
                Clear Feed
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveSubTab('messages')}
              className="px-3 py-1 bg-[#00D1FF]/20 border border-[#00D1FF]/50 text-[#00D1FF] hover:bg-[#00D1FF]/30 text-[10px] font-black rounded-lg uppercase tracking-wider cursor-pointer transition-all"
            >
              Direct Messaging →
            </button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="p-4 bg-black/40 border border-white/10 rounded-2xl text-center text-xs text-zinc-400 italic">
            ⚡ Live broadcast notifications sent by Event Coordinators and Convenors to students will appear here instantly.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
            {notifications.slice().reverse().map((notif) => (
              <div 
                key={notif.id}
                className="p-4 bg-[#140026] border-l-4 border-[#FF007A] border-t border-r border-b border-white/15 rounded-r-2xl rounded-l-md space-y-2 shadow-lg hover:border-[#00D1FF] transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] bg-[#FF007A]/20 text-[#FF007A] border border-[#FF007A]/40 font-black px-2 py-0.5 rounded uppercase font-mono truncate max-w-[150px]">
                    {notif.eventTitle || 'All Events'}
                  </span>
                  <span className="text-[10px] text-amber-200 font-mono font-bold shrink-0">{notif.timestamp}</span>
                </div>
                <h4 className="text-xs font-black text-white leading-snug">{notif.title}</h4>
                <p className="text-xs text-zinc-300 leading-relaxed font-medium line-clamp-3">{notif.content}</p>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="text-cyan-300 font-bold truncate max-w-[180px]">Event Coordinator: {notif.senderName}</span>
                  <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded font-mono font-bold shrink-0">SENT TO STUDENTS</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ALERT BANNER FOR PENDING FACULTY COORDINATORS */}
      {pendingCoordinators.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 border-2 border-amber-500 text-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 border border-amber-500/50 rounded-xl text-amber-300">
              <AlertCircle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                Faculty Approval Alert: {pendingCoordinators.length} Faculty Seeking Approval!
              </h4>
              <p className="text-xs text-amber-200/80">
                Faculty coordinators must be approved by the Convenor before they can post marks or manage events.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveSubTab('coordinators')}
            className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0 uppercase tracking-wider shadow-lg"
          >
            Review Approvals ({pendingCoordinators.length})
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB A: LOGISTICS ANALYTICS */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-b from-[#1A032E] to-[#0F011E] border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Total Active Events</p>
              <h3 className="text-3xl font-black text-[#FF007A] mt-1">{events.length} Events</h3>
              <p className="text-xs text-zinc-400 mt-1">Departments Participating: {new Set(events.map(e => e.hostDepartment)).size}</p>
            </div>
            <div className="bg-gradient-to-b from-[#1A032E] to-[#0F011E] border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Registered Students</p>
              <h3 className="text-3xl font-black text-[#00D1FF] mt-1">{students.length} Students</h3>
              <p className="text-xs text-zinc-400 mt-1">Average Registrations: {(students.reduce((a,b)=>a+b.registeredEventIds.length, 0)/Math.max(1, students.length)).toFixed(1)} per student</p>
            </div>
            <div className="bg-gradient-to-b from-[#1A032E] to-[#0F011E] border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Venues Booked</p>
              <h3 className="text-3xl font-black text-[#00FFAB] mt-1">{new Set(events.map(e => e.venue)).size} Venues</h3>
              <p className="text-xs text-zinc-400 mt-1">Memos dispatched: {messages.length}</p>
            </div>
          </div>

          <div className="bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
            
            {/* Filter buttons & CSV Export */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight transform -rotate-1">
                  University Registration Breakdown
                </h3>
                <p className="text-xs text-zinc-400">
                  Group registrant quantities date-wise, event-wise, or venue-wise to manage capacities.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={downloadStudentRegistrationsCSV(students, events, scores)}
                  download="fresherism_2026_all_student_registrations.csv"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer border border-white/20"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                  <span>Export All Student Registrations (CSV)</span>
                </a>

                <a
                  href={downloadStudentSummaryWithEventCount(students, events, scores)}
                  download="fresherism_2026_unique_students_summary.csv"
                  className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer border border-white/20"
                  title="Download list of all unique students with event registration count"
                >
                  <Users className="w-4 h-4 text-violet-200" />
                  <span>Unique Students Summary (CSV)</span>
                </a>

                <div className="inline-flex bg-[#0F011E] p-1 rounded-xl border border-white/10 text-xs font-bold text-zinc-400">
                  <button
                    onClick={() => setAnalyticsGroupMode('event')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${analyticsGroupMode === 'event' ? 'bg-[#FF007A] text-white font-black' : 'hover:text-white'}`}
                  >
                    Event Wise
                  </button>
                  <button
                    onClick={() => setAnalyticsGroupMode('date')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${analyticsGroupMode === 'date' ? 'bg-[#FF007A] text-white font-black' : 'hover:text-white'}`}
                  >
                    Date Wise
                  </button>
                  <button
                    onClick={() => setAnalyticsGroupMode('venue')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${analyticsGroupMode === 'venue' ? 'bg-[#FF007A] text-white font-black' : 'hover:text-white'}`}
                  >
                    Venue Wise
                  </button>
                </div>
              </div>
            </div>

            {/* EVENT WISE GROUPING */}
            {analyticsGroupMode === 'event' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getEventStats().map(evt => (
                  <div 
                    key={evt.id}
                    className="bg-gradient-to-br from-[#200438] to-[#0F011E] border-2 border-white/10 hover:border-[#00D1FF] rounded-2xl p-5 space-y-4 transition-all flex flex-col justify-between shadow-lg"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-base font-black text-white leading-tight">{evt.title}</h4>
                        <span className="bg-[#00D1FF]/20 border border-[#00D1FF] text-[#00D1FF] font-black px-3 py-1 rounded-xl text-xs font-mono shadow-sm">
                          {evt.registrations} Registrations
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 font-semibold">Faculty: {evt.coordinator}</p>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex justify-between items-center text-xs text-zinc-200 font-bold">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FF007A]/20 border border-[#FF007A]/40 rounded-lg text-white"><Calendar className="w-4 h-4 text-[#FF007A]" /> {formatDateDDMMYYYY(evt.date)}</span>
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00FFAB]/20 border border-[#00FFAB]/40 rounded-lg text-white"><MapPin className="w-4 h-4 text-[#00FFAB]" /> {evt.venue}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* DATE WISE GROUPING */}
            {analyticsGroupMode === 'date' && (
              <div className="space-y-4">
                {getDateStats().map((ds, idx) => (
                  <div key={idx} className="bg-[#0F011E]/75 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#FF007A]" />
                        <h4 className="text-base font-black text-white">{formatDateDDMMYYYY(ds.date)}</h4>
                        <span className="bg-[#1A032E] border border-white/5 text-[#00D1FF] text-[10px] font-mono px-2 py-0.5 rounded font-black">
                          {ds.eventCount} Scheduled Events
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {ds.events.map((eTitle, eIdx) => (
                          <span key={eIdx} className="bg-[#0F011E] border border-white/5 text-zinc-300 text-[10px] px-2.5 py-1 rounded">
                            {eTitle}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400 uppercase font-mono tracking-widest">Total Signups on Date</p>
                      <p className="text-2xl font-black text-[#00D1FF] mt-0.5">{ds.registrations} Students</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* VENUE WISE GROUPING */}
            {analyticsGroupMode === 'venue' && (
              <div className="space-y-4">
                {getVenueStats().map((vs, idx) => (
                  <div key={idx} className="bg-[#0F011E]/75 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-violet-400" />
                        <h4 className="text-base font-black text-white">{vs.venue}</h4>
                        <span className="bg-[#1A032E] border border-white/5 text-[#00FFAB] text-[10px] font-mono px-2 py-0.5 rounded font-black">
                          {vs.eventCount} Hosted Games
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {vs.events.map((eTitle, eIdx) => (
                          <span key={eIdx} className="bg-[#0F011E] border border-white/5 text-zinc-300 text-[10px] px-2.5 py-1 rounded font-medium">
                            {eTitle}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400 uppercase font-mono tracking-widest">Total Venue Crowd</p>
                      <p className="text-2xl font-black text-[#00FFAB] mt-0.5">{vs.registrations} Students</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB B: MANAGE EVENTS (List, Edit, Add, Bulk Upload) */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'events' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#1A032E] border border-white/10 p-6 rounded-3xl">
            <div>
              <h3 className="text-xl font-black text-white uppercase italic transform -rotate-1 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#FF007A]" />
                Event Directory & Schedule Management
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Edit partial or complete event details, venue timings, rules, or update events at any time.
              </p>
            </div>
            <button
              onClick={() => setActiveSubTab('events')}
              className="px-4 py-2 bg-[#FF007A] text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Total Events: {events.length}</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-[#1A032E] border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search events by title, venue, host club, or coordinator..."
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQuery(e.target.value)}
                className="w-full bg-[#0F011E] border border-white/10 focus:border-[#FF007A] text-xs text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none transition-all"
              />
            </div>
            <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
              <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider shrink-0">Filter Club:</label>
              <select
                value={eventDeptFilter}
                onChange={(e) => setEventDeptFilter(e.target.value)}
                className="bg-[#0F011E] border border-white/10 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF007A]"
              >
                <option value="all">All Departments ({events.length})</option>
                {Array.from(new Set(events.map(e => e.hostDepartment))).sort().map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Events List Cards with Edit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events
              .filter((evt) => {
                const query = eventSearchQuery.toLowerCase().trim();
                const matchesSearch = !query ||
                  evt.title.toLowerCase().includes(query) ||
                  evt.hostDepartment.toLowerCase().includes(query) ||
                  evt.venue.toLowerCase().includes(query) ||
                  evt.coordinatorName.toLowerCase().includes(query);
                const matchesDept = eventDeptFilter === 'all' || evt.hostDepartment === eventDeptFilter;
                return matchesSearch && matchesDept;
              })
              .map((evt) => (
              <div 
                key={evt.id} 
                className="bg-gradient-to-br from-[#2D0B5A] via-[#1A032E] to-[#120224] border-2 border-[#FF007A]/40 hover:border-[#FF007A] rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col justify-between space-y-5 transition-all group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="bg-gradient-to-r from-[#FF007A] to-pink-600 text-white text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-widest shadow-md">
                      {evt.hostDepartment}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingEvent(evt)}
                        className="p-2.5 bg-[#0F011E] border border-[#00D1FF]/50 hover:border-[#00D1FF] text-cyan-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-extrabold shadow-md"
                        title="Edit Event Details"
                      >
                        <Edit3 className="w-4 h-4 text-[#00D1FF]" />
                        <span>Edit Details</span>
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight drop-shadow-md">{evt.title}</h4>
                  <p className="text-sm text-zinc-200 font-medium leading-relaxed">{evt.description}</p>

                  {/* Prominent Logistics Badges (Date, Time, Venue) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-white/10 font-sans">
                    <div className="px-3 py-2 bg-[#FF007A]/20 border-2 border-[#FF007A] text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-md shadow-[#FF007A]/15">
                      <Calendar className="w-5 h-5 text-[#FF007A] shrink-0" />
                      <div>
                        <p className="text-[9px] font-black uppercase text-[#FF007A] tracking-wider">DATE</p>
                        <p className="text-sm sm:text-base font-black text-white">{formatDateDDMMYYYY(evt.date)}</p>
                      </div>
                    </div>

                    <div className="px-3 py-2 bg-[#00D1FF]/20 border-2 border-[#00D1FF] text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-md shadow-[#00D1FF]/15">
                      <Clock className="w-5 h-5 text-[#00D1FF] shrink-0" />
                      <div>
                        <p className="text-[9px] font-black uppercase text-[#00D1FF] tracking-wider">TIME</p>
                        <p className="text-sm sm:text-base font-black text-white">{evt.timeStart} – {evt.timeEnd}</p>
                      </div>
                    </div>

                    <div className="px-3 py-2 bg-[#00FFAB]/20 border-2 border-[#00FFAB] text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-md shadow-[#00FFAB]/15">
                      <MapPin className="w-5 h-5 text-[#00FFAB] shrink-0" />
                      <div>
                        <p className="text-[9px] font-black uppercase text-[#00FFAB] tracking-wider">VENUE</p>
                        <p className="text-sm sm:text-base font-black text-white leading-tight">{evt.venue}</p>
                      </div>
                    </div>
                  </div>

                  {/* Faculty & Student Coordinator Info */}
                  <div className="p-4 bg-[#0F011E]/90 border border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-100 font-sans space-y-1.5 shadow-inner">
                    <p className="font-extrabold text-white flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-[#00D1FF]" />
                      <span>Faculty Coordinator:</span>
                      <span className="text-[#00D1FF]">{evt.coordinatorName}</span>
                      <span className="text-xs text-zinc-400 font-mono">({evt.coordinatorFacultyId})</span>
                    </p>
                    <p className="text-zinc-300 text-xs font-mono pl-6">📞 {evt.coordinatorMobile} | ✉️ {evt.coordinatorEmail}</p>
                    {evt.studentCoordinatorName && (
                      <p className="text-[#FFAC1C] text-xs font-bold pt-1.5 border-t border-white/10 flex items-center gap-1.5 pl-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#FFAC1C] shrink-0" />
                        <span>Student Coordinators: {evt.studentCoordinatorName}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs sm:text-sm font-bold text-zinc-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="uppercase tracking-wider">Registered:</span>
                    <span className="px-3 py-1 bg-[#00D1FF]/20 border border-[#00D1FF] text-[#00D1FF] font-mono font-black text-xs rounded-xl shadow-md">
                      {students.filter(s => s.registeredEventIds.includes(evt.id)).length} Students
                    </span>

                    {/* Event Approval & Publishing Status Badge */}
                    {evt.resultsPublished ? (
                      <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 rounded-xl font-extrabold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Official Results Published
                      </span>
                    ) : evt.reportedToConvenor ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/50 text-amber-300 rounded-xl font-extrabold text-xs flex items-center gap-1.5">
                          <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
                          Reported by Faculty (Awaiting Approval)
                        </span>
                        <button
                          type="button"
                          onClick={() => setPublishConfirmModalEvent(evt)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer border border-emerald-300 flex items-center gap-1.5 animate-bounce"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Yes Update Results</span>
                        </button>
                      </div>
                    ) : (
                      <span className="px-3 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-medium text-xs">
                        In Progress / Draft
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => exportScoreSheetIndividual(evt, students, scores)}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-white/20 shrink-0"
                    title="Download official Excel sheet of registered students for this event"
                  >
                    <Download className="w-4 h-4 text-emerald-100" />
                    <span>Download Registered Students Sheet (.xlsx)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bulk Import & Add Single Event Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-6 border-t border-white/10">
            {/* Left Block: Bulk upload */}
            <div className="lg:col-span-5 bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-md font-black text-white uppercase tracking-wider flex items-center gap-2 transform -rotate-1">
                <FileSpreadsheet className="w-5 h-5 text-[#00D1FF]" />
                Excel / CSV Bulk Event Importer
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Download the standardized Excel spreadsheet template, fill in all event details (Event Title, Description, Rules, Date, Start/End Time, Venue, Host Department, Faculty Coordinator Name, and Student Coordinator Name), then upload it back here.
              </p>

              <div className="bg-[#0F011E] p-3 rounded-2xl border border-white/5 text-[11px] text-zinc-400 space-y-1">
                <p className="text-white font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00D1FF]" />
                  Template Columns Included:
                </p>
                <p className="text-[10px] text-zinc-400 leading-normal font-mono">
                  Title, Description, Rules, Date (YYYY-MM-DD), Start Time, End Time, Venue, Host Dept, Faculty Coord ID/Name/Mobile/Email, Student Coordinator Name
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => downloadEventExcel(events)}
                  className="w-full bg-[#0F011E] hover:bg-white/5 border border-[#00D1FF]/30 hover:border-[#00D1FF] text-white py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4 text-[#00D1FF]" />
                  <span>Download All Event Details Excel ({events.length} Events) (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="w-full bg-[#FF007A] hover:opacity-90 text-white border-none py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF007A]/20"
                >
                  <Upload className="w-4 h-4 text-white" />
                  <span>Upload Completed Excel File (.xlsx)</span>
                </button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv, .tsv"
                  onChange={handleBulkEventUpload}
                  className="hidden"
                />
              </div>

              {bulkError && (
                <div className="bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                  <span>{bulkError}</span>
                </div>
              )}
              {bulkSuccess && (
                <div className="bg-[#00FFAB]/15 border border-[#00FFAB]/40 text-[#00FFAB] text-xs p-3.5 rounded-xl flex items-center gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#00FFAB] shrink-0 animate-pulse" />
                  <span>{bulkSuccess}</span>
                </div>
              )}
            </div>

            {/* Right Block: Single Form entry */}
            <div className="lg:col-span-7 bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2 transform -rotate-1">
                Post Single New Event
              </h3>

              {formError && (
                <div className="bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs p-3.5 rounded-xl mb-4 flex items-center gap-2.5">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="bg-[#00FFAB]/15 border border-[#00FFAB]/40 text-[#00FFAB] text-xs p-3.5 rounded-xl mb-4 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#00FFAB] shrink-0 animate-pulse" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateEvent} className="space-y-4 font-sans text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Event Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Beat the Beat - Solo Dance"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Host Department *</label>
                    <input
                      type="text"
                      placeholder="e.g. Department of Performing Arts"
                      value={hostDept}
                      onChange={(e) => setHostDept(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Event Description *</label>
                    <input
                      type="text"
                      placeholder="Provide a brief overview..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Date *</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Venue *</label>
                    <input
                      type="text"
                      placeholder="e.g. Auditorium 1"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Start Time *</label>
                    <input
                      type="time"
                      value={timeStart}
                      onChange={(e) => setTimeStart(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">End Time *</label>
                    <input
                      type="time"
                      value={timeEnd}
                      onChange={(e) => setTimeEnd(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Coordinator Faculty ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. FAC-101"
                      value={facId}
                      onChange={(e) => setFacId(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Coordinator Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Sarah Matthews"
                      value={coordName}
                      onChange={(e) => setCoordName(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Coordinator Mobile *</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      value={coordMobile}
                      onChange={(e) => setCoordMobile(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Faculty Coordinator Email (<span className="lowercase font-semibold">@gcu.edu.in</span>) *</label>
                    <input
                      type="email"
                      placeholder="e.g. s.matthews@gcu.edu.in"
                      value={coordEmail}
                      onChange={(e) => setCoordEmail(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-[#00D1FF] uppercase">Student Coordinator Name(s) & Contacts (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Akash (24BCAR243) — 8618944472 & Ms. Pricilla Raj (24BCAR166)"
                      value={studentCoordName}
                      onChange={(e) => setStudentCoordName(e.target.value)}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#00D1FF] text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase">Game Rules & Rubrics *</label>
                    <textarea
                      placeholder="1. Time limit 3 mins..."
                      value={rules}
                      onChange={(e) => setRules(e.target.value)}
                      rows={3}
                      className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-sans leading-relaxed font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#FF007A] to-[#00D1FF] hover:opacity-95 text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl shadow-xl transition-all cursor-pointer"
                >
                  Publish New Event
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB C: FACULTY COORDINATOR APPROVAL HUB */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'coordinators' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Section Header */}
          <div className="bg-[#1A032E] border border-white/10 p-6 rounded-3xl">
            <h3 className="text-xl font-black text-white uppercase italic transform -rotate-1 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              Faculty Coordinator Approval Lounge
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Coordinators must register with university emails (@gcu.edu.in) and be approved by the Convenor before accessing coordinator dashboards.
            </p>
          </div>

          {/* Direct Mail ID Access Control & Student Data Erase Tool */}
          <div className="bg-gradient-to-r from-purple-950/80 via-indigo-950/80 to-slate-900/80 border-2 border-cyan-500/40 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  Direct Mail ID Access Control & Data Erase Tool
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Convenors can directly approve any new email address to grant faculty access, or permanently delete student/erroneous accounts by Mail ID or Register Number.
                </p>
              </div>
            </div>

            {quickMailMsg && (
              <div className="p-3 bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-xs rounded-xl font-mono flex items-center justify-between gap-2">
                <span>{quickMailMsg}</span>
                <button onClick={() => setQuickMailMsg('')} className="text-zinc-400 hover:text-white text-xs">✕</button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
                <input
                  type="text"
                  value={quickMailInput}
                  onChange={(e) => setQuickMailInput(e.target.value)}
                  placeholder="Enter University Email ID or Reg No (e.g. 23btce234@gcu.edu.in)..."
                  className="w-full bg-[#0F011E] border border-white/10 focus:border-cyan-400 text-white font-mono text-xs pl-10 pr-4 py-2.5 rounded-xl focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleQuickApproveMail}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve Mail ID</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickDisapproveMail}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/50 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                  <span>Disapprove / Revoke</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickDeleteMail}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/50 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Data</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pending Approval Requests Table */}
          <div className="bg-[#1A032E] border-2 border-amber-500/40 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Pending Approval Requests ({pendingCoordinators.length})
              </h4>
            </div>

            {pendingCoordinators.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs italic">
                ✨ No pending faculty approval requests. All registered faculty are approved!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400 uppercase font-black text-[10px]">
                      <th className="py-3 px-3">Faculty ID / Name</th>
                      <th className="py-3 px-3">University Email</th>
                      <th className="py-3 px-3">Mobile No</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingCoordinators.map((coord) => (
                      <tr key={coord.facultyId} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-4 px-3 font-bold text-white">
                          <p className="text-sm">{coord.name}</p>
                          <p className="text-[10px] text-amber-400 font-mono mt-0.5">{coord.facultyId}</p>
                        </td>
                        <td className="py-4 px-3 font-mono text-cyan-300">{coord.email}</td>
                        <td className="py-4 px-3 font-mono text-zinc-300">{coord.mobile || 'N/A'}</td>
                        <td className="py-4 px-3 text-zinc-300">{coord.department}</td>
                        <td className="py-4 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => onApproveCoordinator && onApproveCoordinator(coord.facultyId, true)}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl text-xs flex items-center gap-1 shadow-lg cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleDeleteCoordinatorAccount(coord)}
                              className="px-3 py-1.5 bg-rose-500/20 border border-rose-500 hover:bg-rose-500 text-rose-300 hover:text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Reject & Delete Data</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Approved Coordinators List */}
          <div className="bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Approved Faculty Coordinators ({facultyCoordinators.filter(c => c.isApproved).length})
              </h4>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchApprovedFaculty}
                    onChange={(e) => setSearchApprovedFaculty(e.target.value)}
                    placeholder="Search approved faculty..."
                    className="w-full bg-[#0F011E] border border-white/10 text-white text-xs pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingFacultyModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-black font-black rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Pre-Approve New Faculty Email</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {facultyCoordinators
                .filter(c => c.isApproved)
                .filter(c => {
                  if (!searchApprovedFaculty.trim()) return true;
                  const q = searchApprovedFaculty.toLowerCase();
                  return (
                    c.name.toLowerCase().includes(q) ||
                    c.email.toLowerCase().includes(q) ||
                    c.facultyId.toLowerCase().includes(q) ||
                    c.department.toLowerCase().includes(q)
                  );
                })
                .map((coord) => (
                  <div key={coord.facultyId} className="p-4 bg-[#0F011E] border border-white/5 rounded-2xl space-y-2 relative flex flex-col justify-between hover:border-cyan-500/30 transition-all">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                          APPROVED
                        </span>
                        <span className="text-[10px] text-cyan-400 font-mono font-bold">{coord.facultyId}</span>
                      </div>
                      <h5 className="font-bold text-white text-sm">{coord.name}</h5>
                      <p className="text-xs text-zinc-400 font-mono">{coord.email}</p>
                      <p className="text-xs text-zinc-300 font-mono">📱 {coord.mobile || 'No Mobile set'}</p>
                      <p className="text-xs text-zinc-400">🏢 {coord.department}</p>
                      {(() => {
                        const coordEvts = events.filter(e => 
                          (e.coordinatorFacultyId && e.coordinatorFacultyId.toLowerCase() === coord.facultyId.toLowerCase()) ||
                          (e.coordinatorEmail && coord.email && isMatchingEmail(e.coordinatorEmail, coord.email)) ||
                          (e.coordinatorName && coord.name && (e.coordinatorName.toLowerCase().trim().includes(coord.name.toLowerCase().trim()) || coord.name.toLowerCase().trim().includes(e.coordinatorName.toLowerCase().trim())))
                        );
                        if (coordEvts.length === 0) return null;
                        return (
                          <div className="text-[11px] text-[#00D1FF] bg-[#00D1FF]/10 border border-[#00D1FF]/30 rounded-xl p-2 font-bold space-y-1 mt-1">
                            <span className="block text-[10px] uppercase tracking-wider text-zinc-300 font-black">Assigned Events ({coordEvts.length}):</span>
                            {coordEvts.map(ev => (
                              <span key={ev.id} className="block truncate text-white">• {ev.title}</span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleStartEditFaculty(coord)}
                        className="flex-1 py-1.5 px-2 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisapproveFaculty(coord)}
                        className="py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Disapprove access & move back to pending"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Disapprove</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCoordinatorAccount(coord)}
                        className="py-1.5 px-2 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Delete Faculty Coordinator & Erase Data"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB D: BROADCAST ANNOUNCEMENTS & DIRECT MESSAGES */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
          {/* Broadcast Form (To All Students / Registered Event Students) */}
          <div className="lg:col-span-6 bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-black text-white uppercase tracking-wider flex items-center gap-2 transform -rotate-1">
              <Megaphone className="w-5 h-5 text-[#FF007A]" />
              Broadcast Message to Students
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Broadcast urgent notifications directly to all students or students registered for a specific event.
            </p>

            {broadcastSuccess && (
              <div className="bg-[#00FFAB]/15 border border-[#00FFAB]/40 text-[#00FFAB] text-xs p-3.5 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00FFAB] animate-pulse" />
                <span>{broadcastSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSendBroadcast} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase">Target Audience *</label>
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium cursor-pointer"
                >
                  <option value="all">📢 All Students (Global Broadcast)</option>
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      🎯 Students in: {evt.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase">Announcement Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Venue Change Alert / Schedule Update"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase">Announcement Content *</label>
                <textarea
                  placeholder="Type broadcast notification content..."
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                  rows={4}
                  className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-sans leading-relaxed font-medium"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#FF007A] hover:opacity-95 text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl shadow-lg transition-all cursor-pointer shadow-[#FF007A]/25 flex items-center justify-center gap-2"
              >
                <Megaphone className="w-4 h-4" />
                <span>Publish Broadcast Announcement</span>
              </button>
            </form>
          </div>

          {/* Direct Memo to Faculty Coordinators */}
          <div className="lg:col-span-6 bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-black text-white uppercase tracking-wider flex items-center gap-2 transform -rotate-1">
              <Mail className="w-5 h-5 text-[#00D1FF]" />
              Dispatch Steering Directive to Coordinator
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Send direct guidelines, equipment checkmarks, or feedback inquiries to faculty heads.
            </p>

            {messageSuccess && (
              <div className="bg-[#00FFAB]/15 border border-[#00FFAB]/40 text-[#00FFAB] text-xs p-3.5 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00FFAB] animate-pulse" />
                <span>{messageSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase">Select Target Event / Faculty *</label>
                <select
                  value={messageCoordinatorId}
                  onChange={(e) => setMessageCoordinatorId(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-medium cursor-pointer"
                >
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.coordinatorFacultyId}>
                      {evt.title} ({evt.coordinatorName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase">Steering Directive Message *</label>
                <textarea
                  placeholder="Enter direct memo text here..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  className="w-full bg-[#0F011E] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF007A] text-xs font-sans leading-relaxed font-medium"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#00D1FF] hover:opacity-95 text-black font-black uppercase text-xs tracking-widest py-3 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Send Direct Memo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB E: TOPPERS & LEADERBOARD PICKER */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'leaderboard' && (
        <div className="bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2 transform -rotate-1">
                <Trophy className="w-5 h-5 text-amber-400" />
                Fresherism Overall Toppers Picker
              </h3>
              <p className="text-xs text-zinc-400">
                Calculates aggregate marks across all events to isolate top performing students for final university awards.
              </p>
            </div>

            {/* Toppers Selector & Export CSV */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={downloadLeaderboardCSV(students, scores, events)}
                download="fresherism_2026_leaderboard_results.csv"
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer border border-white/20"
              >
                <FileSpreadsheet className="w-4 h-4 text-black" />
                <span>Export Leaderboard Results (CSV)</span>
              </a>

              <span className="text-xs font-mono text-zinc-300">Select Top Count:</span>
              <div className="flex items-center gap-1 bg-[#0F011E] p-1 rounded-xl border border-white/10 text-xs font-bold">
                {[25, 50, 75, 100].map(count => (
                  <button
                    key={count}
                    onClick={() => setTopperCount(count)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      topperCount === count ? 'bg-[#FF007A] text-white font-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Top {count}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* EVENT APPROVAL & PUBLISHING STATUS CONTROL PANEL */}
          <div className="bg-[#0F011E] border border-white/10 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Event Results Publishing Controls (Convenor Approval)
            </h4>
            <p className="text-[11px] text-zinc-400">
              Leaderboard rankings reflect ONLY events approved and published by Convenor. Click <strong>"Yes Update Results"</strong> on any completed event to publish its marks to the live Leaderboard.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {events.map((evt) => (
                <div key={evt.id} className="bg-[#1A032E] border border-white/10 rounded-xl p-3 flex flex-col justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-white truncate">{evt.title}</p>
                    <p className="text-[10px] text-zinc-400">{evt.coordinatorName}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                    {evt.resultsPublished ? (
                      <span className="text-[10px] px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Published
                      </span>
                    ) : evt.reportedToConvenor ? (
                      <button
                        type="button"
                        onClick={() => setPublishConfirmModalEvent(evt)}
                        className="w-full text-[10px] px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black rounded-lg transition-all cursor-pointer border border-emerald-300 flex items-center justify-center gap-1 shadow-md animate-pulse"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Yes Update Results</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPublishConfirmModalEvent(evt)}
                        className="text-[10px] px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-bold cursor-pointer"
                        title="Publish scores to Leaderboard"
                      >
                        Publish Results
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3 px-2 text-center">Rank</th>
                  <th className="py-3 px-3">Student Details</th>
                  <th className="py-3 px-3">Department / School</th>
                  <th className="py-3 px-3">Campus</th>
                  <th className="py-3 px-3 text-center">Events Won 🏆</th>
                  <th className="py-3 px-3 text-center">Total Marks</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-zinc-500 italic">
                      No student records found.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const publishedEventIds = new Set(
                      events.filter(e => e.resultsPublished).map(e => e.id)
                    );

                    return students
                      .filter(student => student.registeredEventIds && student.registeredEventIds.length > 0)
                      .map(student => {
                        let total = 0;
                        const studentScores = scores.filter(
                          s => s.studentRegisterNo === student.registerNo && publishedEventIds.has(s.eventId)
                        );

                        student.registeredEventIds.forEach(eid => {
                          const isPublished = publishedEventIds.has(eid);
                          if (isPublished) {
                            const scoreRecord = scores.find(
                              sc => sc.studentRegisterNo === student.registerNo && sc.eventId === eid
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
                                total += (typeof scoreRecord.totalScore === 'number' && scoreRecord.totalScore > 0 ? scoreRecord.totalScore : (regPts + partPts + evScore));
                              } else {
                                total += 0; // Absent / Not participated in published event -> 0 points
                              }
                            } else {
                              total += 0; // Published event with no score record -> 0 points
                            }
                          } else {
                            total += 5; // Upcoming / pending event -> 5 registration points
                          }
                        });

                        const wins = studentScores.filter(s => s.isWinner).length;
                        return { student, total, wins, studentScores };
                      })
                      .sort((a, b) => b.total - a.total || b.wins - a.wins)
                      .slice(0, topperCount)
                      .map((item, index) => (
                        <tr 
                          key={item.student.registerNo}
                          className="border-b border-white/5 hover:bg-white/5 transition-all"
                        >
                          <td className="py-4 px-2 text-center font-black text-sm">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-mono text-xs ${
                              index === 0 ? 'bg-amber-400 text-black font-black' :
                              index === 1 ? 'bg-slate-300 text-black font-black' :
                              index === 2 ? 'bg-amber-700 text-white font-black' : 'bg-white/10 text-zinc-300'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <p className="text-white font-bold text-sm">{item.student.name}</p>
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{item.student.registerNo} | {item.student.email}</p>
                          </td>
                          <td className="py-4 px-3 text-zinc-300">{item.student.department} ({item.student.school})</td>
                          <td className="py-4 px-3 font-mono text-xs text-cyan-300">OMR Campus</td>
                          <td className="py-4 px-3 text-center font-bold text-amber-400">{item.wins > 0 ? `🏆 ${item.wins} Wins` : '-'}</td>
                          <td className="py-4 px-3 text-center font-mono font-black text-sm text-[#FF007A]">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentForBreakdown(item.student)}
                              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-amber-300 hover:text-amber-200 transition-all cursor-pointer font-bold inline-flex items-center gap-1.5"
                              title="Click to view detailed points breakdown per event"
                            >
                              <span>{item.total} Pts</span>
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                          </td>
                        </tr>
                      ));
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUBTAB: SCORE SHEETS DOWNLOAD CENTER */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'scoresheets' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#1A032E] border-2 border-[#00D1FF] rounded-3xl p-6 shadow-2xl space-y-2">
            <div className="flex items-center gap-3 text-[#00D1FF]">
              <FileSpreadsheet className="w-7 h-7 animate-pulse" />
              <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">
                Official Score Sheets Download Center
              </h2>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed max-w-3xl font-medium">
              Export official audit score sheets in Excel (.xlsx) format. Convenors can download score sheets for individual events, custom multi-event combinations, all university events, or the ranked list of top 100 students based on their cumulative score.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
            
            {/* 1. INDIVIDUAL EVENT SCORE SHEET */}
            <div className="bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between hover:border-[#00D1FF]/50 transition-all">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-[#00D1FF]">
                  <Award className="w-5 h-5" />
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    1. Individual Event Score Sheet
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Select a specific event from the festival to download its complete student marksheet, including registration points, participation status, and performance scores.
                </p>

                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-wider block">
                    Choose Festival Event:
                  </label>
                  <select
                    value={selectedSingleEventId || (events[0]?.id || '')}
                    onChange={(e) => setSelectedSingleEventId(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/15 focus:border-[#00D1FF] text-white font-bold text-xs rounded-xl px-3.5 py-3 focus:outline-none transition-all cursor-pointer"
                  >
                    {events.map(evt => (
                      <option key={evt.id} value={evt.id}>
                        {evt.title} ({formatDateDDMMYYYY(evt.date)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const targetId = selectedSingleEventId || events[0]?.id;
                    const targetEvt = events.find(e => e.id === targetId);
                    if (targetEvt) {
                      setPrintableScoreSheetEvent(targetEvt);
                    }
                  }}
                  className="px-3 py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>View / Print PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetId = selectedSingleEventId || events[0]?.id;
                    const targetEvt = events.find(e => e.id === targetId);
                    if (targetEvt) {
                      exportScoreSheetIndividual(targetEvt, students, scores);
                    }
                  }}
                  className="px-3 py-3 bg-gradient-to-r from-[#00D1FF] to-blue-600 hover:opacity-95 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel</span>
                </button>
              </div>
            </div>

            {/* 2. MULTIPLE SELECTED EVENTS SCORE SHEET */}
            <div className="bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between hover:border-pink-500/50 transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#FF007A]">
                    <CheckCircle2 className="w-5 h-5" />
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      2. Multiple Events Score Sheet
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMultipleEventIds(events.map(e => e.id))}
                      className="text-[10px] bg-white/10 hover:bg-white/20 text-zinc-200 font-bold px-2 py-1 rounded-lg transition-all"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMultipleEventIds([])}
                      className="text-[10px] bg-white/10 hover:bg-white/20 text-zinc-200 font-bold px-2 py-1 rounded-lg transition-all"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Select custom multiple events below to bundle their marksheets into a single multi-tab Excel workbook.
                </p>

                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-[#0F011E] rounded-xl border border-white/10">
                  {events.map(evt => {
                    const isChecked = selectedMultipleEventIds.includes(evt.id);
                    return (
                      <label 
                        key={evt.id} 
                        className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-xs transition-all ${
                          isChecked ? 'bg-[#FF007A]/20 text-white font-bold' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMultipleEventIds(prev => [...prev, evt.id]);
                            } else {
                              setSelectedMultipleEventIds(prev => prev.filter(id => id !== evt.id));
                            }
                          }}
                          className="accent-[#FF007A] w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="truncate">{evt.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={selectedMultipleEventIds.length === 0}
                onClick={() => {
                  const targetEvents = events.filter(e => selectedMultipleEventIds.includes(e.id));
                  exportScoreSheetsMultiple(targetEvents, students, scores);
                }}
                className={`w-full mt-4 px-4 py-3 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20 ${
                  selectedMultipleEventIds.length > 0 
                    ? 'bg-gradient-to-r from-[#FF007A] to-purple-600 hover:opacity-95 text-white' 
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Download Selected ({selectedMultipleEventIds.length}) Score Sheets (.xlsx)</span>
              </button>
            </div>

            {/* 3. FROM ALL EVENTS MASTER SCORE SHEET */}
            <div className="bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between hover:border-emerald-500/50 transition-all">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    3. Master Score Sheet (All Events)
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Download a complete master Excel workbook containing worksheets for all {events.length} festival events along with a master consolidated score matrix sheet.
                </p>
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-300 font-mono">
                  📊 Includes all registered students, marks breakdown, and winner / runner-up status labels across all {events.length} events.
                </div>
              </div>

              <button
                type="button"
                onClick={() => exportScoreSheetsAll(events, students, scores)}
                className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20"
              >
                <Download className="w-4 h-4" />
                <span>Download Master Score Sheet (All {events.length} Events) (.xlsx)</span>
              </button>
            </div>

            {/* 4. TOP 100 OVERALL TOPPERS SCORE SHEET */}
            <div className="bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between hover:border-amber-400/50 transition-all">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <Trophy className="w-5 h-5" />
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    4. Top 100 Overall Leaderboard Score Sheet
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Download the official top 100 student merit rank spreadsheet calculated by aggregate total scores, event participation counts, and championship titles.
                </p>
                <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-[11px] text-amber-300 font-mono">
                  🏆 Ranked list of top 100 students based on their cumulative score
                </div>
              </div>

              <button
                type="button"
                onClick={() => exportScoreSheetsTop100(students, scores, events, 100)}
                className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-amber-400 to-amber-600 hover:opacity-95 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20"
              >
                <Download className="w-4 h-4" />
                <span>Download Top 100 Leaderboard Score Sheet (.xlsx)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUBTAB: MASTER DATA & CAP LIMIT COMPLIANCE AUDIT */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'capaudit' && (
        <div className="space-y-8 animate-fadeIn font-sans">
          {/* Header */}
          <div className="bg-[#1A032E] border-2 border-amber-500/50 rounded-3xl p-6 shadow-2xl space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-amber-400">
                <UserCheck className="w-8 h-8 shrink-0" />
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">
                    Master Student Data & Cap Limit Compliance Audit
                  </h2>
                  <p className="text-xs text-zinc-300 font-medium mt-0.5">
                    Upload master student lists, inspect registration caps per department, and configure occasion certificate templates.
                  </p>
                </div>
              </div>

              {occasions && occasions.length > 0 && onSelectOccasion && (
                <div className="flex items-center gap-2 bg-[#0F011E] p-2 rounded-2xl border border-amber-500/30">
                  <span className="text-xs font-bold text-amber-300 pl-2">Select Occasion:</span>
                  <select
                    value={activeOccasion?.id || ''}
                    onChange={(e) => onSelectOccasion(e.target.value)}
                    className="bg-purple-950 text-white text-xs font-extrabold rounded-xl px-3 py-2 border border-purple-500/40 focus:outline-none"
                  >
                    {occasions.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.title} (Cap: {o.capLimit} events)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 1. Upload Master Student Data */}
            <div className="bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-cyan-400 border-b border-white/10 pb-3">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  1. Upload Master Student Sheet
                </h3>
              </div>
              <p className="text-xs text-zinc-300">
                Upload or paste student master data for <strong className="text-amber-300">{activeOccasion?.title || 'Active Occasion'}</strong> to enforce event registration cap limits.
              </p>

              {/* Master student count indicator */}
              <div className="p-4 bg-[#0F011E] rounded-2xl border border-purple-500/30 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-zinc-400 font-mono uppercase">Master Roster Total</p>
                  <p className="text-xl font-extrabold text-amber-300">
                    {activeOccasion?.masterStudents?.length || 0} Eligible Students Uploaded
                  </p>
                </div>
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold">
                  Cap Limit: {activeOccasion?.capLimit || 3} Events
                </span>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-300 block">Upload CSV / Excel Master Sheet:</label>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                    const masterList: StudentMasterRecord[] = [];
                    lines.forEach((line, idx) => {
                      if (idx === 0 && line.toLowerCase().includes('register')) return; // header
                      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
                      if (parts.length >= 3) {
                        masterList.push({
                          registerNo: parts[0] || `REG-${idx}`,
                          name: parts[1] || 'Student',
                          email: parts[2] || 'student@gcu.edu.in',
                          department: parts[3] || 'General',
                          programName: parts[4] || 'UG Program'
                        });
                      }
                    });
                    if (masterList.length > 0 && onUploadMasterStudents) {
                      onUploadMasterStudents(masterList);
                      alert(`Successfully imported ${masterList.length} master student records!`);
                    }
                  }}
                  className="w-full text-xs text-zinc-300 bg-[#0F011E] p-3 rounded-xl border border-white/10"
                />
              </div>

              {/* Quick sample seed button */}
              <button
                type="button"
                onClick={() => {
                  if (onUploadMasterStudents) {
                    onUploadMasterStudents([
                      { registerNo: '24GCU001', name: 'Aarav Sharma', email: 'aarav.sharma@gcu.edu.in', department: 'Computer Science', programName: 'B.Tech CSE' },
                      { registerNo: '24GCU002', name: 'Ananya Rao', email: 'ananya.rao@gcu.edu.in', department: 'Computer Science', programName: 'B.Tech CSE' },
                      { registerNo: '24GCU003', name: 'Rohan Verma', email: 'rohan.verma@gcu.edu.in', department: 'Management', programName: 'BBA' },
                      { registerNo: '24GCU004', name: 'Priya Nair', email: 'priya.nair@gcu.edu.in', department: 'Life Sciences', programName: 'B.Sc Biotech' },
                      { registerNo: '24GCU005', name: 'Kiran Kumar', email: 'kiran.kumar@gcu.edu.in', department: 'Media Studies', programName: 'BA Journalism' },
                      { registerNo: '24GCU006', name: 'Vikram Singh', email: 'vikram.singh@gcu.edu.in', department: 'Computer Science', programName: 'BCA' },
                      { registerNo: '24GCU007', name: 'Sneha Patel', email: 'sneha.patel@gcu.edu.in', department: 'Management', programName: 'MBA' }
                    ]);
                    alert('Loaded sample master student roster!');
                  }
                }}
                className="w-full py-2.5 bg-purple-900/40 hover:bg-purple-800/50 border border-purple-500/40 text-purple-200 text-xs font-bold rounded-xl transition-all"
              >
                Load Default Master Roster Seed
              </button>
            </div>

            {/* 2. Certificate Background Template Settings */}
            <div className="bg-[#1A032E] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-pink-400 border-b border-white/10 pb-3">
                <Award className="w-5 h-5" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  2. Participation Certificate Template
                </h3>
              </div>
              <p className="text-xs text-zinc-300">
                Upload or set the participation certificate template image URL for <strong className="text-pink-300">{activeOccasion?.title || 'Active Occasion'}</strong>.
              </p>

              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-300 block">Certificate Template Image URL or Upload:</label>
                <input
                  type="text"
                  placeholder="https://example.com/certificate-template.png or image data"
                  value={activeOccasion?.certificateTemplateUrl || ''}
                  onChange={(e) => {
                    if (onUpdateOccasionCertificate) {
                      onUpdateOccasionCertificate(e.target.value);
                    }
                  }}
                  className="w-full bg-[#0F011E] border border-white/10 text-white rounded-xl px-4 py-2.5 text-xs font-mono"
                />

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const dataUrl = evt.target?.result as string;
                        if (dataUrl && onUpdateOccasionCertificate) {
                          onUpdateOccasionCertificate(dataUrl);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-xs text-zinc-300 bg-[#0F011E] p-2.5 rounded-xl border border-white/10"
                />
              </div>

              {/* Template Preview */}
              {activeOccasion?.certificateTemplateUrl ? (
                <div className="relative border-2 border-amber-500/40 rounded-2xl overflow-hidden p-2 bg-black/40">
                  <img
                    src={activeOccasion.certificateTemplateUrl}
                    alt="Certificate Template Preview"
                    className="w-full h-32 object-contain rounded-lg"
                  />
                  <span className="absolute top-3 right-3 bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                    Template Ready
                  </span>
                </div>
              ) : (
                <div className="p-6 bg-purple-950/30 border border-dashed border-purple-500/40 rounded-2xl text-center text-xs text-purple-300">
                  No custom template set. Students will receive default high-contrast GCU certificate design!
                </div>
              )}
            </div>
          </div>

          {/* 3. CAP LIMIT AUDIT RESULTS BY DEPARTMENT */}
          <div className="bg-[#1A032E] border-2 border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  Department-Wise Cap Limit Audit Report
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  Students from Master Roster who registered for LESS THAN the required <strong className="text-amber-300">{activeOccasion?.capLimit || 3} Events</strong> for {activeOccasion?.title}.
                </p>
              </div>

              <span className="px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold">
                Cap Requirement: Minimum {activeOccasion?.capLimit || 3} Registrations
              </span>
            </div>

            {/* Compute Under-registered students */}
            {(() => {
              const masterList = activeOccasion?.masterStudents || [];
              const capLimit = activeOccasion?.capLimit || 3;

              // map master student to their current registered events count in system
              const auditedList = masterList.map(ms => {
                const sysStudent = students.find(s => 
                  (s.registerNo && ms.registerNo && s.registerNo.toLowerCase() === ms.registerNo.toLowerCase()) || 
                  (s.email && ms.email && s.email.toLowerCase() === ms.email.toLowerCase())
                );
                const regCount = sysStudent ? sysStudent.registeredEventIds.length : 0;
                return {
                  ...ms,
                  regCount,
                  isUnderCap: regCount < capLimit
                };
              });

              const underCapStudents = auditedList.filter(s => s.isUnderCap);

              // Group by department
              const deptGroups: Record<string, typeof underCapStudents> = {};
              underCapStudents.forEach(s => {
                const dept = s.department || 'Unassigned';
                if (!deptGroups[dept]) deptGroups[dept] = [];
                deptGroups[dept].push(s);
              });

              const deptNames = Object.keys(deptGroups);

              if (deptNames.length === 0) {
                return (
                  <div className="p-8 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h4 className="text-base font-bold text-emerald-300">All Students Compliant!</h4>
                    <p className="text-xs text-zinc-300">Every student in the uploaded master roster has met or exceeded the event cap limit!</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-2xl">
                      <p className="text-xs text-amber-300 font-bold">Non-Compliant Students</p>
                      <p className="text-2xl font-black text-amber-400 mt-1">{underCapStudents.length} Students</p>
                    </div>
                    <div className="p-4 bg-purple-950/30 border border-purple-500/40 rounded-2xl">
                      <p className="text-xs text-purple-300 font-bold">Departments Deficient</p>
                      <p className="text-2xl font-black text-purple-200 mt-1">{deptNames.length} Departments</p>
                    </div>
                    <div className="p-4 bg-blue-950/30 border border-blue-500/40 rounded-2xl">
                      <p className="text-xs text-cyan-300 font-bold">Cap Requirement</p>
                      <p className="text-2xl font-black text-cyan-200 mt-1">{capLimit} Events Minimum</p>
                    </div>
                  </div>

                  {/* Department Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {deptNames.map(dept => {
                      const deptStudents = deptGroups[dept];
                      return (
                        <div key={dept} className="bg-[#0F011E] border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-lg">
                          <div className="flex justify-between items-center border-b border-white/10 pb-3">
                            <div>
                              <h4 className="font-extrabold text-white text-base">{dept}</h4>
                              <p className="text-xs text-amber-300">{deptStudents.length} Students Under Cap</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const names = deptStudents.map(s => `${s.name} (${s.registerNo})`).join(', ');
                                if (onAddNotification) {
                                  onAddNotification({
                                    id: `notif-dept-${Date.now()}`,
                                    eventId: 'global',
                                    eventTitle: `Cap Limit Warning - ${dept}`,
                                    title: `URGENT: Registration Cap Limit Warning for ${dept}`,
                                    content: `Notice to ${dept} students: Minimum ${capLimit} event registrations required. The following students must complete event registrations: ${names}`,
                                    timestamp: new Date().toISOString().substring(0, 16),
                                    senderName: 'Convenor HQ'
                                  });
                                  alert(`Warning notification sent to ${dept} department students!`);
                                }
                              }}
                              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-black font-black text-xs rounded-xl shadow-md flex items-center gap-1.5"
                            >
                              <Megaphone className="w-3.5 h-3.5" /> Send Warning to Dept
                            </button>
                          </div>

                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {deptStudents.map(s => (
                              <div key={s.registerNo} className="p-2.5 bg-purple-950/40 border border-purple-800/30 rounded-xl flex items-center justify-between text-xs">
                                <div>
                                  <p className="font-bold text-white">{s.name}</p>
                                  <p className="text-[10px] text-zinc-400 font-mono">{s.registerNo} | {s.programName}</p>
                                </div>
                                <span className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-bold text-[10px] rounded-lg">
                                  {s.regCount} / {capLimit} Events
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUBTAB: SECURITY SETTINGS */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'security' && (
        <div className="max-w-2xl mx-auto bg-[#1A032E] border-2 border-[#FF007A] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="border-b border-white/10 pb-4 flex items-center gap-3">
            <div className="p-3 bg-[#FF007A]/20 border border-[#FF007A]/50 rounded-2xl text-[#FF007A]">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight italic">
                Convenor Security Credentials
              </h3>
              <p className="text-xs text-zinc-400">
                Update your registered Convenor email and security password for HQ access.
              </p>
            </div>
          </div>

          {securityErrorMsg && (
            <div className="bg-rose-950/40 border-l-4 border-rose-500 text-rose-200 text-xs p-4 rounded-r-xl flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{securityErrorMsg}</span>
            </div>
          )}

          {securitySuccessMsg && (
            <div className="bg-emerald-950/40 border-l-4 border-emerald-500 text-emerald-200 text-xs p-4 rounded-r-xl flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{securitySuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveSecurity} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-300 uppercase tracking-wider block">
                Registered Convenor Email ID:
              </label>
              <input
                type="email"
                value={convenorSecurityEmail}
                onChange={(e) => setConvenorSecurityEmail(e.target.value)}
                placeholder="convenor@gcu.edu.in"
                className="w-full bg-[#0F011E] border border-white/10 focus:border-[#FF007A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all"
                required
              />
              <p className="text-[11px] text-zinc-400">
                This email will be used for Convenor password reset and official communications.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-zinc-300 uppercase tracking-wider block">
                  New Password:
                </label>
                <input
                  type="password"
                  placeholder="Enter new password (min 6 chars)"
                  value={convenorNewPass}
                  onChange={(e) => setConvenorNewPass(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/10 focus:border-[#FF007A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-zinc-300 uppercase tracking-wider block">
                  Confirm New Password:
                </label>
                <input
                  type="password"
                  placeholder="Re-type new password"
                  value={convenorConfirmPass}
                  onChange={(e) => setConvenorConfirmPass(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/10 focus:border-[#FF007A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                type="submit"
                className="bg-gradient-to-r from-[#FF007A] to-violet-600 hover:opacity-95 text-white font-black uppercase tracking-widest py-3 px-8 rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2 text-xs"
              >
                <Check className="w-4 h-4" />
                <span>Save Security Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A032E] border-2 border-[#FF007A] rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-xl font-black text-white uppercase italic transform -rotate-1 flex items-center gap-2">
                <Edit3 className="text-[#FF007A] w-5 h-5" />
                Edit Event Data
              </h3>
              <button 
                onClick={() => setEditingEvent(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg bg-black/40 border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditEvent} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">Event Title</label>
                  <input 
                    type="text" 
                    value={editingEvent.title} 
                    onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                    required 
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">Host Department</label>
                  <input 
                    type="text" 
                    value={editingEvent.hostDepartment} 
                    onChange={e => setEditingEvent({ ...editingEvent, hostDepartment: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-mono uppercase block mb-1">Description</label>
                <textarea 
                  value={editingEvent.description} 
                  onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white h-20"
                  required 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">Date</label>
                  <input 
                    type="date" 
                    value={editingEvent.date} 
                    onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                    required 
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">Start Time</label>
                  <input 
                    type="time" 
                    value={editingEvent.timeStart} 
                    onChange={e => setEditingEvent({ ...editingEvent, timeStart: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                    required 
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">End Time</label>
                  <input 
                    type="time" 
                    value={editingEvent.timeEnd} 
                    onChange={e => setEditingEvent({ ...editingEvent, timeEnd: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">Venue</label>
                  <input 
                    type="text" 
                    value={editingEvent.venue} 
                    onChange={e => setEditingEvent({ ...editingEvent, venue: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                    required 
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">Coordinator Faculty ID</label>
                  <input 
                    type="text" 
                    value={editingEvent.coordinatorFacultyId} 
                    onChange={e => setEditingEvent({ ...editingEvent, coordinatorFacultyId: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">Faculty Coordinator Name</label>
                  <input 
                    type="text" 
                    value={editingEvent.coordinatorName} 
                    onChange={e => setEditingEvent({ ...editingEvent, coordinatorName: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                    required 
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">Mobile</label>
                  <input 
                    type="text" 
                    value={editingEvent.coordinatorMobile} 
                    onChange={e => setEditingEvent({ ...editingEvent, coordinatorMobile: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                    required 
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-mono uppercase block mb-1">Email (@gcu.edu.in)</label>
                  <input 
                    type="email" 
                    value={editingEvent.coordinatorEmail} 
                    onChange={e => setEditingEvent({ ...editingEvent, coordinatorEmail: e.target.value })}
                    className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="text-[#00D1FF] font-mono uppercase block mb-1">Student Coordinator Name(s)</label>
                <input 
                  type="text" 
                  value={editingEvent.studentCoordinatorName || ''} 
                  onChange={e => setEditingEvent({ ...editingEvent, studentCoordinatorName: e.target.value })}
                  placeholder="e.g. Akash (24BCAR243) & Pricilla Raj"
                  className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-mono uppercase block mb-1">Event Rules</label>
                <textarea 
                  value={editingEvent.rules} 
                  onChange={e => setEditingEvent({ ...editingEvent, rules: e.target.value })}
                  className="w-full bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white h-20"
                  required 
                />
              </div>

              <div>
                <label className="text-zinc-400 font-mono uppercase block mb-1">Brochure / Poster Image URL or File Upload</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={editingEvent.brochureUrl || editingEvent.imageUrl || ''} 
                    onChange={e => setEditingEvent({ ...editingEvent, brochureUrl: e.target.value, imageUrl: e.target.value })}
                    placeholder="https://example.com/brochure.jpg or choose file to upload"
                    className="flex-1 bg-[#0F011E] border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                  <label className="px-3.5 py-2 bg-[#FF007A] text-white font-black text-xs rounded-xl cursor-pointer hover:bg-[#FF007A]/80 flex items-center gap-1.5 shrink-0 shadow-md">
                    <span>Upload Poster</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const dataUrl = evt.target?.result as string;
                            if (dataUrl) {
                              setEditingEvent({
                                ...editingEvent,
                                brochureUrl: dataUrl,
                                imageUrl: dataUrl
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-4 py-2 bg-black/40 border border-white/10 text-zinc-300 rounded-xl font-bold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF007A] text-white font-black rounded-xl hover:bg-[#FF007A]/80 shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT FACULTY MEMBER MODAL (FOR CONVENOR) */}
      {editingFaculty && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A032E] border-2 border-cyan-400 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative my-8 font-sans">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded">
                    CONVENOR FACULTY MANAGEMENT
                  </span>
                  <h3 className="text-md font-black text-white mt-0.5">Edit Faculty Coordinator Profile</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingFaculty(null)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editCoordError && (
              <div className="p-3 bg-rose-950/80 border border-rose-500 text-rose-200 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{editCoordError}</span>
              </div>
            )}

            {editCoordSuccess && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{editCoordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveFacultyByConvenor} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Faculty Name *</label>
                  <input
                    type="text"
                    required
                    value={editCoordName}
                    onChange={(e) => setEditCoordName(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-white font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Faculty ID *</label>
                  <input
                    type="text"
                    required
                    value={editCoordId}
                    onChange={(e) => setEditCoordId(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-cyan-300 font-mono font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={editCoordMobile}
                    onChange={(e) => setEditCoordMobile(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-white font-mono font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">University Email *</label>
                  <input
                    type="email"
                    required
                    value={editCoordEmail}
                    onChange={(e) => setEditCoordEmail(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-cyan-300 font-mono font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Department</label>
                  <input
                    type="text"
                    value={editCoordDepartment}
                    onChange={(e) => setEditCoordDepartment(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-cyan-400 text-white font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingFaculty(null)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-lg hover:opacity-90 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Faculty Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ➕ PRE-APPROVE NEW FACULTY MEMBER MODAL (FOR CONVENOR) */}
      {isAddingFacultyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A032E] border-2 border-emerald-400 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative my-8 font-sans">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">
                    CONVENOR AUTHORIZATION
                  </span>
                  <h3 className="text-md font-black text-white mt-0.5">Pre-Approve Faculty Email ID</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingFacultyModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Pre-approved faculty members can log in directly using Microsoft 365 or email sign-in without waiting for approval.
            </p>

            {addFacError && (
              <div className="p-3 bg-rose-950/80 border border-rose-500 text-rose-200 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{addFacError}</span>
              </div>
            )}

            {addFacSuccess && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{addFacSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddPreApprovedFaculty} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Faculty Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Smita Sharma"
                    value={addFacName}
                    onChange={(e) => setAddFacName(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Faculty ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FAC-105"
                    value={addFacId}
                    onChange={(e) => setAddFacId(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-cyan-300 font-mono font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">University Email (<span className="lowercase font-semibold">@gcu.edu.in</span>) *</label>
                  <input
                    type="email"
                    required
                    placeholder="faculty@gcu.edu.in"
                    value={addFacEmail}
                    onChange={(e) => setAddFacEmail(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-cyan-300 font-mono font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={addFacMobile}
                    onChange={(e) => setAddFacMobile(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-mono font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science & Engineering"
                    value={addFacDepartment}
                    onChange={(e) => setAddFacDepartment(e.target.value)}
                    className="w-full bg-[#0F011E] border border-white/20 focus:border-emerald-400 text-white font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingFacultyModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-black rounded-xl text-xs uppercase shadow-lg hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pre-Approve Faculty</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Score Sheet Printable Modal */}
      {printableScoreSheetEvent && (
        <OfficialScoreSheetModal
          event={printableScoreSheetEvent}
          registeredStudents={students.filter(s => s.registeredEventIds?.includes(printableScoreSheetEvent.id))}
          scores={scores.filter(sc => sc.eventId === printableScoreSheetEvent.id || (sc.eventTitle && printableScoreSheetEvent.title && sc.eventTitle.trim().toLowerCase() === printableScoreSheetEvent.title.trim().toLowerCase()))}
          occasionTitle={activeOccasion?.title || 'Fresherism 2K26'}
          onClose={() => setPrintableScoreSheetEvent(null)}
        />
      )}

      {/* CONFIRMATION MODAL FOR "YES UPDATE RESULTS" */}
      {publishConfirmModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1A032E] border-2 border-emerald-500 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Confirm Leaderboard Update</h3>
                <p className="text-xs text-emerald-400 font-bold">Convenor Final Approval Step</p>
              </div>
            </div>

            <div className="bg-[#0F011E] border border-white/10 p-4 rounded-2xl space-y-2 text-xs font-sans">
              <p className="text-white font-bold text-sm">{publishConfirmModalEvent.title}</p>
              <p className="text-zinc-300"><strong>Host Department:</strong> {publishConfirmModalEvent.hostDepartment}</p>
              <p className="text-zinc-300"><strong>Faculty Coordinator:</strong> {publishConfirmModalEvent.coordinatorName}</p>
              <p className="text-zinc-300"><strong>Date & Venue:</strong> {formatDateDDMMYYYY(publishConfirmModalEvent.date)} ({publishConfirmModalEvent.venue})</p>
              <p className="text-zinc-300"><strong>Registered Students:</strong> {students.filter(s => s.registeredEventIds?.includes(publishConfirmModalEvent.id)).length}</p>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs space-y-1">
              <p className="font-extrabold flex items-center gap-1.5 text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-400" /> Ready to Update Leaderboard?
              </p>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                Clicking "Yes Update Results" will approve the evaluation scores for this event and immediately update the official student rankings on the live Leaderboard.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setPublishConfirmModalEvent(null)}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePublishEventResults(publishConfirmModalEvent)}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer border border-emerald-300 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Yes, Update Results</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT EVENT POINTS BREAKDOWN MODAL */}
      {selectedStudentForBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1A032E] border-2 border-[#00D1FF] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Points Breakdown: {selectedStudentForBreakdown.name}
                </h3>
                <p className="text-xs text-amber-300 font-mono mt-0.5">
                  Register No: {selectedStudentForBreakdown.registerNo} | {selectedStudentForBreakdown.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForBreakdown(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200">
                <strong>Leaderboard Rule:</strong> Points are ONLY awarded for events that have been conducted AND officially approved/published by Convenor ("Yes Update Results").
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-black text-zinc-300 uppercase tracking-wider">Registered Events & Score Status</h4>
                {selectedStudentForBreakdown.registeredEventIds.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-4 text-center">Student has not registered for any events yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedStudentForBreakdown.registeredEventIds.map(eid => {
                      const evt = events.find(e => e.id === eid);
                      const scoreRec = scores.find(s => s.studentRegisterNo === selectedStudentForBreakdown.registerNo && s.eventId === eid);
                      const isPublished = evt?.resultsPublished;

                      return (
                        <div key={eid} className="bg-[#0F011E] border border-white/10 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="font-bold text-white text-sm">{evt?.title || eid}</p>
                            <p className="text-zinc-400 text-[11px]">Host Dept: {evt?.hostDepartment || 'N/A'}</p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {isPublished ? (
                              (() => {
                                const isPart = Boolean(
                                  scoreRec?.participated || 
                                  (scoreRec?.participationPoints ?? 0) > 0 || 
                                  (scoreRec?.eventScore ?? 0) > 0 || 
                                  scoreRec?.scoreEntered
                                );
                                const pts = isPart ? (scoreRec?.totalScore ?? scoreRec?.eventScore ?? 0) : 0;
                                return (
                                  <div className="text-right">
                                    <span className={`inline-block px-2.5 py-0.5 border text-[10px] rounded-full font-bold ${
                                      isPart ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                    }`}>
                                      {isPart ? '✓ Results Published (Participated)' : '✗ Results Published (Absent / Not Participated)'}
                                    </span>
                                    <p className={`font-mono font-black text-sm mt-0.5 ${isPart ? 'text-amber-400' : 'text-zinc-500'}`}>
                                      +{pts} Pts
                                    </p>
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="text-right">
                                <span className="inline-block px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] rounded-full font-bold">
                                  Event Pending (Upcoming)
                                </span>
                                <p className="font-mono font-bold text-amber-400 text-xs mt-0.5">
                                  +5 Pts (Registration)
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedStudentForBreakdown(null)}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}