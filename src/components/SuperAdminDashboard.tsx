import React, { useState } from 'react';
import { Occasion } from '../types';
import { Plus, Edit2, Trash2, CheckCircle, Calendar, ShieldCheck, UserCheck, Mail, Sparkles, Building2, Upload, FileText, Download, Image as ImageIcon, FileCode, Key, Eye, EyeOff } from 'lucide-react';
import { generateSampleWordTemplateDocx, inspectDocxTemplate, getGeminiApiKey, setGeminiApiKey, testGeminiApiKey } from './DocxTemplateHelper';
import { formatDateDDMMYYYY, formatDateRangeDDMMYYYY } from '../dateUtils';

interface SuperAdminDashboardProps {
  occasions: Occasion[];
  activeOccasionId: string;
  onSelectActiveOccasion: (id: string) => void;
  onSaveOccasion: (occasion: Occasion) => void;
  onDeleteOccasion: (id: string) => void;
  onSignOut: () => void;
  theme: string;
  onToggleTheme: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  occasions,
  activeOccasionId,
  onSelectActiveOccasion,
  onSaveOccasion,
  onDeleteOccasion,
  onSignOut,
  theme,
  onToggleTheme
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState<Partial<Occasion> | null>(null);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>(() => getGeminiApiKey());
  const [geminiTestStatus, setGeminiTestStatus] = useState<string>('');
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [showKeyVisible, setShowKeyVisible] = useState<boolean>(false);

  const handleSaveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    setGeminiKeyInput(key);
    setGeminiTestStatus('✅ Gemini API Key saved successfully to browser storage!');
    setTimeout(() => setGeminiTestStatus(''), 3500);
  };

  const handleTestGeminiKey = async () => {
    setIsTestingKey(true);
    setGeminiTestStatus('Testing Gemini AI connection...');
    const res = await testGeminiApiKey(geminiKeyInput);
    setIsTestingKey(false);
    if (res.success) {
      setGeminiTestStatus(res.message);
    } else {
      setGeminiTestStatus('⚠️ ' + res.message);
    }
  };

  const handleOpenNew = () => {
    setEditingOccasion({
      id: 'occ-' + Date.now(),
      title: '',
      eventDates: 'AUG 3 – 15, 2026',
      fromDate: '2026-08-03',
      toDate: '2026-08-15',
      logoUrl: '',
      brochureUrl: '',
      description: 'Annual Student Activities & Festival Event.',
      chiefGuestName: 'Dr. N. C. Shivaprakash',
      chiefGuestPhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
      chiefGuestDescription: 'Former Professor, IISc Bangalore & Distinguished Academician',
      chiefGuestData: '',
      convenorName: 'Prof. Ashwini. S',
      convenorEmail: 'ashwini.s@gcu.edu.in',
      capLimit: 3,
      isOpenToExternal: true,
      isCompleted: false,
      certificateTemplateUrl: '',
      reportFormatUrl: '',
    });
    setShowModal(true);
  };

  const handleEdit = (occ: Occasion) => {
    setEditingOccasion({ ...occ });
    setShowModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof Occasion) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. File Size Guard (cap at 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert(`⚠️ File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please select a template under 5 MB.`);
      return;
    }

    // 2. Word .docx format validation
    if ((fieldName === 'certificateTemplateUrl' || fieldName === 'reportFormatUrl') && !file.name.toLowerCase().endsWith('.docx') && !file.name.toLowerCase().endsWith('.doc')) {
      alert('⚠️ Invalid file format! Please upload a Microsoft Word (.docx) file.');
      return;
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onerror = () => alert('❌ Error reading image file. Please try again.');
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          // Scale image down to max 350px so data URL is tiny (~15-30KB) and fits in Firestore + LocalStorage without payload limits
          const maxDim = 350;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.65);
            setEditingOccasion(prev => (prev ? { ...prev, [fieldName]: compressed } : null));
          } else {
            setEditingOccasion(prev => (prev ? { ...prev, [fieldName]: event.target?.result as string } : null));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onerror = () => alert('❌ Error reading uploaded document. Please try again.');
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setEditingOccasion(prev => (prev ? { ...prev, [fieldName]: dataUrl } : null));

          // Run inspection on uploaded docx template
          if (fieldName === 'certificateTemplateUrl' || fieldName === 'reportFormatUrl') {
            const inspect = inspectDocxTemplate(dataUrl);
            console.log(`📜 [SUPER ADMIN UPLOAD] ${fieldName} inspect result:`, inspect);
            if (!inspect.isValid) {
              alert(`⚠️ Warning: Uploaded file may be corrupt or invalid .docx zip:\n${inspect.error}`);
            } else {
              const tagsList = inspect.placeholders.length > 0 ? inspect.placeholders.join(', ') : 'No placeholder tags found';
              alert(`✓ Template Uploaded Successfully!\n\n• File: ${file.name} (${(inspect.byteSize / 1024).toFixed(1)} KB)\n• Format: ${inspect.hasCurly ? 'Curly Braces {tag}' : ''} ${inspect.hasSquare ? 'Square Brackets [tag]' : ''}\n• Detected Tags: ${tagsList}\n\nIMPORTANT: Click "Save Festival / Occasion" below to finalize and commit this template!`);
            }
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadSampleWord = async (type: 'certificate' | 'report') => {
    const title = editingOccasion?.title || 'Fresherism 2026';
    await generateSampleWordTemplateDocx(type, title);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOccasion) return;

    if (!editingOccasion.title || !editingOccasion.title.trim()) {
      alert('Please enter a valid Occasion Title.');
      return;
    }

    const titleClean = editingOccasion.title.trim();
    const preparedOccasion: Occasion = {
      id: editingOccasion.id || ('occ-' + Date.now()),
      title: titleClean,
      eventDates: editingOccasion.eventDates || `${editingOccasion.fromDate || '2026-08-03'} – ${editingOccasion.toDate || '2026-08-15'}`,
      fromDate: editingOccasion.fromDate || '2026-08-03',
      toDate: editingOccasion.toDate || '2026-08-15',
      logoUrl: editingOccasion.logoUrl || '',
      brochureUrl: editingOccasion.brochureUrl || '',
      description: editingOccasion.description || '',
      chiefGuestName: editingOccasion.chiefGuestName || '',
      chiefGuestPhotoUrl: editingOccasion.chiefGuestPhotoUrl || '',
      chiefGuestDescription: editingOccasion.chiefGuestDescription || '',
      chiefGuestData: editingOccasion.chiefGuestData || '',
      convenorName: editingOccasion.convenorName?.trim() || 'Prof. Ashwini. S',
      convenorEmail: editingOccasion.convenorEmail?.trim() || 'ashwini.s@gcu.edu.in',
      capLimit: Number(editingOccasion.capLimit) || 3,
      isOpenToExternal: editingOccasion.isOpenToExternal ?? true,
      isCompleted: editingOccasion.isCompleted ?? false,
      certificateTemplateUrl: editingOccasion.certificateTemplateUrl || '',
      reportFormatUrl: editingOccasion.reportFormatUrl || '',
      masterStudents: editingOccasion.masterStudents || []
    };

    onSaveOccasion(preparedOccasion);
    setShowModal(false);
    setEditingOccasion(null);

    setSaveNotification(`✅ Occasion "${preparedOccasion.title}" saved successfully to Cloud Database & Local Storage!`);
    setTimeout(() => {
      setSaveNotification(null);
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-[#0F011E] text-white p-4 md:p-8 font-sans transition-colors duration-200">
      
      {/* Toast Notification Banner */}
      {saveNotification && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-emerald-950/90 border-2 border-emerald-500 text-emerald-200 text-sm font-bold rounded-2xl shadow-2xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            <span>{saveNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveNotification(null)}
            className="text-emerald-400 hover:text-white font-bold text-xs bg-emerald-900/50 px-2.5 py-1 rounded-lg border border-emerald-700/50"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1A032E] p-6 rounded-2xl border border-purple-800/40 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-600/30 rounded-xl border border-purple-500/40 text-purple-300">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SUPER ADMIN
              </span>
              <span className="text-xs text-purple-300">System Management</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-1">
              Occasions & Event Portal Dashboard
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-purple-500/40 bg-purple-900/30 text-purple-200 hover:bg-purple-800/40 transition-colors"
          >
            Theme: {theme === 'sunny-light' ? 'Sunny Light' : theme === 'gcu' ? 'GCU Maroon' : 'Neon Dark'}
          </button>
          <button
            onClick={handleOpenNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Add New Occasion
          </button>
          <button
            onClick={onSignOut}
            className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Occasions List Grid */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-purple-200 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> Active & Upcoming Occasions ({occasions.length})
          </h2>
          <p className="text-xs text-purple-300">
            Select an occasion to make it active across student & faculty views.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {occasions.map((occ) => {
            const isPrimary = occ.id === activeOccasionId;
            const isVisibleOnCarousel = isPrimary || occ.isActive === true;
            return (
              <div
                key={occ.id}
                className={`relative flex flex-col justify-between p-6 rounded-2xl border transition-all ${
                  isPrimary
                    ? 'bg-purple-900/40 border-purple-400 shadow-2xl shadow-purple-900/50 ring-2 ring-purple-400'
                    : isVisibleOnCarousel
                    ? 'bg-[#1A032E] border-pink-500/50 hover:border-pink-400'
                    : 'bg-[#120022] border-purple-950 opacity-75 hover:opacity-100'
                }`}
              >
                {isPrimary && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-black rounded-full shadow-md flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> PRIMARY ACTIVE FESTIVAL
                  </div>
                )}
                {!isPrimary && isVisibleOnCarousel && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-black rounded-full shadow-md flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> VISIBLE ON CAROUSEL
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    {occ.logoUrl ? (
                      <img
                        src={occ.logoUrl}
                        alt={occ.title}
                        className="w-12 h-12 rounded-xl object-contain bg-white/10 p-1 border border-purple-500/30"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-purple-800/40 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-lg">
                        {occ.title.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-extrabold text-white">{occ.title}</h3>
                      <p className="text-xs text-amber-300 flex items-center gap-1 mt-0.5 font-semibold">
                        <Calendar className="w-3 h-3 text-amber-400" /> {formatDateRangeDDMMYYYY(occ.fromDate, occ.toDate, occ.eventDates || '03-08-2026 – 15-08-2026')}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-purple-200/90 line-clamp-3 mb-4 bg-purple-950/40 p-3 rounded-xl border border-purple-900/30">
                    {occ.description || 'No description provided.'}
                  </p>

                  <div className="space-y-2 text-xs text-purple-200 border-t border-purple-800/30 pt-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-400 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> Convenor:
                      </span>
                      <span className="font-semibold text-white">{occ.convenorName || 'Not Assigned'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-400 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> Convenor Email:
                      </span>
                      <span className="font-mono text-purple-300 text-[11px]">{occ.convenorEmail || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-purple-900/30">
                      <span className="text-purple-400">Carousel Status:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${isVisibleOnCarousel ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                        {isVisibleOnCarousel ? 'Active on Carousel' : 'Hidden from Carousel'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-800/40 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      onSaveOccasion({ ...occ, isActive: true });
                      onSelectActiveOccasion(occ.id);
                    }}
                    disabled={isPrimary}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                      isPrimary
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                        : 'bg-purple-700/40 hover:bg-purple-600/50 text-white border border-purple-500/30'
                    }`}
                  >
                    {isPrimary ? 'Primary Active' : 'Make Primary Active'}
                  </button>

                  <button
                    onClick={() => handleEdit(occ)}
                    className="p-2 text-purple-300 bg-purple-800/30 hover:bg-purple-700/40 border border-purple-600/30 rounded-xl transition-colors"
                    title="Edit Occasion Details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {occasions.length > 1 && (
                    <button
                      onClick={() => onDeleteOccasion(occ.id)}
                      className="p-2 text-rose-300 bg-rose-900/30 hover:bg-rose-800/40 border border-rose-600/30 rounded-xl transition-colors"
                      title="Delete Occasion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Modal - High Z-Index & Clean Floating Overlay */}
      {showModal && editingOccasion && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A032E] border-2 border-purple-500/60 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto text-white">
            
            <div className="flex justify-between items-center border-b border-purple-800/40 pb-4 sticky top-0 bg-[#1A032E] z-10 pt-1">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  {editingOccasion.id && occasions.some(o => o.id === editingOccasion.id)
                    ? 'Edit Occasion Details & Media Formats'
                    : 'Create New Event Occasion'}
                </h3>
                <p className="text-xs text-purple-300 mt-0.5">Manage logo, brochure, calendar dates, chief guest details, and Word templates</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-purple-400 hover:text-white text-xl font-bold p-2 bg-purple-900/40 rounded-xl border border-purple-700/50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              
              {/* 1. Occasion Title */}
              <div>
                <label className="block text-xs font-extrabold text-purple-200 uppercase tracking-wider mb-1">
                  Occasion Title (e.g., Fresherism-26, Gardenia-26, Independence Day) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresherism-26"
                  value={editingOccasion.title || ''}
                  onChange={(e) => setEditingOccasion({ ...editingOccasion, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-purple-950/80 border border-purple-700/50 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* 1.5. Carousel Visibility Toggle & Status */}
              <div className="bg-purple-950/60 p-4 rounded-2xl border border-purple-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold text-white uppercase tracking-wider block">
                    Landing Page Carousel Status
                  </span>
                  <p className="text-[11px] text-purple-300">
                    Controls whether this festival appears on the student portal landing page banner carousel.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingOccasion({ ...editingOccasion, isActive: !editingOccasion.isActive })}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    editingOccasion.isActive || editingOccasion.id === activeOccasionId
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg border border-emerald-400'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white'
                  }`}
                >
                  {editingOccasion.isActive || editingOccasion.id === activeOccasionId ? '✓ Active on Carousel' : '✕ Hidden from Carousel'}
                </button>
              </div>

              {/* 2. Logo & Brochure Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-950/40 p-4 rounded-2xl border border-purple-800/40">
                
                {/* Logo Upload */}
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-amber-400" /> Occasion Logo</span>
                    {editingOccasion.logoUrl && <span className="text-[10px] text-emerald-400 font-mono">Uploaded ✓</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Logo URL or paste image link"
                    value={editingOccasion.logoUrl || ''}
                    onChange={(e) => setEditingOccasion({ ...editingOccasion, logoUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/80 border border-purple-700/50 text-white text-xs mb-2 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex-1 px-3 py-2 bg-purple-800/40 hover:bg-purple-700/60 text-purple-200 border border-purple-600/40 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-amber-300" /> Upload Logo File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'logoUrl')}
                        className="hidden"
                      />
                    </label>
                    {editingOccasion.logoUrl && (
                      <img src={editingOccasion.logoUrl} alt="Logo Preview" className="w-8 h-8 rounded-lg object-contain bg-black/40 border border-purple-500/40" />
                    )}
                  </div>
                </div>

                {/* Brochure Upload */}
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-cyan-400" /> Event Brochure</span>
                    {editingOccasion.brochureUrl && <span className="text-[10px] text-emerald-400 font-mono">Uploaded ✓</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Brochure PDF / Doc URL link"
                    value={editingOccasion.brochureUrl || ''}
                    onChange={(e) => setEditingOccasion({ ...editingOccasion, brochureUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/80 border border-purple-700/50 text-white text-xs mb-2 focus:outline-none"
                  />
                  <label className="w-full px-3 py-2 bg-purple-800/40 hover:bg-purple-700/60 text-purple-200 border border-purple-600/40 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-cyan-300" /> Upload Brochure (.pdf/.doc/.png)
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,image/*"
                      onChange={(e) => handleFileUpload(e, 'brochureUrl')}
                      className="hidden"
                    />
                  </label>
                </div>

              </div>

              {/* 3. Calendar Option for From Date & To Date */}
              <div className="bg-purple-950/40 p-4 rounded-2xl border border-purple-800/40 space-y-3">
                <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-400" /> Event Calendar & Schedule Options
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-300 mb-1">
                      Event From Date (Calendar) *
                    </label>
                    <input
                      type="date"
                      required
                      value={editingOccasion.fromDate || '2026-08-03'}
                      onChange={(e) => setEditingOccasion({ ...editingOccasion, fromDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white font-semibold text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-300 mb-1">
                      Event To Date (Calendar) *
                    </label>
                    <input
                      type="date"
                      required
                      value={editingOccasion.toDate || '2026-08-15'}
                      onChange={(e) => setEditingOccasion({ ...editingOccasion, toDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white font-semibold text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-300 mb-1">
                      Event Display Date String
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. AUG 3 – 15, 2026"
                      value={editingOccasion.eventDates || ''}
                      onChange={(e) => setEditingOccasion({ ...editingOccasion, eventDates: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white font-semibold text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Chief Guest Photo & Details */}
              <div className="bg-purple-950/40 p-4 rounded-2xl border border-purple-800/40 space-y-3">
                <span className="text-xs font-extrabold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-purple-400" /> Chief Guest Details & Photo
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-300 mb-1">
                      Chief Guest Name
                    </label>
                    <input
                      type="text"
                      placeholder="Dr. N. C. Shivaprakash"
                      value={editingOccasion.chiefGuestName || ''}
                      onChange={(e) => setEditingOccasion({ ...editingOccasion, chiefGuestName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-300 mb-1 flex items-center justify-between">
                      <span>Chief Guest Photo</span>
                      {editingOccasion.chiefGuestPhotoUrl && <span className="text-[10px] text-emerald-400 font-mono">Uploaded ✓</span>}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Photo URL link"
                        value={editingOccasion.chiefGuestPhotoUrl || ''}
                        onChange={(e) => setEditingOccasion({ ...editingOccasion, chiefGuestPhotoUrl: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white text-xs focus:outline-none"
                      />
                      <label className="px-3 py-2 bg-purple-800/40 hover:bg-purple-700/60 text-purple-200 border border-purple-600/40 rounded-xl text-xs font-bold cursor-pointer shrink-0">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'chiefGuestPhotoUrl')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-purple-300 mb-1">
                    Chief Guest Designation / Short Tagline
                  </label>
                  <input
                    type="text"
                    placeholder="Former Professor, IISc Bangalore & Distinguished Academician"
                    value={editingOccasion.chiefGuestDescription || ''}
                    onChange={(e) => setEditingOccasion({ ...editingOccasion, chiefGuestDescription: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-purple-300 mb-1">
                    About Chief Guest (Detailed Write-Up / Profile)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Write a detailed bio or background about the chief guest..."
                    value={editingOccasion.chiefGuestData || ''}
                    onChange={(e) => setEditingOccasion({ ...editingOccasion, chiefGuestData: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* 5. Convenor Details */}
              <div className="bg-purple-950/40 p-4 rounded-2xl border border-purple-800/40 space-y-3">
                <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-400" /> Event Convenor Details
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-300 mb-1">
                      Convenor Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Prof. Ashwini. S"
                      value={editingOccasion.convenorName || ''}
                      onChange={(e) => setEditingOccasion({ ...editingOccasion, convenorName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white text-xs focus:outline-none focus:border-amber-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-300 mb-1">
                      Convenor Official Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="ashwini.s@gcu.edu.in"
                      value={editingOccasion.convenorEmail || ''}
                      onChange={(e) => setEditingOccasion({ ...editingOccasion, convenorEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white text-xs focus:outline-none focus:border-amber-400 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Festival Overview Description */}
              <div className="bg-purple-950/40 p-4 rounded-2xl border border-purple-800/40 space-y-2">
                <label className="block text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
                  Festival Overview & Highlights Text
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the flagship festival events, cultural performances, and technical showcases..."
                  value={editingOccasion.description || ''}
                  onChange={(e) => setEditingOccasion({ ...editingOccasion, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-purple-950/90 border border-purple-700/50 text-white text-xs focus:outline-none"
                />
              </div>

              {/* 5. Word Document Templates: Certificate & Report Formats */}
              <div className="bg-purple-950/40 p-4 rounded-2xl border border-purple-800/40 space-y-3">
                <span className="text-xs font-extrabold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-blue-400" /> Word Templates (.docx) for Certificates & Reports
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Certificate Template in Word Format */}
                  <div className="bg-purple-900/30 p-3 rounded-xl border border-purple-700/40 space-y-2">
                    <label className="block text-xs font-bold text-purple-200 flex items-center justify-between">
                      <span>📜 Certificate Template (.docx)</span>
                      {editingOccasion.certificateTemplateUrl && <span className="text-[10px] text-emerald-400 font-mono">Ready ✓</span>}
                    </label>
                    <label className="w-full py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all">
                      <Upload className="w-3.5 h-3.5 text-blue-300" /> Upload Word Certificate (.docx)
                      <input
                        type="file"
                        accept=".docx,.doc"
                        onChange={(e) => handleFileUpload(e, 'certificateTemplateUrl')}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDownloadSampleWord('certificate')}
                      className="w-full py-1.5 bg-black/40 hover:bg-black/60 text-purple-300 border border-purple-700/40 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                    >
                      <Download className="w-3 h-3 text-amber-300" /> Download Sample Certificate Word Template
                    </button>
                  </div>

                  {/* Report Format in Word Format */}
                  <div className="bg-purple-900/30 p-3 rounded-xl border border-purple-700/40 space-y-2">
                    <label className="block text-xs font-bold text-purple-200 flex items-center justify-between">
                      <span>📄 Report Format (.docx)</span>
                      {editingOccasion.reportFormatUrl && <span className="text-[10px] text-emerald-400 font-mono">Ready ✓</span>}
                    </label>
                    <label className="w-full py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all">
                      <Upload className="w-3.5 h-3.5 text-purple-300" /> Upload Word Report Format (.docx)
                      <input
                        type="file"
                        accept=".docx,.doc"
                        onChange={(e) => handleFileUpload(e, 'reportFormatUrl')}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDownloadSampleWord('report')}
                      className="w-full py-1.5 bg-black/40 hover:bg-black/60 text-purple-300 border border-purple-700/40 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                    >
                      <Download className="w-3 h-3 text-cyan-300" /> Download Sample Report Word Format
                    </button>
                  </div>

                </div>
              </div>

              {/* 5B. Gemini AI Integration for Event Reports */}
              <div className="bg-gradient-to-r from-blue-950/60 to-purple-950/60 p-4 rounded-2xl border border-blue-600/40 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                    🤖 Gemini AI Key for Auto-Generating Report Objectives & Descriptions
                  </span>
                  {getGeminiApiKey() && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black rounded-md">
                      Configured ✓
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  When coordinators click <strong className="text-cyan-300 font-bold">"Generate Report (.docx)"</strong>, Gemini AI automatically analyzes the event details and writes tailored academic objectives, executive descriptions, and key outcomes.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Key className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type={showKeyVisible ? 'text' : 'password'}
                      placeholder="AIzaSy... (Gemini API Key)"
                      value={geminiKeyInput}
                      onChange={(e) => setGeminiKeyInput(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 rounded-xl bg-black/60 border border-blue-500/40 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyVisible(!showKeyVisible)}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white cursor-pointer"
                      title={showKeyVisible ? 'Hide Key' : 'Show Key'}
                    >
                      {showKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveGeminiKey(geminiKeyInput)}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    Save Key
                  </button>

                  <button
                    type="button"
                    disabled={isTestingKey || !geminiKeyInput.trim()}
                    onClick={handleTestGeminiKey}
                    className="px-4 py-2 bg-purple-600/40 hover:bg-purple-600/70 border border-purple-400/50 text-purple-200 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isTestingKey ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>

                {geminiTestStatus && (
                  <div className={`p-2.5 rounded-xl text-xs font-semibold ${geminiTestStatus.includes('Successfully') || geminiTestStatus.includes('✅') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}`}>
                    {geminiTestStatus}
                  </div>
                )}
              </div>

              {/* 6. Convenor & Capacity Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">
                    Convenor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Prof. Convenor Name"
                    value={editingOccasion.convenorName || ''}
                    onChange={(e) => setEditingOccasion({ ...editingOccasion, convenorName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/80 border border-purple-700/50 text-white font-semibold text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">
                    Convenor Email (<span className="lowercase font-semibold">@gcu.edu.in</span>) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="convenor@gcu.edu.in"
                    value={editingOccasion.convenorEmail || ''}
                    onChange={(e) => setEditingOccasion({ ...editingOccasion, convenorEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/80 border border-purple-700/50 text-white font-semibold text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">
                    Cap Limit (Min Student Regs) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editingOccasion.capLimit ?? 3}
                    onChange={(e) => setEditingOccasion({ ...editingOccasion, capLimit: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/80 border border-purple-700/50 text-white font-semibold text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 bg-purple-950/40 p-3 rounded-xl border border-purple-800/40">
                <input
                  type="checkbox"
                  id="isOpenToExternal"
                  checked={editingOccasion.isOpenToExternal ?? true}
                  onChange={(e) => setEditingOccasion({ ...editingOccasion, isOpenToExternal: e.target.checked })}
                  className="w-4 h-4 rounded border-purple-600 bg-purple-950 accent-purple-500 cursor-pointer"
                />
                <label htmlFor="isOpenToExternal" className="text-xs font-bold text-cyan-200 cursor-pointer">
                  🌐 Open to External Participants (Allows Gmail sign in for students outside GCU)
                </label>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="isCompleted"
                  checked={editingOccasion.isCompleted || false}
                  onChange={(e) => setEditingOccasion({ ...editingOccasion, isCompleted: e.target.checked })}
                  className="w-4 h-4 rounded border-purple-600 bg-purple-950 accent-purple-500 cursor-pointer"
                />
                <label htmlFor="isCompleted" className="text-xs font-bold text-purple-200 cursor-pointer">
                  Mark Occasion as Completed (Enables Occasion Gallery & Certificates)
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-purple-800/40">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-purple-700/50 text-purple-300 hover:bg-purple-900/40 text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold shadow-lg hover:from-purple-500 hover:to-pink-500 cursor-pointer"
                >
                  Save Occasion
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
