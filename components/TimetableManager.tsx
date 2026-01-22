
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClassSection, PERIODS, Teacher, UserRole, ScheduleEntry, DailyOverride, SCHOOL_LOGO_URL, DAYS } from '../types';
import * as dataService from '../services/dataService';
import { 
  ChevronRight, ChevronLeft, X, Users, Edit3, AlertTriangle, FileText, 
  UserCheck, Search, ListChecks, Heart, MessageCircleWarning, Calendar, 
  Layout, Plus, Trash2, Layers, Repeat, Info, Download, Share2, ClipboardList, UserMinus
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

export const TimetableManager: React.FC<Props> = ({ currentRole }) => {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDayName, setSelectedDayName] = useState<string>('Monday');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timetableMode, setTimetableMode] = useState<'DAILY' | 'BASE'>('DAILY');
  const [scheduleData, setScheduleData] = useState<Record<string, any>>({});
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [activeSection, setActiveSection] = useState<TimetableSection>('SECONDARY');
  const [teacherInstructions, setTeacherInstructions] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{classId: string, periodIndex: number} | null>(null);
  
  // Swipe State for Class Manager
  const [swipedClassId, setSwipedClassId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  
  // Form State
  const [assignType, setAssignType] = useState<'NORMAL' | 'SPLIT' | 'FREE'>('NORMAL');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [splitTeacherId, setSplitTeacherId] = useState('');
  const [splitSubject, setSplitSubject] = useState('');
  const [periodNote, setPeriodNote] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [mergedClassIds, setMergedClassIds] = useState<string[]>([]);
  
  const timetableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClasses(dataService.getClasses() || []);
    setTeachers(dataService.getTeachers() || []);
    const now = new Date();
    setSelectedDate(now.toLocaleDateString('en-CA'));
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

  const freeTeachersForCurrentSlot = useMemo(() => {
      if (!editingSlot || timetableMode === 'BASE') return [];
      return dataService.getFreeTeachers(selectedDate, selectedDayName, editingSlot.periodIndex) || [];
  }, [editingSlot, selectedDate, selectedDayName, timetableMode, scheduleData]);

  const allFreeTeachers = useMemo<Record<string, Teacher[]>>(() => {
      const summary: Record<string, Teacher[]> = {};
      if (!selectedDate || !selectedDayName) return summary;
      PERIODS.forEach((_, idx) => {
          if (idx !== 3) { // Skip lunch
              summary[idx.toString()] = dataService.getFreeTeachers(selectedDate, selectedDayName, idx);
          }
      });
      return summary;
  }, [selectedDate, selectedDayName, scheduleData, dailyAttendance]);

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

  const handleSaveSlot = () => {
    if (!editingSlot) return;
    const { classId, periodIndex } = editingSlot;
    
    const payload: any = {
        teacherId: assignType === 'NORMAL' ? selectedTeacherId : (assignType === 'SPLIT' ? selectedTeacherId : undefined),
        subject: assignType === 'NORMAL' ? selectedSubject : (assignType === 'SPLIT' ? selectedSubject : undefined),
        note: assignType === 'FREE' ? periodNote : undefined,
        isSplit: assignType === 'SPLIT',
        splitTeacherId: assignType === 'SPLIT' ? splitTeacherId : undefined,
        splitSubject: assignType === 'SPLIT' ? splitSubject : undefined,
        mergedClassIds: mergedClassIds.length > 0 ? mergedClassIds : undefined
    };

    if (timetableMode === 'BASE') {
        dataService.saveBaseEntry(selectedDayName, classId, periodIndex, payload.teacherId || payload.note || payload.isSplit ? payload : null);
    } else {
        const baseEntry = dataService.getBaseSchedule(selectedDayName)[`${classId}_${periodIndex}`];
        dataService.saveDailyOverride(selectedDate, classId, periodIndex, payload.teacherId || payload.note || payload.isSplit ? {
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
    doc.addImage(SCHOOL_LOGO_URL, 'PNG', 10, 10, 20, 20);
    doc.setFontSize(22);
    doc.setTextColor(2, 132, 199);
    doc.text("SILVER STAR CONVENT SCHOOL", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(100);
    const sectionTitle = activeSection === 'SECONDARY' ? "Secondary Section (6th - 10th)" : "Sr. Secondary Section (11th & 12th)";
    doc.text(`${sectionTitle} - ${selectedDayName} (${selectedDate})`, 105, 28, { align: 'center' });

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
          row.push(`${entry.subject}/${entry.splitSubject}\n(${t1}/${t2})`);
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
      styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle', font: 'helvetica' },
      headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [241, 245, 249], width: 15 } },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 35;
    if (teacherInstructions) {
        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.setFont("helvetica", "bold");
        doc.text("TEACHER INSTRUCTIONS:", 10, finalY + 10);
        doc.setFont("helvetica", "normal");
        const splitText = doc.splitTextToSize(teacherInstructions, 270);
        doc.text(splitText, 10, finalY + 16);
    }
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Handcrafted by Lucky", 105, 200, { align: 'center' });
    doc.save(`SilverStar_Timetable_${activeSection}_${selectedDate}.pdf`);
  };

  const saveInstructions = () => {
      dataService.saveTeacherInstructions(selectedDate, teacherInstructions);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Instructions Saved", type: 'success' } }));
  };

  const handleAddClass = () => {
    const newClass: ClassSection = { id: Date.now().toString(), name: "New Class", section: activeSection };
    setClasses(dataService.saveClasses([...classes, newClass]));
  };

  const handleDeleteClass = (id: string) => {
    if(confirm("Are you sure? This will remove all timetable records for this class from all tables (Daily & Base).")){
        const updated = dataService.deleteClass(id);
        setClasses(updated);
        refreshData(selectedDate, selectedDayName);
        setSwipedClassId(null);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Class & Data Removed", type: 'success' } }));
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
    if (isLunch) return <div className="h-full w-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-[8px] text-slate-300 font-bold uppercase">Lunch</div>;
    
    const key = `${classId}_${periodIndex}`;
    const entry = scheduleData[key];
    
    if (entry) {
        if (entry.isSplit) {
            const t1 = teachers.find(t => t.id === entry.teacherId || entry.subTeacherId);
            const t2 = teachers.find(t => t.id === entry.splitTeacherId);
            return (
                <div onClick={() => handleCellClick(classId, periodIndex)} className="h-full w-full flex flex-col cursor-pointer border dark:border-slate-800 rounded overflow-hidden">
                    <div className="flex-1 p-1 flex flex-col justify-center border-b dark:border-slate-800 bg-brand-50/20" style={{ borderLeft: `3px solid ${t1?.color || '#ccc'}` }}>
                        <div className="text-[8px] font-black truncate">{entry.subject || entry.subSubject}</div>
                        <div className="text-[7px] text-slate-400 truncate">{t1?.name}</div>
                    </div>
                    <div className="flex-1 p-1 flex flex-col justify-center bg-purple-50/20" style={{ borderLeft: `3px solid ${t2?.color || '#ccc'}` }}>
                        <div className="text-[8px] font-black truncate">{entry.splitSubject}</div>
                        <div className="text-[7px] text-slate-400 truncate">{t2?.name}</div>
                    </div>
                </div>
            );
        }

        if (!entry.teacherId && !entry.subTeacherId && entry.note) {
            return (
                <div onClick={() => handleCellClick(classId, periodIndex)} className="h-full w-full p-1 bg-amber-50/30 dark:bg-amber-900/10 border-l-4 border-amber-400 rounded cursor-pointer flex flex-col justify-center">
                    <div className="text-[8px] font-black text-amber-700 uppercase tracking-tighter">FREE</div>
                    <div className="text-[8px] italic text-slate-500 truncate">{entry.note}</div>
                </div>
            );
        }

        const t = teachers.find(t => t.id === (entry.subTeacherId || entry.teacherId));
        const isAbsent = t && dailyAttendance[t.id] === 'absent';
        return (
            <div onClick={() => handleCellClick(classId, periodIndex)} className={`h-full w-full p-1 border-l-4 rounded cursor-pointer shadow-sm relative group ${isAbsent ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`} style={{ borderLeftColor: isAbsent ? '#ef4444' : (t?.color || '#ccc') }}>
                <div className="font-bold text-[9px] truncate">{entry.subSubject || entry.subject}</div>
                <div className={`text-[8px] truncate ${isAbsent ? 'text-red-500 font-black' : 'text-slate-500'}`}>{t?.name || 'Vacant'}</div>
                {entry.mergedClassIds && <Layers className="w-2 h-2 text-slate-300 absolute top-1 right-1" />}
                {isAbsent && <MessageCircleWarning className="w-2.5 h-2.5 text-red-500 absolute top-1 right-1" />}
            </div>
        );
    }
    
    return <button onClick={() => handleCellClick(classId, periodIndex)} className="w-full h-full border-2 border-dashed border-slate-100 dark:border-slate-800 rounded text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">+</button>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border dark:border-slate-800 shadow-sm">
            <button onClick={() => setActiveSection('SECONDARY')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'SECONDARY' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Secondary (6-10)</button>
            <button onClick={() => setActiveSection('SENIOR_SECONDARY')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'SENIOR_SECONDARY' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Sr. Secondary (11-12)</button>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-black shadow-lg transition-all"><Share2 className="w-4 h-4" /> Share Date Sheet</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border dark:border-slate-800 no-print">
        <div className="flex bg-slate-100 dark:bg-black p-1 rounded-xl">
            <button onClick={() => setTimetableMode('DAILY')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${timetableMode === 'DAILY' ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm' : 'text-slate-500'}`}><Calendar className="w-4 h-4" /> Daily</button>
            <button onClick={() => setTimetableMode('BASE')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${timetableMode === 'BASE' ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-sm' : 'text-slate-500'}`}><Layout className="w-4 h-4" /> Base</button>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button onClick={() => adjustDate(-1)} className="p-2 hover:bg-white rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
            <div className="px-3 text-center min-w-[100px]"><span className="block text-[9px] font-black text-brand-600 uppercase leading-none">{selectedDayName}</span><span className="text-sm font-bold">{selectedDate}</span></div>
            <button onClick={() => adjustDate(1)} className="p-2 hover:bg-white rounded-lg"><ChevronRight className="w-5 h-5" /></button>
        </div>
        {currentRole === 'PRINCIPAL' && (
            <button onClick={() => setIsClassManagerOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-white dark:hover:bg-slate-700 transition-all ml-auto border dark:border-slate-700"><Layers className="w-4 h-4" /> Manage Classes</button>
        )}
      </div>

      <div ref={timetableRef} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 p-4 relative overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
            <div className="grid divide-x dark:divide-slate-800 min-w-[900px]" style={{ gridTemplateColumns: `60px repeat(${sectionClasses.length || 1}, 1fr)` }}>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 text-[9px] font-black uppercase text-center sticky left-0 z-20 border-b dark:border-slate-800">PRD</div>
                {sectionClasses.map(cls => <div key={cls.id} className="bg-slate-50 dark:bg-slate-950 p-3 text-center uppercase text-[10px] font-black border-b dark:border-slate-800 truncate">{cls.name}</div>)}
                {PERIODS.map((_, pIndex) => (
                    <React.Fragment key={pIndex}>
                        <div className="p-2 text-center border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-950 sticky left-0 z-20 flex flex-col justify-center"><span className="font-black text-slate-700 dark:text-slate-400 text-[11px]">{getPeriodLabel(pIndex)}</span></div>
                        {sectionClasses.map(cls => <div key={`${cls.id}_${pIndex}`} className="h-20 p-1 border-t dark:border-slate-800 hover:bg-slate-50/50 transition-colors">{renderCell(cls.id, pIndex)}</div>)}
                    </React.Fragment>
                ))}
            </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-t dark:border-slate-800 pt-6">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><ClipboardList className="w-4 h-4 text-brand-600" /> Teacher Instructions</h4>
                    {currentRole === 'PRINCIPAL' && <button onClick={saveInstructions} className="text-[9px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1 rounded-lg hover:bg-brand-600 transition-all">Save</button>}
                </div>
                {currentRole === 'PRINCIPAL' ? <textarea value={teacherInstructions} onChange={(e) => setTeacherInstructions(e.target.value)} placeholder="Note instructions for today's staff..." rows={5} className="w-full text-xs" /> : <div className="w-full min-h-[100px] text-xs bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 italic text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{teacherInstructions || "No instructions provided."}</div>}
            </div>
            <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><UserCheck className="w-4 h-4 text-green-600" /> Free Teacher Summary</h4>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 max-h-[160px] overflow-y-auto custom-scrollbar">
                    {Object.entries(allFreeTeachers).map(([pIdx, freeOnes]) => (
                        <div key={pIdx} className="mb-2 last:mb-0 border-b last:border-0 border-slate-200 dark:border-slate-800 pb-1.5 flex gap-3">
                            <span className="text-[9px] font-black bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded h-fit min-w-[40px] text-center">PRD {getPeriodLabel(parseInt(pIdx))}</span>
                            <div className="flex flex-wrap gap-1.5">
                                {freeOnes && (freeOnes as Teacher[]).length > 0 ? (freeOnes as Teacher[]).map(t => (
                                    <span key={t.id} className="text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: t.color}} /> {t.name}</span>
                                )) : <span className="text-[9px] text-slate-400 italic">None free</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {isModalOpen && editingSlot && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm no-print">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border dark:border-slate-800">
                <div className={`p-4 flex justify-between items-center text-white ${timetableMode === 'BASE' ? 'bg-purple-600' : 'bg-brand-600'}`}>
                    <h3 className="font-bold text-sm uppercase tracking-widest">Assign: {classes.find(c => c.id === editingSlot.classId)?.name} (P{getPeriodLabel(editingSlot.periodIndex)})</h3>
                    <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5"/></button>
                </div>
                <div className="flex bg-slate-50 dark:bg-black p-1">
                    {['NORMAL', 'SPLIT', 'FREE'].map((t) => (
                        <button key={t} onClick={() => setAssignType(t as any)} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${assignType === t ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>
                    ))}
                </div>
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        {assignType === 'FREE' ? (
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Note</label><textarea value={periodNote} onChange={(e) => setPeriodNote(e.target.value)} rows={4} className="w-full text-sm" placeholder="Doing preparation..." /></div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b dark:border-slate-800">Assignment 1</h4>
                                        <input type="text" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full text-sm h-11" placeholder="Subject" />
                                        <div className="relative"><Search className="w-3.5 h-3.5 absolute left-3 top-4 text-slate-500" /><input type="text" value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} className="w-full pl-9 text-xs h-11" placeholder="Filter Teachers..." /></div>
                                    </div>
                                    {assignType === 'SPLIT' && (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest pb-1 border-b dark:border-slate-800">Assignment 2</h4>
                                            <input type="text" value={splitSubject} onChange={(e) => setSplitSubject(e.target.value)} className="w-full text-sm h-11" placeholder="Subject" />
                                            <select value={splitTeacherId} onChange={(e) => setSplitTeacherId(e.target.value)} className="w-full text-xs h-11">
                                                <option value="">Teacher 2</option>
                                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                {assignType !== 'SPLIT' && (
                                    <div className="p-4 bg-slate-50 dark:bg-black rounded-2xl border dark:border-slate-800">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Repeat className="w-4 h-4" /> Merge with other Classes</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            {classes.filter(c => c.id !== editingSlot.classId).map(c => (
                                                <button key={c.id} onClick={() => setMergedClassIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])} className={`px-2 py-1.5 rounded-lg border text-[9px] font-bold truncate transition-all ${mergedClassIds.includes(c.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}>{c.name}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="space-y-4 flex flex-col">
                        <div className="flex-1 bg-slate-50 dark:bg-black rounded-2xl border dark:border-slate-800 flex flex-col overflow-hidden">
                            <h4 className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-800">Teachers</h4>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                <button onClick={() => setSelectedTeacherId('')} className={`w-full text-left p-2.5 rounded-xl text-xs font-bold ${selectedTeacherId === '' ? 'bg-slate-200 dark:bg-slate-800' : 'text-slate-400'}`}>Vacant</button>
                                {teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase())).map(t => (
                                    <button key={t.id} onClick={() => setSelectedTeacherId(t.id)} className={`w-full text-left p-2.5 rounded-xl text-xs font-bold flex justify-between items-center ${selectedTeacherId === t.id ? 'bg-brand-600 text-white' : 'text-slate-500'}`}><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} /> {t.name}</div>{freeTeachersForCurrentSlot.some(f => f.id === t.id) && <span className="text-[8px] bg-green-500/20 text-green-500 px-1 px-1.5 rounded">FREE</span>}</button>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleSaveSlot} className="w-full py-3.5 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Save</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {isClassManagerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm no-print">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-slate-800">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-center"><h3 className="font-bold text-sm uppercase tracking-widest">Class Manager</h3><button onClick={() => { setIsClassManagerOpen(false); setSwipedClassId(null); }}><X className="w-5 h-5"/></button></div>
                <div className="p-6 space-y-4">
                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                        {classes.map(cls => (
                            <div key={cls.id} className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 mb-2 h-11">
                                <button onClick={() => handleDeleteClass(cls.id)} className="absolute right-0 top-0 bottom-0 w-20 bg-red-600 text-white flex flex-col items-center justify-center gap-0.5"><Trash2 className="w-4 h-4" /><span className="text-[8px] font-black uppercase">Delete</span></button>
                                <div className="absolute inset-0 bg-white dark:bg-slate-900 flex gap-2 items-center px-2 transition-transform duration-200 ease-out" style={{ transform: swipedClassId === cls.id ? 'translateX(-80px)' : 'translateX(0)' }} onTouchStart={(e) => handleTouchStart(e, cls.id)} onTouchMove={(e) => handleTouchMove(e, cls.id)} onTouchEnd={() => touchStartX.current = null}>
                                    <select value={cls.section} onChange={(e) => setClasses(dataService.saveClasses(classes.map(c => c.id === cls.id ? { ...c, section: e.target.value as any } : c)))} className="w-20 text-[10px] uppercase font-bold p-1 bg-slate-100 dark:bg-slate-800 border-none rounded shrink-0"><option value="SECONDARY">Sec</option><option value="SENIOR_SECONDARY">Sr Sec</option></select>
                                    <input type="text" value={cls.name} onChange={(e) => setClasses(dataService.saveClasses(classes.map(c => c.id === cls.id ? { ...c, name: e.target.value } : c)))} className="flex-1 text-sm h-8 bg-transparent !border-none px-0" />
                                    <button onClick={() => handleDeleteClass(cls.id)} className="hidden md:block p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddClass} className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> New Class</button>
                    <div className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-widest mt-2 italic">Tip: Swipe left on a row to delete</div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
