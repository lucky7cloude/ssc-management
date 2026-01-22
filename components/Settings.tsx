
import React, { useRef, useState, useEffect } from 'react';
import { Database, Image as ImageIcon, CheckCircle2, AlertTriangle, Trash2, Upload, Settings } from 'lucide-react';
import * as dataService from '../services/dataService';
import { UserRole, SCHOOL_LOGO_URL } from '../types';

interface Props {
    currentRole: UserRole;
}

export const SettingsManager: React.FC<Props> = ({ currentRole }) => {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-800 p-6 text-white">
                    <div className="flex items-center gap-3 mb-1">
                        <Settings className="w-8 h-8 text-white/90" />
                        <h2 className="text-xl font-bold font-serif">System Settings</h2>
                    </div>
                    <p className="text-slate-300 text-xs">Manage system preferences and core application details.</p>
                </div>

                <div className="p-6 space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-brand-600" /> Current Branding
                            </h4>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-4 text-center">
                            <div className="w-32 h-32 bg-white dark:bg-slate-900 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-center overflow-hidden">
                                <img src={SCHOOL_LOGO_URL} alt="School Logo" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100">Silver Star Convent School</h5>
                                <p className="text-xs text-slate-400 mt-1">Branding is permanently configured for the institution.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-center">
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">Silver Star School Management System • v3.6.0</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
