
import React, { useState, useEffect } from 'react';
import { Teacher, TeacherRemark, UserRole } from '../types';
import * as dataService from '../services/dataService';
import { FileText, Plus, Trash2, Download, Search, Calendar, Filter } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
    currentRole: UserRole;
}

export const TeacherRemarks: React.FC<Props> = ({ currentRole }) => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [remarks, setRemarks] = useState<TeacherRemark[]>([]);
    
    // Form State
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [remarkType, setRemarkType] = useState<'General' | 'Monthly' | 'Yearly'>('General');

    // Filter State
    const [filterTeacherId, setFilterTeacherId] = useState('');
    const [reportMonth, setReportMonth] = useState(new Date().getMonth().toString());
    const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());

    useEffect(() => {
        setTeachers(dataService.getTeachers());
        setRemarks(dataService.getRemarks().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, []);

    // Fix: Made handleSubmit async to handle promise from dataService
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!selectedTeacherId || !date || !note.trim()) return;

        const newRemark: TeacherRemark = {
            id: Date.now().toString(),
            teacherId: selectedTeacherId,
            date,
            note: note.trim(),
            type: remarkType
        };

        // Fix: Await the promise before sorting the resulting array
        const updated = await dataService.addRemark(newRemark);
        setRemarks(updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setNote('');
    };

    // Fix: Made handleDelete async to handle promise from dataService
    const handleDelete = async (id: string) => {
        if(confirm("Are you sure you want to delete this remark?")){
            // Fix: Await the promise before sorting the resulting array
            const updated = await dataService.deleteRemark(id);
            setRemarks(updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
    };

    const handleDownloadReport = () => {
        const monthNum = parseInt(reportMonth);
        const yearNum = parseInt(reportYear);
        
        // Filter remarks
        const filteredRemarks = remarks.filter(r => {
            const d = new Date(r.date);
            const matchesDate = d.getMonth() === monthNum && d.getFullYear() === yearNum;
            const matchesTeacher = filterTeacherId ? r.teacherId === filterTeacherId : true;
            return matchesDate && matchesTeacher;
        });

        if(filteredRemarks.length === 0) {
            alert("No remarks found for the selected criteria.");
            return;
        }

        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text("Silver Star Convent School", 105, 15, { align: "center" });
        doc.setFontSize(14);
        doc.text("Teacher Remarks Report", 105, 25, { align: "center" });
        
        const monthName = new Date(yearNum, monthNum).toLocaleString('default', { month: 'long' });
        const teacherName = filterTeacherId ? teachers.find(t => t.id === filterTeacherId)?.name : "All Teachers";
        
        doc.setFontSize(10);
        doc.text(`Period: ${monthName} ${yearNum}`, 105, 32, { align: "center" });
        doc.text(`Teacher: ${teacherName}`, 105, 37, { align: "center" });

        const tableData = filteredRemarks.map(r => {
            const teacher = teachers.find(t => t.id === r.teacherId);
            return [
                r.date,
                teacher ? teacher.name : 'Unknown',
                r.type,
                r.note
            ];
        });

        autoTable(doc, {
            head: [['Date', 'Teacher', 'Type', 'Remark']],
            body: tableData,
            startY: 45,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [14, 165, 233] },
        });

        doc.save(`Remarks_${monthName}_${yearNum}.pdf`);
    };

    const displayedRemarks = remarks.filter(r => {
        if (!filterTeacherId) return true;
        return r.teacherId === filterTeacherId;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Form Section - Only visible to Principal/Management */}
                {(currentRole === 'PRINCIPAL' || currentRole === 'MANAGEMENT') && (
                    <div className="lg:w-1/3 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-brand-600" /> Add New Remark
                            </h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teacher</label>
                                    <select 
                                        value={selectedTeacherId}
                                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                                        className="w-full rounded-lg bg-slate-50 border-slate-300 border p-2.5 focus:ring-brand-500 focus:border-brand-500"
                                        required
                                    >
                                        <option value="">Select Teacher</option>
                                        {teachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Remark Type</label>
                                    <div className="flex gap-2">
                                        {['General', 'Monthly', 'Yearly'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setRemarkType(type as any)}
                                                className={`flex-1 text-xs py-2 rounded-lg border ${remarkType === type ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-slate-600 border-slate-200'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full rounded-lg bg-slate-50 border-slate-300 border p-2.5 focus:ring-brand-500 focus:border-brand-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Remark / Note</label>
                                    <textarea 
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        rows={4}
                                        placeholder="Enter performance note, behavioral remark, or achievement..."
                                        className="w-full rounded-lg bg-slate-50 border-slate-300 border p-2.5 focus:ring-brand-500 focus:border-brand-500"
                                        required
                                    ></textarea>
                                </div>
                                <button 
                                    type="submit" 
                                    className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 transition-colors shadow-sm"
                                >
                                    Save Remark
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* List & Report Section */}
                <div className={`${(currentRole === 'PRINCIPAL' || currentRole === 'MANAGEMENT') ? 'lg:w-2/3' : 'w-full'} space-y-6`}>
                    
                    {/* Filter & Download Controls */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Filter by Teacher</label>
                            <select 
                                value={filterTeacherId}
                                onChange={(e) => setFilterTeacherId(e.target.value)}
                                className="w-full bg-slate-50 border-slate-200 rounded-lg p-2 text-sm"
                            >
                                <option value="">All Teachers</option>
                                {teachers.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Report Month</label>
                            <select 
                                value={reportMonth}
                                onChange={(e) => setReportMonth(e.target.value)}
                                className="w-full bg-slate-50 border-slate-200 rounded-lg p-2 text-sm"
                            >
                                {Array.from({length: 12}).map((_, i) => (
                                    <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-24">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Year</label>
                            <select 
                                value={reportYear}
                                onChange={(e) => setReportYear(e.target.value)}
                                className="w-full bg-slate-50 border-slate-200 rounded-lg p-2 text-sm"
                            >
                                <option value="2024">2024</option>
                                <option value="2025">2025</option>
                                <option value="2026">2026</option>
                            </select>
                        </div>
                        <button 
                            onClick={handleDownloadReport}
                            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 flex items-center gap-2"
                        >
                            <FileText className="w-4 h-4" /> Export Report
                        </button>
                    </div>

                    {/* Remarks Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Remarks History
                            </h3>
                            <div className="text-xs text-slate-500">
                                Total: {displayedRemarks.length}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3 w-32">Date</th>
                                        <th className="px-6 py-3 w-48">Teacher</th>
                                        <th className="px-6 py-3 w-24">Type</th>
                                        <th className="px-6 py-3">Note</th>
                                        {(currentRole === 'PRINCIPAL' || currentRole === 'MANAGEMENT') && (
                                            <th className="px-6 py-3 w-16 text-right">Action</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {displayedRemarks.length > 0 ? (
                                        displayedRemarks.map(r => {
                                            const teacher = teachers.find(t => t.id === r.teacherId);
                                            return (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                                                        {r.date}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{backgroundColor: teacher?.color || '#ccc'}}>
                                                                {teacher?.initials || '?'}
                                                            </div>
                                                            <span className="text-slate-800 font-medium">{teacher?.name || 'Unknown'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                                            r.type === 'Yearly' ? 'bg-purple-100 text-purple-700' :
                                                            r.type === 'Monthly' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {r.type || 'General'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        {r.note}
                                                    </td>
                                                    {(currentRole === 'PRINCIPAL' || currentRole === 'MANAGEMENT') && (
                                                        <td className="px-6 py-4 text-right">
                                                            <button 
                                                                onClick={() => handleDelete(r.id)}
                                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                                No remarks found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
