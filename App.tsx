
import React, { useState, useEffect } from 'react';
import { ViewState, ExamSession, Question, Grade, Language, ReferenceFile, User } from './types.ts';
import Header from './components/Header.tsx';
import SetupForm from './components/SetupForm.tsx';
import Quiz from './components/Quiz.tsx';
import Analysis from './components/Analysis.tsx';
import Login from './components/Login.tsx';
import { generateExamFromFile } from './services/geminiService.ts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('login');
  const [session, setSession] = useState<ExamSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  
  const [hasKey, setHasKey] = useState<boolean>(true);

  useEffect(() => {
    const checkKey = async () => {
      // 1. ตรวจสอบในสภาพแวดล้อม (Netlify Env)
      const envKey = process.env.API_KEY;
      if (envKey && envKey !== "undefined" && envKey !== "null") {
        setHasKey(true);
        return;
      }

      // 2. ตรวจสอบใน AI Studio Frame
      try {
        const selected = await (window as any).aistudio?.hasSelectedApiKey();
        setHasKey(!!selected);
      } catch (e) {
        setHasKey(false);
      }
    };
    checkKey();

    // Load User
    const saved = sessionStorage.getItem('questup_user');
    if (saved && saved !== 'undefined') {
      setUser(JSON.parse(saved));
      setView('setup');
    }
  }, []);

  const handleConnectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasKey(true);
      // ใน AI Studio เราข้ามไปหน้าแอปได้เลย
    } else {
      // ถ้าอยู่บน Netlify และไม่มี Key ใน Env ให้บอกวิธีตั้งค่า
      setHasKey(false);
    }
  };

  const handleStartExam = async (files: ReferenceFile[], grade: Grade, lang: Language, count: number, weakTopics?: string[]) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const questions = await generateExamFromFile(files, grade, lang, count, weakTopics);
      setSession({
        userId: user.id,
        files,
        grade,
        language: lang,
        questionCount: count,
        questions,
        currentScore: 0,
        weakTopicsFromPrevious: weakTopics
      });
      setUserAnswers(new Array(questions.length).fill(null));
      setView('quiz');
    } catch (err: any) {
      if (err.message?.includes("AUTH_REQUIRED")) {
        setHasKey(false);
      } else {
        alert("เกิดข้อผิดพลาด: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Kanit']">
      <Header user={user} onHome={() => setView('setup')} onLogout={() => { setUser(null); sessionStorage.clear(); setView('login'); }} onManageKey={handleConnectKey} />
      
      {!hasKey && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-lg w-full shadow-2xl animate-slideUp border-b-[12px] border-indigo-600">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-4">
                <i className="fas fa-key text-3xl"></i>
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter italic">เชื่อมต่อระบบเก็งข้อสอบ</h2>
              <p className="text-slate-400 font-bold text-sm mt-2 uppercase">API Key Required for AI Power</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  <span className="text-indigo-600 font-black mr-2">●</span> 
                  รันบน <b>Netlify:</b> ไปที่ Site Settings > Environment Variables เพิ่ม <code>API_KEY</code>
                </p>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  <span className="text-indigo-600 font-black mr-2">●</span> 
                  รันบน <b>AI Studio:</b> กดปุ่มด้านล่างเพื่อเลือก Key จากบัญชีของคุณ
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(window as any).aistudio?.openSelectKey && (
                <button onClick={handleConnectKey} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95">
                  เลือก API Key <i className="fas fa-magic ml-2"></i>
                </button>
              )}
              <button onClick={() => window.location.reload()} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95">
                ฉันตั้งค่าใน Netlify แล้ว <i className="fas fa-sync-alt ml-2"></i>
              </button>
            </div>
            
            <a href="https://aistudio.google.com/" target="_blank" className="block text-center mt-6 text-[10px] font-black text-slate-300 hover:text-indigo-400 uppercase tracking-widest transition-colors">
              Get Free API Key from Google AI Studio
            </a>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {isLoading && (
          <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center">
            <div className="w-20 h-20 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
            <h3 className="text-3xl font-black text-slate-800 italic tracking-tighter">QuestUp AI is Crafting Your Exam...</h3>
          </div>
        )}

        {view === 'login' && <Login onLogin={(u) => { setUser(u); sessionStorage.setItem('questup_user', JSON.stringify(u)); setView('setup'); }} />}
        {view === 'setup' && user && <SetupForm onStart={handleStartExam} />}
        {view === 'quiz' && session && <Quiz questions={session.questions} language={session.language} onComplete={(ans, score) => { setUserAnswers(ans); setSession({...session, currentScore: score}); setView('analysis'); }} />}
        {view === 'analysis' && session && <Analysis questions={session.questions} answers={userAnswers} onRetry={() => setView('setup')} onFocusWeakness={(w) => handleStartExam(session.files, session.grade, session.language, session.questionCount, w)} />}
      </main>
    </div>
  );
}
