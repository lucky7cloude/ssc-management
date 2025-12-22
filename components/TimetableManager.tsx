
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClassSection, PERIODS, DAYS, ScheduleEntry, Teacher, Substitution, UserRole } from '../types';
import * as dataService from '../services/dataService';
import { ChevronRight, ChevronLeft, CheckCircle2, X, Users, Image as ImageIcon, ClipboardList, Copy, Settings, Trash2, Split, MessageSquareWarning, Repeat, Calendar as CalendarIcon } from 'lucide-react';
import html2canvas from 'html2canvas';

interface Props {
    currentRole: UserRole;
}

type ClassFilter = 'ALL' | 'SEC' | 'SR_SEC';

const getPeriodLabel = (index: number) => {
    if (index === 3) return "LUNCH";
    const map: {[key: number]: string} = {
        0: "Period-I", 1: "Period-II", 2: "Period-III",
        4: "Period-IV", 5: "Period-V", 6: "Period-VI"
    };
    return map[index] || `Period-${index}`;
};

export const TimetableManager: React.FC<Props> = ({ currentRole }) => {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDayName, setSelectedDayName] = useState<string>('Monday');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [classFilter, setClassFilter] = useState<ClassFilter>('ALL');
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [dailySubstitutions, setDailySubstitutions] = useState<Substitution[]>([]);
  const [timetableNote, setTimetableNote] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubListModalOpen, setIsSubListModalOpen] = useState(false);
  const [isCloneMenuOpen, setIsCloneMenuOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{classId: string, periodIndex: number} | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [applyToRestOfWeek, setApplyToRestOfWeek] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  const [splitTeacherId, setSplitTeacherId] = useState('');
  const [splitSubject, setSplitSubject] = useState('');
  const [classManagerInput, setClassManagerInput] = useState('');
  const timetableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClasses(dataService.getClasses());
    setTeachers(dataService.getTeachers());
    const now = new Date();
    setSelectedDate(now.toLocaleDateString('en-CA'));
  }, []);

  useEffect(() => {
      if(!selectedDate) return;
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      const finalDayName = DAYS.includes(dayName) ? dayName : 'Monday';
      setSelectedDayName(finalDayName);
      setSchedule(dataService.ensureScheduleForDay(finalDayName));
      setDailyAttendance(dataService.getAttendanceForDate(selectedDate));
      setDailySubstitutions(dataService.getSubstitutionsForDate(selectedDate));
      setTimetableNote(dataService.getTimetableNote(selectedDate));
  }, [selectedDate]);

  const adjustDate = (days: number) => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      dateObj.setDate(dateObj.getDate() + days);
      setSelectedDate(dateObj.toLocaleDateString('en-CA'));
  };

  const handleToday = () => {
      setSelectedDate(new Date().toLocaleDateString('en-CA'));
  };

  const handleDownloadImage = async () => {
    if (!timetableRef.current) return;
    const canvas = await html2canvas(timetableRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.href = canvas.toDataURL("image/png");
    link.download = `SilverStar_Timetable_${selectedDate}.png`;
    link.click();
  };

  const filteredClasses = useMemo(() => {
      if (classFilter === 'ALL') return classes;
      return classes.filter(cls => {
          const name = cls.name.toLowerCase();
          const isSrSec = name.includes('11') || name.includes('12');
          return classFilter === 'SR_SEC' ? isSrSec : !isSrSec;
      });
  }, [classes, classFilter]);

  const renderCell = (classId: string, periodIndex: number) => {
    const isLunch = PERIODS[periodIndex].start === "11:15 AM";
    if (isLunch) return <div className="h-full w-full bg-slate-50 flex items-center justify-center text-[8px] text-slate-300 font-bold uppercase tracking-widest">Lunch</div>;
    const entry = schedule.find(s => s.classId === classId && s.day === selectedDayName && s.periodIndex === periodIndex);
    if (entry) {
        const substitution = dailySubstitutions.find(s => s.classId === classId && s.periodIndex === periodIndex);
        if (substitution) {
            const subT = teachers.find(t => t.id === substitution.subTeacherId);
            return (
                <div onClick={() => handleCellClick(classId, periodIndex)} className="h-full w-full p-1 rounded bg-purple-50 ring-1 ring-purple-100 border-l-2 border-purple-500 flex flex-col justify-center cursor-pointer">
                    <div className="font-bold text-[9px] text-slate-800 truncate">{entry.subject}</div>
                    <div className="text-[8px] text-purple-700 truncate font-bold">Sub: {subT?.name || '??'}</div>
                </div>
            );
        }
        const t1 = teachers.find(t => t.id === entry.teacherId);
        const isAbsent1 = t1 && dailyAttendance[t1.id] === 'absent';
        if (entry.isSplit) {
            const t2 = teachers.find(t => t.id === entry.splitTeacherId);
            const isAbsent2 = t2 && dailyAttendance[t2.id] === 'absent';
            return (
                <div onClick={() => handleCellClick(classId, periodIndex)} className="h-full w-full rounded flex flex-col border border-slate-100 cursor-pointer overflow-hidden shadow-sm">
                    <div className={`flex-1 flex items-center px-1 border-l-2 ${isAbsent1 ? 'bg-red-50 border-red-500' : 'bg-white'}`} style={{ borderLeftColor: isAbsent1 ? '#ef4444' : (t1?.color || '#ccc') }}>
                        <div className="text-[8px] font-bold truncate">{entry.subject} ({t1?.initials})</div>
                    </div>
                    <div className={`flex-1 flex items-center px-1 border-l-2 border-t border-slate-50 ${isAbsent2 ? 'bg-red-50 border-red-500' : 'bg-white'}`} style={{ borderLeftColor: isAbsent2 ? '#ef4444' : (t2?.color || '#ccc') }}>
                        <div className="text-[8px] font-bold truncate">{entry.splitSubject} ({t2?.initials})</div>
                    </div>
                </div>
            );
        }
        return (
            <div onClick={() => handleCellClick(classId, periodIndex)} className={`h-full w-full p-1 rounded border-l-2 flex flex-col justify-center cursor-pointer shadow-sm ${isAbsent1 ? 'bg-red-50 border-red-500' : 'bg-white border-slate-100'}`} style={{ borderLeftColor: isAbsent1 ? '#ef4444' : (t1?.color || '#ccc') }}>
                <div className="font-bold text-[9px] text-slate-800 truncate">{entry.subject}</div>
                <div className="text-[8px] text-slate-500 truncate">{t1?.name || '??'}</div>
            </div>
        );
    }
    return <button onClick={() => handleCellClick(classId, periodIndex)} className="w-full h-full rounded border border-dashed border-slate-200 text-slate-300 hover:bg-slate-50">+</button>;
  };

  const handleCellClick = (classId: string, periodIndex: number) => {
    if (PERIODS[periodIndex].start === "11:15 AM") return;
    setEditingSlot({ classId, periodIndex });
    setApplyToRestOfWeek(false);
    const existing = schedule.find(s => s.classId === classId && s.day === selectedDayName && s.periodIndex === periodIndex);
    if (existing) {
        setSelectedTeacherId(existing.teacherId);
        setSelectedSubject(existing.subject);
        setIsSplit(!!existing.isSplit);
        setSplitTeacherId(existing.splitTeacherId || '');
        setSplitSubject(existing.splitSubject || '');
    } else {
        setSelectedTeacherId(''); setSelectedSubject(''); setIsSplit(false); setSplitTeacherId(''); setSplitSubject('');
    }
    setIsModalOpen(true);
  };

  const handleSaveSlot = () => {
    if (!editingSlot || !selectedTeacherId || !selectedSubject) return;
    const entry: ScheduleEntry = { id: Date.now().toString(), classId: editingSlot.classId, day: selectedDayName, periodIndex: editingSlot.periodIndex, teacherId: selectedTeacherId, subject: selectedSubject, isSplit, splitTeacherId: isSplit ? splitTeacherId : undefined, splitSubject: isSplit ? splitSubject : undefined };
    setSchedule(dataService.saveScheduleEntry(entry, applyToRestOfWeek));
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Date Selection Mechanism */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100 no-print">
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button 
                    onClick={() => adjustDate(-1)} 
                    className="p-2 hover:bg-white rounded-lg transition-all text-slate-600 hover:shadow-sm"
                    title="Previous Day"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="relative flex items-center px-3 min-w-[150px] justify-center cursor-pointer group">
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)} 
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center pointer-events-none transition-transform group-hover:scale-105">
                        <span className="text-[10px] font-black text-brand-600 uppercase tracking-tighter leading-none">{selectedDayName}</span>
                        <span className="text-sm font-bold text-slate-800 flex items-center gap-1">
                           {new Date(selectedDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                           <CalendarIcon className="w-3 h-3 text-slate-400" />
                        </span>
                    </div>
                </div>

                <button 
                    onClick={() => adjustDate(1)} 
                    className="p-2 hover:bg-white rounded-lg transition-all text-slate-600 hover:shadow-sm"
                    title="Next Day"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
            
            <button 
                onClick={handleToday} 
                className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-all shadow-sm active:scale-95"
            >
                Today
            </button>
        </div>

        <div className="flex-1 flex gap-1 p-1 bg-slate-50 rounded-lg">
            {['ALL', 'SEC', 'SR_SEC'].map(f => (
                <button key={f} onClick={() => setClassFilter(f as any)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${classFilter === f ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>{f === 'ALL' ? 'All Classes' : f === 'SEC' ? '6-10' : '11-12'}</button>
            ))}
        </div>

        <div className="flex gap-2">
            <button onClick={handleDownloadImage} className="flex items-center gap-1.5 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-brand-700 active:scale-95 transition-all"><ImageIcon className="w-4 h-4" /> IMAGE</button>
            <button onClick={() => setIsSubListModalOpen(true)} className="flex items-center gap-1.5 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-slate-900 active:scale-95 transition-all"><ClipboardList className="w-4 h-4" /> SUBS</button>
            {currentRole === 'PRINCIPAL' && <button onClick={() => setIsClassManagerOpen(true)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 border border-slate-200 transition-colors"><Settings className="w-4 h-4" /></button>}
        </div>
      </div>

      <div ref={timetableRef} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="overflow-x-auto w-full custom-scrollbar">
            <div className="grid divide-x divide-slate-100 min-w-[800px]" style={{ gridTemplateColumns: `70px repeat(${filteredClasses.length}, 1fr)` }}>
                <div className="bg-slate-50 p-3 text-[9px] font-bold text-slate-400 uppercase text-center sticky left-0 z-20 border-b border-r border-slate-200">TIME</div>
                {filteredClasses.map(cls => (
                    <div key={cls.id} className="bg-slate-50 p-3 text-center uppercase text-[10px] font-bold text-slate-700 border-b border-slate-200">{cls.name}</div>
                ))}
                {PERIODS.map((period, pIndex) => (
                    <React.Fragment key={pIndex}>
                        <div className="p-2 text-center border-t border-r border-slate-50 bg-slate-50 sticky left-0 z-20 flex flex-col justify-center">
                            <span className="font-bold text-slate-700 text-[9px]">{getPeriodLabel(pIndex)}</span>
                        </div>
                        {filteredClasses.map(cls => (
                            <div key={`${cls.id}-${pIndex}`} className="h-16 p-1 border-t border-slate-50 hover:bg-slate-50 transition-colors">{renderCell(cls.id, pIndex)}</div>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </div>
        <div className="p-3 bg-amber-50/30 border-t border-amber-100">
            <h4 className="text-[9px] font-bold text-amber-600 uppercase mb-1 flex items-center gap-1"><MessageSquareWarning className="w-3 h-3" /> Principal's Note</h4>
            <textarea value={timetableNote} onChange={(e) => setTimetableNote(e.target.value)} onBlur={() => dataService.saveTimetableNote(selectedDate, timetableNote)} className="w-full bg-transparent border-none text-[11px] text-slate-700 outline-none resize-none" placeholder="Daily updates..." rows={2}/>
        </div>
      </div>

      {isModalOpen && editingSlot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-pop-in">
                <div className="bg-brand-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-sm">Assign: {classes.find(c => c.id === editingSlot.classId)?.name}</h3>
                    <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5"/></button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex gap-2">
                        <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg flex-1 cursor-pointer">
                            <input type="checkbox" checked={isSplit} onChange={(e) => setIsSplit(e.target.checked)} className="w-4 h-4" />
                            <span className="text-[11px] font-bold">Split</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg flex-1 cursor-pointer">
                            <input type="checkbox" checked={applyToRestOfWeek} onChange={(e) => setApplyToRestOfWeek(e.target.checked)} className="w-4 h-4" />
                            <span className="text-[11px] font-bold text-blue-700">Repeat</span>
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <input type="text" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full border rounded p-2 text-sm outline-none" placeholder="Subject..." />
                            <div className="h-40 overflow-y-auto border rounded divide-y custom-scrollbar">
                                {teachers.map(t => (
                                    <button key={t.id} onClick={() => setSelectedTeacherId(t.id)} className={`w-full text-left p-2 text-[11px] font-medium transition-colors ${selectedTeacherId === t.id ? 'bg-brand-50 font-bold text-brand-700' : 'hover:bg-slate-50'}`}>{t.name}</button>
                                ))}
                            </div>
                        </div>
                        {isSplit && (
                            <div className="space-y-2">
                                <input type="text" value={splitSubject} onChange={(e) => setSplitSubject(e.target.value)} className="w-full border border-purple-200 rounded p-2 text-sm outline-none" placeholder="Subject 2..." />
                                <div className="h-40 overflow-y-auto border border-purple-50 rounded divide-y custom-scrollbar">
                                    {teachers.map(t => (
                                        <button key={t.id} onClick={() => setSplitTeacherId(t.id)} className={`w-full text-left p-2 text-[11px] font-medium transition-colors ${splitTeacherId === t.id ? 'bg-purple-50 font-bold text-purple-700' : 'hover:bg-slate-50'}`}>{t.name}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="pt-2 flex gap-2">
                         <button onClick={() => { setSchedule(dataService.removeScheduleEntry(editingSlot.classId, selectedDayName, editingSlot.periodIndex)); setIsModalOpen(false); }} className="flex-1 py-2 text-[11px] font-bold text-red-600 border border-red-100 rounded">Clear Slot</button>
                         <button onClick={handleSaveSlot} className="flex-1 py-2 text-[11px] font-bold bg-brand-600 text-white rounded">Save Assignment</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {isClassManagerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                 <div className="bg-slate-800 p-3 flex justify-between items-center text-white">
                      <h3 className="font-bold text-sm">Manage Classes</h3>
                      <button onClick={() => setIsClassManagerOpen(false)}><X className="w-4 h-4"/></button>
                 </div>
                 <div className="p-4 space-y-4">
                    <form onSubmit={(e) => { e.preventDefault(); setClasses(dataService.addClass(classManagerInput.trim())); setClassManagerInput(''); }} className="flex gap-2">
                        <input value={classManagerInput} onChange={e => setClassManagerInput(e.target.value)} placeholder="Class name" className="flex-1 border rounded px-2 py-1 text-sm" required />
                        <button type="submit" className="bg-brand-600 text-white px-3 py-1 rounded text-xs font-bold">Add</button>
                    </form>
                    <div className="max-h-60 overflow-y-auto divide-y">
                        {classes.map(cls => (
                            <div key={cls.id} className="flex items-center justify-between p-2 text-xs font-medium">
                                <span>{cls.name}</span>
                                <button onClick={() => { if(confirm('Delete?')) setClasses(dataService.deleteClass(cls.id)); }} className="text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                 </div>
            </div>
        </div>
      )}
    </div>
  );
};
