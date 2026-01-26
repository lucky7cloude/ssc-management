import React, { useState, useEffect } from 'react';
import { TeacherMeeting, UserRole, SCHOOL_LOGO_URL } from '../types';
import * as dataService from '../services/dataService';
import { Plus, Trash2, Download, Search, Calendar, FileText, ClipboardList, Clock, Save, X, Loader2 } from 'lucide-react';
import { jsPDF } from "jspdf";

interface Props {
    currentRole: UserRole;
}

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

export const TeacherMeetingManager: React.FC<Props> = ({ currentRole }) => {
    const [meetings, setMeetings] = useState<TeacherMeeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [id, setId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await dataService.getMeetings();
            setMeetings(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!name.trim() || !date || !note.trim()) return;

        setIsLoading(true);
        const newMeeting: TeacherMeeting = {
            id: id || Date.now().toString(),
            name: name.trim(),
            date,
            note: note.trim()
        };

        try {
            const updated = await dataService.saveMeeting(newMeeting);
            setMeetings(updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            resetForm();
        } finally {
            setIsLoading(false);
        }
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

    const handleDelete = async (mid: string) => {
        if(currentRole !== 'PRINCIPAL') return;
        if(confirm("Are you sure you want to delete this meeting record?")){
            setIsLoading(true);
            try {
                const updated = await dataService.deleteMeeting(mid);
                setMeetings(updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDownloadPDF = async (meeting: TeacherMeeting) => {
        const doc = new jsPDF();
        await safeAddImage(doc, SCHOOL_LOGO_URL, 10, 10, 20, 20);
        
        doc.setFontSize(22);
        doc.setTextColor(2, 132, 199); 
        doc.text("Silver Star Convent School", 105, 20, { align: "center" });
        
        doc.setFontSize(14);
        doc.setTextColor(100);
        doc.text("Official Teacher Meeting Record", 105, 30, { align: "center" });
        
        doc.setDrawColor(200);
        doc.line(20, 35, 190, 35);

        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text(`Subject: ${meeting.name}`, 20, 50);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Date of Meeting: ${new Date(meeting.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 20, 60);

        doc.setFontSize(13);
        doc.setTextColor(50);
        doc.text("Minutes of Meeting:", 20, 75);
        
        doc.setFontSize(11);
        doc.setTextColor(80);
        
        const splitNote = doc.splitTextToSize(meeting.note, 170);
        doc.text(splitNote, 20, 85);

        const pageCount = doc.getNumberOfPages();
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
        <div className="space-y-6 relative">
            {isLoading && !isFormOpen && (
                <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                    <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 no-print">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search meetings..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10"
                    />
                </div>
                {currentRole === 'PRINCIPAL' && (
                    <button 
                        onClick={() => setIsFormOpen(true)}
                        className="bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" /> New Meeting Record
                    </button>
                )}
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in no-print">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-pop-in border dark:border-slate-800">
                        <div className="bg-slate-800 dark:bg-black p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <ClipboardList className="w-5 h-5" /> 
                                {id ? 'Update Meeting Record' : 'Create New Meeting Record'}
                            </h3>
                            <button onClick={resetForm} className="hover:bg-slate-700 p-1 rounded-full"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Meeting Name / Agenda</label>
                                    <input 
                                        type="text" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., Staff Review"
                                        className="w-full"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Minutes of Meeting (Notes)</label>
                                <textarea 
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    rows={8}
                                    placeholder="Summarize the discussions..."
                                    className="w-full"
                                    required
                                ></textarea>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={resetForm} className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                                <button type="submit" disabled={isLoading} className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                                    {isLoading ? 'Saving...' : (id ? 'Update Record' : 'Save Record')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredMeetings.length > 0 ? (
                    filteredMeetings.map(m => (
                        <div key={m.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden group hover:shadow-md transition-shadow animate-fade-in">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calendar className="w-4 h-4 text-brand-600" />
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-brand-600 transition-colors">{m.name}</h4>
                                </div>
                                <div className="flex gap-1 no-print">
                                    <button onClick={() => handleDownloadPDF(m)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all" title="Download PDF Record">
                                        <Download className="w-5 h-5" />
                                    </button>
                                    {currentRole === 'PRINCIPAL' && (
                                        <>
                                            <button onClick={() => handleEdit(m)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Record">
                                                <FileText className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleDelete(m.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete Record">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="p-5 bg-slate-50/50 dark:bg-slate-950/30">
                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-4 leading-relaxed whitespace-pre-line italic">{m.note}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    !isLoading && <div className="col-span-full py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No records found</div>
                )}
            </div>
        </div>
    );
};