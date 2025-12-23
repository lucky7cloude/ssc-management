
import React, { useState, useEffect } from 'react';
import { ExamSchedule, ClassSection } from '../types';
import * as dataService from '../services/dataService';
import { CalendarDays, Clock, Book, Plus, Trash2, Layers, Grid, Save, Download, FileText, X, AlertCircle, Wand2, RefreshCw } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const ExamScheduler: React.FC = () => {
    const [exams, setExams] = useState<ExamSchedule[]>([]);
    const [classes, setClasses] = useState<ClassSection[]>([]);
    const [activeTab, setActiveTab] = useState<'list' | 'generator'>('list');
    
    // Filters (List Mode)
    const [filterType, setFilterType] = useState('All');

    // Generator State
    const [genExamName, setGenExamName] = useState('Mid Term');
    const [genStartDate, setGenStartDate] = useState('');
    const [genEndDate, setGenEndDate] = useState('');
    const [genStartTime, setGenStartTime] = useState('09:00');
    const [genEndTime, setGenEndTime] = useState('12:00');
    const [subjectPool, setSubjectPool] = useState('English, Hindi, Mathematics, Science, SST, Computer');
    const [noRepeats, setNoRepeats] = useState(true);
    
    const [generatedGrid, setGeneratedGrid] = useState<string[]>([]);
    const [gridData, setGridData] = useState<Record<string, string>>({});

    useEffect(() => {
        setExams(dataService.getExams());
        setClasses(dataService.getClasses());
    }, []);

    const handleGenerateGrid = (e: React.FormEvent) => {
        e.preventDefault();
        if (!genStartDate || !genEndDate) return;
        const start = new Date(genStartDate);
        const end = new Date(genEndDate);
        const dates: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0]);
        }
        setGeneratedGrid(dates);
        setGridData({}); // Clear existing data when grid changes
    };

    const handleAutoFill = () => {
        const subjects = subjectPool.split(',').map(s => s.trim()).filter(s => s !== '');
        if (subjects.length === 0) {
            alert("Please enter some subjects in the pool.");
            return;
        }

        const newGridData: Record<string, string> = {};
        
        classes.forEach((cls) => {
            // For each class, we want to distribute subjects
            // Shuffle subjects if we want variety, or just iterate
            const classSubjects = [...subjects];
            let subjectIndex = 0;

            generatedGrid.forEach((date) => {
                if (isSunday(date)) return;

                // Select subject
                let selectedSubject = "";
                if (noRepeats) {
                    if (subjectIndex < classSubjects.length) {
                        selectedSubject = classSubjects[subjectIndex];
                        subjectIndex++;
                    } else {
                        // Out of unique subjects for this class
                        selectedSubject = ""; 
                    }
                } else {
                    selectedSubject = subjects[subjectIndex % subjects.length];
                    subjectIndex++;
                }

                newGridData[`${date}_${cls.id}`] = selectedSubject;
            });
        });

        setGridData(newGridData);
    };

    const handleGridChange = (date: string, classId: string, value: string) => {
        setGridData(prev => ({ ...prev, [`${date}_${classId}`]: value }));
    };

    const isSunday = (dateStr: string) => new Date(dateStr).getDay() === 0;

    const handleSaveGrid = () => {
        // Fix: Added explicit cast to string for 'val' to allow calling .trim()
        const entriesToSave = Object.entries(gridData).filter(([_, val]) => (val as string).trim() !== "");
        if (entriesToSave.length === 0) {
            alert("No subjects assigned in the grid.");
            return;
        }
        
        if (!confirm(`Save ${entriesToSave.length} exam entries?`)) return;
        
        const timestamp = Date.now();
        entriesToSave.forEach(([key, value], index) => {
            const [date, classId] = key.split('_');
            dataService.addExam({
                id: `${timestamp}-${index}`,
                examType: genExamName,
                classId,
                // Fix: Added explicit cast to string for 'value' to allow calling .trim()
                subject: (value as string).trim(),
                date,
                startTime: genStartTime,
                endTime: genEndTime
            });
        });
        
        setExams(dataService.getExams());
        setActiveTab('list');
        setFilterType(genExamName);
    };

    const handleDelete = (id: string) => {
        if(confirm("Remove this exam entry?")){
            setExams(dataService.deleteExam(id));
        }
    };

    const filteredExams = filterType === 'All' ? exams : exams.filter(e => e.examType === filterType);
    const groupedExams = filteredExams.reduce((groups, exam) => {
        const date = exam.date;
        if (!groups[date]) groups[date] = [];
        groups[date].push(exam);
        return groups;
    }, {} as Record<string, ExamSchedule[]>);
    const sortedDates = Object.keys(groupedExams).sort();

    return (
        <div className="space-y-6">
            <div className="flex justify-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit mx-auto shadow-sm no-print">
                <button 
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-slate-800 dark:bg-black text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                    <Grid className="w-4 h-4" /> View Schedule
                </button>
                <button 
                    onClick={() => setActiveTab('generator')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'generator' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400'}`}
                >
                    <Layers className="w-4 h-4" /> Schedule Generator
                </button>
            </div>

            {activeTab === 'generator' && (
                <div className="space-y-6 animate-fade-in no-print">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 border-b dark:border-slate-800 pb-3 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-brand-600" /> Step 1: Configure Exam Details
                        </h3>
                        <form onSubmit={handleGenerateGrid} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Exam Name</label>
                                    <input type="text" value={genExamName} onChange={e => setGenExamName(e.target.value)} className="w-full text-sm h-10" placeholder="e.g. Mid Term" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                                    <input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)} className="w-full text-sm h-10" required />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Date</label>
                                    <input type="date" value={genEndDate} onChange={e => setGenEndDate(e.target.value)} className="w-full text-sm h-10" required />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Timings</label>
                                    <div className="flex gap-2">
                                        <input type="time" value={genStartTime} onChange={e => setGenStartTime(e.target.value)} className="w-full text-sm h-10" />
                                        <input type="time" value={genEndTime} onChange={e => setGenEndTime(e.target.value)} className="w-full text-sm h-10" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Subject Pool (Comma Separated)</label>
                                <textarea 
                                    value={subjectPool} 
                                    onChange={e => setSubjectPool(e.target.value)}
                                    className="w-full h-20 text-sm p-3 bg-black border border-slate-700 rounded-xl"
                                    placeholder="English, Hindi, Math..."
                                />
                                <div className="flex items-center gap-3 mt-3">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${noRepeats ? 'bg-brand-600 border-brand-600' : 'border-slate-400 dark:border-slate-700'}`} onClick={() => setNoRepeats(!noRepeats)}>
                                            {noRepeats && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-brand-600">Never repeat subject in this series</span>
                                    </label>
                                </div>
                            </div>

                            <button type="submit" className="w-full h-11 bg-brand-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-700 transition-all shadow-md active:scale-95">
                                Generate Grid Layout
                            </button>
                        </form>
                    </div>

                    {generatedGrid.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Step 2: Subjects Grid</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Review assignments before saving</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleAutoFill} 
                                        className="bg-purple-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest shadow-md flex items-center gap-2 hover:bg-purple-700 active:scale-95 transition-all"
                                    >
                                        <Wand2 className="w-4 h-4" /> Auto-Fill Pool
                                    </button>
                                    <button 
                                        onClick={handleSaveGrid} 
                                        className="bg-brand-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest shadow-md flex items-center gap-2 hover:bg-brand-700 active:scale-95 transition-all"
                                    >
                                        <Save className="w-4 h-4" /> Save Schedule
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-sm border-collapse min-w-[800px]">
                                    <thead>
                                        <tr>
                                            <th className="bg-slate-100 dark:bg-slate-950 p-4 text-left border-b dark:border-slate-800 w-32 sticky left-0 z-10 dark:text-slate-400 uppercase tracking-widest text-[10px] font-black border-r">Date</th>
                                            {classes.map(c => <th key={c.id} className="bg-slate-100 dark:bg-slate-950 p-4 text-left border-b dark:border-slate-800 font-bold text-slate-700 dark:text-slate-400 border-r">{c.name}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {generatedGrid.map(dateStr => (
                                            <tr key={dateStr} className={isSunday(dateStr) ? 'bg-red-50 dark:bg-red-950/10' : ''}>
                                                <td className="p-4 border-b dark:border-slate-800 sticky left-0 font-bold bg-white dark:bg-slate-900 dark:text-slate-300 text-[11px] border-r">
                                                    {new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })}
                                                </td>
                                                {classes.map(c => (
                                                    <td key={c.id} className="p-2 border-b border-r dark:border-slate-800 min-w-[140px]">
                                                        {isSunday(dateStr) ? 
                                                            <span className="text-[10px] text-red-500 dark:text-red-600 font-black px-2 uppercase tracking-tighter block text-center">Sunday</span> : 
                                                            <input 
                                                                type="text" 
                                                                value={gridData[`${dateStr}_${c.id}`] || ''} 
                                                                onChange={(e) => handleGridChange(dateStr, c.id, e.target.value)} 
                                                                className="w-full bg-black text-white border border-slate-700 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500" 
                                                                placeholder="Subject..." 
                                                            />
                                                        }
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'list' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border dark:border-slate-800 flex items-center gap-4 no-print">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filter by Series:</span>
                        <select 
                            value={filterType} 
                            onChange={e => setFilterType(e.target.value)}
                            className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg"
                        >
                            <option value="All">All Exam Series</option>
                            {Array.from(new Set(exams.map(e => e.examType))).map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {sortedDates.length > 0 ? (
                        <div className="space-y-6">
                            {sortedDates.map(date => (
                                <div key={date} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-950 px-6 py-3 border-b dark:border-slate-800 flex justify-between items-center">
                                        <div className="font-black dark:text-slate-300 text-xs tracking-[0.2em] uppercase">
                                            {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' })}
                                        </div>
                                    </div>
                                    <div className="divide-y dark:divide-slate-800">
                                        {groupedExams[date].sort((a,b) => {
                                            const classA = classes.find(c => c.id === a.classId)?.name || "";
                                            const classB = classes.find(c => c.id === b.classId)?.name || "";
                                            return classA.localeCompare(classB);
                                        }).map(exam => (
                                            <div key={exam.id} className="p-4 px-6 flex flex-wrap justify-between items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                <div className="flex items-center gap-6">
                                                    <div className="min-w-[80px]">
                                                        <span className="text-[10px] font-black text-brand-600 uppercase tracking-tighter block mb-0.5">{exam.examType}</span>
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">{classes.find(c => c.id === exam.classId)?.name}</span>
                                                    </div>
                                                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                            <Book className="w-4 h-4 text-slate-400" /> {exam.subject}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1 mt-1">
                                                            <Clock className="w-3.5 h-3.5 text-brand-500" /> {exam.startTime} — {exam.endTime}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDelete(exam.id)} 
                                                    className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 no-print"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <Layers className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                            <div className="dark:text-slate-600 font-black uppercase tracking-[0.3em] text-xs">No exam entries found</div>
                            <p className="text-slate-400 text-[10px] mt-2 font-bold uppercase tracking-widest">Switch to Generator to create a new series</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
