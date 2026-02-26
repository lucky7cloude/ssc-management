
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PERIODS, Teacher, UserRole, ScheduleEntry, DailyOverride, ClassSection, AttendanceStatus, PeriodConfig } from '../types';
import * as dataService from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { 
  ChevronRight, ChevronLeft, X, Layout, Plus, Calendar as CalendarIcon, 
  Loader2, Save, Download, UserCheck, Info, Settings, Trash2, Edit2, Check, Search, Eraser, UserX, Clock,
  ArrowUp, ArrowDown, ChevronDown
} from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
    currentRole: UserRole;
}

export const TimetableManager: React.FC<Props> = ({ currentRole }) => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
  const [customCopyDate, setCustomCopyDate] = useState('');

  const { data: staticData } = useQuery({
    queryKey: ['static-data'],
    queryFn: async () => {
        // Attempt to fetch from API, fallbacks handled in postgresService
        const [c, t, p] = await Promise.all([
            dataService.getClasses(), 
            dataService.getTeachers(),
            dataService.getPeriodConfigs()
        ]);
        return { classes: c, teachers: t, periodConfigs: p };
    },
    staleTime: 60000 
  });

  const teachers = staticData?.teachers || [];
  const classes = staticData?.classes || [];
  const periodConfigs = staticData?.periodConfigs || [];

  // Initialize selected classes when classes load
  useEffect(() => {
    if (classes.length > 0 && selectedClassIds.length === 0) {
      setSelectedClassIds(classes.map((c: ClassSection) => c.id));
    }
  }, [classes, selectedClassIds.length]);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'CLASSES' | 'PERIODS'>('CLASSES');
  const [tempPeriods, setTempPeriods] = useState<Record<number, {start: string, end: string}>>({});
  const [isAttendanceManagerOpen, setIsAttendanceManagerOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{classId: string, periodIndex: number} | null>(null);
  
  // Assignment Form
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [periodNote, setPeriodNote] = useState('');

  // Split & Merge States
  const [splitTeacherId, setSplitTeacherId] = useState('');
  const [splitSubject, setSplitSubject] = useState('');
  const [splitNote, setSplitNote] = useState('');
  const [mergedClassIds, setMergedClassIds] = useState<string[]>([]);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [isMergeMode, setIsMergeMode] = useState(false);

  // Substitution Pop-up
  const [substituteFor, setSubstituteFor] = useState<{ teacherId: string, name: string, status: AttendanceStatus } | null>(null);
  const [subSearch, setSubSearch] = useState('');
  
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

  const [editingPeriodIndex, setEditingPeriodIndex] = useState<number | null>(null);
  const [editingPeriodStart, setEditingPeriodStart] = useState('');
  const [editingPeriodEnd, setEditingPeriodEnd] = useState('');

  const activePeriods = useMemo(() => {
    if (periodConfigs && periodConfigs.length > 0) {
      return periodConfigs.map(p => ({
        start: p.start_time,
        end: p.end_time,
        label: p.label || p.period_index.toString(),
        is_lunch: p.is_lunch
      }));
    }
    return PERIODS;
  }, [periodConfigs]);

  useEffect(() => {
    if (isClassManagerOpen && periodConfigs) {
      const initial: Record<number, {start: string, end: string}> = {};
      activePeriods.forEach((_, idx) => {
        const config = periodConfigs.find(pc => pc.period_index === idx);
        initial[idx] = {
          start: config?.start_time || '',
          end: config?.end_time || ''
        };
      });
      setTempPeriods(initial);
    }
  }, [isClassManagerOpen, periodConfigs, activePeriods]);

  const { data: dbData } = useQuery({
    queryKey: ['schedule', selectedDate, selectedDayName],
    queryFn: () => dataService.getFullTimetableData(selectedDate, selectedDayName),
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
    retry: false
  });

  const scheduleData = useMemo(() => {
    return dbData?.schedule || {};
  }, [dbData]);

  const attendanceData = dbData?.attendance || {};
  const serverInstruction = dbData?.instruction || '';

  useEffect(() => {
    if (serverInstruction) setDailyNote(serverInstruction);
  }, [serverInstruction]);

  // --- MUTATIONS ---

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
        console.log("Saving Slot Payload:", payload); // Debug Log
        return await dataService.saveDailyOverride(selectedDate, selectedDayName, payload.classId, payload.periodIndex, payload.override);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['schedule'] });
        setIsModalOpen(false);
        setTeacherSearch('');
    }
  });

  const attendanceMutation = useMutation({
    mutationFn: ({ teacherId, status }: { teacherId: string, status: AttendanceStatus }) => 
        dataService.markTeacherAttendance(selectedDate, teacherId, status),
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['schedule'] });
        if (variables.status !== 'present') {
            const teacher = teachers.find(t => t.id === variables.teacherId);
            if (teacher) setSubstituteFor({ teacherId: teacher.id, name: teacher.name, status: variables.status });
        }
    }
  });

  const instructionMutation = useMutation({
    mutationFn: (text: string) => dataService.saveTeacherInstructions(selectedDate, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule'] })
  });

  // Individual Class Mutations
  const addClassMutation = useMutation({
    mutationFn: (newClass: ClassSection) => dataService.saveClasses([newClass]),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['static-data'] });
        setNewClassName('');
        setEditingClassId(null);
    }
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id: string) => {
        // We don't have a deleteClass in dataService, let's just use postgresService directly for now
        // or add it to dataService.
        return postgresService.classes.delete(id);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['static-data'] });
    }
  });

  const savePeriodsMutation = useMutation({
    mutationFn: (configs: PeriodConfig[]) => dataService.savePeriodConfigs(configs),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['static-data'] });
        setIsClassManagerOpen(false);
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
    if (selectedClassIds.length === 0) return classes;
    return classes.filter((c: ClassSection) => selectedClassIds.includes(c.id));
  }, [classes, selectedClassIds]);

  const freeTeachersPerPeriod = useMemo(() => {
    return activePeriods.map((_, pIdx) => {
        if (activePeriods[pIdx].is_lunch) return [];
        const busyIds = new Set<string>();
        
        Object.entries(scheduleData).forEach(([key, entry]: [string, any]) => {
            const parts = key.split('_');
            const periodStr = parts.pop();
            if (periodStr && parseInt(periodStr) === pIdx) {
                const activeTeacherId = 'subTeacherId' in entry ? entry.subTeacherId : entry.teacherId;
                if (activeTeacherId) busyIds.add(activeTeacherId);
                if (entry.splitTeacherId) busyIds.add(entry.splitTeacherId);
            }
        });

        Object.entries(attendanceData).forEach(([tId, status]) => {
            if (status === 'absent') busyIds.add(tId);
            const lunchIndex = activePeriods.findIndex(p => p.is_lunch);
            if (status === 'half_day_before' && pIdx < lunchIndex) busyIds.add(tId);
            if (status === 'half_day_after' && pIdx > lunchIndex) busyIds.add(tId);
        });

        return teachers.filter(t => !busyIds.has(t.id));
    });
  }, [teachers, scheduleData, attendanceData]);

  // --- HANDLERS ---

  const handleCellClick = (classId: string, periodIndex: number) => {
    if (activePeriods[periodIndex].is_lunch) return;
    if (currentRole !== 'PRINCIPAL' && currentRole !== 'MANAGEMENT') return;
    
    setEditingSlot({ classId, periodIndex });
    const entry = scheduleData[`${classId}_${periodIndex}`];
    
    // Reset form
    const activeTeacherId = entry ? ('subTeacherId' in entry ? entry.subTeacherId : entry.teacherId) : '';
    setSelectedTeacherId(activeTeacherId || '');
    setSelectedSubject(entry?.subSubject || entry?.subject || '');
    setPeriodNote(entry?.subNote || entry?.note || '');
    
    setSplitTeacherId(entry?.splitTeacherId || '');
    setSplitSubject(entry?.splitSubject || '');
    setSplitNote(entry?.splitNote || '');
    setMergedClassIds(entry?.mergedClassIds || []);
    setIsSplitMode(!!entry?.splitTeacherId);
    setIsMergeMode(!!entry?.mergedClassIds?.length);

    setTeacherSearch('');
    
    setIsModalOpen(true);
  };

  const handleTeacherSelect = (teacher: any) => {
    if (teacher.isBusy) {
        if (!window.confirm(`${teacher.name} is already busy in ${teacher.busyInClass}. Are you sure you want to assign them here too?`)) {
            return;
        }
    }
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
    
    // Daily Mode
    const override: DailyOverride = {
        subTeacherId: teacherId || null,
        subSubject: subject || null,
        subNote: note || null,
        originalTeacherId: (dbData?.baseSchedule as any)?.[`${classId}_${periodIndex}`]?.teacherId || '',
        type: type,
        splitTeacherId: isSplitMode ? splitTeacherId || null : null,
        splitSubject: isSplitMode ? splitSubject || null : null,
        splitNote: isSplitMode ? splitNote || null : null,
        mergedClassIds: isMergeMode ? mergedClassIds : null
    };
    saveMutation.mutate({ classId, periodIndex, override: isClear ? null : override });

    // Also save to merged classes
    if (isMergeMode && mergedClassIds.length > 0) {
        mergedClassIds.forEach(mId => {
            const mOriginalTeacherId = (dbData?.baseSchedule as any)?.[`${mId}_${periodIndex}`]?.teacherId || '';
            saveMutation.mutate({ 
                classId: mId, 
                periodIndex, 
                override: isClear ? null : { 
                    ...override, 
                    originalTeacherId: mOriginalTeacherId,
                    mergedClassIds: [classId, ...mergedClassIds.filter(id => id !== mId)] 
                } 
            });
        });
    }
  };

  // Class Management Handlers
  const handleAddClass = () => {
    if(!newClassName.trim()) return;
    const newClass: ClassSection = {
      id: editingClassId || Date.now().toString(),
      name: newClassName.trim(),
      section: newClassSection,
      sort_order: editingClassId ? classes.find(c => c.id === editingClassId)?.sort_order : classes.length
    };
    addClassMutation.mutate(newClass);
  };

  const handleUpdateClass = (id: string) => {
    if(!newClassName.trim()) return;
    const updatedClass: ClassSection = {
      id,
      name: newClassName.trim(),
      section: newClassSection,
      sort_order: classes.find(c => c.id === id)?.sort_order
    };
    addClassMutation.mutate(updatedClass);
  };

  const handleMoveClass = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = classes.findIndex(c => c.id === id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= classes.length) return;
    
    const list = [...classes];
    const [moved] = list.splice(currentIndex, 1);
    list.splice(newIndex, 0, moved);
    
    // Update all sort orders
    const updates = list.map((c, idx) => ({ ...c, sort_order: idx }));
    
    await dataService.saveClasses(updates);
    queryClient.invalidateQueries({ queryKey: ['static-data'] });
  };

  const handleDeleteClass = (id: string) => {
    if(confirm('Delete this class? This will remove all its timetable entries.')) {
      deleteClassMutation.mutate(id);
    }
  };

  // --- RENDERERS ---

  const renderCell = (classId: string, periodIndex: number) => {
    const isLunch = activePeriods[periodIndex].is_lunch;
    if (isLunch) return <div className="h-full w-full bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center text-[9px] text-slate-400 font-black uppercase rounded-lg">Lunch</div>;
    
    const entry = scheduleData[`${classId}_${periodIndex}`];
    if (entry) {
        const activeTeacherId = 'subTeacherId' in entry ? entry.subTeacherId : entry.teacherId;
        const t = teachers.find(t => t.id === activeTeacherId);
        const isOverride = !!entry.isOverride;
        const isAbsent = entry.status === 'absent' || (entry.status === 'half_day_before' && periodIndex < 3) || (entry.status === 'half_day_after' && periodIndex > 3);
        
        let bgColor = isOverride ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-white dark:bg-slate-900';
        let borderColor = t?.color || '#ccc';
        if (isAbsent && !isOverride) {
            bgColor = 'bg-red-50 dark:bg-red-900/20';
            borderColor = '#ef4444';
        }

        const splitT = entry.splitTeacherId ? teachers.find(t => t.id === entry.splitTeacherId) : null;
        const mergedClasses = entry.mergedClassIds?.length ? classes.filter(c => entry.mergedClassIds.includes(c.id)) : [];

        return (
            <div onClick={() => handleCellClick(classId, periodIndex)} className={`h-full w-full p-2 border-l-4 rounded-xl cursor-pointer shadow-sm relative flex flex-col justify-center transition-all ${bgColor} border-slate-100 dark:border-slate-800`} style={{ borderLeftColor: borderColor }}>
                <div className="flex flex-col gap-0.5">
                    <div className="font-black text-[10px] truncate leading-tight dark:text-slate-200">{entry.subSubject || entry.subject}</div>
                    <div className="text-[9px] truncate font-bold text-slate-500">{t?.name || (isAbsent ? 'Absent' : 'Vacant')}</div>
                    
                    {splitT && (
                        <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-0.5">
                            <div className="font-black text-[9px] truncate text-brand-600 leading-tight">{entry.splitSubject}</div>
                            <div className="text-[8px] font-bold text-slate-400 truncate">{splitT.name}</div>
                        </div>
                    )}

                    {mergedClasses.length > 0 && (
                        <div className="absolute top-1 right-1 flex gap-0.5">
                            <div className="px-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-[7px] font-black rounded uppercase">Merged</div>
                        </div>
                    )}
                </div>

                {isOverride && <div className="absolute bottom-1 right-1 px-1 bg-amber-500 text-white rounded text-[7px] font-black">SUB</div>}
                {isAbsent && !isOverride && <div className="absolute bottom-1 right-1 px-1 bg-red-500 text-white rounded text-[7px] font-black">LEAVE</div>}
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

    const tableHeaders = ["PRD", ...classes.map((c: ClassSection) => c.name)];
    const tableBody = activePeriods.map((p, pIdx) => {
        const row = [p.label];
        classes.forEach((c: ClassSection) => {
            const entry = scheduleData[`${c.id}_${pIdx}`];
            if (p.is_lunch) row.push("LUNCH");
            else if (!entry) row.push("-");
            else {
                const activeTeacherId = 'subTeacherId' in entry ? entry.subTeacherId : entry.teacherId;
                const t = teachers.find(t => t.id === activeTeacherId);
                let text = `${entry.subSubject || entry.subject || ''}\n${t?.name || 'Vacant'}`;
                
                if (entry.splitTeacherId) {
                    const splitT = teachers.find(t => t.id === entry.splitTeacherId);
                    text += `\n---\n${entry.splitSubject || ''}\n${splitT?.name || ''}`;
                }
                
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

  const filteredTeacherList = useMemo(() => {
    if (!editingSlot) return [];
    const { periodIndex, classId } = editingSlot;
    
    // Find who is busy in this period
    const busyMap = new Map<string, string>(); // teacherId -> className
    Object.entries(scheduleData).forEach(([key, entry]: [string, any]) => {
        const parts = key.split('_');
        const pIdxStr = parts.pop();
        const cId = parts.join('_');
        
        if (pIdxStr && parseInt(pIdxStr) === periodIndex && cId !== classId) {
            const activeTeacherId = 'subTeacherId' in entry ? entry.subTeacherId : entry.teacherId;
            const splitTeacherId = entry.splitTeacherId;
            const cls = classes.find(c => c.id === cId);
            
            if (activeTeacherId) {
                busyMap.set(activeTeacherId, cls?.name || 'Another Class');
            }
            if (splitTeacherId) {
                busyMap.set(splitTeacherId, cls?.name || 'Another Class');
            }
        }
    });

    return teachers
        .filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()))
        .map(t => ({
            ...t,
            isBusy: busyMap.has(t.id),
            busyInClass: busyMap.get(t.id)
        }));
  }, [teachers, teacherSearch, editingSlot, scheduleData, classes]);

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between no-print bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
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
              <>
                <button onClick={() => setIsAttendanceManagerOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-100 transition-all border border-brand-100 dark:border-brand-900/30">
                  <UserCheck className="w-4 h-4" /> Attendance
                </button>
                <button onClick={() => setIsClassManagerOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border dark:border-slate-700">
                  <Settings className="w-4 h-4" /> Manage Classes
                </button>
              </>
            )}
            <button onClick={downloadPDF} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg"><Download className="w-4 h-4" /> PDF</button>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border dark:border-slate-700">
            <div className="relative">
                <button 
                    onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)} 
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md"
                >
                    Filter Classes <ChevronDown className="w-3 h-3" />
                </button>
                
                {isClassDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-500">Select Classes</span>
                            <button 
                                onClick={() => setSelectedClassIds(classes.map((c: ClassSection) => c.id))}
                                className="text-[9px] font-bold text-brand-600 hover:text-brand-700"
                            >
                                All
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {classes.map((c: ClassSection) => (
                                <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedClassIds.includes(c.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedClassIds([...selectedClassIds, c.id]);
                                            } else {
                                                setSelectedClassIds(selectedClassIds.filter(id => id !== c.id));
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{c.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-slate-200 dark:border-slate-800 p-6 overflow-x-auto custom-scrollbar">
        <div className="grid divide-x dark:divide-slate-800 min-w-[1000px] border-l dark:border-slate-800 rounded-3xl overflow-hidden bg-slate-50/30 dark:bg-slate-950/30" style={{ gridTemplateColumns: `80px repeat(${sectionClasses.length || 1}, 1fr)` }}>
            <div className="bg-slate-100 dark:bg-slate-950 p-4 text-[10px] font-black uppercase text-center border-b dark:border-slate-800">PRD</div>
            {sectionClasses.map((cls: ClassSection) => (
                <div key={cls.id} className="bg-slate-100 dark:bg-slate-950 p-4 text-center uppercase text-[12px] font-black border-b dark:border-slate-800 truncate dark:text-slate-200">{cls.name}</div>
            ))}
            {activePeriods.map((p, pIndex) => (
                <React.Fragment key={pIndex}>
                    <div 
                        className={`p-3 text-center border-t dark:border-slate-800 bg-slate-100 dark:bg-slate-950 h-24 flex flex-col justify-center relative group ${(currentRole === 'PRINCIPAL' || currentRole === 'MANAGEMENT') ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors' : ''}`}
                        onClick={() => {
                            if (currentRole !== 'PRINCIPAL' && currentRole !== 'MANAGEMENT') return;
                            if (editingPeriodIndex === pIndex) return; // Already editing
                            const config = periodConfigs.find(pc => pc.period_index === pIndex);
                            setEditingPeriodStart(config?.start_time || '');
                            setEditingPeriodEnd(config?.end_time || '');
                            setEditingPeriodIndex(pIndex);
                        }}
                    >
                        {editingPeriodIndex === pIndex ? (
                            <div className="flex flex-col gap-1 z-10 bg-white dark:bg-slate-900 p-2 rounded-xl shadow-xl border dark:border-slate-700 absolute inset-x-1 top-1/2 -translate-y-1/2" onClick={e => e.stopPropagation()}>
                                <input 
                                    type="text" 
                                    value={editingPeriodStart} 
                                    onChange={e => setEditingPeriodStart(e.target.value)}
                                    placeholder="Start" 
                                    className="w-full text-[9px] h-6 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded px-1 font-bold text-center"
                                />
                                <input 
                                    type="text" 
                                    value={editingPeriodEnd} 
                                    onChange={e => setEditingPeriodEnd(e.target.value)}
                                    placeholder="End" 
                                    className="w-full text-[9px] h-6 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded px-1 font-bold text-center"
                                />
                                <div className="flex gap-1 mt-1">
                                    <button 
                                        onClick={() => {
                                            const newConfigs = [...periodConfigs];
                                            const existingIdx = newConfigs.findIndex(pc => pc.period_index === pIndex);
                                            if (existingIdx >= 0) {
                                                newConfigs[existingIdx] = { period_index: pIndex, start_time: editingPeriodStart, end_time: editingPeriodEnd };
                                            } else {
                                                newConfigs.push({ period_index: pIndex, start_time: editingPeriodStart, end_time: editingPeriodEnd });
                                            }
                                            savePeriodsMutation.mutate(newConfigs, { onSuccess: () => setEditingPeriodIndex(null) });
                                        }}
                                        className="flex-1 bg-brand-600 text-white text-[8px] py-1 rounded font-bold"
                                    >
                                        Save
                                    </button>
                                    <button onClick={() => setEditingPeriodIndex(null)} className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[8px] py-1 rounded font-bold">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <span className="font-black text-slate-800 dark:text-slate-100 text-[16px] leading-none mb-1">{p.label}</span>
                                {periodConfigs.find(pc => pc.period_index === pIndex) && (periodConfigs.find(pc => pc.period_index === pIndex)?.start_time || periodConfigs.find(pc => pc.period_index === pIndex)?.end_time) && (
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                        {periodConfigs.find(pc => pc.period_index === pIndex)?.start_time} - {periodConfigs.find(pc => pc.period_index === pIndex)?.end_time}
                                    </span>
                                )}
                                {(currentRole === 'PRINCIPAL' || currentRole === 'MANAGEMENT') && (
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Edit2 className="w-3 h-3 text-slate-400" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {sectionClasses.map((cls: ClassSection) => (
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
                  {activePeriods.map((p, pIdx) => (
                      <div key={pIdx} className={`rounded-2xl border transition-all ${p.is_lunch ? 'hidden' : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-800'}`}>
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
                            Assign Substitute
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            {editingSlot && `${classes.find((c: ClassSection) => c.id === editingSlot.classId)?.name} • Period ${activePeriods[editingSlot.periodIndex].label}`}
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
                                const status = attendanceData[t.id] || 'present';
                                const isAbsent = status === 'absent';
                                const isSelected = selectedTeacherId === t.id;
                                const isHalfDay = status === 'half_day_before' || status === 'half_day_after';
                                
                                return (
                                    <div key={t.id} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleTeacherSelect(t)}
                                                className={`flex-1 p-2 rounded-xl border text-left flex items-center gap-3 transition-all group ${isSelected ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-600' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'} ${isAbsent ? 'opacity-60 bg-red-50/50 dark:bg-red-900/10' : ''} ${t.isBusy ? 'border-amber-200 bg-amber-50/30' : ''}`}
                                            >
                                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] text-white font-bold shrink-0 shadow-sm" style={{backgroundColor: t.color}}>{t.initials}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>{t.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        {isAbsent ? (
                                                            <span className="text-[9px] font-black text-red-500 uppercase tracking-wider bg-red-100 dark:bg-red-900/30 px-1.5 rounded">Absent</span>
                                                        ) : isHalfDay ? (
                                                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 px-1.5 rounded">Half Day</span>
                                                        ) : t.isBusy ? (
                                                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider bg-amber-100 px-1.5 rounded">Busy in {t.busyInClass}</span>
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-400">Available</span>
                                                        )}
                                                        {t.subject && <span className="text-[9px] text-slate-400 border-l pl-2 dark:border-slate-700">{t.subject}</span>}
                                                    </div>
                                                </div>
                                                {isSelected && <Check className="w-5 h-5 text-brand-600" />}
                                            </button>

                                            {/* Attendance Toggle */}
                                            <div className="flex flex-col gap-1 shrink-0">
                                                <select 
                                                    value={status}
                                                    onChange={(e) => attendanceMutation.mutate({ teacherId: t.id, status: e.target.value as AttendanceStatus })}
                                                    className={`text-[10px] font-bold p-1 rounded border appearance-none text-center min-w-[70px] cursor-pointer transition-colors ${
                                                        status === 'present' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                                                        status === 'absent' ? 'bg-red-50 text-red-600 border-red-200' : 
                                                        'bg-amber-50 text-amber-600 border-amber-200'
                                                    }`}
                                                >
                                                    <option value="present">Present</option>
                                                    <option value="absent">Absent</option>
                                                    <option value="half_day_before">Half (B)</option>
                                                    <option value="half_day_after">Half (A)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
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

                         {/* Split & Merge Controls */}
                         <div className="space-y-3 pt-2 border-t dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-brand-600" />
                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">Split Period</span>
                                </div>
                                <button 
                                    onClick={() => setIsSplitMode(!isSplitMode)}
                                    className={`w-10 h-5 rounded-full transition-all relative ${isSplitMode ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isSplitMode ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            {isSplitMode && (
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-brand-100 dark:border-brand-900/30 space-y-3 animate-in slide-in-from-top-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Second Teacher</label>
                                        <select 
                                            value={splitTeacherId}
                                            onChange={(e) => setSplitTeacherId(e.target.value)}
                                            className="w-full text-xs h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-2"
                                        >
                                            <option value="">Select Teacher</option>
                                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Subject" 
                                            value={splitSubject} 
                                            onChange={e => setSplitSubject(e.target.value)}
                                            className="text-xs h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-2"
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="Note" 
                                            value={splitNote} 
                                            onChange={e => setSplitNote(e.target.value)}
                                            className="text-xs h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-2"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-purple-600" />
                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">Merge Classes</span>
                                </div>
                                <button 
                                    onClick={() => setIsMergeMode(!isMergeMode)}
                                    className={`w-10 h-5 rounded-full transition-all relative ${isMergeMode ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isMergeMode ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            {isMergeMode && (
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-100 dark:border-purple-900/30 space-y-2 animate-in slide-in-from-top-2">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Select classes to merge with</p>
                                    <div className="flex flex-wrap gap-2">
                                        {classes.filter(c => c.id !== editingSlot?.classId).map(c => (
                                            <button 
                                                key={c.id}
                                                onClick={() => {
                                                    if (mergedClassIds.includes(c.id)) {
                                                        setMergedClassIds(mergedClassIds.filter(id => id !== c.id));
                                                    } else {
                                                        setMergedClassIds([...mergedClassIds, c.id]);
                                                    }
                                                }}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${mergedClassIds.includes(c.id) ? 'bg-purple-600 border-purple-600 text-white' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                                            >
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                          {activePeriods.map((period, pIdx) => {
                              if (period.is_lunch) return null;
                              
                              // Check if teacher is actually absent in this period based on status
                              const lunchIndex = activePeriods.findIndex(p => p.is_lunch);
                              const isAbsentInPeriod = substituteFor.status === 'absent' || 
                                                       (substituteFor.status === 'half_day_before' && pIdx < lunchIndex) || 
                                                       (substituteFor.status === 'half_day_after' && pIdx > lunchIndex);
                              
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
                                                                              const parts = key.split('_');
                                                                              const periodStr = parts.pop();
                                                                              if (!periodStr || parseInt(periodStr) !== pIdx) return false;
                                                                              const activeId = 'subTeacherId' in entry ? entry.subTeacherId : entry.teacherId;
                                                                              return activeId === t.id || entry.splitTeacherId === t.id;
                                                                          });
                                                                          const status = attendanceData[t.id] || 'present';
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

      {/* Attendance Manager Modal */}
      {isAttendanceManagerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
                  <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                      <div>
                          <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Teacher Attendance</h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{selectedDate} ({selectedDayName})</p>
                      </div>
                      <button onClick={() => setIsAttendanceManagerOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {teachers.map(t => {
                              const status = attendanceData[t.id] || 'present';
                              return (
                                  <div key={t.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0 shadow-sm" style={{backgroundColor: t.color}}>{t.initials}</div>
                                          <div className="min-w-0">
                                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{t.name}</p>
                                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{t.subject || 'No Subject'}</p>
                                          </div>
                                      </div>
                                      
                                      <select 
                                          value={status}
                                          onChange={(e) => attendanceMutation.mutate({ teacherId: t.id, status: e.target.value as AttendanceStatus })}
                                          className={`text-xs font-black p-2 rounded-xl border appearance-none text-center min-w-[100px] cursor-pointer transition-all ${
                                              status === 'present' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                                              status === 'absent' ? 'bg-red-50 text-red-600 border-red-200' : 
                                              'bg-amber-50 text-amber-600 border-amber-200'
                                          }`}
                                      >
                                          <option value="present">Present</option>
                                          <option value="absent">Absent</option>
                                          <option value="half_day_before">Half Day (B)</option>
                                          <option value="half_day_after">Half Day (A)</option>
                                      </select>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
                  
                  <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-800 flex justify-end">
                      <button 
                        onClick={() => setIsAttendanceManagerOpen(false)}
                        className="px-8 py-3 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-700 shadow-xl transition-all active:scale-95"
                      >
                        Done
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Class Manager Modal */}
      {isClassManagerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-pop-in border dark:border-slate-800 flex flex-col max-h-[85vh]">
              <div className="bg-slate-950 p-6 border-b dark:border-slate-800 flex justify-between items-center text-white">
                  <div className="flex gap-6">
                      <button 
                        onClick={() => setActiveTab('CLASSES')}
                        className={`font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all ${activeTab === 'CLASSES' ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <Settings className="w-4 h-4" /> Class Registry
                      </button>
                      <button 
                        onClick={() => setActiveTab('PERIODS')}
                        className={`font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all ${activeTab === 'PERIODS' ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <Clock className="w-4 h-4" /> Period Timing
                      </button>
                  </div>
                  <button onClick={() => { setIsClassManagerOpen(false); setNewClassName(''); setEditingClassId(null); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X className="w-5 h-5"/></button>
              </div>

              {activeTab === 'CLASSES' ? (
                <>
                  <div className="p-8 border-b dark:border-slate-800 bg-brand-50/50 dark:bg-brand-900/10">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                            {editingClassId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                            {editingClassId ? 'Modify Existing Class' : 'Register New Class'}
                        </h4>
                      </div>
                      
                      <div className="flex flex-col gap-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Class Identity</label>
                                <input 
                                    type="text" 
                                    value={newClassName} 
                                    onChange={e => setNewClassName(e.target.value)}
                                    placeholder="e.g. 10-C" 
                                    className="w-full text-sm h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl px-4 font-bold focus:ring-4 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Level</label>
                                <select 
                                    value={newClassSection}
                                    onChange={(e: any) => setNewClassSection(e.target.value)}
                                    className="w-full text-xs h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl px-4 font-bold focus:ring-4 focus:ring-brand-500/10 transition-all"
                                >
                                    <option value="SECONDARY">Secondary</option>
                                    <option value="SENIOR_SECONDARY">Sr. Secondary</option>
                                </select>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            {editingClassId ? (
                                 <>
                                   <button onClick={() => handleUpdateClass(editingClassId)} disabled={addClassMutation.isPending} className="flex-1 bg-brand-600 text-white h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-brand-700 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                                       {addClassMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                                       Update Class
                                   </button>
                                   <button onClick={() => { setEditingClassId(null); setNewClassName(''); }} className="px-6 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-300 transition-all">Cancel</button>
                                 </>
                              ) : (
                                 <button onClick={handleAddClass} disabled={addClassMutation.isPending} className="w-full bg-slate-900 dark:bg-black text-white h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-brand-600 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                                     {addClassMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                                     Add to Registry
                                 </button>
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/30">
                      <div className="flex items-center justify-between mb-4 px-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Classes ({classes.length})</span>
                      </div>
                      <div className="space-y-3">
                          {classes.map((cls: ClassSection) => (
                              <div key={cls.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl group hover:border-brand-500 hover:shadow-xl transition-all">
                                  <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-sm font-black text-brand-600 shadow-inner">{cls.name.substring(0,2)}</div>
                                      <div>
                                          <h4 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">{cls.name}</h4>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cls.section === 'SECONDARY' ? 'Secondary' : 'Senior Secondary'}</p>
                                      </div>
                                  </div>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                      <div className="flex gap-1 mr-2 border-r pr-2 dark:border-slate-800">
                                          <button onClick={() => handleMoveClass(cls.id, 'up')} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all"><ArrowUp className="w-4 h-4"/></button>
                                          <button onClick={() => handleMoveClass(cls.id, 'down')} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all"><ArrowDown className="w-4 h-4"/></button>
                                      </div>
                                      <button onClick={() => { setEditingClassId(cls.id); setNewClassName(cls.name); setNewClassSection(cls.section); }} className="p-3 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-2xl transition-all"><Edit2 className="w-4 h-4"/></button>
                                      <button onClick={() => handleDeleteClass(cls.id)} disabled={deleteClassMutation.isPending} className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all">
                                          {deleteClassMutation.isPending && deleteClassMutation.variables === cls.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                                      </button>
                                  </div>
                              </div>
                          ))}
                          {classes.length === 0 && (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <Settings className="w-8 h-8 opacity-20" />
                                </div>
                                <p className="text-xs font-black uppercase tracking-widest">No classes registered</p>
                            </div>
                          )}
                      </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-8 bg-brand-50/50 dark:bg-brand-900/10 border-b dark:border-slate-800">
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-2">Configure Period Timings</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Set start and end times for each period. Leave blank to hide.</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {activePeriods.map((p, idx) => (
                            <div key={idx} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xs font-black text-brand-600 shrink-0">{p.label}</div>
                                <div className="grid grid-cols-2 gap-3 flex-1">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Start</label>
                                        <input 
                                            type="text" 
                                            value={tempPeriods[idx]?.start || ''} 
                                            onChange={e => setTempPeriods({...tempPeriods, [idx]: {...(tempPeriods[idx] || {}), start: e.target.value}})}
                                            placeholder="09:00 AM" 
                                            className="w-full text-[10px] h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl px-3 font-bold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">End</label>
                                        <input 
                                            type="text" 
                                            value={tempPeriods[idx]?.end || ''} 
                                            onChange={e => setTempPeriods({...tempPeriods, [idx]: {...(tempPeriods[idx] || {}), end: e.target.value}})}
                                            placeholder="10:00 AM" 
                                            className="w-full text-[10px] h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl px-3 font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
                        <button 
                            onClick={() => {
                                const configs = Object.entries(tempPeriods).map(([idx, times]) => ({
                                    period_index: parseInt(idx),
                                    start_time: times.start,
                                    end_time: times.end
                                }));
                                savePeriodsMutation.mutate(configs);
                            }}
                            disabled={savePeriodsMutation.isPending}
                            className="w-full bg-brand-600 text-white h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-brand-700 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                            {savePeriodsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                            Save All Timings
                        </button>
                    </div>
                </div>
              )}
            </div>
        </div>
      )}
    </div>
  );
};
