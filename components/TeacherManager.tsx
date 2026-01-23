import React, { useState, useEffect } from 'react';
import { Teacher, PREDEFINED_COLORS, UserRole, AttendanceStatus, SCHOOL_LOGO_URL, DailyOverride } from '../types';
import * as dataService from '../services/dataService';
import { UserPlus, Trash2, Edit2, Heart, BookOpen, X, RefreshCw, ShieldAlert, CheckCircle, Users, Loader2, Download, Calendar, AlertTriangle, UserCheck, ArrowRight, UserPlus2, Layers, Zap } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    currentRole: UserRole;
}

const safeAddImage = async (doc: jsPDF, url: string, x: number, y: number, w: number, h: number) => {
    try {
        const response = await fetch(url, { mode: 'cors' });
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType?.startsWith('image/')) throw new Error("Not a valid image");
        const blob = await response.blob();
        const reader = new FileReader();
        return new Promise<void>((resolve) => {
            reader.onloadend = () => {
                const base64data = reader.result as string;
                doc.addImage(base64data, 'PNG', x, y, w, h);
                resolve();
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Failed to load PDF logo:", e);
        return Promise.resolve();
    }
};

const getPeriodLabel = (index: number) => {
    if (index === 3) return "LUNCH";
    const map: {[key: number]: string} = { 0: "I", 1: "II", 2: "III", 4: "IV", 5: "V", 6: "VI" };
    return map[index] || index.toString();
};

export const TeacherManager: React.FC<Props> = ({ currentRole }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);
  const [todayDate, setTodayDate] = useState('');
  const [todayDayName, setTodayDayName] = useState('');
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth().toString());
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());

  // Substitution Helper Modal
  const [subHelperTeacher, setSubHelperTeacher] = useState<Teacher | null>(null);
  const [teacherScheduleToday, setTeacherScheduleToday] = useState<any[]>([]);
  const [quickNotes, setQuickNotes] = useState<Record<string, string>>({});

  const loadData = () => {
    const currentTeachers = dataService.getTeachers();
    setTeachers(currentTeachers);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA');
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    setTodayDate(dateStr);
    setTodayDayName(dayName);
    setDailyAttendance(dataService.getAttendanceForDate(dateStr));
  };

  useEffect(() => {
    loadData();
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
        resetForm();
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Profile Saved Successfully", type: 'success' } }));
    } catch (err) {
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

  const toggleAttendance = async (teacher: Teacher, status: AttendanceStatus) => {
      await dataService.markTeacherAttendance(todayDate, teacher.id, status);
      loadData();

      if (status !== 'present') {
          const schedule = dataService.getTeacherScheduleForDay(teacher.id, todayDate, todayDayName);
          const LUNCH_PERIOD_INDEX = 3;
          
          const filteredSchedule = schedule.filter(s => {
              if (status === 'absent') return true;
              if (status === 'half_day_before') return s.periodIndex < LUNCH_PERIOD_INDEX;
              if (status === 'half_day_after') return s.periodIndex > LUNCH_PERIOD_INDEX;
              return false;
          });

          if (filteredSchedule.length > 0) {
              setSubHelperTeacher(teacher);
              setTeacherScheduleToday(filteredSchedule);
          }
      }
  };

  const handleQuickSubstitute = async (periodItem: any, subTeacherId: string | null, type: 'SUB' | 'FREE' | 'MERGE') => {
      const baseEntry = dataService.getBaseSchedule(todayDayName)[`${periodItem.classId}_${periodItem.periodIndex}`];
      const customNote = quickNotes[`${periodItem.classId}_${periodItem.periodIndex}`];
      
      let override: DailyOverride | null = null;
      
      if (type === 'SUB' && subTeacherId) {
          override = {
              subTeacherId: subTeacherId,
              subSubject: baseEntry?.subject || 'Substitution',
              originalTeacherId: subHelperTeacher?.id || '',
              type: 'SUBSTITUTION'
          };
      } else if (type === 'FREE') {
          override = {
              subNote: customNote || 'Teacher on Leave - Self Study',
              originalTeacherId: subHelperTeacher?.id || '',
              type: 'VACANT'
          };
      } else if (type === 'MERGE') {
          const otherClasses = dataService.getClasses().filter(c => c.id !== periodItem.classId);
          if (otherClasses.length > 0) {
              override = {
                  mergedClassIds: [otherClasses[0].id],
                  originalTeacherId: subHelperTeacher?.id || '',
                  type: 'MERGED'
              };
          }
      }

      if (override) {
          await dataService.saveDailyOverride(todayDate, periodItem.classId, periodItem.periodIndex, override);
          setTeacherScheduleToday(prev => prev.filter(p => !(p.classId === periodItem.classId && p.periodIndex === periodItem.periodIndex)));
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Substitution Applied", type: 'success' } }));
          
          if (teacherScheduleToday.length <= 1) {
              setSubHelperTeacher(null);
          }
      }
  };

  const downloadAttendanceReport = async () => {
    const month = parseInt(reportMonth);
    const year = parseInt(reportYear);
    const doc = new jsPDF('l', 'mm', 'a4');
    
    await safeAddImage(doc, SCHOOL_LOGO_URL, 10, 10, 20, 20);
    doc.setFontSize(22);
    doc.setTextColor(2, 132, 199);
    doc.text("SILVER STAR CONVENT SCHOOL", 148, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(100);
    const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
    doc.text(`Monthly Staff Attendance Report: ${monthName} ${year}`, 148, 28, { align: 'center' });

    const attendanceStore = dataService.getAttendanceStore();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const rows = teachers.map(t => {
        let absentDays = 0;
        let halfDays = 0;
        let datesList: string[] = [];
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const status = attendanceStore[dateStr]?.[t.id];
            if (status === 'absent') {
                absentDays++;
                datesList.push(`${d}(F)`);
            } else if (status === 'half_day_before') {
                halfDays += 0.5;
                datesList.push(`${d}(M)`);
            } else if (status === 'half_day_after') {
                halfDays += 0.5;
                datesList.push(`${d}(A)`);
            }
        }
        
        return [
            t.name,
            absentDays.toString(),
            halfDays.toString(),
            (absentDays + halfDays).toString(),
            datesList.join(', ') || 'None'
        ];
    });

    autoTable(doc, {
        head: [['Teacher Name', 'Full Leaves', 'Half Days', 'Total LOP Days', 'Dates of Leave (F=Full, M=Morn, A=Aft)']],
        body: rows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [2, 132, 199] },
        styles: { fontSize: 8 },
        columnStyles: { 4: { cellWidth: 80 } }
    });

    doc.save(`Attendance_Report_${monthName}_${year}.pdf`);
    setIsReportModalOpen(false);
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
        <div className="flex gap-2 w-full justify-end">
            <button 
                onClick={() => setIsReportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold transition-all hover:bg-black"
            >
                <Download className="w-3.5 h-3.5" />
                Monthly Report
            </button>
            <button 
                onClick={handleManualRefresh} 
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Syncing...' : 'Sync Cloud'}
            </button>
        </div>
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
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-800">
                    <button type="button" onClick={resetForm} disabled={isSaving} className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800">Discard</button>
                    <button type="submit" disabled={isSaving} className="bg-brand-600 text-white px-12 py-3 rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-brand-700 flex items-center gap-2">
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSaving ? 'Saving Profile...' : (editId ? 'Update Profile' : 'Publish to Cloud')}
                    </button>
                </div>
            </form>
          </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {teachers.length > 0 ? teachers.map(teacher => {
            const status = dailyAttendance[teacher.id] || 'present';
            const isAbsent = status === 'absent';
            const isHalfDay = status === 'half_day_before' || status === 'half_day_after';
            
            return (
              <div key={teacher.id} className={`group bg-white dark:bg-slate-900 rounded-[2rem] p-6 border-2 transition-all duration-300 hover:shadow-xl ${isAbsent ? 'border-red-500 bg-red-50/10' : (isHalfDay ? 'border-amber-500 bg-amber-50/10' : 'border-slate-100 dark:border-slate-800 hover:border-brand-500')}`}>
                 <div className="flex items-center gap-4 mb-5">
                     <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl transform group-hover:rotate-6 transition-transform" style={{ backgroundColor: teacher.color }}>{teacher.initials}</div>
                     <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate text-base leading-tight">{teacher.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className={`w-2 h-2 rounded-full ${isAbsent ? 'bg-red-500 animate-pulse' : (isHalfDay ? 'bg-amber-500' : 'bg-green-500')}`}></div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isAbsent ? 'text-red-500' : (isHalfDay ? 'text-amber-500' : 'text-green-500')}`}>
                                {status === 'present' && 'On Duty'}
                                {status === 'absent' && 'Full Leave'}
                                {status === 'half_day_before' && 'Morning Leave'}
                                {status === 'half_day_after' && 'Afternoon Leave'}
                            </span>
                        </div>
                     </div>
                 </div>
                 
                 <div className="space-y-2">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => toggleAttendance(teacher, 'present')} 
                            className={`flex-1 h-9 rounded-xl text-[8px] font-black transition-all ${status === 'present' ? 'bg-green-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
                        >
                            PRESENT
                        </button>
                        <button 
                            onClick={() => toggleAttendance(teacher, 'absent')} 
                            className={`flex-1 h-9 rounded-xl text-[8px] font-black transition-all ${status === 'absent' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
                        >
                            FULL DAY
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => toggleAttendance(teacher, 'half_day_before')} 
                            className={`flex-1 h-9 rounded-xl text-[8px] font-black transition-all ${status === 'half_day_before' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
                        >
                            LEAVE MORNING
                        </button>
                        <button 
                            onClick={() => toggleAttendance(teacher, 'half_day_after')} 
                            className={`flex-1 h-9 rounded-xl text-[8px] font-black transition-all ${status === 'half_day_after' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
                        >
                            LEAVE AFTERNOON
                        </button>
                    </div>
                 </div>

                 {currentRole === 'PRINCIPAL' && (
                    <div className="flex justify-between items-center mt-5 pt-4 border-t dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID: {teacher.id.substring(0,6)}</span>
                        <div className="flex gap-1">
                            <button onClick={() => handleEdit(teacher)} className="p-2 text-slate-400 hover:text-brand-600"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(teacher.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                 )}
              </div>
            );
        }) : (
            <div className="col-span-full py-20 flex flex-col items-center text-center opacity-50">
                <Users className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-400">No staff profiles found.</h3>
            </div>
        )}
      </div>

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-pop-in">
                <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2"><Calendar className="w-4 h-4"/> Monthly Attendance</h3>
                    <button onClick={() => setIsReportModalOpen(false)}><X className="w-4 h-4"/></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Select Month</label>
                            <select value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full text-sm h-11">
                                {Array.from({length: 12}).map((_, i) => (
                                    <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Select Year</label>
                            <select value={reportYear} onChange={(e) => setReportYear(e.target.value)} className="w-full text-sm h-11">
                                <option value="2024">2024</option>
                                <option value="2025">2025</option>
                                <option value="2026">2026</option>
                            </select>
                        </div>
                    </div>
                    <button onClick={downloadAttendanceReport} className="w-full h-12 bg-brand-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl">Download PDF Report</button>
                </div>
            </div>
        </div>
      )}

      {subHelperTeacher && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border dark:border-slate-800 animate-pop-in">
                  <div className="bg-red-600 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 animate-pulse" /> 
                        Substitution Core Assistant
                      </h3>
                      <button onClick={() => setSubHelperTeacher(null)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-6">
                      <div className="flex items-center gap-4 bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-800">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg" style={{ backgroundColor: subHelperTeacher.color }}>{subHelperTeacher.initials}</div>
                          <div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{subHelperTeacher.name} is on Leave Today</h4>
                              <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest">{teacherScheduleToday.length} Active Periods Unfilled</p>
                          </div>
                      </div>
                      
                      <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                          {teacherScheduleToday.map((item, idx) => {
                              const cls = dataService.getClasses().find(c => c.id === item.classId);
                              const freeOnes = dataService.getFreeTeachers(todayDate, todayDayName, item.periodIndex);
                              const key = `${item.classId}_${item.periodIndex}`;
                              
                              return (
                                  <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700 space-y-3">
                                      <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black bg-brand-600 text-white px-2.5 py-1 rounded-lg uppercase tracking-tighter">PRD {getPeriodLabel(item.periodIndex)}</span>
                                              <span className="text-sm font-black text-slate-800 dark:text-slate-200">{cls?.name}</span>
                                          </div>
                                          <span className="text-[10px] text-slate-400 font-black uppercase">{item.entry.subject}</span>
                                      </div>
                                      
                                      <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-slate-700">
                                          {freeOnes.length > 0 ? (
                                              freeOnes.map(f => (
                                                  <button 
                                                      key={f.id}
                                                      onClick={() => handleQuickSubstitute(item, f.id, 'SUB')}
                                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-xl text-[10px] font-bold border border-green-500/20 hover:bg-green-500 hover:text-white transition-all group"
                                                  >
                                                      <UserPlus2 className="w-3 h-3 group-hover:scale-110" />
                                                      {f.name} (Free)
                                                  </button>
                                              ))
                                          ) : (
                                              <span className="text-[10px] text-slate-400 font-bold italic py-1.5">No staff free at this time.</span>
                                          )}
                                      </div>

                                      <div className="space-y-2 pt-2">
                                          <input 
                                            type="text" 
                                            placeholder="Add custom note for self-study (optional)..." 
                                            className="w-full text-[10px] h-8"
                                            value={quickNotes[key] || ''}
                                            onChange={(e) => setQuickNotes({...quickNotes, [key]: e.target.value})}
                                          />
                                          <div className="flex gap-2">
                                              <button 
                                                  onClick={() => handleQuickSubstitute(item, null, 'FREE')}
                                                  className="flex-1 py-2 bg-amber-500/10 text-amber-600 rounded-xl text-[10px] font-black uppercase border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                              >
                                                  <Zap className="w-3.5 h-3.5" /> Mark Self-Study
                                              </button>
                                              <button 
                                                  onClick={() => handleQuickSubstitute(item, null, 'MERGE')}
                                                  className="flex-1 py-2 bg-purple-500/10 text-purple-600 rounded-xl text-[10px] font-black uppercase border border-purple-500/20 hover:bg-purple-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                              >
                                                  <Layers className="w-3.5 h-3.5" /> Merge Class
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>

                      <div className="pt-4 border-t dark:border-slate-800 flex justify-between items-center">
                          <p className="text-[10px] text-slate-500 italic font-medium">Quick-assign free staff or mark as non-teaching slots.</p>
                          <button 
                            onClick={() => setSubHelperTeacher(null)} 
                            className="h-10 px-6 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-xl"
                          >
                            Done <ArrowRight className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="pt-12 pb-6 flex flex-col items-center opacity-30">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 text-center">
            <span>SSC-MANAGEMENT REGISTRY • Made by lucky</span>
            <Heart className="w-3 h-3 text-red-500 fill-current" />
        </div>
      </div>
    </div>
  );
};