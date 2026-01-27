
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PERIODS, Teacher, UserRole, ScheduleEntry, DailyOverride, ClassSection, AttendanceStatus } from '../types';
import * as dataService from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { 
  ChevronRight, ChevronLeft, X, Layout, Plus, Calendar as CalendarIcon, 
  Loader2, Save, Download, UserCheck, Info, Settings, Trash2, Edit2, Check, Search, Eraser, UserX, Clock
} from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
    currentRole: UserRole;
}

export const TimetableManager: React.FC<Props> = ({ currentRole }) => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [timetableMode, setTimetableMode] = useState<'DAILY' | 'BASE'>('DAILY');
  const [activeSection, setActiveSection] = useState<'SECONDARY' | 'SENIOR_SECONDARY'>('SECONDARY');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{classId: string, periodIndex: number} | null>(null);
  
  // Assignment Form
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [periodNote, setPeriodNote] = useState('');
  
  // Daily Note
  const [dailyNote, setDailyNote] = useState('');

  // Class Management Form
  const [newClassName, setNewClassName] = useState('');
  const [newClassSection, setNewClassSection] = useState<'SECONDARY' | 'SENIOR_SECONDARY'>('SECONDARY');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const selectedDayName = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long' });
  }, [selectedDate]);

  // Use postgresService for classes now
  const { data: staticData } = useQuery({
    queryKey: ['static-data'],
    queryFn: async () => {
        // Attempt to fetch from API, fallbacks handled in postgresService
        const [c, t] = await Promise.all([postgresService.classes.getAll(), dataService.getTeachers()]);
        return { classes: c, teachers: t };
    },
    staleTime: 60000 
  });

  const teachers = staticData?.teachers || [];
  const classes = staticData?.classes || [];

  const { data: dbData } = useQuery({
    queryKey: ['schedule', selectedDate, selectedDayName],
    queryFn: () => postgresService.timetable.getEffective(selectedDate, selectedDayName),
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
    retry: false
  });

  const scheduleData = dbData?.schedule || {};
  const attendanceData = dbData?.attendance || {};
  const serverInstruction = dbData?.instruction || '';

  useEffect(() => {
    if (serverInstruction) setDailyNote(serverInstruction);
  }, [serverInstruction]);

  // --- MUTATIONS ---

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
        console.log("Saving Slot Payload:", payload); // Debug Log
        if (timetableMode === 'BASE') {
            return await postgresService.timetable.saveBase(selectedDayName, payload.classId, payload.periodIndex, payload.entry);
        } else {
            return await postgresService.timetable.saveSubstitution(selectedDate, selectedDayName, payload.classId, payload.periodIndex, payload.override);
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['schedule'] });
        setIsModalOpen(false);
        setTeacherSearch('');
    }
  });

  const instructionMutation = useMutation({
    mutationFn: (text: string) => postgresService.timetable.saveInstruction(selectedDate, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule'] })
  });

  // Individual Class Mutations
  const addClassMutation = useMutation({
    mutationFn: (newClass: ClassSection) => postgresService.classes.save(newClass),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['static-data'] });
        setNewClassName('');
        setEditingClassId(null);
    }
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id: string) => postgresService.classes.delete(id),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['static-data'] });
    }
  });

  // --- HELPERS ---

  const adjustDate = (days: number) => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      dateObj.setDate(dateObj.getDate() + days);
      setSelectedDate(dateObj.toLocaleDateString('en-CA'));
  };

  const sectionClasses = useMemo(() => {
    return classes.filter(c => c.section === activeSection);
  }, [classes, activeSection]);

  const freeTeachersPerPeriod = useMemo(() => {
    const LUNCH_PERIOD = 3;
    return PERIODS.map((_, pIdx) => {
        if (pIdx === LUNCH_PERIOD) return [];
        const busyIds = new Set<string>();
        
        Object.entries(scheduleData).forEach(([key, entry]: [string, any]) => {
            const [_, periodStr] = key.split('_');
            if (parseInt(periodStr) === pIdx) {
                if (entry.subTeacherId) busyIds.add(entry.subTeacherId);
                else if (entry.teacherId) busyIds.add(entry.teacherId);
            }
        });

        Object.entries(attendanceData).forEach(([tId, status]) => {
            if (status === 'absent') busyIds.add(tId);
            if (status === 'half_day_before' && pIdx < LUNCH_PERIOD) busyIds.add(tId);
            if (status === 'half_day_after' && pIdx > LUNCH_PERIOD) busyIds.add(tId);
        });

        return teachers.filter(t => !busyIds.has(t.id));
    });
  }, [teachers, scheduleData, attendanceData]);

  // --- HANDLERS ---

  const handleCellClick = (classId: string, periodIndex: number) => {
    if (PERIODS[periodIndex].label === "LUNCH") return;
    if (currentRole !== 'PRINCIPAL' && currentRole !== 'MANAGEMENT') return;
    
    setEditingSlot({ classId, periodIndex });
    const entry = scheduleData[`${classId}_${periodIndex}`];
    
    // Reset form
    setSelectedTeacherId(entry?.subTeacherId || entry?.teacherId || '');
    setSelectedSubject(entry?.subSubject || entry?.subject || '');
    setPeriodNote(entry?.subNote || entry?.note || '');
    setTeacherSearch('');
    
    setIsModalOpen(true);
  };

  const handleTeacherSelect = (teacher: Teacher) => {
    setSelectedTeacherId(teacher.id);
    // Auto-fill subject if available and current subject is empty
    if (teacher.subject && !selectedSubject) {
        setSelectedSubject(teacher.subject);
    }
  };

  const handleSaveSlot = (explicitData?: { teacherId?: string, subject?: string, note?: string, type?: 'SUBSTITUTION' | 'VACANT', isClear?: boolean }) => {
    if (!editingSlot) return;
    const { classId, periodIndex } = editingSlot;

    const teacherId = explicitData ? explicitData.teacherId : selectedTeacherId;
    const subject = explicitData ? explicitData.subject : selectedSubject;
    const note = explicitData ? explicitData.note : periodNote;
    const type = explicitData?.type || (teacherId ? 'SUBSTITUTION' : 'VACANT');
    const isClear = explicitData?.isClear;
    
    if (timetableMode === 'BASE') {
        const entry: ScheduleEntry = {
            teacherId: teacherId || undefined,
            subject: subject || undefined,
            note: note || undefined
        };
        saveMutation.mutate({ classId, periodIndex, entry: isClear ? null : entry });
    } else {
        // Daily Mode
        const override: DailyOverride = {
            subTeacherId: teacherId || undefined,
            subSubject: subject || undefined,
            subNote: note || undefined,
            originalTeacherId: scheduleData[`${classId}_${periodIndex}`]?.teacherId || '',
            type: type
        };
        saveMutation.mutate({ classId, periodIndex, override: isClear ? null : override });
    }
  };

  // Class Management Handlers
  const handleAddClass = () => {
    if(!newClassName.trim()) return;
    const newClass: ClassSection = {
      id: editingClassId || Date.now().toString(),
      name: newClassName.trim(),
      section: newClassSection
    };
    addClassMutation.mutate(newClass);
  };

  const handleUpdateClass = (id: string) => {
    // Re-use add logic for upsert
    handleAddClass();
  };

  const handleDeleteClass = (id: string) => {
    if(confirm('Delete this class? This will hide it from the schedule.')) {
      deleteClassMutation.mutate(id);
    }
  };

  // --- RENDERERS ---

  const renderCell = (classId: string, periodIndex: number) => {
    const isLunch = PERIODS[periodIndex].label === "LUNCH";
    if (isLunch) return <div className="h-full w-full bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center text-[9px] text-slate-400 font-black uppercase rounded-lg">Lunch</div>;
    
    const entry = scheduleData[`${classId}_${periodIndex}`];
    if (entry) {
        const t = teachers.find(t => t.id === (entry.subTeacherId || entry.teacherId));
        const isOverride = !!entry.isOverride;
        const isAbsent = entry.status === 'absent' || (entry.status === 'half_day_before' && periodIndex < 3) || (entry.status === 'half_day_after' && periodIndex > 3);
        
        let bgColor = isOverride ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-white dark:bg-slate-900';
        let borderColor = t?.color || '#ccc';
        if (isAbsent && !isOverride) {
            bgColor = 'bg-red-50 dark:bg-red-900/20';
            borderColor = '#ef4444';
        }

        return (
            <div onClick={() => handleCellClick(classId, periodIndex)} className={`h-full w-full p-2 border-l-4 rounded-xl cursor-pointer shadow-sm relative flex flex-col justify-center transition-all ${bgColor} border-slate-100 dark:border-slate-800`} style={{ borderLeftColor: borderColor }}>
                <div className="font-black text-[10px] truncate leading-tight mb-0.5 dark:text-slate-200">{entry.subSubject || entry.subject}</div>
                <div className="text-[9px] truncate font-bold text-slate-500">{t?.name || (isAbsent ? 'Absent' : 'Vacant')}</div>
                {isOverride && <div className="absolute top-1 right-1 px-1 bg-amber-500 text-white rounded text-[7px] font-black">SUB</div>}
                {isAbsent && !isOverride && <div className="absolute top-1 right-1 px-1 bg-red-500 text-white rounded text-[7px] font-black">LEAVE</div>}
            </div>
        );
    }
    return <button onClick={() => handleCellClick(classId, periodIndex)} className="w-full h-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-300 hover:text-brand-500 transition-all">+</button>;
  };

  const downloadPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(22);
    doc.setTextColor(2, 132, 199);
    doc.text("SILVER STAR CONVENT SCHOOL", 148.5, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`Daily Schedule: ${selectedDate} (${selectedDayName})`, 148.5, 22, { align: 'center' });

    const tableHeaders = ["PRD", ...sectionClasses.map(c => c.name)];
    const tableBody = PERIODS.map((p, pIdx) => {
        const row = [p.label];
        sectionClasses.forEach(c => {
            const entry = scheduleData[`${c.id}_${pIdx}`];
            if (p.label === "LUNCH") row.push("LUNCH");
            else if (!entry) row.push("-");
            else {
                const t = teachers.find(t => t.id === (entry.subTeacherId || entry.teacherId));
                let text = `${entry.subSubject || entry.subject || ''}\n${t?.name || 'Vacant'}`;
                if (entry.isOverride) text = `[SUB] ${text}`;
                row.push(text);
            }
        });
        return row;
    });

    autoTable(doc, {
        head: [tableHeaders],
        body: tableBody,
        startY: 30,
        styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [14, 165, 233] }
    });
    
    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    doc.setFontSize(12);
    doc.text("DAILY INSTRUCTIONS / ASSEMBLY NOTES:", 15, finalY + 10);
    doc.setFontSize(10);
    doc.text(dailyNote || "No instructions for today.", 15, finalY + 17, { maxWidth: 260 });
    doc.save(`SilverStar_Schedule_${selectedDate}.pdf`);
  };

  const filteredTeacherList = teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()));

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between no-print bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border dark:border-slate-700">
                <button onClick={() => setTimetableMode('DAILY')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${timetableMode === 'DAILY' ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-lg' : 'text-slate-500'}`}><CalendarIcon className="w-4 h-4" /> Daily</button>
                <button onClick={() => setTimetableMode('BASE')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${timetableMode === 'BASE' ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-lg' : 'text-slate-500'}`}><Layout className="w-4 h-4" /> Base</button>
            </div>
            
            <div className="relative flex items-center bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <button onClick={() => adjustDate(-1)} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group border-r dark:border-slate-800 mr-1"><ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" /></button>
                
                <div className="relative">
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => e.target.value && setSelectedDate(e.target.value)} 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <div className="px-6 text-center min-w-[160px] py-1 cursor-pointer group">
                        <span className="block text-[10px] font-black text-brand-600 uppercase tracking-widest leading-none mb-1 group-hover:text-brand-500 transition-colors">{selectedDayName}</span>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200 group-hover:text-brand-900 dark:group-hover:text-white transition-colors">{selectedDate}</span>
                            <CalendarIcon className="w-3 h-3 text-slate-300 group-hover:text-brand-500 transition-colors opacity-50 group-hover:opacity-100" />
                        </div>
                    </div>
                </div>

                <button onClick={() => adjustDate(1)} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group border-l dark:border-slate-800 ml-1"><ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" /></button>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            {(currentRole === 'PRINCIPAL' || currentRole === 'MANAGEMENT') && (
              <button onClick={() => setIsClassManagerOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border dark:border-slate-700">
                <Settings className="w-4 h-4" /> Manage Classes
              </button>
            )}
            <button onClick={downloadPDF} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg"><Download className="w-4 h-4" /> PDF</button>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border dark:border-slate-700">
                <button onClick={() => setActiveSection('SECONDARY')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeSection === 'SECONDARY' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md' : 'text-slate-400 opacity-60'}`}>SEC</button>
                <button onClick={() => setActiveSection('SENIOR_SECONDARY')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeSection === 'SENIOR_SECONDARY' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md' : 'text-slate-400 opacity-60'}`}>SR SEC</button>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-slate-200 dark:border-slate-800 p-6 overflow-x-auto custom-scrollbar">
        <div className="grid divide-x dark:divide-slate-800 min-w-[1000px] border-l dark:border-slate-800 rounded-3xl overflow-hidden bg-slate-50/30 dark:bg-slate-950/30" style={{ gridTemplateColumns: `80px repeat(${sectionClasses.length || 1}, 1fr)` }}>
            <div className="bg-slate-100 dark:bg-slate-950 p-4 text-[10px] font-black uppercase text-center border-b dark:border-slate-800">PRD</div>
            {sectionClasses.map(cls => (
                <div key={cls.id} className="bg-slate-100 dark:bg-slate-950 p-4 text-center uppercase text-[12px] font-black border-b dark:border-slate-800 truncate dark:text-slate-200">{cls.name}</div>
            ))}
            {PERIODS.map((p, pIndex) => (
                <React.Fragment key={pIndex}>
                    <div className={`p-3 text-center border-t dark:border-slate-800 bg-slate-100 dark:bg-slate-950 h-24 flex flex-col justify-center`}>
                        <span className="font-black text-slate-800 dark:text-slate-100 text-[16px] leading-none mb-1">{p.label}</span>
                    </div>
                    {sectionClasses.map(cls => (
                        <div key={`${cls.id}_${pIndex}`} className="h-24 p-2 border-t border-l dark:border-slate-800">
                            {renderCell(cls.id, pIndex)}
                        </div>
                    ))}
                </React.Fragment>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest mb-6 flex items-center gap-2"><UserCheck className="w-5 h-5 text-brand-600" /> Free Teachers Grid</h3>
              <div className="space-y-6">
                  {PERIODS.map((p, pIdx) => (
                      <div key={pIdx} className={`rounded-2xl border transition-all ${p.label === 'LUNCH' ? 'hidden' : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-800'}`}>
                          <div className="p-3 border-b dark:border-slate-800 flex items-center gap-3">
                              <span className="text-xs font-black text-white bg-slate-400 dark:bg-slate-700 w-6 h-6 rounded flex items-center justify-center">{p.label}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Staff</span>
                          </div>
                          <div className="p-3">
                             {freeTeachersPerPeriod[pIdx]?.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {freeTeachersPerPeriod[pIdx].map(t => (
                                      <div key={t.id} className="p-2 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 shadow-sm flex flex-col items-center text-center">
                                          <div className="w-6 h-6 rounded-full text-[8px] flex items-center justify-center text-white font-black mb-1" style={{backgroundColor: t.color}}>{t.initials}</div>
                                          <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 truncate w-full">{t.name}</span>
                                      </div>
                                  ))}
                                </div>
                             ) : (
                                <span className="text-[10px] font-bold text-red-400 italic pl-1">No free staff</span>
                             )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest mb-6 flex items-center gap-2"><Info className="w-5 h-5 text-purple-600" /> Daily Instructions</h3>
              <div className="flex-1 flex flex-col gap-4">
                  <textarea 
                    value={dailyNote}
                    onChange={(e) => setDailyNote(e.target.value)}
                    placeholder="Enter instructions for today (e.g., Assembly details, Duty notes)..."
                    className="flex-1 min-h-[300px] w-full p-6 text-sm bg-slate-50 dark:bg-slate-950 border-none rounded-[2rem] focus:ring-4 focus:ring-brand-500/10 resize-none font-medium dark:text-slate-300"
                  />
                  <button onClick={() => instructionMutation.mutate(dailyNote)} disabled={instructionMutation.isPending} className="w-full bg-brand-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-brand-700 shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
                    {instructionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Notes
                  </button>
              </div>
          </div>
      </div>

      {/* Teacher Assignment Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-pop-in border dark:border-slate-800 flex flex-col h-[85vh]">
                  {/* Modal Header */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-5 border-b dark:border-slate-800 flex justify-between items-center shrink-0">
                      <div>
                        <h3 className="font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 text-lg">
                            {timetableMode === 'DAILY' ? 'Assign Substitute' : 'Master Assignment'}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            {editingSlot && `${classes.find(c => c.id === editingSlot.classId)?.name} • Period ${PERIODS[editingSlot.periodIndex].label}`}
                        </p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 text-slate-500"/></button>
                  </div>
                  
                  {/* Modal Body - Scrollable */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                      <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                        {/* Search */}
                        <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 pb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search teacher..." 
                                    value={teacherSearch}
                                    onChange={e => setTeacherSearch(e.target.value)}
                                    className="w-full pl-10 h-11 text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500/20 transition-all"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="grid grid-cols-1 gap-2">
                             <button 
                                onClick={() => { setSelectedTeacherId(''); setSelectedSubject(''); }}
                                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${!selectedTeacherId ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-500' : 'border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                             >
                                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400 shrink-0">
                                    <UserX className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Free / Vacant Period</p>
                                    <p className="text-[9px] text-slate-400">Mark this slot as empty</p>
                                </div>
                                {!selectedTeacherId && <Check className="w-5 h-5 text-amber-600" />}
                             </button>

                            {filteredTeacherList.map(t => {
                                const isAbsent = attendanceData[t.id] === 'absent';
                                const isSelected = selectedTeacherId === t.id;
                                const isHalfDay = attendanceData[t.id] === 'half_day_before' || attendanceData[t.id] === 'half_day_after';
                                
                                return (
                                    <button 
                                        key={t.id}
                                        onClick={() => handleTeacherSelect(t)}
                                        className={`p-2 rounded-xl border text-left flex items-center gap-3 transition-all group ${isSelected ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-600' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'} ${isAbsent ? 'opacity-60 bg-red-50/50 dark:bg-red-900/10' : ''}`}
                                    >
                                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] text-white font-bold shrink-0 shadow-sm" style={{backgroundColor: t.color}}>{t.initials}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>{t.name}</p>
                                            <div className="flex items-center gap-2">
                                                {isAbsent ? (
                                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-wider bg-red-100 dark:bg-red-900/30 px-1.5 rounded">Absent</span>
                                                ) : isHalfDay ? (
                                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 px-1.5 rounded">Half Day</span>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-400">Available</span>
                                                )}
                                                {t.subject && <span className="text-[9px] text-slate-400 border-l pl-2 dark:border-slate-700">{t.subject}</span>}
                                            </div>
                                        </div>
                                        {isSelected && <Check className="w-5 h-5 text-brand-600" />}
                                    </button>
                                );
                            })}
                        </div>
                      </div>

                      {/* Inputs Section */}
                      <div className="p-5 bg-slate-50/80 dark:bg-slate-950/80 border-t dark:border-slate-800 backdrop-blur-sm space-y-4 shrink-0">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Subject</label>
                                <input 
                                    type="text" 
                                    value={selectedSubject} 
                                    onChange={(e) => setSelectedSubject(e.target.value)} 
                                    className="w-full text-sm h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500/20 px-3 font-medium" 
                                    placeholder="e.g. Math" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Note / Room</label>
                                <input 
                                    type="text" 
                                    value={periodNote} 
                                    onChange={(e) => setPeriodNote(e.target.value)} 
                                    className="w-full text-sm h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500/20 px-3" 
                                    placeholder="Optional" 
                                />
                            </div>
                         </div>
                         
                         <div className="flex gap-3 pt-2">
                             <button 
                                onClick={() => handleSaveSlot({ isClear: true })}
                                className="px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs font-black uppercase hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                                title="Reset Slot to Default"
                              >
                                <Eraser className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleSaveSlot()} 
                                disabled={saveMutation.isPending}
                                className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-brand-700 shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                              >
                                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Confirm Assignment
                              </button>
                         </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Class Manager Modal */}
      {isClassManagerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-pop-in border dark:border-slate-800 flex flex-col max-h-[85vh]">
              <div className="bg-slate-50 dark:bg-slate-950 p-6 border-b dark:border-slate-800 flex justify-between items-center">
                  <h3 className="font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-brand-600" /> Manage Classes
                  </h3>
                  <button onClick={() => { setIsClassManagerOpen(false); setNewClassName(''); setEditingClassId(null); }}><X className="w-5 h-5 text-slate-500"/></button>
              </div>

              <div className="p-6 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">{editingClassId ? 'Edit Class' : 'Add New Class'}</label>
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newClassName} 
                        onChange={e => setNewClassName(e.target.value)}
                        placeholder="Class Name (e.g. 10-C)" 
                        className="flex-1 text-sm h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-xl px-3"
                      />
                      <select 
                        value={newClassSection}
                        onChange={(e: any) => setNewClassSection(e.target.value)}
                        className="text-xs h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-xl px-2"
                      >
                        <option value="SECONDARY">Secondary</option>
                        <option value="SENIOR_SECONDARY">Sr. Secondary</option>
                      </select>
                      {editingClassId ? (
                         <div className="flex gap-1">
                           <button onClick={() => handleUpdateClass(editingClassId)} disabled={addClassMutation.isPending} className="bg-brand-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-brand-700 disabled:opacity-50">
                               {addClassMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-5 h-5"/>}
                           </button>
                           <button onClick={() => { setEditingClassId(null); setNewClassName(''); }} className="bg-slate-200 dark:bg-slate-800 text-slate-600 w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-300"><X className="w-5 h-5"/></button>
                         </div>
                      ) : (
                         <button onClick={handleAddClass} disabled={addClassMutation.isPending} className="bg-brand-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-brand-700 disabled:opacity-50">
                             {addClassMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-5 h-5"/>}
                         </button>
                      )}
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  <div className="space-y-2">
                      {classes.map(cls => (
                          <div key={cls.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl group hover:border-brand-200 dark:hover:border-slate-700 transition-colors">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center text-xs font-black text-slate-500">{cls.name.substring(0,2)}</div>
                                  <div>
                                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{cls.name}</h4>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase">{cls.section === 'SECONDARY' ? 'Sec' : 'Sr. Sec'}</p>
                                  </div>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditingClassId(cls.id); setNewClassName(cls.name); setNewClassSection(cls.section); }} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                                  <button onClick={() => handleDeleteClass(cls.id)} disabled={deleteClassMutation.isPending} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                      {deleteClassMutation.isPending && deleteClassMutation.variables === cls.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                                  </button>
                              </div>
                          </div>
                      ))}
                      {classes.length === 0 && <p className="text-center text-slate-400 text-xs py-8">No classes found.</p>}
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
