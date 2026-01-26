import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClassSection, PERIODS, Teacher, UserRole, ScheduleEntry, DailyOverride } from '../types';
import * as dataService from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { isDbConnected } from '../lib/db';
import { 
  ChevronRight, ChevronLeft, X, Layout, Plus, Calendar as CalendarIcon, 
  Loader2, Save, RefreshCw, AlertTriangle, DatabaseZap 
} from 'lucide-react';

interface Props {
    currentRole: UserRole;
}

const getPeriodLabel = (index: number) => {
    if (index === 3) return "LUNCH";
    const map: {[key: number]: string} = { 0: "I", 1: "II", 2: "III", 4: "IV", 5: "V", 6: "VI" };
    return map[index] || index.toString();
};

export const TimetableManager: React.FC<Props> = ({ currentRole }) => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [timetableMode, setTimetableMode] = useState<'DAILY' | 'BASE'>('DAILY');
  const [activeSection, setActiveSection] = useState<'SECONDARY' | 'SENIOR_SECONDARY'>('SECONDARY');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{classId: string, periodIndex: number} | null>(null);
  
  // Local form state
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [periodNote, setPeriodNote] = useState('');

  // Derived Day Name
  const selectedDayName = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long' });
  }, [selectedDate]);

  // Fetch Static Data
  const { data: staticData } = useQuery({
    queryKey: ['static-data'],
    queryFn: async () => {
        const [c, t] = await Promise.all([dataService.getClasses(), dataService.getTeachers()]);
        return { classes: c, teachers: t };
    },
    staleTime: 60000 // Cache static data for 1 min
  });

  const teachers = staticData?.teachers || [];
  const classes = staticData?.classes || [];

  // REAL-TIME FETCHING: Refetch interval 3000ms ensures changes sync across devices
  const { data: scheduleData = {}, isFetching, isError } = useQuery({
    queryKey: ['schedule', selectedDate, timetableMode, selectedDayName],
    queryFn: () => postgresService.timetable.getEffective(selectedDate, selectedDayName),
    refetchInterval: isDbConnected ? 3000 : false,
    placeholderData: (prev) => prev,
    enabled: true // Always enabled, but postgresService handles missing DB internally
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
        if (!isDbConnected) {
            alert("Changes cannot be saved: No database connection found.");
            return;
        }
        if (timetableMode === 'BASE') {
            return await postgresService.timetable.saveBase(selectedDayName, payload.classId, payload.periodIndex, payload.entry);
        } else {
            return await postgresService.timetable.saveOverride(selectedDate, selectedDayName, payload.classId, payload.periodIndex, payload.override);
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['schedule'] });
        setIsModalOpen(false);
    },
    onError: (err) => {
        console.error("Mutation failed:", err);
        alert("Failed to save changes. Please check your connection.");
    }
  });

  const adjustDate = (days: number) => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      dateObj.setDate(dateObj.getDate() + days);
      setSelectedDate(dateObj.toLocaleDateString('en-CA'));
  };

  const sectionClasses = useMemo(() => {
    return classes.filter(c => c.section === activeSection);
  }, [classes, activeSection]);

  const handleCellClick = (classId: string, periodIndex: number) => {
    if (PERIODS[periodIndex].start === "11:15 AM") return;
    if (currentRole !== 'PRINCIPAL' && currentRole !== 'MANAGEMENT') return;
    
    setEditingSlot({ classId, periodIndex });
    const entry = scheduleData[`${classId}_${periodIndex}`];
    
    setSelectedTeacherId(entry?.subTeacherId || entry?.teacherId || '');
    setSelectedSubject(entry?.subSubject || entry?.subject || '');
    setPeriodNote(entry?.subNote || entry?.note || '');
    setIsModalOpen(true);
  };

  const handleSaveSlot = () => {
    if (!editingSlot) return;
    const { classId, periodIndex } = editingSlot;
    
    const baseEntry: ScheduleEntry = { teacherId: selectedTeacherId, subject: selectedSubject, note: periodNote };
    const overrideEntry: DailyOverride = { 
        subTeacherId: selectedTeacherId, 
        subSubject: selectedSubject, 
        subNote: periodNote, 
        originalTeacherId: '', 
        type: 'SUBSTITUTION' 
    };

    saveMutation.mutate({
        classId,
        periodIndex,
        entry: (selectedTeacherId || periodNote) ? baseEntry : null,
        override: (selectedTeacherId || periodNote) ? overrideEntry : null
    });
  };

  const renderCell = (classId: string, periodIndex: number) => {
    const isLunch = PERIODS[periodIndex].start === "11:15 AM";
    if (isLunch) return <div className="h-full w-full bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center text-[9px] text-slate-400 font-black uppercase border dark:border-slate-800/50 rounded-lg">Lunch</div>;
    
    const entry = scheduleData[`${classId}_${periodIndex}`];
    if (entry) {
        const t = teachers.find(t => t.id === (entry.subTeacherId || entry.teacherId));
        const isOverride = !!entry.isOverride;
        return (
            <div onClick={() => handleCellClick(classId, periodIndex)} className={`h-full w-full p-2 border-l-4 rounded-xl cursor-pointer shadow-sm relative flex flex-col justify-center transition-all ${isOverride ? 'bg-brand-50/50 dark:bg-brand-900/10 animate-pulse-once' : 'bg-white dark:bg-slate-900'} border-slate-100 dark:border-slate-800`} style={{ borderLeftColor: t?.color || '#ccc' }}>
                <div className="font-black text-[10px] truncate leading-tight mb-0.5">{entry.subSubject || entry.subject}</div>
                <div className="text-[9px] truncate leading-tight font-bold text-slate-500">{t?.name || 'Vacant'}</div>
                {isOverride && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-brand-500 rounded-full"></div>}
            </div>
        );
    }
    return <button onClick={() => handleCellClick(classId, periodIndex)} className="w-full h-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-300 hover:text-brand-500 transition-all">+</button>;
  };

  return (
    <div className="space-y-6 relative">
      {/* DB Connection Alert Banner */}
      {!isDbConnected && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4 rounded-2xl flex items-center gap-4 animate-fade-in shadow-sm no-print">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center shrink-0">
                  <DatabaseZap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                  <h4 className="text-sm font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest leading-none mb-1">Database connection pending</h4>
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Sync features work on Vercel deployment. Using local view mode.</p>
              </div>
              <div className="px-3 py-1 bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 rounded-lg text-[9px] font-black uppercase tracking-widest">
                  Preview Only
              </div>
          </div>
      )}

      {isError && (
           <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 rounded-2xl flex items-center gap-4 animate-fade-in no-print">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-xs font-bold text-red-800 dark:text-red-400">Error syncing with server. Please refresh your browser.</p>
           </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between no-print bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-xl border border-slate-200/50 dark:border-slate-800/50">
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border dark:border-slate-700/50">
                <button onClick={() => setTimetableMode('DAILY')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${timetableMode === 'DAILY' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}><CalendarIcon className="w-4 h-4" /> Daily</button>
                <button onClick={() => setTimetableMode('BASE')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${timetableMode === 'BASE' ? 'bg-white dark:bg-slate-800 text-purple-600 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}><Layout className="w-4 h-4" /> Base</button>
            </div>
            
            <div className="relative flex items-center gap-1 bg-slate-50 dark:bg-black/40 p-1.5 rounded-2xl border dark:border-slate-800 shadow-inner">
                <button onClick={() => adjustDate(-1)} className="p-2.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>
                <div className="px-6 text-center min-w-[170px] py-1.5">
                    <span className="block text-[10px] font-black text-brand-600 uppercase tracking-widest leading-none mb-1">{selectedDayName}</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">{selectedDate}</span>
                </div>
                <button onClick={() => adjustDate(1)} className="p-2.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
            </div>
        </div>

        <div className="flex items-center gap-3">
            {isFetching && <RefreshCw className="w-4 h-4 text-brand-500 animate-spin mr-2" />}
            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border dark:border-slate-700/50">
                <button onClick={() => setActiveSection('SECONDARY')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeSection === 'SECONDARY' ? 'bg-white dark:bg-slate-800 text-slate-900 shadow-md' : 'text-slate-400 opacity-60'}`}>SEC</button>
                <button onClick={() => setActiveSection('SENIOR_SECONDARY')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeSection === 'SENIOR_SECONDARY' ? 'bg-white dark:bg-slate-800 text-slate-900 shadow-md' : 'text-slate-400 opacity-60'}`}>SR SEC</button>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-slate-200/60 p-6 relative overflow-hidden overflow-x-auto custom-scrollbar">
        <div className="grid divide-x dark:divide-slate-800 min-w-[1000px] border-l dark:border-slate-800 rounded-3xl overflow-hidden bg-slate-50/30" style={{ gridTemplateColumns: `80px repeat(${sectionClasses.length || 1}, 1fr)` }}>
            <div className="bg-slate-100 dark:bg-slate-950 p-4 text-[10px] font-black uppercase text-center border-b dark:border-slate-800">PRD</div>
            {sectionClasses.map(cls => (
                <div key={cls.id} className="bg-slate-100 dark:bg-slate-950 p-4 text-center uppercase text-[12px] font-black border-b dark:border-slate-800 truncate">{cls.name}</div>
            ))}
            {PERIODS.map((_, pIndex) => (
                <React.Fragment key={pIndex}>
                    <div className={`p-3 text-center border-t dark:border-slate-800 bg-slate-100 dark:bg-slate-950 h-24 flex flex-col justify-center`}>
                        <span className="font-black text-slate-800 dark:text-slate-100 text-[14px] leading-none mb-1">{getPeriodLabel(pIndex)}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{PERIODS[pIndex].start}</span>
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

      {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden animate-pop-in border dark:border-slate-800">
                  <div className="bg-slate-800 dark:bg-black p-6 flex justify-between items-center text-white">
                      <h3 className="font-black uppercase tracking-widest text-[10px] flex items-center gap-2"><Plus className="w-4 h-4" /> Edit Slot</h3>
                      <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6"/></button>
                  </div>
                  <div className="p-10 space-y-6">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Teacher</label>
                          <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className="w-full text-sm h-11">
                              <option value="">Select Staff</option>
                              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Subject</label>
                          <input type="text" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full text-sm h-11" placeholder="e.g. Mathematics" />
                      </div>
                      <button 
                        onClick={handleSaveSlot} 
                        disabled={saveMutation.isPending || !isDbConnected}
                        className="w-full bg-brand-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-700 shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {!isDbConnected ? 'DB DISCONNECTED' : saveMutation.isPending ? 'Syncing...' : 'Save Changes'}
                      </button>
                      {!isDbConnected && <p className="text-[9px] text-amber-600 font-bold uppercase text-center">Save disabled in preview mode</p>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};