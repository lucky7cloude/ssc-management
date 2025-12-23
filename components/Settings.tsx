
import React, { useRef, useState, useEffect } from 'react';
import { Database, Image as ImageIcon, CheckCircle2, AlertTriangle, Trash2, Upload } from 'lucide-react';
import * as dataService from '../services/dataService';
import { UserRole } from '../types';

interface Props {
    currentRole: UserRole;
}

export const SettingsManager: React.FC<Props> = ({ currentRole }) => {
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
    const [currentLogo, setCurrentLogo] = useState<string | null>(localStorage.getItem('school_logo'));

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        setStatus({ msg, type });
        setTimeout(() => setStatus(null), 4000);
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="bg-brand-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-1">
                        <ImageIcon className="w-8 h-8 text-white/90" />
                        <h2 className="text-xl font-bold font-serif">Branding Settings</h2>
                    </div>
                    <p className="text-brand-50 text-xs">Customize the school identity across the platform.</p>
                </div>

                <div className="p-6 space-y-8">
                    {status && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 animate-pop-in ${
                            status.type === 'success' ? 'bg-green-50 text-green-800 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 
                            status.type === 'error' ? 'bg-red-50 text-red-800 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : 'bg-blue-50 text-blue-800 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                        } border`}>
                            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            <span className="text-xs font-bold">{status.msg}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-brand-600" /> Official Logo
                            </h4>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-4">
                            <div className="w-32 h-32 bg-white dark:bg-slate-900 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-center overflow-hidden">
                                {currentLogo ? (
                                    <img src={currentLogo} alt="School Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-slate-300 dark:text-slate-700 flex flex-col items-center">
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
                                    <Upload className="w-4 h-4" /> Upload New Logo
                                </button>
                                {currentLogo && (
                                    <button 
                                        onClick={resetLogo}
                                        className="bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900 text-red-500 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950 transition-all flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> Reset to Default
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">Recommended: SVG or high-quality PNG. All inputs in the app have been optimized for high contrast dark mode.</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-center">
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">Silver Star School Management System • v3.5.0</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
