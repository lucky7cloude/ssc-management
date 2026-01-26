import React, { useRef } from 'react';
import { Database, Download, Upload, Trash2, ShieldAlert } from 'lucide-react';
import * as dataService from '../services/dataService';
import { UserRole } from '../types';

interface Props {
    currentRole: UserRole;
}

export const SettingsManager: React.FC<Props> = ({ currentRole }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (confirm("This will overwrite all current app data with the backup file. Continue?")) {
                const success = await dataService.importData(file);
                if (success) {
                    alert("Data restored successfully! The app will reload.");
                    window.location.reload();
                } else {
                    alert("Failed to restore. Invalid file format.");
                }
            }
        }
    };

    const handleReset = () => {
        if (confirm("WARNING: This will delete ALL data (Teachers, Classes, Timetables) from this device. This cannot be undone. Are you sure?")) {
            dataService.resetData();
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-800 p-10 text-white">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Database className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold font-serif">Data Management</h2>
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Manage your local data storage. Create backups to move data to another device or secure your records.</p>
                </div>

                <div className="p-10 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                            onClick={dataService.exportData}
                            className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50 transition-all group text-left"
                        >
                            <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Download className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">Backup Data</h4>
                            <p className="text-xs text-slate-500 mt-1">Download a .json file of all your current data.</p>
                        </button>

                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 hover:bg-purple-50 transition-all group text-left"
                        >
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Upload className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">Restore Data</h4>
                            <p className="text-xs text-slate-500 mt-1">Upload a previously saved .json backup file.</p>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".json" 
                                onChange={handleRestore} 
                            />
                        </button>
                    </div>

                    <div className="pt-6 border-t dark:border-slate-800">
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6 flex items-start gap-4">
                            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-1" />
                            <div>
                                <h4 className="font-bold text-red-800 dark:text-red-400">Factory Reset</h4>
                                <p className="text-xs text-red-600 dark:text-red-500 mt-1 mb-4 leading-relaxed">
                                    Permanently wipe all data from this browser. This action is irreversible unless you have a backup file.
                                </p>
                                <button 
                                    onClick={handleReset}
                                    className="px-6 py-2 bg-red-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-sm"
                                >
                                    Erase All Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Local Storage v2.0 • Secure & Private</p>
            </div>
        </div>
    );
};