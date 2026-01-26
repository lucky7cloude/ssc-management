import React, { useState, useEffect } from 'react';
import { TeacherManager } from './components/TeacherManager';
import { TimetableManager } from './components/TimetableManager';
import { TeacherRemarks } from './components/TeacherRemarks';
import { ExamScheduler } from './components/ExamScheduler';
import { TeacherMeetingManager } from './components/TeacherMeeting';
import { SettingsManager } from './components/Settings';
import { Calendar, Users, BarChart3, FileSignature, Clock, Heart, CheckCircle2, Bell, LogOut, Lock, Shield, X, ClipboardList, Menu, Settings as SettingsIcon, Moon, Sun, CloudOff } from 'lucide-react';
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
  // Safe initialization of Dark Mode and Role from localStorage
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [currentView, setCurrentView] = useState<View>(View.TIMETABLE);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Login State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedRoleForLogin, setSelectedRoleForLogin] = useState<UserRole | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Handle Toast Notifications
  useEffect(() => {
    const handleToast = (e: any) => {
        setToast(e.detail);
        setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener('show-toast' as any, handleToast);
    return () => window.removeEventListener('show-toast' as any, handleToast);
  }, []);

  const handleRoleSelect = (role: UserRole) => { 
      setSelectedRoleForLogin(role); 
      setShowLoginModal(true); 
      setLoginPassword(''); 
      setLoginError(''); 
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // Principal pass: ssc2025 | Management pass: ssc123
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

  // AUTHENTICATION SCREEN
  if (!currentRole) {
      return (
          <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-6 transition-colors duration-500">
              <div className="w-full max-w-lg mb-12 flex flex-col items-center animate-fade-in text-center">
                 <div className="w-48 h-48 md:w-64 md:h-64 mb-6 flex items-center justify-center overflow-hidden rounded-full shadow-2xl bg-black border-4 border-slate-100 dark:border-slate-800">
                    <img src={SCHOOL_LOGO_URL} alt="Logo" className="max-w-full max-h-full object-contain scale-110" loading="eager" crossOrigin="anonymous" />
                 </div>
                 <h1 className="text-4xl md:text-5xl font-serif font-black text-slate-800 dark:text-slate-100 tracking-tight">Silver Star</h1>
                 <p className="text-slate-500 dark:text-slate-400 font-black tracking-[0.4em] uppercase text-[11px] mt-3">Institutional Management</p>
                 <div className="mt-6 px-4 py-2 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border dark:border-slate-800">
                     <CloudOff className="w-3 h-3" /> Local Storage Active
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-2">
                  <button onClick={() => handleRoleSelect('PRINCIPAL')} className="bg-slate-50 dark:bg-slate-900/50 p-6 md:p-10 rounded-[2.5rem] shadow-xl border-2 border-transparent hover:border-brand-500 hover:bg-white dark:hover:bg-slate-900 transition-all flex flex-col items-center text-center group active:scale-95">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-50 dark:bg-brand-900/20 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-brand-500 transition-all"><Shield className="w-8 h-8 md:w-10 md:h-10 text-brand-600 group-hover:text-white" /></div>
                      <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Principal</h3>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-widest">Admin Console</p>
                  </button>
                  <button onClick={() => handleRoleSelect('MANAGEMENT')} className="bg-slate-50 dark:bg-slate-900/50 p-6 md:p-10 rounded-[2.5rem] shadow-xl border-2 border-transparent hover:border-purple-500 hover:bg-white dark:hover:bg-slate-900 transition-all flex flex-col items-center text-center group active:scale-95">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-purple-50 dark:bg-purple-900/20 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-purple-500 transition-all"><BarChart3 className="w-8 h-8 md:w-10 md:h-10 text-purple-600 group-hover:text-white" /></div>
                      <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Management</h3>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-widest">Observer Access</p>
                  </button>
              </div>

              <div className="mt-16 flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
                  <Sun className="w-3 h-3" /> System Ready
              </div>

              {showLoginModal && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-fade-in">
                      <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden animate-pop-in border dark:border-slate-800">
                          <div className="bg-slate-800 dark:bg-black p-6 flex justify-between items-center text-white">
                              <h3 className="font-black uppercase tracking-widest text-[10px] flex items-center gap-2"><Lock className="w-4 h-4" /> Identity Verification</h3>
                              <button onClick={() => setShowLoginModal(false)} className="p-1 hover:bg-slate-700 rounded-full"><X className="w-6 h-6"/></button>
                          </div>
                          <form onSubmit={handleLoginSubmit} className="p-8 md:p-10 space-y-8">
                                <div className="space-y-4 text-center">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Enter Secure Passkey</label>
                                    <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full rounded-2xl bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 p-5 outline-none focus:ring-4 focus:ring-brand-500/10 font-black tracking-[0.8em] text-center text-slate-800 dark:text-white text-3xl shadow-inner" placeholder="••••" autoFocus />
                                </div>
                                {loginError && <p className="text-xs text-red-500 font-black text-center uppercase tracking-widest animate-shake">{loginError}</p>}
                                <button type="submit" className="w-full bg-brand-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-brand-700 shadow-2xl transform active:scale-95 transition-all">Verify & Enter</button>
                          </form>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // MAIN APPLICATION DASHBOARD
  return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row overflow-x-hidden transition-colors duration-300">
        {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] animate-pop-in"><div className="bg-slate-900 dark:bg-black text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-black text-xs border border-slate-800 tracking-widest uppercase"><CheckCircle2 className="w-5 h-5 text-green-400" /> {toast.message}</div></div>}
        
        {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[110] md:hidden animate-fade-in" onClick={() => setIsSidebarOpen(false)}></div>}
        
        <aside className={`fixed md:sticky top-0 left-0 h-screen w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-[120] transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col no-print`}>
          <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center">
              <div className="w-40 h-40 mb-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-[2rem] shadow-inner flex items-center justify-center">
                <img src={SCHOOL_LOGO_URL} alt="Silver Star" className="w-full h-full object-contain" loading="eager" crossOrigin="anonymous" />
              </div>
              <h2 className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.5em] text-center leading-relaxed">Silver Star<br/>Convent</h2>
          </div>
          <nav className="p-6 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
            <NavButton view={View.TIMETABLE} icon={Calendar} label="Daily Grid" />
            <NavButton view={View.TEACHERS} icon={Users} label="Staff Hub" />
            <NavButton view={View.REMARKS} icon={FileSignature} label="Remarks" />
            <NavButton view={View.EXAMS} icon={Clock} label="Exams" />
            <NavButton view={View.MEETINGS} icon={ClipboardList} label="Meetings" />
            <NavButton view={View.SETTINGS} icon={SettingsIcon} label="Data Management" />
          </nav>
          <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setCurrentRole(null)} className="w-full flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-4 rounded-2xl transition-all"><LogOut className="w-5 h-5" /> Sign Out</button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 h-20 flex items-center justify-between px-6 md:px-10 shrink-0 no-print z-30">
            <div className="flex items-center gap-6">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl"><Menu className="w-7 h-7 text-slate-600 dark:text-slate-400" /></button>
                <div className="flex flex-col">
                  <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 font-serif truncate tracking-tighter">
                      {currentView === View.TIMETABLE && 'Timetable Studio'}
                      {currentView === View.TEACHERS && 'Staff Directory'}
                      {currentView === View.REMARKS && 'Daily Feedback'}
                      {currentView === View.EXAMS && 'Exam Planner'}
                      {currentView === View.MEETINGS && 'Institutional Logs'}
                      {currentView === View.SETTINGS && 'System Config'}
                  </h2>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button onClick={() => setDarkMode(!darkMode)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all border dark:border-slate-700">
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 relative text-slate-600 dark:text-slate-400 border dark:border-slate-700">
                    <Bell className="w-5 h-5" />
                    {notifications.filter(n => !n.read).length > 0 && <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
                </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar scroll-smooth">
            {currentView === View.TIMETABLE && <TimetableManager currentRole={currentRole} />}
            {currentView === View.TEACHERS && <TeacherManager currentRole={currentRole} />}
            {currentView === View.REMARKS && <TeacherRemarks currentRole={currentRole} />}
            {currentView === View.EXAMS && <ExamScheduler />}
            {currentView === View.MEETINGS && <TeacherMeetingManager currentRole={currentRole} />}
            {currentView === View.SETTINGS && <SettingsManager currentRole={currentRole} />}
          </div>

          <footer className="h-14 border-t dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-[9px] font-black text-slate-400 uppercase no-print">
              <div className="flex items-center gap-2 tracking-[0.5em]">
                  Silver Star Management • System Active <Heart className="w-3 h-3 text-red-500 fill-current" />
              </div>
          </footer>
        </main>
      </div>
  );
};

export default App;