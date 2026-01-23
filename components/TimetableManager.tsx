import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClassSection, PERIODS, Teacher, UserRole, ScheduleEntry, DailyOverride, SCHOOL_LOGO_URL, DAYS, AttendanceStatus } from '../types';
import * as dataService from '../services/dataService';
import { 
  ChevronRight, ChevronLeft, X, Users, Edit3, AlertTriangle, FileText, 
  UserCheck, Search, ListChecks, Heart, MessageCircleWarning, Calendar as CalendarIcon, 
  Layout, Plus, Trash2, Layers, Repeat, Info, Download, Share2, ClipboardList, UserMinus, Sparkles, UserPlus, HelpCircle, ArrowRight, Save, Settings as SettingsIcon, CalendarDays, MousePointer2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    currentRole: UserRole;
}

type TimetableSection = 'SECONDARY' | 'SENIOR_SECONDARY';

const getPeriodLabel = (index: number) => {
    if (index === 3) return "LUNCH";
    const map: {[key: number]: string} = { 0: "I", 1: "II", 2: "III", 4: "IV", 5: "V", 6: "VI" };
    return map[index] || index.toString();
};

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

export const TimetableManager: React.FC<Props> = ({ currentRole }) => {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDayName, setSelectedDayName] = useState<string>('Monday');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timetableMode, setTimetableMode] = useState<'DAILY' | 'BASE'>('DAILY');
  const [scheduleData, setScheduleData] = useState<Record<string, any>>({});
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [activeSection, setActiveSection] = useState<TimetableSection>('SECONDARY');
  const [teacherInstructions, setTeacherInstructions] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{classId: string, periodIndex: number} | null>(null);
  
  const [swipedClassId, setSwipedClassId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  
  const [assignType, setAssignType] = useState<'NORMAL' | 'SPLIT' | 'FREE'>('NORMAL');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [splitTeacherId, setSplitTeacherId] = useState('');
  const [splitSubject, setSplitSubject] = useState('');
  const [periodNote, setPeriodNote] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [mergedClassIds, setMergedClassIds] = useState<string[]>([]);
  const [showNativePicker, setShowNativePicker] = useState(false);
  
  const timetableRef = useRef<HTMLDivElement>(null);

  const loadAll = () => {
    setClasses(dataService.getClasses() || []);
    setTeachers(dataService.getTeachers() || []);
    if(selectedDate && selectedDayName) refreshData(selectedDate, selectedDayName);
  };

  useEffect(() => {
    const now = new Date();
    setSelectedDate(now.toLocaleDateString('en-CA'));
    loadAll();

    const handleDataUpdate = () => {
        loadAll();
    };

    window.addEventListener('data-updated', handleDataUpdate);
    return () => window.removeEventListener('data-updated', handleDataUpdate);
  }, []);

  useEffect(() => {
      if(!selectedDate) return;
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      setSelectedDayName(dayName);
      refreshData(selectedDate, dayName);
      setTeacherInstructions(dataService.getTeacherInstructions(selectedDate));
  }, [selectedDate, timetableMode]);

  const refreshData = (date: string, day: string) => {
    setScheduleData(timetableMode === 'BASE' ? dataService.getBaseSchedule(day) : dataService.getEffectiveSchedule(date, day));
    setDailyAttendance(dataService.getAttendanceForDate(date));
  };

  const adjustDate = (days: number) => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      dateObj.setDate(dateObj.getDate() + days);
      setSelectedDate(dateObj.toLocaleDateString('en-CA'));
  };

  const teachersWithStatus = useMemo(() => {
    if (!editingSlot || !selectedDate || !selectedDayName) return [];
    return teachers.map(t => ({
        ...t,
        status: dataService.getTeacherDetailedStatus(t.id, selectedDate, selectedDayName, editingSlot.periodIndex)
    }));
  }, [teachers, editingSlot, selectedDate, selectedDayName, scheduleData, dailyAttendance]);

  const allFreeTeachers = useMemo<Record<string, Array<{t: Teacher, status: dataService.TeacherDetailedStatus}>>>(( ) => {
      const summary: Record<string, Array<{t: Teacher, status: dataService.TeacherDetailedStatus}>> = {};
      if (!selectedDate || !selectedDayName) return summary;
      
      PERIODS.forEach((_, idx) => {
          if (idx !== 3) { 
              const list = teachers.map(t => ({
                  t,
                  status: dataService.getTeacherDetailedStatus(t.id, selectedDate, selectedDayName, idx)
              })).filter(item => item.status.type === 'FREE');
              summary[idx.toString()] = list;
          }
      });
      return summary;
  }, [selectedDate, selectedDayName, scheduleData, dailyAttendance, teachers]);

  const unfilledAbsentPeriods = useMemo(() => {
      if (timetableMode === 'BASE') return [];
      return dataService.getUnfilledAbsentPeriods(selectedDate, selectedDayName);
  }, [selectedDate, selectedDayName, timetableMode, scheduleData, dailyAttendance]);

  const sectionClasses = useMemo(() => {
    return classes.filter(c => c.section === activeSection);
  }, [classes, activeSection]);

  const handleCellClick = (classId: string, periodIndex: number) => {
    if (PERIODS[periodIndex].start === "11:15 AM") return;
    setEditingSlot({ classId, periodIndex });
    const entry = scheduleData[`${classId}_${periodIndex}`];
    
    if (entry?.isSplit) setAssignType('SPLIT');
    else if (!entry?.teacherId && entry?.note) setAssignType('FREE');
    else setAssignType('NORMAL');

    setSelectedTeacherId(entry?.subTeacherId || entry?.teacherId || '');
    setSelectedSubject(entry?.subSubject || entry?.subject || '');
    setSplitTeacherId(entry?.splitTeacherId || '');
    setSplitSubject(entry?.splitSubject || '');
    setPeriodNote(entry?.subNote || entry?.note || '');
    setMergedClassIds(entry?.mergedClassIds || []);
    setTeacherSearch('');
    setIsModalOpen(true);
  };

  const handleSaveSlot = async () => {
    if (!editingSlot) return;
    const { classId, periodIndex } = editingSlot;
    
    const payload: any = {
        teacherId: assignType === 'NORMAL' || assignType === 'SPLIT' ? selectedTeacherId : undefined,
        subject: assignType === 'NORMAL' || assignType === 'SPLIT' ? selectedSubject : undefined,
        note: assignType === 'FREE' ? periodNote : undefined,
        isSplit: assignType === 'SPLIT',
        splitTeacherId: assignType === 'SPLIT' ? splitTeacherId : undefined,
        splitSubject: assignType === 'SPLIT' ? splitSubject : undefined,
        mergedClassIds: assignType === 'NORMAL' && mergedClassIds.length > 0 ? mergedClassIds : undefined
    };

    if (timetableMode === 'BASE') {
        await dataService.saveBaseEntry(selectedDayName, classId, periodIndex, payload.teacherId || payload.note || payload.isSplit ? payload : null);
    } else {
        const baseEntry = dataService.getBaseSchedule(selectedDayName)[`${classId}_${periodIndex}`];
        await dataService.saveDailyOverride(selectedDate, classId, periodIndex, payload.teacherId || payload.note || payload.isSplit ? {
            ...payload,
            subTeacherId: payload.teacherId,
            subSubject: payload.subject,
            subNote: payload.note,
            originalTeacherId: baseEntry?.teacherId || '',
            type: payload.isSplit ? 'SPLIT' : (payload.mergedClassIds ? 'MERGED' : (payload.teacherId ? 'SUBSTITUTION' : 'VACANT'))
        } : null);
    }
    
    refreshData(selectedDate, selectedDayName);
    setIsModalOpen(false);
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    await safeAddImage(doc, SCHOOL_LOGO_URL, 10, 10, 20, 20);
    
    doc.setFontSize(22);
    doc.setTextColor(2, 132, 199);
    doc.text("SILVER STAR CONVENT SCHOOL", 148, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(100);
    const sectionTitle = activeSection === 'SECONDARY' ? "Secondary Section (6th - 10th)" : "Sr. Secondary Section (11th & 12th)";
    doc.text(`${sectionTitle} - ${selectedDayName} (${selectedDate})`, 148, 28, { align: 'center' });

    const head = [['PRD', ...sectionClasses.map(c => c.name)]];
    const body = PERIODS.map((p, pIdx) => {
      const isLunch = p.start === "11:15 AM";
      if (isLunch) return ["LUNCH", ...sectionClasses.map(() => "---")];
      const row = [getPeriodLabel(pIdx)];
      sectionClasses.forEach(cls => {
        const entry = scheduleData[`${cls.id}_${pIdx}`];
        if (!entry) row.push("");
        else if (entry.isSplit) {
          const t1 = teachers.find(t => t.id === (entry.subTeacherId || entry.teacherId))?.name || "";
          const t2 = teachers.find(t => t.id === entry.splitTeacherId)?.name || "";
          row.push(`${entry.subSubject || entry.subject}/${entry.splitSubject}\n(${t1}/${t2})`);
        } else if (!entry.teacherId && !entry.subTeacherId && entry.note) row.push(`FREE: ${entry.note}`);
        else {
          const t = teachers.find(t => t.id === (entry.subTeacherId || entry.teacherId))?.name || "";
          row.push(`${entry.subSubject || entry.subject || ""}\n(${t})`);
        }
      });
      return row;
    });

    autoTable(doc, {
      head: head,
      body: body,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle', font: 'helvetica' },
      headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 15 } },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 35;
    if (teacherInstructions) {
        doc.setFontSize(11);
        doc.setTextColor(50);
        doc.setFont("helvetica", "bold");
        doc.text("PRINCIPAL INSTRUCTIONS:", 14, finalY + 12);
        doc.setFont("helvetica", "normal");
        const splitText = doc.splitTextToSize(teacherInstructions, 270);
        doc.text(splitText, 14, finalY + 18);
    }
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Official School Timetable Copy • Generated via SSC Cloud Management • Shared with School Group", 148, 200, { align: 'center' });
    doc.save(`SilverStar_Timetable_${selectedDate}.pdf`);
  };

  const saveInstructions = async () => {
      await dataService.saveTeacherInstructions(selectedDate, teacherInstructions);
  };

  const handleAddClass = async () => {
    const newClass: ClassSection = { id: Date.now().toString(), name: "New Class", section: activeSection };
    const updated = await dataService.saveClasses([...classes, newClass]);
    setClasses(updated);
  };

  const handleDeleteClass = async (id: string) => {
    if(confirm("Remove this class from the cloud database?")){
        const updated = await dataService.deleteClass(id);
        setClasses(updated);
        refreshData(selectedDate, selectedDayName);
        setSwipedClassId(null);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, classId: string) => touchStartX.current = e.targetTouches[0].clientX;

  const handleTouchMove = (e: React.TouchEvent, classId: string) => {
    if (touchStartX.current === null) return;
    const currentX = e.targetTouches[0].clientX;
    const diffX = touchStartX.current - currentX;
    if (diffX > 50) setSwipedClassId(classId);
    else if (diffX < -50) setSwipedClassId(null);
  };

  const renderCell = (classId: string, periodIndex: number) => {
    const isLunch = PERIODS[periodIndex].start === "11:15 AM";
    if (isLunch) return <div className="h-full w-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase border dark:border-slate-800/50 rounded-lg">Lunch</div>;
    
    const key = `${classId}_${periodIndex}`;
    const entry = scheduleData[key];
    
    if (entry) {
        if (entry.isSplit) {
            const t1 = teachers.find(t => t.id === entry.teacherId || entry.subTeacherId);
            const t2 = teachers.find(t => t.id === entry.splitTeacherId);
            return (
                <div onClick={() => handleCellClick(classId, periodIndex)} className="h-full w-full flex flex-col cursor-pointer border dark:border-slate-800 rounded-xl overflow-hidden group shadow-sm hover:shadow-md transition-all">
                    <div className="flex-1 p-1 flex flex-col justify-center border-b dark:border-slate-800 bg-brand-50/20 hover:bg-brand-50/40 transition-colors" style={{ borderLeft: `4px solid ${t1?.color || '#ccc'}` }}>
                        <div className="text-[9px] font-black truncate">{entry.subject || entry.subSubject}</div>
                        <div className="text-[8px] text-slate-500 truncate font-bold uppercase">{t1?.initials || '??'}</div>
                    </div>
                    <div className="flex-1 p-1 flex flex-col justify-center bg-purple-50/20 hover:bg-purple-50/40 transition-colors" style={{ borderLeft: `4px solid ${t2?.color || '#ccc'}` }}>
                        <div className="text-[9px] font-black truncate">{entry.splitSubject}</div>
                        <div className="text-[8px] text-slate-500 truncate font-bold uppercase">{t2?.initials || '??'}</div>
                    </div>
                </div>
            );
        }

        if (!entry.teacherId && !entry.subTeacherId && entry.note) {
            return (
                <div onClick={() => handleCellClick(classId, periodIndex)} className="h-full w-full p-2 bg-amber-50/40 dark:bg-amber-900/10 border-l-4 border-amber-400 rounded-xl cursor-pointer flex flex-col justify-center hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-all">
                    <div className="text-[9px] font-black text-amber-700 uppercase tracking-tighter mb-0.5">SELF STUDY</div>
                    <div className="text-[8px] italic text-slate-500 truncate leading-tight">{entry.note}</div>
                </div>
            );
        }

        const t = teachers.find(t => t.id === (entry.subTeacherId || entry.teacherId));
        const status = t ? dailyAttendance[t.id] : 'present';
        const isAbsent = status && status !== 'present';
        
        const LUNCH_PERIOD_INDEX = 3;
        const isCurrentlyAbsent = isAbsent && (
            (status === 'absent') ||
            (status === 'half_day_before' && periodIndex < LUNCH_PERIOD_INDEX) ||
            (status === 'half_day_after' && periodIndex > LUNCH_PERIOD_INDEX)
        );

        const isSubstituted = entry.isOverride && entry.subTeacherId;

        return (
            <div onClick={() => handleCellClick(classId, periodIndex)} className={`h-full w-full p-2 border-l-4 rounded-xl cursor-pointer shadow-sm relative group flex flex-col justify-center transition-all ${isCurrentlyAbsent ? 'bg-red-500/10 border-red-500 ring-2 ring-red-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'} ${isSubstituted ? 'bg-brand-50/40 dark:bg-brand-900/10 ring-1 ring-brand-500/20' : ''}`} style={{ borderLeftColor: isCurrentlyAbsent ? '#ef4444' : (t?.color || '#ccc') }}>
                <div className="font-black text-[10px] truncate leading-tight mb-0.5">{entry.subSubject || entry.subject}</div>
                <div className={`text-[9px] truncate leading-tight font-bold ${isCurrentlyAbsent ? 'text-red-600' : 'text-slate-500'}`}>{t?.name || 'Unassigned'}</div>
                {entry.mergedClassIds && <Layers className="w-2.5 h-2.5 text-slate-300 absolute top-1 right-1" />}
                {isCurrentlyAbsent && <MessageCircleWarning className="w-3 h-3 text-red-500 absolute top-1 right-1 animate-pulse" />}
                {isSubstituted && <UserCheck className="w-2.5 h-2.5 text-brand-500 absolute bottom-1 right-1" />}
            </div>
        );
    }
    
    return <button onClick={() => handleCellClick(classId, periodIndex)} className="w-full h-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-300 hover:text-brand-500 hover:bg-brand-50/50 dark:hover:bg-slate-800/50 transition-all font-black text-xs">+</button>;
  };

  return (
    <div className="space-y-6">
      {/* Premium Date & Mode Island */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between no-print bg-white dark:bg-slate-900 p-4 rounded-[2rem] shadow-xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border dark:border-slate-700/50 shadow-inner">
                <button onClick={() => setTimetableMode('DAILY')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${timetableMode === 'DAILY' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-lg scale-[1.05]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><CalendarIcon className="w-4 h-4" /> Daily</button>
                <button onClick={() => setTimetableMode('BASE')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${timetableMode === 'BASE' ? 'bg-white dark:bg-slate-800 text-purple-600 shadow-lg scale-[1.05]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Layout className="w-4 h-4" /> Base</button>
            </div>
            
            <div className="relative flex items-center gap-1 bg-slate-50 dark:bg-black/40 p-1.5 rounded-2xl border dark:border-slate-800 shadow-inner group">
                <button onClick={() => adjustDate(-1)} className="p-2.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm group-hover:scale-110"><ChevronLeft className="w-5 h-5 text-slate-400 hover:text-brand-600" /></button>
                
                <div 
                    onClick={() => setShowNativePicker(true)}
                    className="px-6 text-center min-w-[170px] py-1.5 cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-xl transition-all relative border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                    <span className="block text-[10px] font-black text-brand-600 uppercase tracking-widest leading-none mb-1">{selectedDayName}</span>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">{selectedDate}</span>
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                    </div>
                    {showNativePicker && (
                        <input 
                            type="date" 
                            autoFocus
                            value={selectedDate} 
                            onChange={(e) => { setSelectedDate(e.target.value); setShowNativePicker(false); }}
                            onBlur={() => setShowNativePicker(false)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                        />
                    )}
                </div>
                
                <button onClick={() => adjustDate(1)} className="p-2.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm group-hover:scale-110"><ChevronRight className="w-5 h-5 text-slate-400 hover:text-brand-600" /></button>
            </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border dark:border-slate-700/50">
                <button onClick={() => setActiveSection('SECONDARY')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeSection === 'SECONDARY' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-md ring-1 ring-slate-200/50' : 'text-slate-400 opacity-60'}`}>SEC (6-10)</button>
                <button onClick={() => setActiveSection('SENIOR_SECONDARY')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeSection === 'SENIOR_SECONDARY' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-md ring-1 ring-slate-200/50' : 'text-slate-400 opacity-60'}`}>SR SEC (11-12)</button>
            </div>
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-xl transition-all active:scale-95"><Download className="w-4 h-4" /> Share</button>
            {currentRole === 'PRINCIPAL' && (
                <button onClick={() => setIsClassManagerOpen(true)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-white dark:hover:bg-slate-700 transition-all border dark:border-slate-700 group"><SettingsIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" /></button>
            )}
        </div>
      </div>

      {unfilledAbsentPeriods.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-800 p-5 rounded-[2.5rem] flex items-center justify-between no-print animate-bounce-slow">
              <div className="flex items-center gap-5">
                  <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-3xl shadow-sm"><MessageCircleWarning className="w-8 h-8 text-red-600" /></div>
                  <div>
                      <h4 className="text-sm font-black text-red-800 dark:text-red-400 uppercase tracking-[0.2em]">Substitution Critical Alert</h4>
                      <p className="text-xs text-red-600 dark:text-red-500 font-bold mt-0.5">{unfilledAbsentPeriods.length} Classes are unmanaged. Substitution required immediately.</p>
                  </div>
              </div>
              <button onClick={() => {
                  const first = unfilledAbsentPeriods[0];
                  handleCellClick(first.classId, first.periodIndex);
              }} className="px-8 py-4 bg-red-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-red-700 transition-all flex items-center gap-3 active:scale-90">Auto-Solve <ArrowRight className="w-5 h-5" /></button>
          </div>
      )}

      {/* Main Grid: Precise & Aesthetic */}
      <div ref={timetableRef} className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-6 relative overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
            <div className="grid divide-x dark:divide-slate-800 min-w-[1000px] border-l dark:border-slate-800 rounded-3xl overflow-hidden shadow-inner bg-slate-50/30 dark:bg-black/20" style={{ gridTemplateColumns: `80px repeat(${sectionClasses.length || 1}, 1fr)` }}>
                {/* PRD Column Header */}
                <div className="bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-md p-4 text-[10px] font-black uppercase text-center sticky left-0 z-[45] border-b dark:border-slate-800 shadow-[4px_0_15px_rgba(0,0,0,0.08)]">PRD</div>
                
                {/* Class Column Headers */}
                {sectionClasses.map(cls => (
                    <div key={cls.id} className="bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-md p-4 text-center uppercase text-[12px] font-black border-b dark:border-slate-800 truncate sticky top-0 z-[40]">
                        <div className="text-brand-600 text-[8px] tracking-[0.3em] mb-1 font-black">CLASS</div>
                        {cls.name}
                    </div>
                ))}

                {/* Rows Mapping */}
                {PERIODS.map((_, pIndex) => (
                    <React.Fragment key={pIndex}>
                        {/* PRD Side Label */}
                        <div className="p-3 text-center border-t dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-md sticky left-0 z-[35] flex flex-col justify-center shadow-[4px_0_15px_rgba(0,0,0,0.08)] h-28">
                            <span className="font-black text-slate-800 dark:text-slate-100 text-[14px] leading-none mb-1">{getPeriodLabel(pIndex)}</span>
                            {pIndex !== 3 && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{PERIODS[pIndex].start}</span>}
                        </div>
                        
                        {/* Class Data Cells */}
                        {sectionClasses.map(cls => (
                            <div key={`${cls.id}_${pIndex}`} className={`h-28 p-2 border-t border-l dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-all ${pIndex === 3 ? 'bg-slate-200/20 dark:bg-slate-900/10' : ''}`}>
                                {renderCell(cls.id, pIndex)}
                            </div>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </div>

        {/* Improved Instruction & Availability Feed */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10 border-t dark:border-slate-800 pt-10">
            <div className="space-y-5">
                <div className="flex items-center justify-between px-3">
                    <h4 className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500"><ClipboardList className="w-5 h-5 text-brand-600" /> Principal's Dispatch</h4>
                    {currentRole === 'PRINCIPAL' && <button onClick={saveInstructions} className="flex items-center gap-2 text-[10px] font-black text-white bg-brand-600 px-5 py-2 rounded-xl hover:bg-brand-700 transition-all shadow-lg active:scale-95"><Save className="w-4 h-4" /> Save Feed</button>}
                </div>
                {currentRole === 'PRINCIPAL' ? (
                    <textarea 
                        value={teacherInstructions} 
                        onChange={(e) => setTeacherInstructions(e.target.value)} 
                        placeholder="Public instructions for staff today... (e.g., 'Late marks after 9:15 AM', 'Assembly at Play Area')" 
                        rows={7} 
                        className="w-full text-sm font-bold p-6 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-[2.5rem] focus:ring-8 ring-brand-500/5 transition-all placeholder:font-medium shadow-inner outline-none" 
                    />
                ) : (
                    <div className="w-full min-h-[160px] text-sm bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-7 italic text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed shadow-inner">
                        {teacherInstructions || "The Principal's Office has no additional dispatches for today's session."}
                    </div>
                )}
            </div>
            
            <div className="space-y-5">
                <h4 className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500 px-3"><UserCheck className="w-5 h-5 text-green-600" /> Deployment Feed</h4>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 max-h-[300px] overflow-y-auto custom-scrollbar shadow-inner">
                    {unfilledAbsentPeriods.length > 0 && (
                        <div className="mb-8 bg-red-100/60 dark:bg-red-900/20 p-5 rounded-3xl border border-red-200 dark:border-red-800 shadow-sm animate-pulse">
                             <h5 className="text-[11px] font-black text-red-600 uppercase mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Priority Deployments</h5>
                             <div className="space-y-3">
                                {unfilledAbsentPeriods.map((slot, i) => {
                                    const cls = classes.find(c => c.id === slot.classId);
                                    const teacher = teachers.find(t => t.id === slot.originalTeacherId);
                                    return (
                                        <button key={i} onClick={() => handleCellClick(slot.classId, slot.periodIndex)} className="w-full text-left p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl flex items-center justify-between group hover:border-brand-500 hover:shadow-xl transition-all">
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] font-black bg-brand-500 text-white px-3 py-1 rounded-xl">P{getPeriodLabel(slot.periodIndex)}</span>
                                                <div>
                                                    <span className="text-sm font-black text-slate-800 dark:text-slate-200 block leading-none">{cls?.name}</span>
                                                    <span className="text-[10px] font-bold text-red-500 uppercase mt-1 inline-block">• {teacher?.name}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <span className="text-[10px] font-black text-slate-400 group-hover:text-brand-600 uppercase tracking-tighter">Assign Now</span>
                                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </button>
                                    );
                                })}
                             </div>
                        </div>
                    )}
                    
                    <h5 className="text-[11px] font-black text-slate-400 uppercase mb-5 px-1 tracking-widest">Free Staff Directory</h5>
                    {(Object.entries(allFreeTeachers) as [string, Array<{t: Teacher, status: dataService.TeacherDetailedStatus}>][]).map(([pIdx, freeList]) => (
                        <div key={pIdx} className="mb-5 last:mb-0 border-b last:border-0 border-slate-200 dark:border-slate-800 pb-4 flex gap-6 items-start">
                            <span className="text-[11px] font-black bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-1.5 rounded-2xl h-fit min-w-[70px] text-center shadow-sm">P{getPeriodLabel(parseInt(pIdx))}</span>
                            <div className="flex flex-wrap gap-2.5 pt-1">
                                {freeList.length > 0 ? freeList.map(({t}) => (
                                    <span key={t.id} className="text-[12px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border dark:border-slate-800 hover:text-brand-600 hover:border-brand-500 hover:shadow-md transition-all cursor-default shadow-sm"><div className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-100 dark:ring-slate-800" style={{backgroundColor: t.color}} /> {t.name}</span>
                                )) : <span className="text-xs text-slate-400 italic py-2 font-medium opacity-60">Full Deployment</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Assignment Studio: Enhanced UI Picker */}
      {isModalOpen && editingSlot && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-lg no-print animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[4rem] shadow-[0_30px_100px_rgba(0,0,0,0.6)] w-full max-w-6xl overflow-hidden border dark:border-slate-800 animate-pop-in flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className={`p-8 flex justify-between items-center text-white ${timetableMode === 'BASE' ? 'bg-purple-600' : 'bg-brand-600'} shrink-0`}>
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/25 rounded-3xl flex items-center justify-center shadow-inner backdrop-blur-sm"><Edit3 className="w-8 h-8" /></div>
                        <div>
                            <h3 className="font-black text-3xl uppercase tracking-tighter">Assignment Studio</h3>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="px-3 py-1 bg-black/20 rounded-full text-[10px] font-black uppercase tracking-widest">{classes.find(c => c.id === editingSlot.classId)?.name}</span>
                                <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">Period {getPeriodLabel(editingSlot.periodIndex)}</span>
                                <span className="text-[10px] font-bold opacity-75">{PERIODS[editingSlot.periodIndex].start} - {PERIODS[editingSlot.periodIndex].end}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-4 bg-white/10 hover:bg-white/30 rounded-full transition-all hover:rotate-90 duration-300"><X className="w-8 h-8"/></button>
                </div>
                
                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Mode Tabs */}
                    <div className="flex bg-slate-50 dark:bg-black/50 p-3 border-b dark:border-slate-800 gap-3 shrink-0">
                        <button onClick={() => setAssignType('NORMAL')} className={`flex-1 flex items-center justify-center gap-3 py-5 text-sm font-black uppercase tracking-widest rounded-3xl transition-all ${assignType === 'NORMAL' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-2xl scale-[1.03] ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-700'}`}><Users className="w-5 h-5" /> Normal Session</button>
                        <button onClick={() => setAssignType('SPLIT')} className={`flex-1 flex items-center justify-center gap-3 py-5 text-sm font-black uppercase tracking-widest rounded-3xl transition-all ${assignType === 'SPLIT' ? 'bg-white dark:bg-slate-800 text-purple-600 shadow-2xl scale-[1.03] ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-700'}`}><Layers className="w-5 h-5" /> Split Period</button>
                        <button onClick={() => setAssignType('FREE')} className={`flex-1 flex items-center justify-center gap-3 py-5 text-sm font-black uppercase tracking-widest rounded-3xl transition-all ${assignType === 'FREE' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-2xl scale-[1.03] ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-700'}`}><Sparkles className="w-5 h-5" /> Self Study</button>
                    </div>

                    <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-10 overflow-y-auto custom-scrollbar">
                        {/* Configuration Column */}
                        <div className="lg:col-span-8 space-y-10">
                            {assignType === 'FREE' ? (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="p-12 bg-amber-50 dark:bg-amber-900/10 border-4 border-dashed border-amber-200 dark:border-amber-800 rounded-[3.5rem] flex flex-col items-center text-center gap-6">
                                        <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center shadow-lg"><Sparkles className="w-12 h-12 text-amber-500" /></div>
                                        <div>
                                            <h4 className="text-3xl font-black text-amber-800 dark:text-amber-500 uppercase tracking-tighter">Independent Learning</h4>
                                            <p className="text-base text-amber-600 font-bold max-w-md mt-2 leading-relaxed">No primary instructor is assigned. The class will engage in revision or self-study.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[12px] font-black text-slate-400 uppercase ml-6 tracking-[0.3em]">Session Directives</label>
                                        <textarea 
                                            value={periodNote} 
                                            onChange={(e) => setPeriodNote(e.target.value)} 
                                            rows={5} 
                                            className="w-full text-lg font-black p-8 bg-white dark:bg-black border-2 border-slate-200 dark:border-slate-800 rounded-[3rem] shadow-inner focus:ring-12 ring-amber-500/5 transition-all outline-none" 
                                            placeholder="What should students do? (e.g. 'Complete Science homework', 'Revision Unit 3')" 
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-10 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Block 1 */}
                                        <div className={`space-y-8 p-8 rounded-[3.5rem] transition-all border-2 ${assignType === 'SPLIT' ? 'bg-brand-50/20 dark:bg-brand-900/5 border-brand-200/50 dark:border-brand-800/50' : 'bg-white dark:bg-black border-slate-200 dark:border-slate-800 shadow-xl'}`}>
                                            <div className="flex items-center gap-4 border-b-2 dark:border-slate-800 pb-5">
                                                <div className="w-10 h-10 bg-brand-600 text-white rounded-2xl flex items-center justify-center font-black text-base shadow-lg shadow-brand-500/30">01</div>
                                                <h4 className="text-sm font-black text-brand-700 dark:text-brand-500 uppercase tracking-[0.2em]">Core Block</h4>
                                            </div>
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Subject Discipline</label>
                                                    <input type="text" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full text-base font-black h-14 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800" placeholder="e.g. Mathematics" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Search Lead Staff</label>
                                                    <div className="relative">
                                                        <Search className="w-5 h-5 absolute left-5 top-4.5 text-slate-400" />
                                                        <input type="text" value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} className="w-full pl-14 text-base font-black h-14 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800" placeholder="Type name..." />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Block 2 (Split Only) */}
                                        {assignType === 'SPLIT' ? (
                                            <div className="space-y-8 p-8 bg-purple-50/20 dark:bg-purple-900/5 rounded-[3.5rem] border-2 border-purple-200/50 dark:border-purple-800/50 shadow-xl animate-pop-in">
                                                <div className="flex items-center gap-4 border-b-2 dark:border-slate-800 pb-5">
                                                    <div className="w-10 h-10 bg-purple-600 text-white rounded-2xl flex items-center justify-center font-black text-base shadow-lg shadow-purple-500/30">02</div>
                                                    <h4 className="text-sm font-black text-purple-700 dark:text-purple-500 uppercase tracking-[0.2em]">Parallel Block</h4>
                                                </div>
                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Parallel Subject</label>
                                                        <input type="text" value={splitSubject} onChange={(e) => setSplitSubject(e.target.value)} className="w-full text-base font-black h-14 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800" placeholder="e.g. Hindi Grammar" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Choose Support Staff</label>
                                                        <select value={splitTeacherId} onChange={(e) => setSplitTeacherId(e.target.value)} className="w-full text-base font-black h-14 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800">
                                                            <option value="">Choose Staff...</option>
                                                            {teachers.map(t => (
                                                                <option key={t.id} value={t.id} disabled={dailyAttendance[t.id] && dailyAttendance[t.id] !== 'present'}>{t.name} {dailyAttendance[t.id] && dailyAttendance[t.id] !== 'present' ? '(!)' : ''}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Class Merging (Normal Only) */
                                            <div className="space-y-8 p-8 bg-slate-100/50 dark:bg-black/40 rounded-[3.5rem] border-2 border-slate-200 dark:border-slate-800">
                                                <h4 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3 border-b-2 dark:border-slate-800 pb-5"><Layers className="w-5 h-5 text-brand-600" /> Session Merge</h4>
                                                <p className="text-xs text-slate-400 font-bold px-1 leading-relaxed">Combine with other classes for simultaneous activity.</p>
                                                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar pr-3">
                                                    {classes.filter(c => c.id !== editingSlot.classId).map(c => (
                                                        <button 
                                                            key={c.id} 
                                                            onClick={() => setMergedClassIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])} 
                                                            className={`px-4 py-3 rounded-2xl border-2 text-[11px] font-black truncate transition-all ${mergedClassIds.includes(c.id) ? 'bg-brand-600 text-white border-brand-600 shadow-xl transform scale-105' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800 hover:border-brand-300'}`}
                                                        >
                                                            {c.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Staff Selection Column */}
                        <div className="lg:col-span-4 flex flex-col space-y-6">
                            <div className="flex-1 bg-white dark:bg-black rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden shadow-2xl">
                                <div className="p-7 border-b-2 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
                                    <h4 className="text-[12px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.2em] flex items-center gap-3"><MousePointer2 className="w-5 h-5 text-brand-600" /> Deployment Hub</h4>
                                    <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-tighter italic">Selection for Period {getPeriodLabel(editingSlot.periodIndex)}</p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                                    <button 
                                        onClick={() => setSelectedTeacherId('')} 
                                        className={`w-full text-left p-5 rounded-3xl text-xs font-black transition-all flex items-center justify-between group border-2 ${selectedTeacherId === '' ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-[1.02]' : 'text-slate-400 bg-slate-50 dark:bg-slate-900 border-transparent hover:border-slate-200 dark:hover:border-slate-800'}`}
                                    >
                                        <span className="tracking-widest">VACATE POSITION</span>
                                        <Trash2 className={`w-5 h-5 ${selectedTeacherId === '' ? 'text-red-400' : 'text-slate-300'}`} />
                                    </button>
                                    
                                    {teachersWithStatus
                                        .filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()))
                                        .sort((a, b) => (a.status.type === 'FREE' ? -1 : 1))
                                        .map(t => {
                                            const { type, busyInClass } = t.status;
                                            const isAbsent = type === 'ABSENT' || type === 'MORNING_LEAVE' || type === 'AFTERNOON_LEAVE';
                                            const isFree = type === 'FREE';
                                            
                                            return (
                                                <button 
                                                    key={t.id} 
                                                    onClick={() => setSelectedTeacherId(t.id)} 
                                                    className={`w-full text-left p-5 rounded-3xl text-sm font-bold flex flex-col transition-all border-2 ${selectedTeacherId === t.id ? 'bg-brand-600 text-white border-brand-500 shadow-2xl scale-[1.05]' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 hover:border-brand-400'}`}
                                                >
                                                    <div className="flex justify-between items-center w-full">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black shadow-lg transform group-hover:rotate-6 transition-transform" style={{ backgroundColor: t.color }}>{t.initials}</div> 
                                                            <span className="truncate max-w-[150px] font-black">{t.name}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {isFree ? (
                                                                <span className={`text-[9px] px-2.5 py-1 rounded-full font-black tracking-widest ${selectedTeacherId === t.id ? 'bg-white/30' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>FREE</span>
                                                            ) : (
                                                                <span className={`text-[9px] px-2.5 py-1 rounded-full font-black tracking-widest ${selectedTeacherId === t.id ? 'bg-white/30' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>{isAbsent ? 'LEAVE' : 'BUSY'}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!isFree && !isAbsent && <span className={`text-[10px] mt-2 font-black uppercase tracking-tighter ${selectedTeacherId === t.id ? 'text-white/80' : 'text-amber-500'}`}>Occupied: {busyInClass}</span>}
                                                    {isAbsent && <span className={`text-[10px] mt-2 font-black uppercase tracking-tighter ${selectedTeacherId === t.id ? 'text-white/80' : 'text-red-500'}`}>Not In Campus</span>}
                                                </button>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                            
                            <button onClick={handleSaveSlot} className="w-full py-6 bg-slate-900 dark:bg-brand-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.4em] shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:translate-y-[-4px] active:translate-y-[2px] transition-all flex items-center justify-center gap-4">
                                <Save className="w-6 h-6" /> Commit Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Class Manager: Polished & Modern */}
      {isClassManagerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl no-print animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl w-full max-w-xl overflow-hidden border dark:border-slate-800 animate-pop-in">
                <div className="p-8 bg-slate-800 text-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><Layers className="w-6 h-6 text-brand-400" /></div>
                        <div>
                            <h3 className="font-black text-lg uppercase tracking-[0.2em]">Class Registry</h3>
                            <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Global School Hierarchy</p>
                        </div>
                    </div>
                    <button onClick={() => { setIsClassManagerOpen(false); setSwipedClassId(null); }} className="p-3 hover:bg-white/10 rounded-full transition-all"><X className="w-6 h-6"/></button>
                </div>
                <div className="p-10 space-y-8">
                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                        {classes.map(cls => (
                            <div key={cls.id} className="relative overflow-hidden rounded-3xl bg-slate-50 dark:bg-slate-800 h-16 group shadow-sm">
                                <button onClick={() => handleDeleteClass(cls.id)} className="absolute right-0 top-0 bottom-0 w-28 bg-red-600 text-white flex flex-col items-center justify-center gap-1"><Trash2 className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">WIPE</span></button>
                                <div className="absolute inset-0 bg-white dark:bg-slate-900 flex gap-5 items-center px-6 transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) border dark:border-slate-800 rounded-3xl" style={{ transform: swipedClassId === cls.id ? 'translateX(-112px)' : 'translateX(0)' }} onTouchStart={(e) => handleTouchStart(e, cls.id)} onTouchMove={(e) => handleTouchMove(e, cls.id)} onTouchEnd={() => touchStartX.current = null}>
                                    <div className="flex flex-col gap-1 w-28 shrink-0">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Section</label>
                                        <select value={cls.section} onChange={async (e) => setClasses(await dataService.saveClasses(classes.map(c => c.id === cls.id ? { ...c, section: e.target.value as any } : c)))} className="text-[11px] font-black uppercase py-1 bg-slate-100 dark:bg-slate-800 rounded-xl border-none outline-none ring-1 ring-slate-200 dark:ring-slate-700"><option value="SECONDARY">Secondary</option><option value="SENIOR_SECONDARY">Sr Sec</option></select>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                                        <input type="text" value={cls.name} onChange={async (e) => setClasses(await dataService.saveClasses(classes.map(c => c.id === cls.id ? { ...c, name: e.target.value } : c)))} className="text-base font-black h-8 bg-transparent border-none p-0 outline-none ring-0" />
                                    </div>
                                    <button onClick={() => handleDeleteClass(cls.id)} className="hidden md:block p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"><Trash2 className="w-5 h-5" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddClass} className="w-full py-5 border-4 border-dashed border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-black uppercase tracking-[0.3em] rounded-[2.5rem] flex items-center justify-center gap-4 hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50/50 transition-all active:scale-95 group"><Plus className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" /> New Enrollment</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};