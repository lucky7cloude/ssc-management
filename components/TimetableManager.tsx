
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClassSection, PERIODS, DAYS, Teacher, Substitution, UserRole, ScheduleEntry, DailyOverride } from '../types';
import * as dataService from '../services/dataService';
import { ChevronRight, ChevronLeft, CheckCircle2, X, Users, Image as ImageIcon, Settings, Trash2, Split, MessageSquareWarning, Calendar as CalendarIcon, ChevronUp, ChevronDown, Layout, Edit3, RotateCcw, AlertTriangle, FileText, Download, UserCheck, Search, ListChecks, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    currentRole: UserRole;
}

type ClassFilter = 'ALL' | 'SEC' | 'SR_SEC';
type TimetableMode = 'DAILY' | 'BASE';

const getPeriodLabel = (index: number) => {
    if (index === 3) return "LUNCH";
    const map: {[key: number]: string} = {
        0: "I", 1: "II", 2: "III", 4: "IV", 5: "V", 6: "VI"
    };
    return map[index] || index.toString();
};

export const TimetableManager: React.FC<Props> = ({ currentRole }) => {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDayName, setSelectedDayName] = useState<string>('Monday');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timetableMode, setTimetableMode] = useState<TimetableMode>('DAILY');
  const [scheduleData, setScheduleData] = useState<Record<string, any>>({});
  const [classFilter, setClassFilter] = useState<ClassFilter>('ALL');
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [timetableNote, setTimetableNote] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [isSubListOpen, setIsSubListOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{classId: string, periodIndex: number} | null>(null);
  
  // Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isSplit, setIsSplit] = useState(false);
  const [splitTeacherId, setSplitTeacherId] = useState('');
  const [splitSubject, setSplitSubject] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  
  const [classManagerInput, setClassManagerInput] = useState('');
  const timetableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClasses(dataService.getClasses() || []);
    setTeachers(dataService.getTeachers() || []);
    const now = new Date();
    setSelectedDate(now.toLocaleDateString('en-CA'));
  }, []);

  useEffect(() => {
      if(!selectedDate) return;
      try {
          const [year, month, day] = selectedDate.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day);
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          setSelectedDayName(dayName);
          refreshSchedule(selectedDate, dayName, timetableMode);
          setDailyAttendance(dataService.getAttendanceForDate(selectedDate));
          setTimetableNote(dataService.getTimetableNote(selectedDate));
      } catch (e) {
          console.error("Timetable initialization error:", e);
      }
  }, [selectedDate, timetableMode]);

  const refreshSchedule = (date: string, day: string, mode: TimetableMode) => {
      if (mode === 'BASE') setScheduleData(dataService.getBaseSchedule(day) || {});
      else setScheduleData(dataService.getEffectiveSchedule(date, day) || {});
  };

  const adjustDate = (days: number) => {
      if (!selectedDate) return;
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      dateObj.setDate(dateObj.getDate() + days);
      setSelectedDate(dateObj.toLocaleDateString('en-CA'));
  };

  const handleDownloadPDF = async () => {
    if (!timetableRef.current) return;
    
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) document.documentElement.classList.remove('dark');
    
    try {
        const canvas = await html2canvas(timetableRef.current, { 
          scale: 3, 
          useCORS: true, 
          backgroundColor: '#ffffff', 
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.setFillColor(2, 132, 199);
        pdf.rect(0, 0, pdfWidth, 15, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text("SILVER STAR CONVENT SCHOOL", pdfWidth / 2, 10, { align: 'center' });
        
        pdf.setTextColor(50, 50, 50);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Academic Timetable: ${selectedDate} (${selectedDayName})`, 10, 22);
        
        pdf.addImage(imgData, 'PNG', 5, 25, pdfWidth - 10, pdfHeight - 10);
        pdf.save(`SilverStar_Timetable_${selectedDate}.pdf`);
    } finally {
        if (isDark) document.documentElement.classList.add('dark');
    }
  };

  const substitutionList = useMemo(() => {
      if (!teachers.length || !classes.length) return [];
      const list: any[] = [];
      const baseSchedule = dataService.getBaseSchedule(selectedDayName) || {};
      
      classes.forEach(cls => {
          PERIODS.forEach((_, pIdx) => {
              if (pIdx === 3) return; // Lunch
              const key = `${cls.id}_${pIdx}`;
              const baseEntry = baseSchedule[key];
              const currentEntry = scheduleData[key];
              
              const originalTeacher = baseEntry ? teachers.find(t => t.id === baseEntry.teacherId) : null;
              const subTeacher = currentEntry && currentEntry.isOverride ? teachers.find(t => t.id === currentEntry.subTeacherId) : null;
              
              const isBaseAbsent = originalTeacher && dailyAttendance[originalTeacher.id] === 'absent';
              
              if (isBaseAbsent || (currentEntry?.isOverride && baseEntry?.teacherId !== currentEntry?.subTeacherId)) {
                  list.push({
                      date: selectedDate,
                      period: getPeriodLabel(pIdx),
                      className: cls.name,
                      absentTeacher: originalTeacher?.name || 'Vacant Slot',
                      subTeacher: subTeacher?.name || (isBaseAbsent ? 'REPLACEMENT NEEDED' : 'N/A'),
                      subject: currentEntry?.subSubject || currentEntry?.subject || 'N/A'
                  });
              }
          });
      });
      return list;
  }, [scheduleData, dailyAttendance, selectedDayName, selectedDate, teachers, classes]);

  const handleDownloadSubListPDF = () => {
      const doc = new jsPDF();
      doc.setFillColor(2, 132, 199);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setFontSize(16);
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.text("SILVER STAR CONVENT SCHOOL", 105, 13, { align: 'center' });

      autoTable(doc, {
          startY: 42,
          head: [['Period', 'Class', 'Absent Teacher', 'Replacement Teacher', 'Subject']],
          body: substitutionList.map(item => [
              item.period,
              item.className,
              item.absentTeacher,
              item.subTeacher,
              item.subject
          ]),
          headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold', fontSize: 10 },
          styles: { fontSize: 9, cellPadding: 4, font: 'helvetica' }
      });

      doc.save(`Substitution_Report_${selectedDate}.pdf`);
  };

  const filteredClasses = useMemo(() => {
      if (!classes) return [];
      if (classFilter === 'ALL') return classes;
      return classes.filter(cls => {
          const name = cls.name.toLowerCase();
          const isSrSec = name.includes('11') || name.includes('12');
          return classFilter === 'SR_SEC' ? isSrSec : !isSrSec;
      });
  }, [classes, classFilter]);

  const freeTeachersForCurrentSlot = useMemo(() => {
      if (!editingSlot || timetableMode === 'BASE') return [];
      return dataService.getFreeTeachers(selectedDate, selectedDayName, editingSlot.periodIndex) || [];
  }, [editingSlot, selectedDate, selectedDayName, timetableMode, scheduleData]);

  const renderCell = (classId: string, periodIndex: number) => {
    const isLunch = PERIODS[periodIndex].start === "11:15 AM";
    if (isLunch) return <div className="h-full w-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-[8px] text-slate-300 dark:text-slate-600 font-bold uppercase tracking-widest">Lunch</div>;
    
    const key = `${classId}_${periodIndex}`;
    const entry = scheduleData[key];

    if (entry) {
        const t1 = teachers.find(t => t.id === (entry.subTeacherId || entry.teacherId));
        const isAbsent1 = t1 && dailyAttendance[t1.id] === 'absent';
        const isOverride = entry.isOverride && timetableMode === 'DAILY';

        return (
            <div 
                onClick={() => handleCellClick(classId, periodIndex)} 
                className={`h-full w-full p-1 rounded border-l-2 flex flex-col justify-center cursor-pointer shadow-sm transition-all group relative overflow-hidden ${
                    isOverride ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-500' : 
                    isAbsent1 ? 'bg-red-50 dark:bg-red-900/20 border-red-500 animate-pulse-subtle' : 
                    'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                }`} 
                style={{ borderLeftColor: isOverride ? '#f59e0b' : isAbsent1 ? '#ef4444' : (t1?.color || '#ccc') }}
            >
                <div className="font-bold text-[9px] text-slate-800 dark:text-slate-200 truncate leading-tight">
                    {entry.subSubject || entry.subject || 'Empty'}
                </div>
                <div className={`text-[8px] truncate flex items-center gap-1 ${isAbsent1 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                    {t1?.name || '??'}
                    {isOverride && <Edit3 className="w-2 h-2 text-amber-500" />}
                </div>
                {isAbsent1 && (
                    <div className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl-md">
                        <AlertTriangle className="w-2.5 h-2.5" />
                    </div>
                )}
            </div>
        );
    }
    return <button onClick={() => handleCellClick(classId, periodIndex)} className="w-full h-full rounded border border-dashed border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">+</button>;
  };

  const handleCellClick = (classId: string, periodIndex: number) => {
    if (PERIODS[periodIndex].start === "11:15 AM") return;
    setEditingSlot({ classId, periodIndex });
    const key = `${classId}_${periodIndex}`;
    const entry = scheduleData[key];
    if (entry) {
        setSelectedTeacherId(entry.subTeacherId || entry.teacherId || '');
        setSelectedSubject(entry.subSubject || entry.subject || '');
        setIsSplit(!!entry.isSplit);
        setSplitTeacherId(entry.splitTeacherId || '');
        setSplitSubject(entry.splitSubject || '');
    } else {
        setSelectedTeacherId(''); setSelectedSubject(''); setIsSplit(false); setSplitTeacherId(''); setSplitSubject('');
    }
    setTeacherSearch('');
    setIsModalOpen(true);
  };

  const handleSaveSlot = () => {
    if (!editingSlot || !selectedTeacherId || !selectedSubject) return;
    const { classId, periodIndex } = editingSlot;
    if (timetableMode === 'BASE') {
        const entry: ScheduleEntry = { teacherId: selectedTeacherId, subject: selectedSubject, isSplit, splitTeacherId: isSplit ? splitTeacherId : undefined, splitSubject: isSplit ? splitSubject : undefined };
        dataService.saveBaseEntry(selectedDayName, classId, periodIndex, entry);
    } else {
        const baseEntry = dataService.getBaseSchedule(selectedDayName)[`${classId}_${periodIndex}`];
        if (baseEntry && baseEntry.teacherId === selectedTeacherId && baseEntry.subject === selectedSubject) {
            dataService.saveDailyOverride(selectedDate, classId, periodIndex, null);
        } else {
            const override: DailyOverride = { subTeacherId: selectedTeacherId, subSubject: selectedSubject, originalTeacherId: baseEntry?.teacherId || '', type: 'SUBSTITUTION' };
            dataService.saveDailyOverride(selectedDate, classId, periodIndex, override);
        }
    }
    refreshSchedule(selectedDate, selectedDayName, timetableMode);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 no-print">
        <div className="flex bg-slate-100 dark:bg-black p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button onClick={() => setTimetableMode('DAILY')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${timetableMode === 'DAILY' ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm' : 'text-slate-500'}`}><CalendarIcon className="w-4 h-4" /> Daily View</button>
            <button onClick={() => setTimetableMode('BASE')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${timetableMode === 'BASE' ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-sm' : 'text-slate-500'}`}><Layout className="w-4 h-4" /> Base Plan</button>
        </div>
        
        <div className={`flex items-center gap-2 transition-opacity shrink-0 ${timetableMode === 'BASE' ? 'opacity-30 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button onClick={() => adjustDate(-1)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all text-slate-600 dark:text-slate-400"><ChevronLeft className="w-5 h-5" /></button>
                <div className="relative flex items-center px-3 min-w-[130px] justify-center cursor-pointer group">
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="flex flex-col items-center pointer-events-none">
                        <span className="text-[9px] font-black text-brand-600 uppercase tracking-tighter leading-none">{selectedDayName}</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedDate}</span>
                    </div>
                </div>
                <button onClick={() => adjustDate(1)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all text-slate-600 dark:text-slate-400"><ChevronRight className="w-5 h-5" /></button>
            </div>
        </div>

        <div className="flex-1 flex gap-1 p-1 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
            {['ALL', 'SEC', 'SR_SEC'].map(f => (
                <button key={f} onClick={() => setClassFilter(f as any)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${classFilter === f ? 'bg-white dark:bg-slate-800 shadow-sm text-brand-700' : 'text-slate-500'}`}>{f === 'ALL' ? 'All Classes' : f === 'SEC' ? '6-10' : '11-12'}</button>
            ))}
        </div>

        <div className="flex gap-2 shrink-0">
            <button onClick={() => setIsSubListOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-amber-600 transition-colors">
                <ListChecks className="w-4 h-4" /> Substitution List
            </button>
            <button onClick={handleDownloadPDF} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl border dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-all"><FileText className="w-4 h-4" /></button>
            {currentRole === 'PRINCIPAL' && <button onClick={() => setIsClassManagerOpen(true)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl border dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-all"><Settings className="w-4 h-4" /></button>}
        </div>
      </div>

      <div className="timetable-container relative">
        <div ref={timetableRef} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative p-4">
            <div className="overflow-x-auto w-full custom-scrollbar">
                <div className="grid divide-x divide-slate-100 dark:divide-slate-800 min-w-[800px]" style={{ gridTemplateColumns: `60px repeat(${filteredClasses.length || 1}, 1fr)` }}>
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 text-[9px] font-black text-slate-400 uppercase text-center sticky left-0 z-20 border-b border-r border-slate-200 dark:border-slate-800">PRD</div>
                    {filteredClasses.map(cls => (
                        <div key={cls.id} className="bg-slate-50 dark:bg-slate-950 p-3 text-center uppercase text-[10px] font-black text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">{cls.name}</div>
                    ))}
                    {PERIODS.map((_, pIndex) => (
                        <React.Fragment key={pIndex}>
                            <div className="p-2 text-center border-t border-r border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 sticky left-0 z-20 flex flex-col justify-center">
                                <span className="font-black text-slate-700 dark:text-slate-400 text-[11px]">{getPeriodLabel(pIndex)}</span>
                            </div>
                            {filteredClasses.map(cls => (
                                <div key={`${cls.id}-${pIndex}`} className="h-16 p-1 border-t border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{renderCell(cls.id, pIndex)}</div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Substitution List Modal */}
      {isSubListOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md no-print">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-pop-in border border-slate-200 dark:border-slate-800">
                  <div className="bg-amber-500 p-5 flex justify-between items-center text-white shrink-0">
                      <div>
                          <h3 className="font-bold text-lg flex items-center gap-2"><ListChecks className="w-6 h-6" /> Substitution & Absence List</h3>
                          <p className="text-[10px] opacity-90 uppercase tracking-widest font-black">{selectedDate} — {selectedDayName}</p>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={handleDownloadSubListPDF} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-xs font-bold transition-all"><Printer className="w-4 h-4" /> Export Report</button>
                          <button onClick={() => setIsSubListOpen(false)} className="hover:bg-black/10 p-2 rounded-full"><X className="w-6 h-6"/></button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950">
                      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                                  <tr>
                                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Period</th>
                                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Class</th>
                                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-red-500">Absent Teacher</th>
                                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-green-500">Replacement</th>
                                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Subject</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {substitutionList && substitutionList.length > 0 ? substitutionList.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                          <td className="px-6 py-4 font-black text-slate-700 dark:text-slate-300">{item.period}</td>
                                          <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">{item.className}</td>
                                          <td className="px-6 py-4">
                                              <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-[11px] font-black uppercase">{item.absentTeacher}</span>
                                          </td>
                                          <td className="px-6 py-4">
                                              <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase ${item.subTeacher === 'REPLACEMENT NEEDED' ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'}`}>{item.subTeacher}</span>
                                          </td>
                                          <td className="px-6 py-4 text-slate-500 dark:text-slate-500 font-medium italic">{item.subject}</td>
                                      </tr>
                                  )) : (
                                      <tr>
                                          <td colSpan={5} className="px-6 py-20 text-center opacity-40">
                                              <Layout className="w-12 h-12 mx-auto mb-3" />
                                              <p className="font-black uppercase tracking-widest text-[10px]">No substitutions found for today</p>
                                          </td>
                                      </tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Assignment Editor Modal */}
      {isModalOpen && editingSlot && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm no-print">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-pop-in">
                <div className={`p-4 flex justify-between items-center text-white ${timetableMode === 'BASE' ? 'bg-purple-600' : 'bg-brand-600'}`}>
                    <div className="flex flex-col">
                        <h3 className="font-bold text-sm uppercase tracking-widest">{timetableMode} Mode Assignment</h3>
                        <p className="text-[10px] opacity-80">{classes.find(c => c.id === editingSlot.classId)?.name} • Period {getPeriodLabel(editingSlot.periodIndex)}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        {dailyAttendance[selectedTeacherId] === 'absent' && timetableMode === 'DAILY' && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-xl flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" />
                                <div className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-tighter">Teacher is marked ABSENT today! Replace immediately.</div>
                            </div>
                        )}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Subject</label>
                            <input type="text" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full bg-black border border-slate-800 text-white rounded-xl p-3 text-sm outline-none" placeholder="e.g. Mathematics" />
                        </div>
                        <div className="relative">
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Search Teacher</label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                                <input type="text" value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} className="w-full pl-9 bg-black border border-slate-800 text-white rounded-xl p-2.5 text-xs outline-none" placeholder="Filter names..." />
                            </div>
                        </div>
                        <div className="h-64 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl divide-y dark:divide-slate-800 bg-slate-50 dark:bg-black custom-scrollbar">
                            {teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase())).map(t => (
                                <button key={t.id} onClick={() => setSelectedTeacherId(t.id)} className={`w-full text-left p-3 text-[11px] font-medium transition-all flex items-center justify-between ${selectedTeacherId === t.id ? 'bg-brand-50 dark:bg-brand-900/20 font-bold text-brand-700' : 'hover:bg-slate-100 dark:hover:bg-slate-900 dark:text-slate-400'}`}>
                                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />{t.name}</div>
                                    {dailyAttendance[t.id] === 'absent' && <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black">ABSENT</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-brand-50 dark:bg-brand-900/10 p-4 rounded-2xl border border-brand-100 dark:border-brand-800 h-full flex flex-col">
                            <h4 className="text-[10px] font-black text-brand-700 dark:text-brand-400 uppercase mb-3 flex items-center gap-2">
                                <UserCheck className="w-4 h-4" /> Free Substitutes ({freeTeachersForCurrentSlot.length})
                            </h4>
                            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                                {freeTeachersForCurrentSlot.length > 0 ? freeTeachersForCurrentSlot.map(t => (
                                    <button 
                                        key={t.id} 
                                        onClick={() => setSelectedTeacherId(t.id)}
                                        className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 transition-all group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{t.name}</span>
                                        </div>
                                        <div className="text-[9px] bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-0.5 rounded-full font-black opacity-0 group-hover:opacity-100 transition-opacity">PICK</div>
                                    </button>
                                )) : (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                        <Users className="w-8 h-8 mb-2" />
                                        <p className="text-[9px] font-bold uppercase text-center">No free teachers<br/>this period</p>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-brand-100 dark:border-brand-800/50">
                                <button onClick={handleSaveSlot} className={`w-full py-3 text-[11px] font-bold text-white rounded-xl shadow-lg uppercase tracking-widest ${timetableMode === 'BASE' ? 'bg-purple-600' : 'bg-brand-600'}`}>Confirm Assignment</button>
                                <button onClick={() => setIsModalOpen(false)} className="w-full py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors mt-2">CANCEL</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
