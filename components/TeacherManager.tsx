
import React, { useState, useEffect } from 'react';
import { Teacher, PREDEFINED_COLORS, ScheduleEntry, Substitution, UserRole } from '../types';
import * as dataService from '../services/dataService';
import { UserPlus, Trash2, User, X, Edit2, Check, CalendarDays, UserCheck, Lock } from 'lucide-react';

interface Props {
    currentRole: UserRole;
}

export const TeacherManager: React.FC<Props> = ({ currentRole }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [todayDate, setTodayDate] = useState('');
  const [todayDayName, setTodayDayName] = useState('');
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [dailySubstitutions, setDailySubstitutions] = useState<Substitution[]>([]);
  const [subModalTeacher, setSubModalTeacher] = useState<Teacher | null>(null);

  useEffect(() => {
    setTeachers(dataService.getTeachers());
    const now = new Date();
    setTodayDate(now.toLocaleDateString('en-CA'));
    setTodayDayName(now.toLocaleDateString('en-US', { weekday: 'long' }));
    setDailyAttendance(dataService.getAttendanceForDate(now.toLocaleDateString('en-CA')));
    setDailySubstitutions(dataService.getSubstitutionsForDate(now.toLocaleDateString('en-CA')));
  }, []);

  const resetForm = () => {
    setEditId(null);
    setName('');
    setSelectedColor(PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)]);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const teacherData: Teacher = {
      id: editId || Date.now().toString(),
      name: name.trim(),
      initials: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      color: selectedColor,
    };

    setTeachers(dataService.saveTeacher(teacherData));
    resetForm();
  };

  const handleEdit = (teacher: Teacher) => {
    if (currentRole !== 'PRINCIPAL') return;
    setEditId(teacher.id);
    setName(teacher.name);
    setSelectedColor(teacher.color);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (currentRole !== 'PRINCIPAL') return;
    if (confirm('Are you sure? This will remove the teacher from all assignments.')) {
      setTeachers(dataService.deleteTeacher(id));
      if (editId === id) resetForm();
    }
  };

  const toggleAttendance = (teacher: Teacher, status: 'present' | 'absent') => {
      dataService.markTeacherAttendance(todayDate, teacher.id, status);
      setDailyAttendance(prev => {
          const newState = { ...prev };
          if (status === 'present') delete newState[teacher.id];
          else newState[teacher.id] = 'absent';
          return newState;
      });
      if (status === 'absent') {
          setSubModalTeacher(teacher);
          dataService.addNotification(`${teacher.name} marked absent.`, 'absence');
          window.dispatchEvent(new Event('notifications-updated'));
      }
  };

  return (
    <div className="space-y-6">
      {currentRole === 'PRINCIPAL' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand-600" />
              {editId ? 'Edit Teacher Profile' : 'Add New Teacher'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border-slate-300 p-2.5 border" placeholder="Enter teacher's name" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Theme Color</label>
                        <div className="flex gap-2 flex-wrap items-center">
                            {PREDEFINED_COLORS.map(c => (
                                <button key={c} type="button" onClick={() => setSelectedColor(c)} className={`w-8 h-8 rounded-full border-2 ${selectedColor === c ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    {editId && <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-slate-600 font-bold">Cancel</button>}
                    <button type="submit" className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm">{editId ? 'Update' : 'Add Teacher'}</button>
                </div>
            </form>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teachers.map(teacher => {
            const isAbsent = dailyAttendance[teacher.id] === 'absent';
            return (
              <div key={teacher.id} className={`bg-white rounded-xl p-4 border transition-all ${isAbsent ? 'border-red-200 bg-red-50/20' : 'border-slate-100 shadow-sm'}`}>
                 <div className="flex items-center gap-4 mb-3">
                     <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: teacher.color }}>{teacher.initials}</div>
                     <div className="flex-1 min-w-0"><h3 className="font-bold text-slate-800 truncate">{teacher.name}</h3></div>
                     <div className="flex gap-1">
                        <button onClick={() => toggleAttendance(teacher, 'present')} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${!isAbsent ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>P</button>
                        <button onClick={() => toggleAttendance(teacher, 'absent')} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${isAbsent ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>A</button>
                     </div>
                 </div>
                 <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teacher ID: {teacher.id.slice(-5)}</span>
                     {currentRole === 'PRINCIPAL' && (
                        <div className="flex gap-1">
                            <button onClick={() => handleEdit(teacher)} className="p-1.5 text-slate-400 hover:text-brand-600"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(teacher.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                     )}
                 </div>
              </div>
            );
        })}
      </div>

      {subModalTeacher && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                  <div className="bg-red-600 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold">Assign Substitute for {subModalTeacher.name}</h3>
                      <button onClick={() => setSubModalTeacher(null)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-4 bg-slate-50 text-xs font-bold text-slate-500 text-center">Redirecting to Timetable to manage daily replacements...</div>
                  <div className="p-6 text-center">
                      <p className="text-slate-600 mb-4">You have marked this teacher as absent. Please visit the Timetable section for today to manage periods and assign available substitutes.</p>
                      <button onClick={() => setSubModalTeacher(null)} className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-bold">I'll manage in Timetable</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
