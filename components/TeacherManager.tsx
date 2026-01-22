
import React, { useState, useEffect } from 'react';
import { Teacher, PREDEFINED_COLORS, UserRole } from '../types';
import * as dataService from '../services/dataService';
import { UserPlus, Trash2, Edit2, Heart, BookOpen, X, RefreshCw, ShieldAlert, CheckCircle, Users, Loader2 } from 'lucide-react';

interface Props {
    currentRole: UserRole;
}

export const TeacherManager: React.FC<Props> = ({ currentRole }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);
  const [todayDate, setTodayDate] = useState('');
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = () => {
    const currentTeachers = dataService.getTeachers();
    setTeachers(currentTeachers);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA');
    setTodayDate(dateStr);
    setDailyAttendance(dataService.getAttendanceForDate(dateStr));
  };

  useEffect(() => {
    loadData();

    // Listen for cloud updates
    const handleDataUpdate = () => {
        loadData();
    };

    window.addEventListener('data-updated', handleDataUpdate);
    return () => window.removeEventListener('data-updated', handleDataUpdate);
  }, []);

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await dataService.fetchAllData();
      loadData();
      setIsRefreshing(false);
  };

  const resetForm = () => {
    setEditId(null);
    setName('');
    setSelectedColor(PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)]);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;

    setIsSaving(true);
    const teacherData: Teacher = {
      id: editId || Date.now().toString(),
      name: name.trim(),
      initials: name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      color: selectedColor,
      subjectsTaught: []
    };

    try {
        await dataService.saveTeacher(teacherData);
        // dataService now triggers 'data-updated', which calls loadData via our useEffect
        resetForm();
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Profile Saved Successfully", type: 'success' } }));
    } catch (err) {
        console.error(err);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Failed to Save", type: 'error' } }));
    } finally {
        setIsSaving(false);
    }
  };

  const handleEdit = (teacher: Teacher) => {
    if (currentRole !== 'PRINCIPAL') return;
    setEditId(teacher.id);
    setName(teacher.name);
    setSelectedColor(teacher.color);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (currentRole !== 'PRINCIPAL') return;
    if (confirm('Delete this teacher profile from the school database?')) {
      await dataService.deleteTeacher(id);
      loadData();
      if (editId === id) resetForm();
    }
  };

  const toggleAttendance = async (teacher: Teacher, status: 'present' | 'absent') => {
      await dataService.markTeacherAttendance(todayDate, teacher.id, status);
      loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header with Sync Controls */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
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
        <button 
            onClick={handleManualRefresh} 
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
        >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing...' : 'Refresh List'}
        </button>
      </div>

      {currentRole === 'PRINCIPAL' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 animate-pop-in">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand-600" />
              {editId ? 'Modify Staff Record' : 'Create New Teacher Profile'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Full Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                className="w-full text-sm h-11 bg-black border border-slate-700 text-white rounded-xl px-4" 
                                placeholder="Enter teacher's name..." 
                                disabled={isSaving}
                                required 
                            />
                        </div>
                        <div className="pt-2">
                             <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                                Teacher profiles are shared across all school devices instantly.
                             </p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">UI Theme Color</label>
                        <div className="grid grid-cols-6 gap-3 bg-slate-50 dark:bg-black p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
                            {PREDEFINED_COLORS.map(c => (
                                <button 
                                    key={c} 
                                    type="button" 
                                    onClick={() => setSelectedColor(c)} 
                                    disabled={isSaving}
                                    className={`w-full aspect-square rounded-full border-2 transition-all ${selectedColor === c ? 'border-brand-500 scale-110 shadow-lg ring-4 ring-brand-500/10' : 'border-transparent hover:scale-105'}`} 
                                    style={{ backgroundColor: c }} 
                                />
                            ))}
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium">This color will represent the teacher in the timetable grid.</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-800">
                    <button 
                        type="button" 
                        onClick={resetForm} 
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        Discard Changes
                    </button>
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className="bg-brand-600 text-white px-12 py-3 rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-2"
                    >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSaving ? 'Saving Profile...' : (editId ? 'Update Profile' : 'Publish to Cloud')}
                    </button>
                </div>
            </form>
          </div>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {teachers.length > 0 ? teachers.map(teacher => {
            const isAbsent = dailyAttendance[teacher.id] === 'absent';
            return (
              <div key={teacher.id} className={`group bg-white dark:bg-slate-900 rounded-[2rem] p-6 border-2 transition-all duration-300 hover:shadow-xl ${isAbsent ? 'border-red-500 bg-red-50/10' : 'border-slate-100 dark:border-slate-800 hover:border-brand-500'}`}>
                 <div className="flex items-center gap-4 mb-5">
                     <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl transform group-hover:rotate-6 transition-transform" style={{ backgroundColor: teacher.color }}>{teacher.initials}</div>
                     <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate text-base leading-tight">{teacher.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className={`w-2 h-2 rounded-full ${isAbsent ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isAbsent ? 'text-red-500' : 'text-green-500'}`}>{isAbsent ? 'Absent Today' : 'On Duty'}</span>
                        </div>
                     </div>
                 </div>
                 
                 <div className="flex gap-2">
                    <button 
                        onClick={() => toggleAttendance(teacher, 'present')} 
                        className={`flex-1 h-10 rounded-xl text-[9px] font-black transition-all ${!isAbsent ? 'bg-green-600 text-white shadow-lg scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-green-50'}`}
                    >
                        PRESENT
                    </button>
                    <button 
                        onClick={() => toggleAttendance(teacher, 'absent')} 
                        className={`flex-1 h-10 rounded-xl text-[9px] font-black transition-all ${isAbsent ? 'bg-red-600 text-white shadow-lg scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-red-50'}`}
                    >
                        ABSENT
                    </button>
                 </div>

                 {currentRole === 'PRINCIPAL' && (
                    <div className="flex justify-between items-center mt-5 pt-4 border-t dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Profile ID: {teacher.id.substring(0,6)}</span>
                        <div className="flex gap-1">
                            <button onClick={() => handleEdit(teacher)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(teacher.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                 )}
              </div>
            );
        }) : (
            <div className="col-span-full py-20 flex flex-col items-center text-center opacity-50">
                <Users className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-400">No staff profiles found.</h3>
                <p className="text-sm text-slate-400 max-w-xs mt-2">Start by creating teacher profiles to build your school management database.</p>
            </div>
        )}
      </div>

      <div className="pt-12 pb-6 flex flex-col items-center opacity-30">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
            <span>Verified S.S.C.S Database Registry</span>
            <Heart className="w-3 h-3 text-red-500 fill-current" />
        </div>
      </div>
    </div>
  );
};
