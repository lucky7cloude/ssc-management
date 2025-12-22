
import React, { useState, useEffect, useRef } from 'react';
import { TeacherManager } from './components/TeacherManager';
import { TimetableManager } from './components/TimetableManager';
import { TeacherRemarks } from './components/TeacherRemarks';
import { ExamScheduler } from './components/ExamScheduler';
import { TeacherMeetingManager } from './components/TeacherMeeting';
import { SettingsManager } from './components/Settings';
import { Calendar, Users, BarChart3, GraduationCap, Sparkles, FileSignature, Clock, Heart, CheckCircle2, Bell, LogOut, Lock, Shield, X, KeyRound, ChevronRight, ClipboardList, Menu, Settings as SettingsIcon } from 'lucide-react';
import * as dataService from './services/dataService';
import * as geminiService from './services/geminiService';
import { UserRole, AppNotification } from './types';

enum View {
  TIMETABLE = 'TIMETABLE',
  TEACHERS = 'TEACHERS',
  REMARKS = 'REMARKS',
  EXAMS = 'EXAMS',
  MEETINGS = 'MEETINGS',
  INSIGHTS = 'INSIGHTS',
  SETTINGS = 'SETTINGS'
}

const DEFAULT_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><defs><style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');</style></defs><path d="M100,250 C100,100 250,50 400,250" fill="none" stroke="#b45309" stroke-width="8" stroke-linecap="round" /><path d="M100,250 C100,400 250,450 400,250" fill="none" stroke="#b45309" stroke-width="8" stroke-linecap="round" /><g fill="#d97706"><circle cx="110" cy="200" r="8" /><circle cx="130" cy="160" r="8" /><circle cx="160" cy="130" r="8" /><circle cx="200" cy="105" r="8" /><circle cx="250" cy="95" r="8" /><circle cx="300" cy="105" r="8" /><circle cx="340" cy="130" r="8" /><circle cx="370" cy="160" r="8" /><circle cx="390" cy="200" r="8" /><circle cx="110" cy="300" r="8" /><circle cx="130" cy="340" r="8" /><circle cx="160" cy="370" r="8" /><circle cx="200" cy="395" r="8" /><circle cx="250" cy="405" r="8" /><circle cx="300" cy="395" r="8" /><circle cx="340" cy="370" r="8" /><circle cx="370" cy="340" r="8" /><circle cx="390" cy="300" r="8" /></g><path d="M230,320 L230,220 C230,220 180,200 170,180" stroke="#004e98" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M270,320 L270,220 C270,220 320,200 330,180" stroke="#004e98" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M250,280 L250,150" stroke="#004e98" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M250,200 L210,160" stroke="#004e98" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M250,190 L290,150" stroke="#004e98" stroke-width="8" fill="none" stroke-linecap="round"/><g fill="#dc2626"><path d="M250,110 L254,122 L266,122 L256,130 L260,142 L250,134 L240,142 L244,130 L234,122 L246,122 Z" /><path d="M190,140 L194,152 L206,152 L196,160 L200,172 L190,164 L180,172 L184,160 L174,152 L186,152 Z" /><path d="M310,140 L314,152 L326,152 L316,160 L320,172 L310,164 L300,172 L304,160 L294,152 L306,152 Z" /><path d="M150,190 L153,198 L161,198 L155,204 L157,212 L150,207 L143,212 L145,204 L139,198 L147,198 Z" /><path d="M350,190 L353,198 L361,198 L355,204 L357,212 L350,207 L343,212 L345,204 L339,198 L347,198 Z" /></g><text x="250" y="440" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="bold" font-size="42" fill="#1e293b">Silver Star</text><text x="250" y="475" text-anchor="middle" font-family="'Playfair Display', serif" font-size="32" fill="#334155">Convent School</text><g fill="#1e293b"><path d="M250,50 L254,62 L266,62 L256,70 L260,82 L250,74 L240,82 L244,70 L234,62 L246,62 Z" transform="scale(0.8) translate(60, 20)" /><path d="M210,60 L214,72 L226,72 L216,80 L220,92 L210,84 L200,92 L204,80 L194,72 L206,72 Z" transform="scale(0.8) translate(60, 20)" /><path d="M290,60 L294,72 L306,72 L296,80 L300,92 L290,84 L280,92 L284,80 L274,72 L286,72 Z" transform="scale(0.8) translate(60, 20)" /></g></svg>`;

const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<View>(View.TIMETABLE);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [logo, setLogo] = useState<string>(DEFAULT_LOGO);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedRoleForLogin, setSelectedRoleForLogin] = useState<UserRole | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const savedLogo = localStorage.getItem('school_logo');
    if (savedLogo) setLogo(savedLogo);
    
    setNotifications(dataService.getNotifications());
    
    const handleNotificationUpdate = () => setNotifications(dataService.getNotifications());
    const handleToast = (e: CustomEvent) => { setToast(e.detail); setTimeout(() => setToast(null), 3000); };
    const handleLogoUpdate = (e: any) => { setLogo(e.detail || DEFAULT_LOGO); };

    window.addEventListener('notifications-updated' as any, handleNotificationUpdate);
    window.addEventListener('show-toast' as any, handleToast);
    window.addEventListener('logo-updated' as any, handleLogoUpdate);

    return () => {
        window.removeEventListener('notifications-updated' as any, handleNotificationUpdate);
        window.removeEventListener('show-toast' as any, handleToast);
        window.removeEventListener('logo-updated' as any, handleLogoUpdate);
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${currentView === view ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon className="w-5 h-5" /> {label}
    </button>
  );

  if (!currentRole) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
              <div className="mb-8 flex flex-col items-center animate-fade-in text-center">
                 <div className="w-24 h-24 mb-4"><img src={logo} alt="Logo" className="w-full h-full object-contain" /></div>
                 <h1 className="text-3xl font-serif font-bold text-slate-800">Silver Star</h1>
                 <p className="text-slate-500 font-medium">School Management System</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl">
                  <button onClick={() => handleRoleSelect('PRINCIPAL')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-brand-500 transition-all flex flex-col items-center text-center group">
                      <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-brand-500 transition-colors"><Shield className="w-6 h-6 text-brand-600 group-hover:text-white" /></div>
                      <h3 className="text-lg font-bold text-slate-800">Principal</h3>
                      <p className="text-xs text-slate-500 mt-1">Full Administrative Access</p>
                  </button>
                  <button onClick={() => handleRoleSelect('MANAGEMENT')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-500 transition-all flex flex-col items-center text-center group">
                      <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-500 transition-colors"><BarChart3 className="w-6 h-6 text-purple-600 group-hover:text-white" /></div>
                      <h3 className="text-lg font-bold text-slate-800">Management</h3>
                      <p className="text-xs text-slate-500 mt-1">Review & Resource Planning</p>
                  </button>
              </div>
              {showLoginModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-pop-in">
                          <div className="bg-slate-800 p-4 flex justify-between items-center text-white"><h3 className="font-bold flex items-center gap-2 text-sm"><Lock className="w-4 h-4" /> Secure Portal Access</h3><button onClick={() => setShowLoginModal(false)}><X className="w-4 h-4"/></button></div>
                          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
                                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full rounded-lg bg-slate-50 border p-3 outline-none focus:ring-2 focus:ring-brand-500 font-bold tracking-widest text-center" placeholder="••••••••" autoFocus />
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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-x-hidden">
      {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-pop-in"><div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold text-xs"><CheckCircle2 className="w-4 h-4 text-green-400" /> {toast.message}</div></div>}
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fade-in" onClick={() => setIsSidebarOpen(false)}></div>}

      <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 z-50 transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col no-print`}>
        <div className="p-6 border-b border-slate-100 flex flex-col items-center">
            <div className="w-20 h-20 mb-3"><img src={logo} alt="Silver Star" className="w-full h-full object-contain" /></div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-[0.2em] text-center">Silver Star</h2>
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
        <div className="p-4 bg-slate-50 border-t flex flex-col items-center gap-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentRole} Mode</div>
            <button onClick={() => setCurrentRole(null)} className="w-full flex items-center justify-center gap-2 text-xs text-red-500 font-bold hover:bg-red-50 p-2 rounded-lg transition-all"><LogOut className="w-4 h-4" /> Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-100 h-16 flex items-center justify-between px-4 md:px-8 shrink-0 no-print z-30">
           <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-slate-100 rounded-lg"><Menu className="w-6 h-6 text-slate-600" /></button>
              <h2 className="text-lg font-bold text-slate-800 font-serif truncate">
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
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 rounded-full hover:bg-slate-100 relative text-slate-600">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
              </button>
           </div>
           {isNotifOpen && (
               <div className="absolute right-4 top-14 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 z-[60] overflow-hidden animate-pop-in">
                   <div className="p-3 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Activity Logs</h3><button onClick={() => setNotifications(dataService.clearNotifications())} className="text-[10px] text-red-500 font-bold">Clear</button></div>
                   <div className="max-h-60 overflow-y-auto custom-scrollbar">
                       {notifications.length > 0 ? notifications.map(n => <div key={n.id} className="p-3 border-b hover:bg-slate-50 text-[11px] text-slate-700 leading-relaxed">{n.message}</div>) : <div className="p-6 text-center text-slate-400 text-[11px] font-bold uppercase tracking-widest">Everything is up to date</div>}
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
           {currentView === View.INSIGHTS && (
               <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-12 text-center max-w-2xl mx-auto flex flex-col items-center">
                    <Sparkles className="w-12 h-12 text-purple-500 mb-4 animate-pulse" />
                    <h3 className="text-xl font-bold text-slate-800">School Workload Analysis</h3>
                    <p className="text-sm text-slate-500 mb-8 max-w-md">Our AI engine analyzes staff distribution and period density to ensure a balanced academic environment.</p>
                    {!aiReport ? (
                        <button onClick={async () => { setIsAnalyzing(true); setAiReport(await geminiService.analyzeWorkload(dataService.getTeachers(), dataService.getSchedule())); setIsAnalyzing(false); }} disabled={isAnalyzing} className="bg-purple-600 text-white px-10 py-3.5 rounded-full font-bold hover:bg-purple-700 disabled:opacity-70 transition-all flex items-center gap-3 shadow-xl shadow-purple-200">
                            {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Sparkles className="w-4 h-4" />}
                            {isAnalyzing ? "Analyzing Data..." : "Run AI Diagnostics"}
                        </button>
                    ) : (
                        <div className="w-full text-left bg-purple-50/50 rounded-2xl p-6 md:p-8 border border-purple-100 text-sm prose prose-purple max-w-none shadow-inner" dangerouslySetInnerHTML={{__html: aiReport}} />
                    )}
               </div>
           )}
        </div>

        <footer className="h-10 border-t bg-white flex items-center justify-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] no-print">
            Handcrafted for Silver Star Team <Heart className="w-2.5 h-2.5 text-red-500 fill-current" />
        </footer>
      </main>
    </div>
  );
};

export default App;
