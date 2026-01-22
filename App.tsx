
import React, { useState, useEffect, useRef } from 'react';
import { TeacherManager } from './components/TeacherManager';
import { TimetableManager } from './components/TimetableManager';
import { TeacherRemarks } from './components/TeacherRemarks';
import { ExamScheduler } from './components/ExamScheduler';
import { TeacherMeetingManager } from './components/TeacherMeeting';
import { SettingsManager } from './components/Settings';
import { Calendar, Users, BarChart3, GraduationCap, Sparkles, FileSignature, Clock, Heart, CheckCircle2, Bell, LogOut, Lock, Shield, X, KeyRound, ChevronRight, ClipboardList, Menu, Settings as SettingsIcon, Moon, Sun } from 'lucide-react';
import * as dataService from './services/dataService';
import * as geminiService from './services/geminiService';
import { UserRole, AppNotification, SCHOOL_LOGO_URL } from './types';

enum View {
  TIMETABLE = 'TIMETABLE',
  TEACHERS = 'TEACHERS',
  REMARKS = 'REMARKS',
  EXAMS = 'EXAMS',
  MEETINGS = 'MEETINGS',
  INSIGHTS = 'INSIGHTS',
  SETTINGS = 'SETTINGS'
}

const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<View>(View.TIMETABLE);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedRoleForLogin, setSelectedRoleForLogin] = useState<UserRole | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

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
    setNotifications(dataService.getNotifications());
    const handleNotificationUpdate = () => setNotifications(dataService.getNotifications());
    const handleToast = (e: CustomEvent) => { setToast(e.detail); setTimeout(() => setToast(null), 3000); };
    
    window.addEventListener('notifications-updated' as any, handleNotificationUpdate);
    window.addEventListener('show-toast' as any, handleToast);
    
    return () => {
        window.removeEventListener('notifications-updated' as any, handleNotificationUpdate);
        window.removeEventListener('show-toast' as any, handleToast);
    }
  }, []);

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

  if (!currentRole) {
      return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
              <div className="mb-8 flex flex-col items-center animate-fade-in text-center">
                 <div className="w-24 h-24 mb-4"><img src={SCHOOL_LOGO_URL} alt="Logo" className="w-full h-full object-contain" /></div>
                 <h1 className="text-3xl font-serif font-bold text-slate-800 dark:text-slate-100">Silver Star</h1>
                 <p className="text-slate-500 dark:text-slate-400 font-medium">School Management System</p>
                 <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Made by Lucky <Heart className="w-2.5 h-2.5 text-red-500 fill-current" />
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl">
                  <button onClick={() => handleRoleSelect('PRINCIPAL')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-brand-500 transition-all flex flex-col items-center text-center group">
                      <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/20 rounded-full flex items-center justify-center mb-3 group-hover:bg-brand-500 transition-colors"><Shield className="w-6 h-6 text-brand-600 group-hover:text-white" /></div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Principal</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Full Administrative Access</p>
                  </button>
                  <button onClick={() => handleRoleSelect('MANAGEMENT')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-purple-500 transition-all flex flex-col items-center text-center group">
                      <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-500 transition-colors"><BarChart3 className="w-6 h-6 text-purple-600 group-hover:text-white" /></div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Management</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review & Resource Planning</p>
                  </button>
              </div>
              {showLoginModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-pop-in">
                          <div className="bg-slate-800 dark:bg-black p-4 flex justify-between items-center text-white"><h3 className="font-bold flex items-center gap-2 text-sm"><Lock className="w-4 h-4" /> Secure Access</h3><button onClick={() => setShowLoginModal(false)}><X className="w-4 h-4"/></button></div>
                          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
                                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full rounded-lg bg-black border border-slate-700 p-3 outline-none focus:ring-2 focus:ring-brand-500 font-bold tracking-widest text-center text-white" placeholder="••••••••" autoFocus />
                                {loginError && <p className="text-xs text-red-500 font-bold text-center uppercase tracking-wider">{loginError}</p>}
                                <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 shadow-md transform active:scale-95 transition-all">Sign In</button>
                          </form>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row overflow-x-hidden transition-colors duration-300">
      {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-pop-in"><div className="bg-slate-800 dark:bg-black text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold text-xs border border-slate-700"><CheckCircle2 className="w-4 h-4 text-green-400" /> {toast.message}</div></div>}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fade-in" onClick={() => setIsSidebarOpen(false)}></div>}
      <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col no-print`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center">
            <div className="w-20 h-20 mb-3"><img src={SCHOOL_LOGO_URL} alt="Silver Star" className="w-full h-full object-contain" /></div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em] text-center">Silver Star</h2>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
          <NavButton view={View.TIMETABLE} icon={Calendar} label="Timetable" />
          <NavButton view={View.TEACHERS} icon={Users} label="Teachers" />
          <NavButton view={View.REMARKS} icon={FileSignature} label="Remarks" />
          <NavButton view={View.EXAMS} icon={Clock} label="Exams" />
          <NavButton view={View.MEETINGS} icon={ClipboardList} label="Meetings" />
          <NavButton view={View.INSIGHTS} icon={Sparkles} label="Workload AI" />
          <NavButton view={View.SETTINGS} icon={SettingsIcon} label="Settings" />
        </nav>
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Made by Lucky</div>
            <button onClick={() => setCurrentRole(null)} className="w-full flex items-center justify-center gap-2 text-xs text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-all"><LogOut className="w-4 h-4" /> Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 h-16 flex items-center justify-between px-4 md:px-8 shrink-0 no-print z-30">
           <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-slate-100 rounded-lg"><Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" /></button>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-serif truncate">
                {currentView === View.TIMETABLE && 'School Timetable'}
                {currentView === View.TEACHERS && 'Staff Registry'}
                {currentView === View.REMARKS && 'Performance Logs'}
                {currentView === View.EXAMS && 'Exam Planner'}
                {currentView === View.MEETINGS && 'Staff Meetings'}
                {currentView === View.INSIGHTS && 'Analytics Engine'}
                {currentView === View.SETTINGS && 'System Settings'}
              </h2>
           </div>
           <div className="flex items-center gap-3">
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600 dark:text-slate-400 transition-all">
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 rounded-full hover:bg-slate-100 relative text-slate-600 dark:text-slate-400">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
              </button>
           </div>
           {isNotifOpen && (
               <div className="absolute right-4 top-14 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[60] overflow-hidden animate-pop-in">
                   <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center"><h3 className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Activity Logs</h3><button onClick={() => setNotifications(dataService.clearNotifications())} className="text-[10px] text-red-500 font-bold">Clear</button></div>
                   <div className="max-h-60 overflow-y-auto custom-scrollbar">
                       {notifications.length > 0 ? notifications.map(n => <div key={n.id} className="p-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">{n.message}</div>) : <div className="p-6 text-center text-slate-400 text-[11px] font-bold uppercase tracking-widest">Everything is up to date</div>}
                   </div>
               </div>
           )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth">
           {currentView === View.TIMETABLE && <TimetableManager currentRole={currentRole} />}
           {currentView === View.TEACHERS && <TeacherManager currentRole={currentRole} />}
           {currentView === View.REMARKS && (
               <>
                 <TeacherRemarks currentRole={currentRole} />
                 <div className="mt-8 pt-4 border-t dark:border-slate-800 flex justify-center opacity-30">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">Remarks Section • Made by Lucky</span>
                 </div>
               </>
           )}
           {currentView === View.EXAMS && (
               <>
                 <ExamScheduler />
                 <div className="mt-8 pt-4 border-t dark:border-slate-800 flex justify-center opacity-30">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">Exam Section • Made by Lucky</span>
                 </div>
               </>
           )}
           {currentView === View.MEETINGS && (
               <>
                 <TeacherMeetingManager currentRole={currentRole} />
                 <div className="mt-8 pt-4 border-t dark:border-slate-800 flex justify-center opacity-30">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">Meeting Section • Made by Lucky</span>
                 </div>
               </>
           )}
           {currentView === View.SETTINGS && (
               <>
                 <SettingsManager currentRole={currentRole} />
                 <div className="mt-8 pt-4 border-t dark:border-slate-800 flex justify-center opacity-30">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">Settings Section • Made by Lucky</span>
                 </div>
               </>
           )}
           {currentView === View.INSIGHTS && (
               <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-12 text-center max-w-2xl mx-auto flex flex-col items-center">
                    <Sparkles className="w-12 h-12 text-purple-500 mb-4 animate-pulse" />
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">School Workload Analysis</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-md">AI engine analyzes staff distribution to ensure a balanced environment.</p>
                    {!aiReport ? (
                        <button onClick={async () => { setIsAnalyzing(true); setAiReport(await geminiService.analyzeWorkload(dataService.getTeachers(), dataService.getSchedule())); setIsAnalyzing(false); }} disabled={isAnalyzing} className="bg-purple-600 text-white px-10 py-3.5 rounded-full font-bold hover:bg-purple-700 disabled:opacity-70 transition-all flex items-center gap-3 shadow-xl">
                            {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Sparkles className="w-4 h-4" />}
                            {isAnalyzing ? "Analyzing Data..." : "Run AI Diagnostics"}
                        </button>
                    ) : (
                        <div className="w-full text-left bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl p-6 md:p-8 border border-purple-100 dark:border-purple-800 text-sm prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{__html: aiReport}} />
                    )}
                    <div className="mt-12 opacity-30 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]">
                        Made by Lucky <Heart className="w-2.5 h-2.5 text-red-500 fill-current" />
                    </div>
               </div>
           )}
        </div>

        <footer className="h-10 border-t dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] no-print">
            Handcrafted by Lucky <Heart className="w-2.5 h-2.5 text-red-500 fill-current" />
        </footer>
      </main>
    </div>
  );
};

export default App;
