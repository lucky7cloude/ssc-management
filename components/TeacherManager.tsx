
import React, { useState, useEffect } from 'react';
import { Teacher, PREDEFINED_COLORS, UserRole } from '../types';
import * as dataService from '../services/dataService';
import { UserPlus, Trash2, Edit2, Heart, BookOpen, X } from 'lucide-react';

interface Props {
    currentRole: UserRole;
}

export const TeacherManager: React.FC<Props> = ({ currentRole }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);
  const [subjectInput, setSubjectInput] = useState('');
  const [subjectsTaught, setSubjectsTaught] = useState<string[]>([]);
  const [todayDate, setTodayDate] = useState('');
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent'>>({});

  useEffect(() => {
    setTeachers(dataService.getTeachers());
    const now = new Date();
    setTodayDate(now.toLocaleDateString('en-CA'));
    setDailyAttendance(dataService.getAttendanceForDate(now.toLocaleDateString('en-CA')));
  }, []);

  const resetForm = () => {
    setEditId(null);
    setName('');
    setSubjectsTaught([]);
    setSubjectInput('');
    setSelectedColor(PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)]);
  }

  const addSubject = () => {
      if (subjectInput.trim() && !subjectsTaught.includes(subjectInput.trim())) {
          setSubjectsTaught([...subjectsTaught, subjectInput.trim()]);
          setSubjectInput('');
      }
  };

  const removeSubject = (sub: string) => {
      setSubjectsTaught(subjectsTaught.filter(s => s !== sub));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const teacherData: Teacher = {
      id: editId || Date.now().toString(),
      name: name.trim(),
      initials: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      color: selectedColor,
      subjectsTaught: subjectsTaught
    };

    const updated = await dataService.saveTeacher(teacherData);
    setTeachers(updated);
    resetForm();
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Teacher Cloud Profile Updated", type: 'success' } }));
  };

  const handleEdit = (teacher: Teacher) => {
    if (currentRole !== 'PRINCIPAL') return;
    setEditId(teacher.id);
    setName(teacher.name);
    setSelectedColor(teacher.color);
    setSubjectsTaught(teacher.subjectsTaught || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (currentRole !== 'PRINCIPAL') return;
    if (confirm('Are you sure?')) {
      const updated = await dataService.deleteTeacher(id);
      setTeachers(updated);
      if (editId === id) resetForm();
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Teacher Profile Removed", type: 'success' } }));
    }
  };

  const toggleAttendance = async (teacher: Teacher, status: 'present' | 'absent') => {
      await dataService.markTeacherAttendance(todayDate, teacher.id, status);
      setDailyAttendance(prev => {
          const newState = { ...prev };
          if (status === 'present') delete newState[teacher.id];
          else newState[teacher.id] = 'absent';
          return newState;
      });
  };

  return (
    <div className="space-y-6">
      {currentRole === 'PRINCIPAL' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand-600" />
              {editId ? 'Edit Teacher' : 'Add New Teacher'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Teacher Name</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm h-11" placeholder="e.g. Lucky" required />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Expert Subjects</label>
                            <div className="flex gap-2 mb-2">
                                <input 
                                    type="text" 
                                    value={subjectInput} 
                                    onChange={(e) => setSubjectInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubject())}
                                    className="flex-1 text-sm h-11" 
                                    placeholder="e.g. Mathematics" 
                                />
                                <button type="button" onClick={addSubject} className="px-4 bg-slate-800 text-white rounded-xl text-xs font-bold">Add</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {subjectsTaught.map(s => (
                                    <span key={s} className="bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2 border border-brand-100 dark:border-brand-800">
                                        {s} <X className="w-3 h-3 cursor-pointer" onClick={() => removeSubject(s)} />
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Theme Color</label>
                        <div className="flex gap-2 flex-wrap items-center bg-slate-50 dark:bg-black p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                            {PREDEFINED_COLORS.map(c => (
                                <button key={c} type="button" onClick={() => setSelectedColor(c)} className={`w-8 h-8 rounded-full border-2 transition-transform ${selectedColor === c ? 'border-brand-500 scale-125 shadow-lg' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-800">
                    <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-500">Cancel</button>
                    <button type="submit" className="bg-brand-600 text-white px-10 py-2.5 rounded-xl font-bold uppercase tracking-widest shadow-lg">Save Profile</button>
                </div>
            </form>
          </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {teachers.map(teacher => {
            const isAbsent = dailyAttendance[teacher.id] === 'absent';
            return (
              <div key={teacher.id} className={`group bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all ${isAbsent ? 'border-red-500 bg-red-50/10' : 'border-slate-100 dark:border-slate-800'}`}>
                 <div className="flex items-center gap-4 mb-3">
                     <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-inner" style={{ backgroundColor: teacher.color }}>{teacher.initials}</div>
                     <div className="flex-1">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{teacher.name}</h3>
                        <p className={`text-[9px] font-black uppercase ${isAbsent ? 'text-red-500' : 'text-green-500'}`}>{isAbsent ? 'Absent' : 'Present'}</p>
                     </div>
                 </div>
                 <div className="mb-4 min-h-[20px]">
                    <div className="flex flex-wrap gap-1">
                        {(teacher.subjectsTaught || []).slice(0, 3).map(s => (
                            <span key={s} className="text-[8px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                        {(teacher.subjectsTaught?.length || 0) > 3 && <span className="text-[8px] font-bold text-slate-400">+{teacher.subjectsTaught!.length - 3}</span>}
                    </div>
                 </div>
                 <div className="flex gap-2 mb-3">
                    <button onClick={() => toggleAttendance(teacher, 'present')} className={`flex-1 h-8 rounded-lg text-[9px] font-black ${!isAbsent ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>PRESENT</button>
                    <button onClick={() => toggleAttendance(teacher, 'absent')} className={`flex-1 h-8 rounded-lg text-[9px] font-black ${isAbsent ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>ABSENT</button>
                 </div>
                 {currentRole === 'PRINCIPAL' && (
                    <div className="flex justify-end pt-2 border-t dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(teacher)} className="p-2 text-slate-400 hover:text-brand-600"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(teacher.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                 )}
              </div>
            );
        })}
      </div>

      <div className="pt-10 flex flex-col items-center opacity-30">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            <span>Official S.S.C.S Registry</span>
            <Heart className="w-3 h-3 text-red-500 fill-current" />
        </div>
      </div>
    </div>
  );
};
