
import React, { useState, useEffect } from 'react';
import { TeacherMeeting, UserRole } from '../types';
import * as dataService from '../services/dataService';
import { Plus, Trash2, Download, Search, Calendar, FileText, ClipboardList, Clock, Save, X } from 'lucide-react';
import { jsPDF } from "jspdf";

interface Props {
    currentRole: UserRole;
}

export const TeacherMeetingManager: React.FC<Props> = ({ currentRole }) => {
    const [meetings, setMeetings] = useState<TeacherMeeting[]>([]);
    
    // Form State
    const [id, setId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Search/Filter
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setMeetings(dataService.getMeetings().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!name.trim() || !date || !note.trim()) return;

        const newMeeting: TeacherMeeting = {
            id: id || Date.now().toString(),
            name: name.trim(),
            date,
            note: note.trim()
        };

        const updated = dataService.saveMeeting(newMeeting);
        setMeetings(updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        resetForm();
    };

    const resetForm = () => {
        setId(null);
        setName('');
        setDate(new Date().toISOString().split('T')[0]);
        setNote('');
        setIsFormOpen(false);
    };

    const handleEdit = (m: TeacherMeeting) => {
        if(currentRole !== 'PRINCIPAL') return;
        setId(m.id);
        setName(m.name);
        setDate(m.date);
        setNote(m.note);
        setIsFormOpen(true);
    };

    const handleDelete = (id: string) => {
        if(currentRole !== 'PRINCIPAL') return;
        if(confirm("Are you sure you want to delete this meeting record?")){
            const updated = dataService.deleteMeeting(id);
            setMeetings(updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
    };

    const handleDownloadPDF = (meeting: TeacherMeeting) => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(2, 132, 199); // Brand Blue
        doc.text("Silver Star Convent School", 105, 20, { align: "center" });
        
        doc.setFontSize(14);
        doc.setTextColor(100);
        doc.text("Official Teacher Meeting Record", 105, 30, { align: "center" });
        
        // Line
        doc.setDrawColor(200);
        doc.line(20, 35, 190, 35);

        // Meeting Info
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text(`Subject: ${meeting.name}`, 20, 50);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Date of Meeting: ${new Date(meeting.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 20, 60);

        // Content
        doc.setFontSize(13);
        doc.setTextColor(50);
        doc.text("Minutes of Meeting:", 20, 75);
        
        doc.setFontSize(11);
        doc.setTextColor(80);
        
        // Multiline support for notes
        const splitNote = doc.splitTextToSize(meeting.note, 170);
        doc.text(splitNote, 20, 85);

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 285, { align: "center" });
        }

        doc.save(`Meeting_${meeting.date}_${meeting.name.replace(/\s+/g, '_')}.pdf`);
    };

    const filteredMeetings = meetings.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.date.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100 no-print">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search meetings by name or date..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                </div>
                {currentRole === 'PRINCIPAL' && (
                    <button 
                        onClick={() => setIsFormOpen(true)}
                        className="bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> New Meeting Record
                    </button>
                )}
            </div>

            {/* Meeting Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-pop-in">
                        <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <ClipboardList className="w-5 h-5" /> 
                                {id ? 'Update Meeting Record' : 'Create New Meeting Record'}
                            </h3>
                            <button onClick={resetForm} className="hover:bg-slate-700 p-1 rounded-full"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Name / Agenda</label>
                                    <input 
                                        type="text" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., Staff Monthly Review"
                                        className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2.5 focus:ring-brand-500 focus:border-brand-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2.5 focus:ring-brand-500 focus:border-brand-500"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Minutes of Meeting (Notes)</label>
                                <textarea 
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    rows={8}
                                    placeholder="Summarize the discussions, decisions, and tasks assigned..."
                                    className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2.5 focus:ring-brand-500 focus:border-brand-500"
                                    required
                                ></textarea>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={resetForm}
                                    className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> {id ? 'Update Record' : 'Save Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Meetings Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredMeetings.length > 0 ? (
                    filteredMeetings.map(m => (
                        <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-shadow animate-fade-in">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calendar className="w-4 h-4 text-brand-600" />
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-800 leading-tight group-hover:text-brand-600 transition-colors">{m.name}</h4>
                                </div>
                                <div className="flex gap-1 no-print">
                                    <button 
                                        onClick={() => handleDownloadPDF(m)}
                                        className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                        title="Download PDF Record"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                    {currentRole === 'PRINCIPAL' && (
                                        <>
                                            <button 
                                                onClick={() => handleEdit(m)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Edit Record"
                                            >
                                                <FileText className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(m.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Delete Record"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="p-5 bg-slate-50/50">
                                <p className="text-sm text-slate-600 line-clamp-4 leading-relaxed whitespace-pre-line italic">
                                    {m.note}
                                </p>
                                {m.note.length > 200 && (
                                    <button 
                                        onClick={() => handleDownloadPDF(m)} 
                                        className="text-xs text-brand-600 font-bold mt-2 hover:underline"
                                    >
                                        View Full Minutes...
                                    </button>
                                )}
                            </div>
                            <div className="px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Recorded ID: {m.id.substring(0, 8)}
                                </div>
                                <div>Silver Star Staff Records</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                        <ClipboardList className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-800 mb-1">No meeting records found</h3>
                        <p className="text-slate-500 max-w-xs mx-auto">
                            {searchTerm ? 'Try searching for a different name or date.' : 'Start recording your teacher meetings by clicking "New Meeting Record".'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
