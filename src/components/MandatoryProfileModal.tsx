import React, { useState, useEffect, FormEvent } from 'react';
import { Student, FacultyCoordinator } from '../types';
import { User, ShieldCheck, CheckCircle2, Building2, Phone, Mail, BookOpen, GraduationCap } from 'lucide-react';

interface MandatoryProfileModalProps {
  isOpen: boolean;
  student: Student | null;
  faculty: FacultyCoordinator | null;
  onSaveStudent: (student: Student) => void;
  onSaveFaculty: (faculty: FacultyCoordinator) => void;
  onClose?: () => void;
}

export const MandatoryProfileModal: React.FC<MandatoryProfileModalProps> = ({
  isOpen,
  student,
  faculty,
  onSaveStudent,
  onSaveFaculty,
  onClose
}) => {
  if (!isOpen) return null;

  // Faculty takes priority if present, otherwise student
  const isStudent = Boolean(student && !faculty);
  const isExternal = isStudent && (student?.isExternal || false);

  // Student & Faculty Form State
  const [name, setName] = useState(faculty?.name || student?.name || '');
  const [email, setEmail] = useState(faculty?.email || student?.email || '');
  const [mobile, setMobile] = useState(faculty?.mobile || student?.mobile || '');
  const [registerNo, setRegisterNo] = useState(student?.registerNo || '');
  const [school, setSchool] = useState(faculty?.school || student?.school || 'Garden City University');
  const [department, setDepartment] = useState(faculty?.department || student?.department || '');
  const [programName, setProgramName] = useState(student?.programName || '');
  const [tShirtSize, setTShirtSize] = useState(student?.tShirtSize || 'M');
  const [externalCollegeName, setExternalCollegeName] = useState(student?.externalCollegeName || '');
  const [facultyId, setFacultyId] = useState(faculty?.facultyId || '');
  const [formError, setFormError] = useState('');

  // Sync state whenever student or faculty props change
  useEffect(() => {
    if (faculty) {
      setName(faculty.name || '');
      setEmail(faculty.email || '');
      setMobile(faculty.mobile || '');
      setFacultyId(faculty.facultyId || '');
      setSchool(faculty.school || 'Garden City University');
      setDepartment(faculty.department || '');
    } else if (student) {
      setName(student.name || '');
      setEmail(student.email || '');
      setMobile(student.mobile || '');
      setRegisterNo(student.registerNo || '');
      setSchool(student.school || 'Garden City University');
      setDepartment(student.department || '');
      setProgramName(student.programName || '');
      setTShirtSize(student.tShirtSize || 'M');
      setExternalCollegeName(student.externalCollegeName || '');
    }
  }, [student, faculty]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter your Full Name.');
      return;
    }
    if (!mobile.trim() || mobile.trim().length < 8) {
      setFormError('Please enter a valid Mobile Number.');
      return;
    }

    if (!isStudent && faculty) {
      if (!facultyId.trim()) {
        setFormError('Please enter your Faculty ID.');
        return;
      }
      if (!department.trim()) {
        setFormError('Please enter your Department.');
        return;
      }

      const updatedFaculty: FacultyCoordinator = {
        ...faculty,
        name: name.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        facultyId: facultyId.trim(),
        school: school.trim(),
        department: department.trim(),
        isProfileComplete: true
      };

      onSaveFaculty(updatedFaculty);
    } else if (isStudent && student) {
      if (isExternal && !externalCollegeName.trim()) {
        setFormError('Please enter your College / School / University Name.');
        return;
      }
      if (!registerNo.trim()) {
        setFormError('Please enter your Register / Roll Number.');
        return;
      }

      const updatedStudent: Student = {
        ...student,
        name: name.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        registerNo: registerNo.trim(),
        school: school.trim(),
        department: department.trim(),
        programName: programName.trim(),
        tShirtSize: tShirtSize,
        externalCollegeName: externalCollegeName.trim(),
        isProfileComplete: true
      };

      onSaveStudent(updatedStudent);
    }

    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1A032E] border-2 border-[#00D1FF] rounded-3xl max-w-xl w-full p-6 md:p-8 space-y-6 shadow-2xl my-8 relative overflow-hidden">
        
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="p-3 bg-[#00D1FF]/20 border border-[#00D1FF]/40 rounded-2xl text-[#00D1FF]">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <span className="bg-[#00D1FF] text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider">
              MANDATORY PROFILE SETUP
            </span>
            <h3 className="text-xl font-black text-white italic tracking-wide mt-1">
              {!isStudent ? 'Faculty Registration Details' : (isExternal ? 'External Participant Profile' : 'Internal Student Profile')}
            </h3>
          </div>
        </div>

        <p className="text-xs text-zinc-300">
          Some of your contact or academic profile details (Mobile/Email/Program) are currently empty. Please update them below, or skip to proceed directly to your dashboard.
        </p>

        {formError && (
          <div className="p-3 bg-rose-950/80 border border-rose-500 text-rose-200 text-xs rounded-xl font-bold">
            ⚠️ {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Full Name */}
            <div>
              <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none font-mono"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
              />
            </div>

            {/* Register No / Faculty ID */}
            <div>
              <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                {isStudent ? 'Register / Roll Number *' : 'Faculty ID *'}
              </label>
              <input
                type="text"
                required
                placeholder={isStudent ? 'e.g. 26ANSHUMAN.K' : 'e.g. FAC-101'}
                value={isStudent ? registerNo : facultyId}
                onChange={(e) => isStudent ? setRegisterNo(e.target.value) : setFacultyId(e.target.value)}
                className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none font-mono uppercase"
              />
            </div>

            {/* External College Name */}
            {isStudent && isExternal && (
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                  College / School / University Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. St. Joseph's University / RV College of Engineering"
                  value={externalCollegeName}
                  onChange={(e) => setExternalCollegeName(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>
            )}

            {/* School / Institution */}
            {(!isExternal || !isStudent) && (
              <div>
                <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                  School / Faculty Institution
                </label>
                <input
                  type="text"
                  placeholder="e.g. School of CS & IT"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>
            )}

            {/* Department */}
            <div>
              <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                Department
              </label>
              <input
                type="text"
                placeholder="e.g. Computer Science"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
              />
            </div>

            {/* Program Name for Students */}
            {isStudent && (
              <div>
                <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest block mb-1">
                  Program Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. B.Tech CSE / BBA"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="w-full bg-[#0F011E] border border-white/20 focus:border-[#00D1FF] text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>
            )}

            {/* T-Shirt Size for Students */}
            {isStudent && (
              <div>
                <label className="text-[10px] font-black text-amber-300 uppercase tracking-widest block mb-1">
                  👕 Marathon / Official T-Shirt Size
                </label>
                <select
                  value={tShirtSize}
                  onChange={(e) => setTShirtSize(e.target.value)}
                  className="w-full bg-[#0F011E] border border-amber-400/50 focus:border-amber-400 text-white font-bold rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                >
                  <option value="S">Small (S)</option>
                  <option value="M">Medium (M)</option>
                  <option value="L">Large (L)</option>
                  <option value="XL">Extra Large (XL)</option>
                  <option value="XXL">Double Extra Large (XXL)</option>
                  <option value="3XL">Triple Extra Large (3XL)</option>
                </select>
              </div>
            )}

          </div>

          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (isStudent && student) {
                  onSaveStudent({
                    ...student,
                    isProfileComplete: true
                  });
                } else if (!isStudent && faculty) {
                  onSaveFaculty({
                    ...faculty,
                    isProfileComplete: true
                  });
                }
                if (onClose) onClose();
              }}
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-zinc-200 font-bold text-xs uppercase py-3.5 px-5 rounded-xl transition-all cursor-pointer text-center"
            >
              Skip & Go to Dashboard →
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto bg-gradient-to-r from-[#00D1FF] via-purple-600 to-[#FF007A] text-white font-black text-xs uppercase py-3.5 px-6 rounded-xl shadow-xl hover:opacity-90 transition-all cursor-pointer"
            >
              Confirm & Save Profile →
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
