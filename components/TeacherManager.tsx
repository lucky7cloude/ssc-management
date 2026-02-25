
import React, { useState, useEffect } from 'react';
import { Teacher, PREDEFINED_COLORS, UserRole, AttendanceStatus, SCHOOL_LOGO_URL } from '../types';
import * as dataService from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { UserPlus, Trash2, CheckCircle, ShieldAlert, RefreshCw, Loader2, Save, UserX, Clock, X, Search, Edit2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PERIODS } from '../types';

interface Props {
    currentRole: UserRole;
}

export const TeacherManager: React.FC<Props> = ({ currentRole }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));

  const selectedDayName = React.useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long' });
  }, [selectedDate]);

  const [substituteFor, setSubstituteFor] = useState<{ teacherId: string, name: string, status: AttendanceStatus } | null>(null);

  const { data: staticData } = useQuery({
    queryKey: ['static-data'],
    queryFn: async () => {
        const [c, t] = await Promise.all([dataService.getClasses(), dataService.getTeachers()]);
        return { classes: c, teachers: t };
    }
  });

  const teachers = staticData?.teachers || [];
  const classes = staticData?.classes || [];
  const isLoading = !staticData;

  const { data: dbData } = useQuery({
    queryKey: ['schedule', selectedDate, selectedDayName],
    queryFn: () => dataService.getFullTimetableData(selectedDate, selectedDayName),
    refetchInterval: 5000
  });

  const scheduleData = dbData?.schedule || {};
  const attendanceMap = dbData?.attendance || {};

  const saveTeacherMutation = useMutation({
    mutationFn: (teacher: Teacher) => dataService.saveTeacher(teacher),
    onSuccess: () => {
        setName('');
        setSubject('');
        setSelectedColor(PREDEFINED_COLORS[0]);
        setEditingTeacherId(null);
        queryClient.invalidateQueries({ queryKey: ['static-data'] });
        queryClient.invalidateQueries({ queryKey: ['teachers'] });
    }
  });

  const attendanceMutation = useMutation({
    mutationFn: (payload: { teacherId: string, status: AttendanceStatus }) => 
        dataService.markTeacherAttendance(selectedDate, payload.teacherId, payload.status),
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['schedule'] });
        if (variables.status !== 'present') {
            const teacher = teachers.find(t => t.id === variables.teacherId);
            if (teacher) setSubstituteFor({ teacherId: teacher.id, name: teacher.name, status: variables.status });
        }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const teacherData: Teacher = {
      id: editingTeacherId || Date.now().toString(),
      name: name.trim(),
      initials: name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      color: selectedColor,
      subject: subject.trim() || undefined
    };
    saveTeacherMutation.mutate(teacherData);
  };

  const handleEditClick = (teacher: Teacher) => {
    setEditingTeacherId(teacher.id);
    setName(teacher.name);
    setSubject(teacher.subject || '');
    setSelectedColor(teacher.color);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingTeacherId(null);
    setName('');
    setSubject('');
    setSelectedColor(PREDEFINED_COLORS[0]);
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
              {editingTeacherId ? <Edit2 className="w-6 h-6 text-brand-600" /> : <UserPlus className="w-6 h-6 text-brand-600" />}
              {editingTeacherId ? 'Edit Staff Profile' : 'New Staff Entry'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">Legal Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm h-12" placeholder="e.g. John Doe" required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">Primary Subject</label>
                        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full text-sm h-12" placeholder="e.g. Mathematics" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">System Color Identifier</label>
                        <div className="flex flex-wrap gap-2">
                            {PREDEFINED_COLORS.slice(0, 10).map(c => (
                                <button key={c} type="button" onClick={() => setSelectedColor(c)} className={`w-8 h-8 rounded-xl border-4 ${selectedColor === c ? 'border-brand-500 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button type="submit" disabled={saveTeacherMutation.isPending} className="flex-1 bg-slate-900 dark:bg-black text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-600 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95">
                        {saveTeacherMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {editingTeacherId ? 'Update Profile' : 'Publish Staff Profile'}
                    </button>
                    {editingTeacherId && (
                        <button type="button" onClick={cancelEdit} className="px-8 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">
                            Cancel
                        </button>
                    )}
                </div>
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
                            {attendanceMap[teacher.id] === 'absent' ? 'Absent' : 
                             attendanceMap[teacher.id] === 'half_day_before' ? 'Half Day (Morning)' :
                             attendanceMap[teacher.id] === 'half_day_after' ? 'Half Day (Afternoon)' :
                             'Present Today'}
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

                 <div className="mt-6 pt-4 border-t dark:border-slate-800 flex justify-end gap-2">
                    {currentRole === 'PRINCIPAL' && (
                        <button onClick={() => handleEditClick(teacher)} className="p-2 text-slate-300 hover:text-brand-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    )}
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
      {/* Substitution Pop-up Modal */}
      {substituteFor && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-pop-in">
                  <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                              <UserX className="w-6 h-6" />
                          </div>
                          <div>
                              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Substitution Required</h3>
                              <p className="text-xs text-red-500 font-black uppercase tracking-widest mt-0.5">{substituteFor.name} is Absent</p>
                          </div>
                      </div>
                      <button onClick={() => setSubstituteFor(null)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                          {substituteFor.name} is marked as absent. Below are the periods where they were assigned. Please select a substitute teacher for each period or mark it as vacant.
                      </p>

                      <div className="space-y-4">
                          {PERIODS.map((period, pIdx) => {
                              if (period.label === 'LUNCH') return null;
                              
                              // Check if teacher is actually absent in this period based on status
                              const isAbsentInPeriod = substituteFor.status === 'absent' || 
                                                       (substituteFor.status === 'half_day_before' && pIdx < 3) || 
                                                       (substituteFor.status === 'half_day_after' && pIdx > 3);
                              
                              if (!isAbsentInPeriod) return null;

                              // Find classes where this teacher is assigned in this period
                              const assignedClasses = classes.filter(c => {
                                  const entry = scheduleData[`${c.id}_${pIdx}`];
                                  const activeTeacherId = entry ? ('subTeacherId' in entry ? entry.subTeacherId : entry.teacherId) : '';
                                  return activeTeacherId === substituteFor.teacherId;
                              });

                              if (assignedClasses.length === 0) return null;

                              return (
                                  <div key={pIdx} className="p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                                      <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                              <div className="px-3 py-1 bg-brand-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">Period {period.label}</div>
                                              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{period.start} - {period.end}</span>
                                          </div>
                                      </div>

                                      <div className="space-y-3">
                                          {assignedClasses.map(cls => (
                                              <div key={cls.id} className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                                  <div className="flex items-center justify-between">
                                                      <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Class {cls.name}</span>
                                                      <span className="text-[10px] font-bold text-slate-400 italic">Original: {substituteFor.name}</span>
                                                  </div>

                                                  <div className="grid grid-cols-1 gap-3">
                                                      <div className="space-y-2">
                                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Substitute</label>
                                                          <div className="flex gap-2">
                                                              <select 
                                                                  className="flex-1 text-xs h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl px-3 font-bold"
                                                                  onChange={(e) => {
                                                                      const subId = e.target.value;
                                                                      if (subId === 'VACANT') {
                                                                          dataService.saveDailyOverride(selectedDate, selectedDayName, cls.id, pIdx, {
                                                                              subTeacherId: null,
                                                                              subSubject: 'Free Period',
                                                                              subNote: 'Teacher Absent',
                                                                              originalTeacherId: substituteFor.teacherId,
                                                                              type: 'VACANT'
                                                                          }).then(() => queryClient.invalidateQueries({ queryKey: ['schedule'] }));
                                                                      } else if (subId) {
                                                                          const subTeacher = teachers.find(t => t.id === subId);
                                                                          dataService.saveDailyOverride(selectedDate, selectedDayName, cls.id, pIdx, {
                                                                              subTeacherId: subId,
                                                                              subSubject: subTeacher?.subject || 'Substitution',
                                                                              subNote: 'Substitute Assigned',
                                                                              originalTeacherId: substituteFor.teacherId,
                                                                              type: 'SUBSTITUTION'
                                                                          }).then(() => queryClient.invalidateQueries({ queryKey: ['schedule'] }));
                                                                      }
                                                                  }}
                                                              >
                                                                  <option value="">Select Action...</option>
                                                                  <option value="VACANT">Mark as Free Period</option>
                                                                  <optgroup label="Available Teachers">
                                                                      {teachers.filter(t => {
                                                                          // Check if teacher is free in this period
                                                                          const isBusy = Object.entries(scheduleData).some(([key, entry]: [string, any]) => {
                                                                              const [_, periodStr] = key.split('_');
                                                                              if (parseInt(periodStr) !== pIdx) return false;
                                                                              const activeId = 'subTeacherId' in entry ? entry.subTeacherId : entry.teacherId;
                                                                              return activeId === t.id || entry.splitTeacherId === t.id;
                                                                          });
                                                                          const status = attendanceMap[t.id] || 'present';
                                                                          const isAbsent = status === 'absent' || 
                                                                                           (status === 'half_day_before' && pIdx < 3) || 
                                                                                           (status === 'half_day_after' && pIdx > 3);
                                                                          return !isBusy && !isAbsent && t.id !== substituteFor.teacherId;
                                                                      }).map(t => (
                                                                          <option key={t.id} value={t.id}>{t.name} ({t.subject || 'N/A'})</option>
                                                                      ))}
                                                                  </optgroup>
                                                              </select>
                                                          </div>
                                                      </div>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-800 flex justify-end">
                      <button 
                        onClick={() => setSubstituteFor(null)}
                        className="px-10 py-3.5 bg-slate-900 dark:bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-600 shadow-xl transition-all active:scale-95"
                      >
                        Finish Substitution
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
