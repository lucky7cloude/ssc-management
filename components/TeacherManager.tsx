
import React, { useState, useEffect } from 'react';
import { Teacher, PREDEFINED_COLORS, UserRole, AttendanceStatus, SCHOOL_LOGO_URL } from '../types';
import * as dataService from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { UserPlus, Trash2, CheckCircle, ShieldAlert, RefreshCw, Loader2, Save, UserX, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
    currentRole: UserRole;
}

export const TeacherManager: React.FC<Props> = ({ currentRole }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);
  const [selectedDate] = useState(new Date().toLocaleDateString('en-CA'));

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: dataService.getTeachers
  });

  const { data: dbData } = useQuery({
    queryKey: ['schedule', selectedDate],
    queryFn: () => postgresService.timetable.getEffective(selectedDate, 'Monday'), // Placeholder day
    refetchInterval: 5000
  });

  const attendanceMap = dbData?.attendance || {};

  const saveTeacherMutation = useMutation({
    mutationFn: (teacher: Teacher) => dataService.saveTeacher(teacher),
    onSuccess: () => {
        setName('');
        queryClient.invalidateQueries({ queryKey: ['teachers'] });
    }
  });

  const attendanceMutation = useMutation({
    mutationFn: (payload: { teacherId: string, status: AttendanceStatus }) => 
        postgresService.timetable.saveAttendance(selectedDate, payload.teacherId, payload.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule'] })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const teacherData: Teacher = {
      id: Date.now().toString(),
      name: name.trim(),
      initials: name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      color: selectedColor,
    };
    saveTeacherMutation.mutate(teacherData);
  };

  const getAttendanceBtnStyle = (tId: string, status: AttendanceStatus) => {
      const current = attendanceMap[tId] || 'present';
      if (current === status) {
          if (status === 'absent') return 'bg-red-500 text-white';
          if (status === 'half_day_before' || status === 'half_day_after') return 'bg-amber-500 text-white';
          return 'bg-brand-500 text-white';
      }
      return 'bg-slate-100 dark:bg-slate-800 text-slate-400';
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
                    {currentRole === 'PRINCIPAL' ? 'Administrator Access' : 'Management Console'}
                </h2>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                    Live Registry: {teachers.length} Active Staff
                </p>
            </div>
        </div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl">Today: {selectedDate}</div>
      </div>

      {currentRole === 'PRINCIPAL' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 uppercase tracking-tight">
              <UserPlus className="w-6 h-6 text-brand-600" /> New Staff Entry
            </h2>
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">Legal Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm h-12" placeholder="e.g. John Doe" required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">System Color Identifier</label>
                        <div className="flex gap-2">
                            {PREDEFINED_COLORS.slice(0, 8).map(c => (
                                <button key={c} type="button" onClick={() => setSelectedColor(c)} className={`w-10 h-10 rounded-xl border-4 ${selectedColor === c ? 'border-brand-500 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                </div>
                <button type="submit" disabled={saveTeacherMutation.isPending} className="w-full bg-slate-900 dark:bg-black text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-600 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95">
                    {saveTeacherMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Publish Staff Profile
                </button>
            </form>
          </div>
      )}

      {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest">Accessing Cloud Database...</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map(teacher => (
              <div key={teacher.id} className="group bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 hover:border-brand-500 hover:shadow-2xl transition-all">
                 <div className="flex items-center gap-4 mb-6">
                     <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg" style={{ backgroundColor: teacher.color }}>{teacher.initials}</div>
                     <div className="flex-1 truncate">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 truncate text-lg tracking-tight">{teacher.name}</h3>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${attendanceMap[teacher.id] && attendanceMap[teacher.id] !== 'present' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {attendanceMap[teacher.id] || 'Present Today'}
                        </span>
                     </div>
                 </div>
                 
                 <div className="space-y-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attendance Quick-Actions</span>
                    <div className="flex gap-1.5">
                        <button onClick={() => attendanceMutation.mutate({ teacherId: teacher.id, status: 'present' })} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm transition-all flex items-center justify-center gap-1 ${getAttendanceBtnStyle(teacher.id, 'present')}`}>
                            <CheckCircle className="w-3 h-3"/> Full
                        </button>
                        <button onClick={() => attendanceMutation.mutate({ teacherId: teacher.id, status: 'absent' })} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm transition-all flex items-center justify-center gap-1 ${getAttendanceBtnStyle(teacher.id, 'absent')}`}>
                            <UserX className="w-3 h-3"/> Absent
                        </button>
                    </div>
                    <div className="flex gap-1.5">
                        <button onClick={() => attendanceMutation.mutate({ teacherId: teacher.id, status: 'half_day_before' })} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm transition-all flex items-center justify-center gap-1 ${getAttendanceBtnStyle(teacher.id, 'half_day_before')}`}>
                            <Clock className="w-3 h-3"/> Morning
                        </button>
                        <button onClick={() => attendanceMutation.mutate({ teacherId: teacher.id, status: 'half_day_after' })} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm transition-all flex items-center justify-center gap-1 ${getAttendanceBtnStyle(teacher.id, 'half_day_after')}`}>
                            <Clock className="w-3 h-3"/> After.
                        </button>
                    </div>
                 </div>

                 <div className="mt-6 pt-4 border-t dark:border-slate-800 flex justify-end">
                    <button onClick={async () => {
                        if (confirm('Delete profile?')) {
                            await dataService.deleteTeacher(teacher.id);
                            queryClient.invalidateQueries({ queryKey: ['teachers'] });
                        }
                    }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                 </div>
              </div>
            ))}
          </div>
      )}
    </div>
  );
};
