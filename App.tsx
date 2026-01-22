
import React, { useState, useEffect, useRef } from 'react';
import { TeacherManager } from './components/TeacherManager';
import { TimetableManager } from './components/TimetableManager';
import { TeacherRemarks } from './components/TeacherRemarks';
import { ExamScheduler } from './components/ExamScheduler';
import { TeacherMeetingManager } from './components/TeacherMeeting';
import { SettingsManager } from './components/Settings';
import { Calendar, Users, BarChart3, GraduationCap, FileSignature, Clock, Heart, CheckCircle2, Bell, LogOut, Lock, Shield, X, KeyRound, ChevronRight, ClipboardList, Menu, Settings as SettingsIcon, Moon, Sun, Cloud, CloudOff, RefreshCw, Loader2 } from 'lucide-react';
import * as dataService from './services/dataService';
import { UserRole, AppNotification, SCHOOL_LOGO_URL } from './types';

enum View {
  TIMETABLE = 'TIMETABLE',
  TEACHERS = 'TEACHERS',
  REMARKS = 'REMARKS',
  EXAMS = 'EXAMS',
  MEETINGS = 'MEETINGS',
  SETTINGS = 'SETTINGS'
}

const App: React.FC = () => {
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<View>(View.TIMETABLE);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedRoleForLogin, setSelectedRoleForLogin] = useState<UserRole | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Connecting...');

  // 1. App Bootloader - Always fetch cloud data first
  useEffect(() => {
    const bootApp = async () => {
        await dataService.fetchAllData();
        setIsCloudLoaded(true);
        setLastSyncTime('Live Cloud Connected');
    };
    bootApp();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!isCloudLoaded) return;
    
    setNotifications(dataService.getNotifications());
    
    // Cloud Polling (Every 30 seconds check for updates from other devices)
    const pollInterval = setInterval(async () => {
        const updated = await dataService.fetchAllData();
        if (updated) {
            setLastSyncTime('Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
    }, 30000);

    const handleSyncStatus = (e: any) => setSyncStatus(e.detail);
    const handleDataUpdated = () => setLastSyncTime('Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    window.addEventListener('sync-status' as any, handleSyncStatus);
    window.addEventListener('data-updated', handleDataUpdated);
    
    return () => {
        clearInterval(pollInterval);
        window.removeEventListener('sync-status' as any, handleSyncStatus);
        window.removeEventListener('data-updated', handleDataUpdated);
    }
  }, [isCloudLoaded]);

  const handleRoleSelect = (role: UserRole) => { setSelectedRoleForLogin(role); setShowLoginModal(true); setLoginPassword(''); setLoginError(''); };

  const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedRoleForLogin === 'PRINCIPAL') {
          if (loginPassword === 'ssc2025') { setCurrentRole('PRINCIPAL'); setShowLoginModal(false); }
          else setLoginError('Invalid Password');
      } else if (selectedRoleForLogin === 'MANAGEMENT') {
          if (loginPassword === 'ssc123') { setCurrentRole('MANAGEMENT'); setShowLoginModal(false); }
          else setLoginError('Invalid Password');
      }
  };

  const NavButton = ({ view, icon: Icon, label }: { view: View, icon: any, label: string }) => (
    <button 
      onClick={() => { setCurrentView(view); setIsSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${currentView === view ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
    >
      <Icon className="w-5 h-5" /> {label}
    </button>
  );

  // Database Connection Screen
  if (!isCloudLoaded) {
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-24 h-24 mb-8 animate-bounce">
                <img src={SCHOOL_LOGO_URL} alt="Silver Star" className="w-full h-full object-contain" />
              </div>
              <div className="relative">
                <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4 mx-auto" />
                <Cloud className="w-5 h-5 text-white absolute top-3.5 left-1/2 -translate-x-1/2" />
              </div>
              <h2 className="text-white font-bold text-xl tracking-[0.2em] uppercase">Connecting to Cloud</h2>
              <p className="text-slate-500 text-xs mt-3 font-medium max-w-xs">Fetching Silver Star Convent School's official database. This ensures your data is synced across all devices.</p>
          </div>
      );
  }

  if (!currentRole) {
      return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
              <div className="mb-8 flex flex-col items-center animate-fade-in text-center">
                 <div className="w-24 h-24 mb-4"><img src={SCHOOL_LOGO_URL} alt="Logo" className="w-full h-full object-contain" /></div>
                 <h1 className="text-3xl font-serif font-bold text-slate-800 dark:text-slate-100">Silver Star</h1>
                 <p className="text-slate-500 dark:text-slate-400 font-medium tracking-widest uppercase text-[10px] mt-1">Shared Management Portal • v5.0 Cloud</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl">
                  <button onClick={() => handleRoleSelect('PRINCIPAL')} className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-brand-500 transition-all flex flex-col items-center text-center group">
                      <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-brand-500 transition-colors"><Shield className="w-8 h-8 text-brand-600 group-hover:text-white" /></div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Principal</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Administrator Access</p>
                  </button>
                  <button onClick={() => handleRoleSelect('MANAGEMENT')} className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-purple-500 transition-all flex flex-col items-center text-center group">
                      <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors"><BarChart3 className="w-8 h-8 text-purple-600 group-hover:text-white" /></div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Management</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Observer Access</p>
                  </button>
              </div>
              {showLoginModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-pop-in">
                          <div className="bg-slate-800 dark:bg-black p-4 flex justify-between items-center text-white"><h3 className="font-bold flex items-center gap-2 text-sm"><Lock className="w-4 h-4" /> Security Gateway</h3><button onClick={() => setShowLoginModal(false)}><X className="w-4 h-4"/></button></div>
                          <form onSubmit={handleLoginSubmit} className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Identity Verification</label>
                                    <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full rounded-xl bg-black border border-slate-700 p-4 outline-none focus:ring-2 focus:ring-brand-500 font-bold tracking-[0.5em] text-center text-white text-xl" placeholder="••••" autoFocus />
                                </div>
                                {loginError && <p className="text-xs text-red-500 font-bold text-center uppercase tracking-wider animate-shake">{loginError}</p>}
                                <button type="submit" className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-brand-700 shadow-lg transform active:scale-95 transition-all">Sign In</button>
                          </form>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row overflow-x-hidden transition-colors duration-300">
      {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-pop-in"><div className="bg-slate-800 dark:bg-black text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold text-xs border border-slate-700"><CheckCircle2 className="w-4 h-4 text-green-400" /> {toast.message}</div></div>}
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fade-in" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col no-print`}>
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center">
            <div className="w-24 h-24 mb-4"><img src={SCHOOL_LOGO_URL} alt="Silver Star" className="w-full h-full object-contain" /></div>
            <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.3em] text-center leading-relaxed">Silver Star<br/>Convent School</h2>
        </div>
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          <NavButton view={View.TIMETABLE} icon={Calendar} label="Timetable" />
          <NavButton view={View.TEACHERS} icon={Users} label="Staff Directory" />
          <NavButton view={View.REMARKS} icon={FileSignature} label="Teacher Remarks" />
          <NavButton view={View.EXAMS} icon={Clock} label="Exam Planner" />
          <NavButton view={View.MEETINGS} icon={ClipboardList} label="Staff Meetings" />
          <NavButton view={View.SETTINGS} icon={SettingsIcon} label="Cloud Core" />
        </nav>
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setCurrentRole(null)} className="w-full flex items-center justify-center gap-2 text-xs text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 p-3 rounded-xl transition-all"><LogOut className="w-4 h-4" /> Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 h-16 flex items-center justify-between px-4 md:px-8 shrink-0 no-print z-30">
           <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-slate-100 rounded-lg"><Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" /></button>
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-serif truncate leading-tight">
                    {currentView === View.TIMETABLE && 'School Timetable'}
                    {currentView === View.TEACHERS && 'Staff Management'}
                    {currentView === View.REMARKS && 'Daily Remarks'}
                    {currentView === View.EXAMS && 'Exam Schedule'}
                    {currentView === View.MEETINGS && 'Meeting Records'}
                    {currentView === View.SETTINGS && 'Cloud Settings'}
                </h2>
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'SYNCING' ? 'bg-amber-500 animate-pulse' : (syncStatus === 'ERROR' ? 'bg-red-500' : 'bg-green-500')}`}></div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{lastSyncTime}</span>
                </div>
              </div>
           </div>
           
           <div className="flex items-center gap-2">
              <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-full hover:bg-slate-100 text-slate-600 dark:text-slate-400 transition-all">
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2.5 rounded-full hover:bg-slate-100 relative text-slate-600 dark:text-slate-400">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
              </button>
           </div>
           {isNotifOpen && (
               <div className="absolute right-4 top-14 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[60] overflow-hidden animate-pop-in">
                   <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center"><h3 className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Cloud Sync Feed</h3><button onClick={() => dataService.clearNotifications()} className="text-[10px] text-red-500 font-bold uppercase">Clear</button></div>
                   <div className="max-h-80 overflow-y-auto custom-scrollbar">
                       {notifications.length > 0 ? notifications.map(n => <div key={n.id} className="p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{n.message}</div>) : <div className="p-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">All systems live</div>}
                   </div>
               </div>
           )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth">
           {currentView === View.TIMETABLE && <TimetableManager currentRole={currentRole} />}
           {currentView === View.TEACHERS && <TeacherManager currentRole={currentRole} />}
           {currentView === View.REMARKS && <TeacherRemarks currentRole={currentRole} />}
           {currentView === View.EXAMS && <ExamScheduler />}
           {currentView === View.MEETINGS && <TeacherMeetingManager currentRole={currentRole} />}
           {currentView === View.SETTINGS && <SettingsManager currentRole={currentRole} />}
        </div>

        <footer className="h-10 border-t dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] no-print">
            S.S.C.S. Cloud Core v5.1 • Active <Heart className="w-2 h-2 text-red-500 fill-current" />
        </footer>
      </main>
    </div>
  );
};

export default App;
