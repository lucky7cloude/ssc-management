
import React, { useRef, useState, useEffect } from 'react';
import { Database, Image as ImageIcon, FileUp, FileDown, CheckCircle2, AlertTriangle, Trash2, Upload } from 'lucide-react';
import * as dataService from '../services/dataService';
import { UserRole } from '../types';

interface Props {
    currentRole: UserRole;
}

export const SettingsManager: React.FC<Props> = ({ currentRole }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
    const [currentLogo, setCurrentLogo] = useState<string | null>(localStorage.getItem('school_logo'));

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        setStatus({ msg, type });
        setTimeout(() => setStatus(null), 4000);
    };

    const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                const success = dataService.restoreData(json);
                if (success) {
                    showToast("Data restored successfully! App will refresh...", "success");
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    showToast("Failed to restore. Invalid backup file.", "error");
                }
            } catch (err) {
                showToast("Error reading file. Please use a valid .json backup.", "error");
            }
        };
        reader.readAsText(file);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                localStorage.setItem('school_logo', result);
                setCurrentLogo(result);
                showToast("School logo updated successfully!", "success");
                // Notify App component to update header logo
                window.dispatchEvent(new CustomEvent('logo-updated', { detail: result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const resetLogo = () => {
        if (confirm("Reset to default school logo?")) {
            localStorage.removeItem('school_logo');
            setCurrentLogo(null);
            showToast("Logo reset to default.", "info");
            window.dispatchEvent(new CustomEvent('logo-updated', { detail: null }));
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-brand-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-1">
                        <Database className="w-8 h-8 text-white/90" />
                        <h2 className="text-xl font-bold font-serif">School Settings</h2>
                    </div>
                    <p className="text-brand-50 text-xs">Manage school branding and system data.</p>
                </div>

                <div className="p-6 space-y-8">
                    {status && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 animate-pop-in ${
                            status.type === 'success' ? 'bg-green-50 text-green-800 border-green-100' : 
                            status.type === 'error' ? 'bg-red-50 text-red-800 border-red-100' : 'bg-blue-50 text-blue-800 border-blue-100'
                        } border`}>
                            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            <span className="text-xs font-bold">{status.msg}</span>
                        </div>
                    )}

                    {/* Branding Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-brand-600" /> School Branding
                            </h4>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-4">
                            <div className="w-32 h-32 bg-white rounded-xl shadow-inner border border-slate-200 p-2 flex items-center justify-center overflow-hidden">
                                {currentLogo ? (
                                    <img src={currentLogo} alt="School Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-slate-300 flex flex-col items-center">
                                        <ImageIcon className="w-8 h-8" />
                                        <span className="text-[10px] font-bold uppercase mt-1">Default Logo</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="file" 
                                    ref={logoInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={handleLogoUpload} 
                                />
                                <button 
                                    onClick={() => logoInputRef.current?.click()}
                                    className="bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-700 shadow-sm flex items-center gap-2 transition-all"
                                >
                                    <Upload className="w-4 h-4" /> Change Logo
                                </button>
                                {currentLogo && (
                                    <button 
                                        onClick={resetLogo}
                                        className="bg-white border border-red-100 text-red-500 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition-all flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> Reset
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 text-center">Recommended size: 500x500px. Supports PNG, JPG, and SVG.</p>
                        </div>
                    </div>

                    {/* Data Management Section */}
                    <div className="pt-6 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Database className="w-4 h-4 text-brand-600" /> Data Management
                            </h4>
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded uppercase tracking-widest">Manual Controls</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button 
                                onClick={dataService.exportAllData}
                                className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all group text-left"
                            >
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <FileDown className="w-5 h-5 text-brand-600" />
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-800">Export Backup</span>
                                    <span className="block text-[9px] text-slate-500 mt-0.5">Save all data to a .json file</span>
                                </div>
                            </button>

                            {currentRole === 'PRINCIPAL' && (
                                <>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept=".json" 
                                        onChange={handleRestore} 
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all group text-left"
                                    >
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                            <FileUp className="w-5 h-5 text-slate-600" />
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-slate-800">Import Data</span>
                                            <span className="block text-[9px] text-slate-500 mt-0.5">Restore from a .json file</span>
                                        </div>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-xl flex gap-3 border border-amber-100">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
                            <strong>Warning:</strong> Restoring data will overwrite all current teachers, timetables, and remarks. We recommend exporting a backup before performing an import.
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Silver Star School Management System • v3.1.0</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
