import React, { useState, useEffect } from 'react';
import { ExamSchedule, ClassSection } from '../types';
import * as dataService from '../services/dataService';
import { CalendarDays, Clock, Book, Plus, Trash2, Layers, Grid, Save, Download, FileText, X, AlertCircle } from 'lucide-react';
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
    const [generatedGrid, setGeneratedGrid] = useState<string[]>([]); // Array of date strings
    
    // Grid Data: key = "date_classId", value = subject string
    const [gridData, setGridData] = useState<Record<string, string>>({});

    useEffect(() => {
        setExams(dataService.getExams());
        setClasses(dataService.getClasses());
    }, []);

    // --- Generator Functions ---

    const handleGenerateGrid = (e: React.FormEvent) => {
        e.preventDefault();
        if (!genStartDate || !genEndDate) return;

        const start = new Date(genStartDate);
        const end = new Date(genEndDate);
        const dates: string[] = [];

        // Loop from start to end
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0]);
        }

        setGeneratedGrid(dates);
    };

    const handleGridChange = (date: string, classId: string, value: string) => {
        setGridData(prev => ({
            ...prev,
            [`${date}_${classId}`]: value
        }));
    };

    const isSunday = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.getDay() === 0;
    };

    const checkForDuplicate = (currentDate: string, classId: string, subject: string) => {
        if (!subject || !subject.trim()) return false;
        
        // Check if the same subject exists for the same class on a DIFFERENT date
        const duplicateEntry = Object.entries(gridData).find(([key, val]) => {
            const [d, c] = key.split('_');
            if (c !== classId) return false; // Different class, not a conflict
            if (d === currentDate) return false; // Same date (current cell), not a conflict
            
            return (val as string).trim().toLowerCase() === subject.trim().toLowerCase();
        });
        
        return !!duplicateEntry;
    };

    const handleSaveGrid = () => {
        if (!confirm(`This will save ${Object.keys(gridData).length} exam entries. Continue?`)) return;

        let newExams: ExamSchedule[] = [];
        const timestamp = Date.now();

        Object.entries(gridData).forEach(([key, value], index) => {
            const subject = value as string;
            if (!subject.trim()) return;
            const [date, classId] = key.split('_');

            // Skip Sundays if somehow data got in
            if (isSunday(date)) return;

            newExams.push({
                id: `${timestamp}-${index}`,
                examType: genExamName,
                classId,
                subject: subject.trim(),
                date,
                startTime: genStartTime,
                endTime: genEndTime
            });
        });

        // We assume we append. A more complex app might check for duplicates.
        // For now, let's just add them.
        let currentExams = dataService.getExams();
        // Simple append in local state/storage logic
        newExams.forEach(e => dataService.addExam(e));
        
        setExams(dataService.getExams());
        alert("Exams saved successfully!");
        setActiveTab('list');
        setFilterType(genExamName); // Switch filter to new exam
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

        doc.setFontSize(18);
        doc.text("Silver Star Convent School", 14, 15);
        doc.setFontSize(12);
        doc.text(`${genExamName} Schedule (${genStartDate} to ${genEndDate})`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Time: ${genStartTime} - ${genEndTime}`, 14, 27);

        // Prepare columns: Date, Day, ...Classes
        const tableHead = [['Date', 'Day', ...classes.map(c => c.name)]];
        
        const tableBody = generatedGrid.map(date => {
            const dateObj = new Date(date);
            const isSun = dateObj.getDay() === 0;
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            
            const row = [
                date,
                dayName,
            ];

            if (isSun) {
                classes.forEach(() => row.push("SUNDAY / HOLIDAY"));
            } else {
                classes.forEach(cls => {
                    const subject = gridData[`${date}_${cls.id}`] || '-';
                    row.push(subject);
                });
            }
            return row;
        });

        autoTable(doc, {
            head: tableHead,
            body: tableBody,
            startY: 32,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [14, 165, 233] },
            didParseCell: (data) => {
                if (data.row.raw && (data.row.raw as string[])[1] === 'Sun') {
                    data.cell.styles.fillColor = [254, 226, 226]; // Red background for Sunday row
                    data.cell.styles.textColor = [185, 28, 28];
                }
            }
        });

        doc.save(`${genExamName}_Schedule.pdf`);
    };


    // --- List Mode Functions ---

    const handleDelete = (id: string) => {
        if(confirm("Remove this exam entry?")){
            setExams(dataService.deleteExam(id));
        }
    };

    const getExamTypes = () => {
        const types = Array.from(new Set(exams.map(e => e.examType)));
        if (!types.includes("Mid Term")) types.push("Mid Term");
        if (!types.includes("Half Yearly")) types.push("Half Yearly");
        if (!types.includes("Yearly")) types.push("Yearly");
        return types;
    };

    const filteredExams = filterType === 'All' ? exams : exams.filter(e => e.examType === filterType);
    
    // Group by Date for display
    const groupedExams = filteredExams.reduce((groups, exam) => {
        const date = exam.date;
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(exam);
        return groups;
    }, {} as Record<string, ExamSchedule[]>);

    // Sort dates
    const sortedDates = Object.keys(groupedExams).sort();

    return (
        <div className="space-y-6">
            
            {/* Navigation Tabs */}
            <div className="flex justify-center bg-white p-1 rounded-xl border border-slate-200 w-fit mx-auto shadow-sm">
                <button 
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <Grid className="w-4 h-4" /> View Schedule
                </button>
                <button 
                    onClick={() => setActiveTab('generator')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'generator' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:text-brand-600'}`}
                >
                    <Layers className="w-4 h-4" /> Schedule Generator
                </button>
            </div>

            {/* GENERATOR MODE */}
            {activeTab === 'generator' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Step 1: Configure Exam Details</h3>
                        <form onSubmit={handleGenerateGrid} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Exam Name</label>
                                <input 
                                    type="text" 
                                    value={genExamName}
                                    onChange={e => setGenExamName(e.target.value)}
                                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                                    placeholder="e.g. Final Exams"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Start Date</label>
                                <input 
                                    type="date" 
                                    value={genStartDate}
                                    onChange={e => setGenStartDate(e.target.value)}
                                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">End Date</label>
                                <input 
                                    type="date" 
                                    value={genEndDate}
                                    onChange={e => setGenEndDate(e.target.value)}
                                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={genStartTime} 
                                        onChange={e => setGenStartTime(e.target.value)} 
                                        className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2 text-sm shadow-sm" 
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">End Time</label>
                                    <input 
                                        type="time" 
                                        value={genEndTime} 
                                        onChange={e => setGenEndTime(e.target.value)} 
                                        className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2 text-sm shadow-sm" 
                                    />
                                </div>
                            </div>
                            <button type="submit" className="bg-slate-800 text-white p-2 rounded-lg font-medium hover:bg-slate-900 transition-colors shadow-sm">
                                Generate Grid
                            </button>
                        </form>
                    </div>

                    {generatedGrid.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-slate-800">Step 2: Fill Subjects</h3>
                                    <p className="text-xs text-slate-500">Enter subject names. Duplicates per class are highlighted in red.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setGeneratedGrid([])} className="text-slate-500 hover:text-red-500 px-3 py-1.5 text-sm font-medium">Clear</button>
                                    <button 
                                        onClick={handleDownloadPDF}
                                        className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                                    >
                                        <FileText className="w-4 h-4" /> PDF Download
                                    </button>
                                    <button 
                                        onClick={handleSaveGrid}
                                        className="flex items-center gap-2 bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm"
                                    >
                                        <Save className="w-4 h-4" /> Save All Entries
                                    </button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="bg-slate-100 p-3 text-left border-b border-r border-slate-200 w-32 sticky left-0 z-10">Date</th>
                                            {classes.map(c => (
                                                <th key={c.id} className="bg-slate-100 p-3 text-left border-b border-slate-200 min-w-[120px] font-semibold text-slate-700">{c.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {generatedGrid.map(dateStr => {
                                            const isSun = isSunday(dateStr);
                                            const displayDate = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                            
                                            return (
                                                <tr key={dateStr} className={isSun ? 'bg-red-50' : 'hover:bg-slate-50'}>
                                                    <td className={`p-3 border-b border-r border-slate-200 sticky left-0 font-medium ${isSun ? 'bg-red-50 text-red-600' : 'bg-white text-slate-700'}`}>
                                                        {displayDate}
                                                    </td>
                                                    {classes.map(c => {
                                                        const currentValue = gridData[`${dateStr}_${c.id}`] || '';
                                                        const isDup = !isSun && checkForDuplicate(dateStr, c.id, currentValue);

                                                        return (
                                                            <td key={c.id} className="p-2 border-b border-slate-100">
                                                                {isSun ? (
                                                                    <span className="text-xs text-red-300 font-bold uppercase tracking-widest pl-2">Sunday</span>
                                                                ) : (
                                                                    <div className="relative group">
                                                                        <input 
                                                                            type="text" 
                                                                            placeholder="Subject..."
                                                                            value={currentValue}
                                                                            onChange={(e) => handleGridChange(dateStr, c.id, e.target.value)}
                                                                            className={`w-full rounded px-2 py-1.5 outline-none transition-all placeholder-slate-300 text-sm border ${
                                                                                isDup 
                                                                                ? 'bg-red-50 text-red-700 border-red-300 focus:ring-2 focus:ring-red-200 font-medium' 
                                                                                : 'bg-white text-slate-900 border-slate-300 focus:ring-2 focus:ring-brand-500'
                                                                            }`}
                                                                        />
                                                                        {isDup && (
                                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" title="Duplicate subject for this class">
                                                                                <AlertCircle className="w-4 h-4" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* LIST MODE (Existing View) */}
            {activeTab === 'list' && (
                <div className="space-y-4 animate-fade-in">
                    {/* Filter Bar */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 overflow-x-auto no-scrollbar">
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Filter Schedule:</span>
                        <button 
                            onClick={() => setFilterType('All')}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterType === 'All' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            All Exams
                        </button>
                        {getExamTypes().map(type => (
                            <button 
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterType === type ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {type}
                            </button>
                        ))}
                        <button onClick={() => window.print()} className="ml-auto flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-600 bg-slate-50 hover:bg-brand-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">
                            Print List
                        </button>
                    </div>

                    {/* Schedule List */}
                    <div className="space-y-6">
                        {sortedDates.length > 0 ? (
                            sortedDates.map(examDate => (
                                <div key={examDate} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                                        <CalendarDays className="w-5 h-5 text-brand-600" />
                                        <h4 className="font-bold text-slate-800">
                                            {new Date(examDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </h4>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {groupedExams[examDate].map(exam => {
                                            const cls = classes.find(c => c.id === exam.classId);
                                            return (
                                                <div key={exam.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors group">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="bg-brand-100 text-brand-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                                {exam.examType}
                                                            </span>
                                                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                                <Clock className="w-3 h-3" /> {exam.startTime} - {exam.endTime}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 text-lg">{cls?.name || 'Unknown Class'}</span>
                                                            <span className="text-slate-300">|</span>
                                                            <span className="text-slate-600 font-medium flex items-center gap-1">
                                                                <Book className="w-4 h-4 text-slate-400" /> {exam.subject}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => handleDelete(exam.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                                        title="Remove Exam"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                                <Layers className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500">No exams scheduled matching your filter.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};