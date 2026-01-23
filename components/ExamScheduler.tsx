
import React, { useState, useEffect, useMemo } from 'react';
import { ExamSchedule, ClassSection, SCHOOL_LOGO_URL, Teacher } from '../types';
import * as dataService from '../services/dataService';
import { CalendarDays, Clock, Book, Plus, Trash2, Layers, Grid, Save, Download, FileText, X, AlertCircle, Wand2, RefreshCw, Eraser, Share2, UserCheck } from 'lucide-react';
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
    
    const [generatedGrid, setGeneratedGrid] = useState<string[]>([]);
    const [gridData, setGridData] = useState<Record<string, { subject: string, invigilatorId?: string }>>({});
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const groupedExams = useMemo(() => {
        const filtered = filterType === 'All' ? exams : exams.filter(e => e.examType === filterType);
        return filtered.reduce((acc, exam) => {
            if (!acc[exam.date]) acc[exam.date] = [];
            acc[exam.date].push(exam);
            return acc;
        }, {} as Record<string, ExamSchedule[]>);
    }, [exams, filterType]);

    const sortedDates = useMemo(() => Object.keys(groupedExams).sort(), [groupedExams]);

    useEffect(() => {
        setExams(dataService.getExams());
        setClasses(dataService.getClasses());
        setTeachers(dataService.getTeachers());
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
        setGridData({});
        setValidationErrors([]);
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
        
        classes.forEach((cls) => {
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
        setValidationErrors([]);
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
            setValidationErrors([]);
        }
    };

    const isSunday = (dateStr: string) => new Date(dateStr).getDay() === 0;

    const handleSaveGrid = () => {
        const entries = Object.entries(gridData) as [string, { subject: string, invigilatorId?: string }][];
        const entriesToSave = entries.filter(([_, val]) => val.subject.trim() !== "");
        
        if (entriesToSave.length === 0) {
            alert("No exams assigned in the grid.");
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
                subject: value.subject.trim(),
                invigilatorId: value.invigilatorId,
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

    const downloadDateSheet = async () => {
        const doc = new jsPDF();
        await safeAddImage(doc, SCHOOL_LOGO_URL, 10, 10, 25, 25);
        
        doc.setFontSize(22);
        doc.setTextColor(2, 132, 199);
        doc.text("SILVER STAR CONVENT SCHOOL", 105, 20, { align: 'center' });
        doc.setFontSize(14);
        doc.setTextColor(80, 80, 80);
        doc.text(`OFFICIAL DATE SHEET: ${filterType === 'All' ? 'Full Schedule' : filterType}`, 105, 30, { align: 'center' });
        doc.setDrawColor(200);
        doc.line(10, 38, 200, 38);

        const filteredExams = filterType === 'All' ? exams : exams.filter(e => e.examType === filterType);
        const grouped = filteredExams.reduce((acc, exam) => {
            if (!acc[exam.date]) acc[exam.date] = [];
            acc[exam.date].push(exam);
            return acc;
        }, {} as Record<string, ExamSchedule[]>);

        const sortedDatesLocal = Object.keys(grouped).sort();
        const tableBody = sortedDatesLocal.map(date => {
            const rowExams = grouped[date];
            const dateStr = new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' });
            const subjectsStr = rowExams.map(e => {
                const cls = classes.find(c => c.id === e.classId)?.name || 'Class';
                const t = teachers.find(teacher => teacher.id === e.invigilatorId)?.name;
                return `${cls}: ${e.subject}${t ? ` (Duty: ${t})` : ''}`;
            }).join('\n');
            return [dateStr, subjectsStr];
        });

        autoTable(doc, {
            startY: 45,
            head: [['Date', 'Exams & Invigilators']],
            body: tableBody,
            styles: { fontSize: 10, cellPadding: 5 },
            headStyles: { fillColor: [2, 132, 199] },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            columnStyles: { 0: { fontStyle: 'bold', width: 35 } }
        });

        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("Handcrafted by Lucky • Best of luck to all students!", 105, (doc as any).lastAutoTable.finalY + 15, { align: 'center' });
        doc.save(`${filterType.replace(/\s+/g, '_')}_DateSheet.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit mx-auto shadow-sm no-print">
                <button onClick={() => setActiveTab('list')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-slate-800 dark:bg-black text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}><Grid className="w-4 h-4" /> View Date Sheets</button>
                <button onClick={() => setActiveTab('generator')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'generator' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400'}`}><Layers className="w-4 h-4" /> New Generator</button>
            </div>

            {activeTab === 'generator' && (
                <div className="space-y-6 animate-fade-in no-print">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 border-b dark:border-slate-800 pb-3 flex items-center gap-2"><Plus className="w-5 h-5 text-brand-600" /> 1. Exam Configuration</h3>
                        <form onSubmit={handleGenerateGrid} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Series Name</label><input type="text" value={genExamName} onChange={e => setGenExamName(e.target.value)} className="w-full text-sm h-10" placeholder="e.g. Annual Exams" /></div>
                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Starts On</label><input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)} className="w-full text-sm h-10" required /></div>
                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ends On</label><input type="date" value={genEndDate} onChange={e => setGenEndDate(e.target.value)} className="w-full text-sm h-10" required /></div>
                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Timings</label><div className="flex gap-2"><input type="time" value={genStartTime} onChange={e => setGenStartTime(e.target.value)} className="w-full text-sm h-10" /><input type="time" value={genEndTime} onChange={e => setGenEndTime(e.target.value)} className="w-full text-sm h-10" /></div></div>
                            </div>
                            <div className="pt-4 border-t dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Subject Pool (Comma Separated)</label>
                                <textarea value={subjectPool} onChange={e => setSubjectPool(e.target.value)} className="w-full h-20 text-sm p-3 bg-black border border-slate-700 rounded-xl" placeholder="English, Hindi, Math..." />
                                <div className="mt-4 flex flex-wrap gap-6">
                                    <button type="button" onClick={() => setNoRepeats(!noRepeats)} className={`flex items-center gap-2 text-xs font-bold transition-colors ${noRepeats ? 'text-brand-600' : 'text-slate-400'}`}><div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${noRepeats ? 'bg-brand-600 border-brand-600' : 'border-slate-400'}`}>{noRepeats && <div className="w-2 h-2 bg-white rounded-full" />}</div>Strict Subject Logic</button>
                                    <button type="button" onClick={() => setAssignInvigilators(!assignInvigilators)} className={`flex items-center gap-2 text-xs font-bold transition-colors ${assignInvigilators ? 'text-purple-600' : 'text-slate-400'}`}><div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${assignInvigilators ? 'bg-purple-600 border-purple-600' : 'border-slate-400'}`}>{assignInvigilators && <div className="w-2 h-2 bg-white rounded-full" />}</div>Assign Teacher Duties</button>
                                </div>
                            </div>
                            <button type="submit" className="w-full h-11 bg-brand-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-700 transition-all shadow-md active:scale-95">Generate Draft Grid</button>
                        </form>
                    </div>

                    {generatedGrid.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-pop-in">
                            <div className="flex justify-between items-center mb-6 border-b dark:border-slate-800 pb-3">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Wand2 className="w-5 h-5 text-purple-600" /> 2. Review & Auto-Fill</h3>
                                <div className="flex gap-2">
                                    <button onClick={handleAutoFill} className="px-4 py-2 bg-purple-50 text-purple-600 dark:bg-purple-900/20 rounded-lg text-xs font-bold hover:bg-purple-600 hover:text-white transition-all">Smart Fill Grid</button>
                                    <button onClick={clearGrid} className="px-4 py-2 bg-slate-50 text-slate-600 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all">Clear All</button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-3 text-left text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Date / Class</th>
                                            {classes.map(c => <th key={c.id} className="p-3 text-[10px] font-black uppercase text-slate-500 border-b dark:border-slate-800 text-center">{c.name}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {generatedGrid.map(date => (
                                            <tr key={date} className={isSunday(date) ? 'bg-red-50/30 dark:bg-red-900/5' : ''}>
                                                <td className="p-3 whitespace-nowrap border-b dark:border-slate-800">
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{new Date(date).toLocaleDateString('en-GB', { weekday: 'long' })}</span>
                                                </td>
                                                {classes.map(cls => (
                                                    <td key={`${date}_${cls.id}`} className="p-2 border-b dark:border-slate-800 min-w-[120px]">
                                                        {!isSunday(date) ? (
                                                            <div className="space-y-1">
                                                                <input 
                                                                    type="text" 
                                                                    value={gridData[`${date}_${cls.id}`]?.subject || ''} 
                                                                    onChange={(e) => handleGridChange(date, cls.id, e.target.value, 'subject')}
                                                                    className="w-full text-[10px] h-7 px-2 border-slate-200 dark:border-slate-700"
                                                                    placeholder="Subject..."
                                                                />
                                                                {assignInvigilators && (
                                                                    <select 
                                                                        value={gridData[`${date}_${cls.id}`]?.invigilatorId || ''} 
                                                                        onChange={(e) => handleGridChange(date, cls.id, e.target.value, 'invigilator')}
                                                                        className="w-full text-[9px] h-6 px-1 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                                                    >
                                                                        <option value="">No Duty</option>
                                                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                                    </select>
                                                                )}
                                                            </div>
                                                        ) : <div className="text-[10px] text-red-500 font-bold text-center italic">Holiday</div>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-8 flex justify-end gap-3 pt-6 border-t dark:border-slate-800">
                                <button onClick={() => setGeneratedGrid([])} className="px-6 py-3 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all">Discard</button>
                                <button onClick={handleSaveGrid} className="bg-brand-600 text-white px-10 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-700 transition-all">Push to Official Schedule</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'list' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filter Exam:</label>
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm h-9 px-4 rounded-lg">
                                <option value="All">All Exam Series</option>
                                {[...new Set(exams.map(e => e.examType))].map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <button onClick={downloadDateSheet} className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-md"><Download className="w-4 h-4" /> Download PDF</button>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {sortedDates.map(date => (
                            <div key={date} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden group">
                                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CalendarDays className="w-5 h-5 text-brand-600" />
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h4>
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Official Silver Star Planner</span>
                                </div>
                                <div className="p-0 overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">
                                            <tr>
                                                <th className="px-6 py-3">Class</th>
                                                <th className="px-6 py-3">Subject</th>
                                                <th className="px-6 py-3">Timing</th>
                                                <th className="px-6 py-3">Invigilator (Teacher)</th>
                                                <th className="px-6 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {groupedExams[date].map(e => (
                                                <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-4 font-black text-brand-600 text-xs">{classes.find(c => c.id === e.classId)?.name}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{e.subject}</td>
                                                    <td className="px-6 py-4 text-xs font-medium text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {e.startTime} - {e.endTime}</td>
                                                    <td className="px-6 py-4">
                                                        {e.invigilatorId ? (
                                                            <span className="flex items-center gap-2 text-xs font-bold text-purple-600">
                                                                <UserCheck className="w-3.5 h-3.5" />
                                                                {teachers.find(t => t.id === e.invigilatorId)?.name}
                                                            </span>
                                                        ) : <span className="text-[10px] text-slate-300 font-bold uppercase">No Duty Assigned</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right"><button onClick={() => handleDelete(e.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
