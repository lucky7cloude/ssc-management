
import React, { useState, useEffect } from 'react';
import { TeacherManager } from './components/TeacherManager';
import { TimetableManager } from './components/TimetableManager';
import { TeacherRemarks } from './components/TeacherRemarks';
import { ExamScheduler } from './components/ExamScheduler';
import { TeacherMeetingManager } from './components/TeacherMeeting';
import { SettingsManager } from './components/Settings';
import { Calendar, Users, BarChart3, FileSignature, Clock, Heart, Shield, X, ClipboardList, Menu, Settings as SettingsIcon, Moon, Sun, Zap, LogOut, Lock } from 'lucide-react';
import { UserRole, SCHOOL_LOGO_URL } from './types';

enum View {
  TIMETABLE = 'TIMETABLE',
  TEACHERS = 'TEACHERS',
  REMARKS = 'REMARKS',
  EXAMS = 'EXAMS',
  MEETINGS = 'MEETINGS',
  SETTINGS = 'SETTINGS'
}

const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  const [currentView, setCurrentView] = useState<View>(View.TIMETABLE);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedRoleForLogin, setSelectedRoleForLogin] = useState<UserRole | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleRoleSelect = (role: UserRole) => { 
      setSelectedRoleForLogin(role); 
      setShowLoginModal(true); 
      setLoginPassword(''); 
      setLoginError(''); 
  };

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
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-widest ${currentView === view ? 'bg-brand-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:bg-slate-50'}`}
    >
      <Icon className="w-5 h-5" /> {label}
    </button>
  );

  if (!currentRole) {
      return (
          <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-lg mb-16 flex flex-col items-center text-center">
                 <div className="w-52 h-52 mb-8 flex items-center justify-center overflow-hidden rounded-full shadow-2xl bg-slate-950 border-8 border-slate-50">
                    <img src={SCHOOL_LOGO_URL} alt="Logo" className="w-4/5 h-4/5 object-contain" />
                 </div>
                 <h1 className="text-5xl font-serif font-black text-slate-950 tracking-tighter">Silver Star</h1>
                 <p className="text-brand-600 font-black tracking-[0.5em] uppercase text-[10px] mt-4">Autonomous Management System</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
                  <button onClick={() => handleRoleSelect('PRINCIPAL')} className="bg-slate-50 p-10 rounded-[3rem] shadow-xl border-4 border-transparent hover:border-brand-500 hover:bg-white transition-all flex flex-col items-center group">
                      <div className="w-20 h-20 bg-brand-50 rounded-[2rem] flex items-center justify-center mb-6 group-hover:bg-brand-500 transition-all"><Shield className="w-10 h-10 text-brand-600 group-hover:text-white" /></div>
                      <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Principal</h3>
                      <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">Admin Access</p>
                  </button>
                  <button onClick={() => handleRoleSelect('MANAGEMENT')} className="bg-slate-50 p-10 rounded-[3rem] shadow-xl border-4 border-transparent hover:border-purple-500 hover:bg-white transition-all flex flex-col items-center group">
                      <div className="w-20 h-20 bg-purple-50 rounded-[2rem] flex items-center justify-center mb-6 group-hover:bg-purple-500 transition-all"><BarChart3 className="w-10 h-10 text-purple-600 group-hover:text-white" /></div>
                      <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Management</h3>
                      <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">Reports Console</p>
                  </button>
              </div>

              {showLoginModal && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-fade-in">
                      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden animate-pop-in border">
                          <div className="bg-slate-950 p-8 flex justify-between items-center text-white">
                              <h3 className="font-black uppercase tracking-widest text-[10px] flex items-center gap-2"><Lock className="w-4 h-4" /> Secure Auth</h3>
                              <button onClick={() => setShowLoginModal(false)}><X className="w-6 h-6"/></button>
                          </div>
                          <form onSubmit={handleLoginSubmit} className="p-12 space-y-8">
                                <div className="space-y-4 text-center">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Passkey Required</label>
                                    <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full rounded-3xl bg-slate-50 border-none p-6 outline-none focus:ring-8 focus:ring-brand-500/10 font-black tracking-[0.8em] text-center text-4xl shadow-inner" placeholder="••••" autoFocus />
                                </div>
                                {loginError && <p className="text-xs text-red-500 font-black text-center uppercase tracking-widest">{loginError}</p>}
                                <button type="submit" className="w-full bg-brand-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs hover:bg-brand-700 shadow-2xl transition-all">Verify</button>
                          </form>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return (
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-x-hidden">
        <aside className={`fixed md:sticky top-0 left-0 h-screen w-80 bg-white border-r z-[120] transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col no-print`}>
          <div className="p-12 border-b flex flex-col items-center">
              <div className="w-36 h-36 mb-6 bg-slate-50 p-4 rounded-[2.5rem] shadow-inner flex items-center justify-center">
                <img src={SCHOOL_LOGO_URL} alt="Silver Star" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.6em] text-center">Silver Star<br/>Convent</h2>
          </div>
          <nav className="p-8 space-y-3 flex-1 overflow-y-auto">
            <NavButton view={View.TIMETABLE} icon={Calendar} label="Live Grid" />
            <NavButton view={View.TEACHERS} icon={Users} label="Staff Hub" />
            <NavButton view={View.REMARKS} icon={FileSignature} label="Daily Feedback" />
            <NavButton view={View.EXAMS} icon={Clock} label="Exam Planner" />
            <NavButton view={View.MEETINGS} icon={ClipboardList} label="Log Records" />
            <NavButton view={View.SETTINGS} icon={SettingsIcon} label="Settings" />
          </nav>
          <div className="p-8 border-t">
              <button onClick={() => setCurrentRole(null)} className="w-full flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 p-5 rounded-[1.5rem] transition-all"><LogOut className="w-5 h-5" /> Logout</button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="bg-white border-b h-24 flex items-center justify-between px-10 no-print z-30">
            <div className="flex items-center gap-8">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-4 bg-slate-50 rounded-2xl"><Menu className="w-8 h-8 text-slate-600" /></button>
                <h2 className="text-2xl font-black text-slate-950 tracking-tight uppercase">
                    {currentView === View.TIMETABLE && 'Timetable Studio'}
                    {currentView === View.TEACHERS && 'Staff Registry'}
                    {currentView === View.REMARKS && 'Remarks Hub'}
                    {currentView === View.EXAMS && 'Exam Planner'}
                    {currentView === View.MEETINGS && 'Internal Logs'}
                    {currentView === View.SETTINGS && 'Settings'}
                </h2>
            </div>
            <div className="flex items-center gap-4">
                <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-brand-100">
                    <Zap className="w-3 h-3"/> System Online
                </div>
                <button onClick={() => setDarkMode(!darkMode)} className="p-3.5 rounded-2xl hover:bg-slate-50 text-slate-500 border">
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            {currentView === View.TIMETABLE && <TimetableManager currentRole={currentRole} />}
            {currentView === View.TEACHERS && <TeacherManager currentRole={currentRole} />}
            {currentView === View.REMARKS && <TeacherRemarks currentRole={currentRole} />}
            {currentView === View.EXAMS && <ExamScheduler />}
            {currentView === View.MEETINGS && <TeacherMeetingManager currentRole={currentRole} />}
            {currentView === View.SETTINGS && <SettingsManager currentRole={currentRole} />}
          </div>

          <footer className="h-16 border-t bg-white flex flex-col items-center justify-center text-[10px] font-black text-slate-400 uppercase no-print">
              <div className="flex items-center gap-3 tracking-[0.6em]">
                  Silver Star Management • Made by Lucky <Heart className="w-3.5 h-3.5 text-red-500 fill-current animate-pulse" />
              </div>
          </footer>
        </main>
      </div>
  );
};

export default App;
