
import React, { useState, useEffect } from 'react';
import { Teacher, PREDEFINED_COLORS, UserRole, AttendanceStatus, SCHOOL_LOGO_URL } from '../types';
import * as dataService from '../services/dataService';
// Fix: Added Save to the lucide-react imports
import { UserPlus, Trash2, Edit2, CheckCircle, ShieldAlert, RefreshCw, Loader2, Users, Save } from 'lucide-react';

interface Props {
    currentRole: UserRole;
}

export const TeacherManager: React.FC<Props> = ({ currentRole }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);

  const loadData = async () => {
    setIsLoading(true);
    try {
        const fetched = await dataService.getTeachers();
        setTeachers(fetched);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;

    setIsSaving(true);
    const teacherData: Teacher = {
      id: Date.now().toString(),
      name: name.trim(),
      initials: name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      color: selectedColor,
      subjectsTaught: []
    };

    try {
        await dataService.saveTeacher(teacherData);
        setName('');
        await loadData();
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (currentRole !== 'PRINCIPAL') return;
    if (confirm('Delete this teacher profile?')) {
      setIsLoading(true);
      await dataService.deleteTeacher(id);
      await loadData();
    }
  };

  const toggleAttendance = async (teacher: Teacher, status: AttendanceStatus) => {
      setIsLoading(true);
      await dataService.markTeacherAttendance(new Date().toLocaleDateString('en-CA'), teacher.id, status);
      await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 w-full">
            <div className={`p-2 rounded-lg ${currentRole === 'PRINCIPAL' ? 'bg-brand-50 text-brand-600' : 'bg-amber-50 text-amber-600'}`}>
                {currentRole === 'PRINCIPAL' ? <CheckCircle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {currentRole === 'PRINCIPAL' ? 'Administrator Access' : 'Management (View Only)'}
                </h2>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                    {teachers.length} Active Staff Profiles
                </p>
            </div>
        </div>
        <button onClick={loadData} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync Cloud
        </button>
      </div>

      {currentRole === 'PRINCIPAL' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 animate-pop-in">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand-600" /> Create New Teacher Profile
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">Full Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm h-11" placeholder="Enter name..." disabled={isSaving} required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">Theme Color</label>
                        <div className="flex gap-2">
                            {PREDEFINED_COLORS.slice(0, 6).map(c => (
                                <button key={c} type="button" onClick={() => setSelectedColor(c)} className={`w-8 h-8 rounded-full border-2 ${selectedColor === c ? 'border-brand-500' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                </div>
                <button type="submit" disabled={isSaving} className="w-full bg-brand-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-brand-700 flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Saving to Cloud...' : 'Publish Profile'}
                </button>
            </form>
          </div>
      )}

      {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest">Loading staff database...</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {teachers.map(teacher => (
              <div key={teacher.id} className="group bg-white dark:bg-slate-900 rounded-[2rem] p-6 border-2 border-slate-100 dark:border-slate-800 hover:border-brand-500 transition-all">
                 <div className="flex items-center gap-4 mb-5">
                     <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg" style={{ backgroundColor: teacher.color }}>{teacher.initials}</div>
                     <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate flex-1">{teacher.name}</h3>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={() => toggleAttendance(teacher, 'absent')} className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase">Leave</button>
                     <button onClick={() => handleDelete(teacher.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                 </div>
              </div>
            ))}
          </div>
      )}
    </div>
  );
};
