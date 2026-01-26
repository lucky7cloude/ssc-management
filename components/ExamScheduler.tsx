import React, { useState, useEffect, useMemo } from 'react';
import { ExamSchedule, ClassSection, SCHOOL_LOGO_URL, Teacher } from '../types';
import * as dataService from '../services/dataService';
import { CalendarDays, Clock, Book, Plus, Trash2, Layers, Grid, Save, Download, FileText, X, AlertCircle, Wand2, RefreshCw, Eraser, Share2, UserCheck, Smartphone, Loader2 } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

export const ExamScheduler: React.FC = () => {
    const [exams, setExams] = useState<ExamSchedule[]>([]);
    const [classes, setClasses] = useState<ClassSection[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'generator'>('list');
    
    const [filterType, setFilterType] = useState('All');

    const [genExamName, setGenExamName] = useState('Mid Term Exam 2025');
    const [genStartDate, setGenStartDate] = useState('');
    const [genEndDate, setGenEndDate] = useState('');
    const [genStartTime, setGenStartTime] = useState('09:00');
    const [genEndTime, setGenEndTime] = useState('12:00');
    const [subjectPool, setSubjectPool] = useState('English, Hindi, Mathematics, Science, SST, Computer, Drawing, Sanskrit');
    const [noRepeats, setNoRepeats] = useState(true);
    const [assignInvigilators, setAssignInvigilators] = useState(true);
    const [targetSection, setTargetSection] = useState<'ALL' | 'SECONDARY' | 'SENIOR_SECONDARY'>('ALL');
    
    const [generatedGrid, setGeneratedGrid] = useState<string[]>([]);
    const [gridData, setGridData] = useState<Record<string, { subject: string, invigilatorId?: string }>>({});

    const groupedExams = useMemo(() => {
        const filtered = filterType === 'All' ? exams : exams.filter(e => e.examType === filterType);
        return filtered.reduce((acc, exam) => {
            if (!acc[exam.date]) acc[exam.date] = [];
            acc[exam.date].push(exam);
            return acc;
        }, {} as Record<string, ExamSchedule[]>);
    }, [exams, filterType]);

    const sortedDates = useMemo(() => Object.keys(groupedExams).sort(), [groupedExams]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [cData, eData, tData] = await Promise.all([
                dataService.getClasses(),
                dataService.getExams(),
                dataService.getTeachers()
            ]);
            setClasses(cData);
            setExams(eData);
            setTeachers(tData);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

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
        setGridData({});
    };

    const getFilteredClasses = () => {
        return classes.filter(c => targetSection === 'ALL' || c.section === targetSection);
    };

    const handleAutoFill = () => {
        const subjects = subjectPool.split(',').map(s => s.trim()).filter(s => s !== '');
        if (subjects.length === 0) {
            alert("Please enter some subjects in the pool.");
            return;
        }

        const newGridData: Record<string, { subject: string, invigilatorId?: string }> = {};
        const availableTeachers = [...teachers];
        let teacherCounter = 0;
        
        const targetClasses = getFilteredClasses();

        targetClasses.forEach((cls) => {
            const classSubjects = [...subjects];
            let subjectIndex = 0;

            generatedGrid.forEach((date) => {
                if (isSunday(date)) return;

                let selectedSubject = "";
                if (noRepeats) {
                    if (subjectIndex < classSubjects.length) {
                        selectedSubject = classSubjects[subjectIndex];
                        subjectIndex++;
                    }
                } else {
                    selectedSubject = subjects[subjectIndex % subjects.length];
                    subjectIndex++;
                }

                let invigilatorId = undefined;
                if (assignInvigilators && availableTeachers.length > 0 && selectedSubject) {
                    invigilatorId = availableTeachers[teacherCounter % availableTeachers.length].id;
                    teacherCounter++;
                }

                if (selectedSubject) {
                    newGridData[`${date}_${cls.id}`] = { subject: selectedSubject, invigilatorId };
                }
            });
        });

        setGridData(newGridData);
    };

    const handleGridChange = (date: string, classId: string, value: string, type: 'subject' | 'invigilator') => {
        const key = `${date}_${classId}`;
        const current = gridData[key] || { subject: '' };
        const newData = { 
            ...gridData, 
            [key]: type === 'subject' ? { ...current, subject: value } : { ...current, invigilatorId: value }
        };
        setGridData(newData);
    };

    const clearGrid = () => {
        if (confirm("Clear all data from the grid?")) {
            setGridData({});
        }
    };

    const isSunday = (dateStr: string) => new Date(dateStr).getDay() === 0;

    const handleSaveGrid = async () => {
        const entries = Object.entries(gridData) as [string, { subject: string, invigilatorId?: string }][];
        const entriesToSave = entries.filter(([_, val]) => val.subject.trim() !== "");
        
        if (entriesToSave.length === 0) {
            alert("No exams assigned in the grid.");
            return;
        }
        
        if (!confirm(`Save ${entriesToSave.length} exam entries?`)) return;
        
        setIsLoading(true);
        const timestamp = Date.now();
        
        try {
            for (let i = 0; i < entriesToSave.length; i++) {
                const [key, value] = entriesToSave[i];
                const [date, classId] = key.split('_');
                await dataService.addExam({
                    id: `${timestamp}-${i}`,
                    examType: genExamName,
                    classId,
                    subject: value.subject.trim(),
                    invigilatorId: value.invigilatorId,
                    date,
                    startTime: genStartTime,
                    endTime: genEndTime
                });
            }
            await loadData();
            setActiveTab('list');
            setFilterType(genExamName);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if(confirm("Remove this exam entry?")){
            setIsLoading(true);
            try {
                const updated = await dataService.deleteExam(id);
                setExams(updated);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const downloadPDF = async (isDraft: boolean = false) => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const title = isDraft ? `DRAFT: ${genExamName}` : (filterType === 'All' ? 'Complete Schedule' : filterType);
        
        // Letterhead Styling
        await safeAddImage(doc, SCHOOL_LOGO_URL, 10, 8, 30, 30);
        doc.setFontSize(24);
        doc.setTextColor(2, 132, 199);
        doc.setFont("helvetica", "bold");
        doc.text("SILVER STAR CONVENT SCHOOL", 105, 18, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text("Official Examination Department • Institutional Management System", 105, 24, { align: 'center' });
        
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 35, 182, 12, 'F');
        doc.setFontSize(14);
        doc.setTextColor(30);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), 105, 43, { align: 'center' });
        
        let currentY = 55;

        // Data Source
        let dataSource: ExamSchedule[] = [];
        if (isDraft) {
            const entries = Object.entries(gridData) as [string, { subject: string, invigilatorId?: string }][];
            entries.forEach(([key, val]) => {
                if (!val.subject) return;
                const [date, classId] = key.split('_');
                dataSource.push({
                    id: 'draft',
                    examType: genExamName,
                    classId,
                    subject: val.subject,
                    date,
                    startTime: genStartTime,
                    endTime: genEndTime,
                    invigilatorId: val.invigilatorId
                });
            });
        } else {
            dataSource = filterType === 'All' ? exams : exams.filter(e => e.examType === filterType);
        }

        if (dataSource.length === 0) {
            alert("No data to export.");
            return;
        }

        // Sorting
        dataSource.sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            const classA = classes.find(c => c.id === a.classId)?.name || '';
            const classB = classes.find(c => c.id === b.classId)?.name || '';
            return classA.localeCompare(classB, undefined, { numeric: true });
        });

        const groupedByDate: Record<string, ExamSchedule[]> = {};
        dataSource.forEach(e => {
            if (!groupedByDate[e.date]) groupedByDate[e.date] = [];
            groupedByDate[e.date].push(e);
        });

        Object.keys(groupedByDate).sort().forEach((date) => {
            const dateExams = groupedByDate[date];
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            if (currentY > 260) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFillColor(2, 132, 199);
            doc.rect(14, currentY, 182, 7, 'F');
            doc.setFontSize(10);
            doc.setTextColor(255);
            doc.setFont("helvetica", "bold");
            doc.text(formattedDate, 105, currentY + 5, { align: 'center' });
            
            currentY += 7;

            const tableBody = dateExams.map(e => {
                const cls = classes.find(c => c.id === e.classId)?.name || 'Unknown';
                const teacher = teachers.find(t => t.id === e.invigilatorId);
                const invigilator = teacher ? teacher.name : '-';
                const time = `${e.startTime} - ${e.endTime}`;
                return [cls, e.subject, time, invigilator];
            });

            autoTable(doc, {
                startY: currentY,
                head: [['Class', 'Subject', 'Timing', 'Invigilator']],
                body: tableBody,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 2.5, textColor: 50 },
                headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
                columnStyles: {
                    0: { fontStyle: 'bold', width: 28 },
                    1: { width: 55 },
                    2: { width: 45 },
                    3: { width: 54 }
                },
                margin: { left: 14, right: 14 },
                didDrawPage: (data) => {
                    currentY = data.cursor?.y || 20;
                }
            });

            currentY += 10;
        });

        const fileName = `${title.replace(/\s+/g, '_')}_DateSheet.pdf`;
        doc.save(fileName);
    };

    return (
        <div className="space-y-6 relative">
            {isLoading && activeTab === 'list' && (
                <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-950/50 flex items-center justify-center rounded-2xl">
                    <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                </div>
            )}

            <div className="flex justify-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit mx-auto shadow-sm no-print">
                <button onClick={() => setActiveTab('list')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-slate-800 dark:bg-black text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}><Grid className="w-4 h-4" /> Exam History</button>
                <button onClick={() => setActiveTab('generator')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'generator' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400'}`}><Layers className="w-4 h-4" /> Smart Generator</button>
            </div>

            {activeTab === 'generator' && (
                <div className="space-y-6 animate-fade-in no-print">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 border-b dark:border-slate-800 pb-3 flex items-center gap-2"><Plus className="w-5 h-5 text-brand-600" /> Exam Series Definition</h3>
                        <form onSubmit={handleGenerateGrid} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Series Name</label><input type="text" value={genExamName} onChange={e => setGenExamName(e.target.value)} className="w-full text-sm h-10" placeholder="e.g. Annual Exams" /></div>
                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Starts On</label><input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)} className="w-full text-sm h-10" required /></div>
                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ends On</label><input type="date" value={genEndDate} onChange={e => setGenEndDate(e.target.value)} className="w-full text-sm h-10" required /></div>
                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Daily Timings</label><div className="flex gap-2"><input type="time" value={genStartTime} onChange={e => setGenStartTime(e.target.value)} className="w-full text-sm h-10" /><input type="time" value={genEndTime} onChange={e => setGenEndTime(e.target.value)} className="w-full text-sm h-10" /></div></div>
                            </div>
                            <div className="pt-4 border-t dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Target Grade Sections</label>
                                <div className="flex gap-2 mb-4">
                                    <button type="button" onClick={() => setTargetSection('ALL')} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${targetSection === 'ALL' ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>Full Registry</button>
                                    <button type="button" onClick={() => setTargetSection('SECONDARY')} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${targetSection === 'SECONDARY' ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>SEC (6-10)</button>
                                    <button type="button" onClick={() => setTargetSection('SENIOR_SECONDARY')} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${targetSection === 'SENIOR_SECONDARY' ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>SR SEC (11-12)</button>
                                </div>

                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Core Subject Pool</label>
                                <textarea value={subjectPool} onChange={e => setSubjectPool(e.target.value)} className="w-full h-20 text-sm p-3 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl" placeholder="English, Hindi, Math..." />
                                <div className="mt-4 flex flex-wrap gap-6">
                                    <button type="button" onClick={() => setNoRepeats(!noRepeats)} className={`flex items-center gap-2 text-xs font-bold transition-colors ${noRepeats ? 'text-brand-600' : 'text-slate-400'}`}><div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${noRepeats ? 'bg-brand-600 border-brand-600' : 'border-slate-400'}`}>{noRepeats && <div className="w-2 h-2 bg-white rounded-full" />}</div>Conflict-Free Subjects</button>
                                    <button type="button" onClick={() => setAssignInvigilators(!assignInvigilators)} className={`flex items-center gap-2 text-xs font-bold transition-colors ${assignInvigilators ? 'text-purple-600' : 'text-slate-400'}`}><div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${assignInvigilators ? 'bg-purple-600 border-purple-600' : 'border-slate-400'}`}>{assignInvigilators && <div className="w-2 h-2 bg-white rounded-full" />}</div>Auto-Assign Duties</button>
                                </div>
                            </div>
                            <button type="submit" className="w-full h-12 bg-brand-600 text-white rounded-lg font-black uppercase text-xs tracking-widest hover:bg-brand-700 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"><RefreshCw className="w-4 h-4" /> GENERATE DRAFT MATRIX</button>
                        </form>
                    </div>

                    {generatedGrid.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-pop-in">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b dark:border-slate-800 pb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase text-sm tracking-widest"><Wand2 className="w-5 h-5 text-purple-600" /> Draft Matrix Review</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Review and customize before official publish</p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button onClick={() => downloadPDF(true)} className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-brand-50 hover:text-brand-600 transition-all border dark:border-slate-700 flex items-center justify-center gap-2"><Smartphone className="w-3.5 h-3.5" /> PDF DRAFT</button>
                                    <button onClick={handleAutoFill} className="flex-1 sm:flex-none px-4 py-2.5 bg-purple-50 text-purple-600 dark:bg-purple-900/20 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all flex items-center justify-center gap-2">AUTO-FILL</button>
                                    <button onClick={clearGrid} className="px-4 py-2.5 bg-slate-50 text-slate-600 dark:bg-slate-800 rounded-lg text-xs font-black uppercase transition-all hover:bg-red-500 hover:text-white"><Trash2 className="w-3.5 h-3.5"/></button>
                                </div>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full border-collapse min-w-[800px]">
                                    <thead>
                                        <tr>
                                            <th className="p-3 text-left text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 z-10">Schedule / Gr</th>
                                            {getFilteredClasses().map(c => <th key={c.id} className="p-3 text-[10px] font-black uppercase text-slate-500 border-b dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-950">{c.name}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {generatedGrid.map(date => (
                                            <tr key={date} className={isSunday(date) ? 'bg-red-50/30 dark:bg-red-900/5' : 'hover:bg-slate-50/50 transition-colors'}>
                                                <td className="p-3 whitespace-nowrap border-b dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{new Date(date).toLocaleDateString('en-GB', { weekday: 'long' })}</span>
                                                </td>
                                                {getFilteredClasses().map(cls => (
                                                    <td key={`${date}_${cls.id}`} className="p-2 border-b dark:border-slate-800">
                                                        {!isSunday(date) ? (
                                                            <div className="space-y-1.5 p-1 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm">
                                                                <input 
                                                                    type="text" 
                                                                    value={gridData[`${date}_${cls.id}`]?.subject || ''} 
                                                                    onChange={(e) => handleGridChange(date, cls.id, e.target.value, 'subject')}
                                                                    className="w-full text-[10px] h-7 px-2 border-none bg-slate-50 dark:bg-slate-900 rounded font-bold"
                                                                    placeholder="Subject"
                                                                />
                                                                {assignInvigilators && (
                                                                    <select 
                                                                        value={gridData[`${date}_${cls.id}`]?.invigilatorId || ''} 
                                                                        onChange={(e) => handleGridChange(date, cls.id, e.target.value, 'invigilator')}
                                                                        className="w-full text-[9px] h-6 px-1 border-none bg-slate-100 dark:bg-slate-950 rounded font-medium text-slate-500"
                                                                    >
                                                                        <option value="">Teacher?</option>
                                                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                                    </select>
                                                                )}
                                                            </div>
                                                        ) : <div className="text-[10px] text-red-500 font-black text-center italic tracking-widest uppercase">Sunday</div>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t dark:border-slate-800">
                                <button onClick={() => setGeneratedGrid([])} className="px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all">Discard Draft</button>
                                <button onClick={handleSaveGrid} disabled={isLoading} className="bg-brand-600 text-white px-12 py-4 rounded-xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-brand-700 transition-all active:scale-95 flex items-center justify-center gap-3">
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-5 h-5"/>}
                                    {isLoading ? 'PUBLISHING...' : 'PUBLISH OFFICIAL'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'list' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Series</label>
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full sm:w-64">
                                <option value="All">Complete History</option>
                                {[...new Set(exams.map(e => e.examType))].map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <button onClick={() => downloadPDF(false)} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3 bg-slate-900 dark:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl border dark:border-slate-800"><Download className="w-4 h-4" /> EXPORT PDF</button>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        {sortedDates.length > 0 ? sortedDates.map(date => (
                            <div key={date} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden group">
                                <div className="p-5 bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-brand-500 rounded-xl text-white shadow-lg"><CalendarDays className="w-5 h-5" /></div>
                                        <h4 className="font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase text-sm">{new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h4>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-2">
                                        <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest">{groupedExams[date][0].examType}</span>
                                    </div>
                                </div>
                                <div className="p-0 overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 bg-slate-50/30">
                                            <tr>
                                                <th className="px-8 py-4">Grade</th>
                                                <th className="px-8 py-4">Subject Name</th>
                                                <th className="px-8 py-4">Timings</th>
                                                <th className="px-8 py-4">Duty Personnel</th>
                                                <th className="px-8 py-4 text-right">Registry</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {groupedExams[date].map(e => (
                                                <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-8 py-5 font-black text-brand-600 text-xs tracking-widest">{classes.find(c => c.id === e.classId)?.name}</td>
                                                    <td className="px-8 py-5 font-bold text-slate-800 dark:text-slate-100 text-sm">{e.subject}</td>
                                                    <td className="px-8 py-5 text-xs font-bold text-slate-500 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {e.startTime} - {e.endTime}</td>
                                                    <td className="px-8 py-5">
                                                        {e.invigilatorId ? (
                                                            <span className="flex items-center gap-3 text-[11px] font-black text-purple-600 uppercase">
                                                                <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm ring-4 ring-purple-100 dark:ring-purple-900/30"></div>
                                                                {teachers.find(t => t.id === e.invigilatorId)?.name}
                                                            </span>
                                                        ) : <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Unassigned</span>}
                                                    </td>
                                                    <td className="px-8 py-5 text-right"><button onClick={() => handleDelete(e.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )) : (
                            <div className="py-32 flex flex-col items-center justify-center text-center opacity-40 grayscale">
                                <FileText className="w-20 h-20 text-slate-300 mb-6" />
                                <h3 className="text-xl font-black text-slate-500 uppercase tracking-widest">No Exam Records</h3>
                                <p className="text-xs font-bold text-slate-400 mt-2">Generate a new date sheet to populate the history</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};