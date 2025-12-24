
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        // ตรวจสอบ API Key (แบบทนทาน)
        const key = typeof process !== 'undefined' ? process.env.API_KEY : "";
        if (!key || key === "" || key === "undefined") {
          try {
            const selected = await (window as any).aistudio?.hasSelectedApiKey();
            setHasKey(!!selected);
          } catch (e) {
            setHasKey(false);
          }
        } else {
          setHasKey(true);
        }

        // โหลดข้อมูลผู้ใช้
        const saved = sessionStorage.getItem('questup_user');
        if (saved && saved !== 'undefined') {
          setUser(JSON.parse(saved));
          setView('setup');
        }
      } catch (err) {
        console.error("Init crash:", err);
      }
    };
    initApp();
  }, []);

  const handleConnectKey = async () => {
    try {
      if ((window as any).aistudio?.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        setHasKey(true);
      } else {
        alert("กรุณาตั้งค่า API_KEY ในระบบหลังบ้านของ Netlify (Site Settings > Env Variables)");
      }
    } catch (e) {
      setHasKey(false);
    }
  };

  const handleStartExam = async (files: ReferenceFile[], grade: Grade, lang: Language, count: number, weakTopics?: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const questions = await generateExamFromFile(files, grade, lang, count, weakTopics);
      setSession({
        userId: user?.id || 'guest',
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
        setError(err.message || "เกิดข้อผิดพลาดในการสร้างข้อสอบ");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Kanit']">
      <Header 
        user={user} 
        onHome={() => { setView('setup'); setError(null); }} 
        onLogout={() => { setUser(null); sessionStorage.clear(); setView('login'); }} 
        onManageKey={handleConnectKey} 
      />

      {!hasKey && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-md w-full shadow-2xl text-center border-t-[12px] border-indigo-600">
            <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tighter uppercase italic">AI ยังไม่ได้รับอนุญาต</h2>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">กรุณาตั้งค่า <b>API_KEY</b> ใน Netlify หรือใช้ปุ่มด้านล่างเพื่อเลือก Key จาก AI Studio</p>
            <div className="space-y-3">
              <button onClick={handleConnectKey} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-transform">
                เลือก API Key (AI Studio)
              </button>
              <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200">
                ตั้งค่าใน Netlify แล้ว (รีโหลด)
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {isLoading && (
          <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="font-black text-slate-800 animate-pulse">กำลังเก็งข้อสอบด้วย AI...</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-100 text-rose-600 rounded-2xl flex items-center justify-between">
            <span className="font-black text-xs uppercase tracking-widest"><i className="fas fa-exclamation-circle mr-2"></i>{error}</span>
            <button onClick={() => setError(null)}><i className="fas fa-times"></i></button>
          </div>
        )}

        {view === 'login' && <Login onLogin={(u) => { setUser(u); sessionStorage.setItem('questup_user', JSON.stringify(u)); setView('setup'); }} />}
        {view === 'setup' && user && <SetupForm onStart={handleStartExam} />}
        {view === 'quiz' && session && <Quiz questions={session.questions} language={session.language} onComplete={(ans, sc) => { setUserAnswers(ans); setSession({...session, currentScore: sc}); setView('analysis'); }} />}
        {view === 'analysis' && session && <Analysis questions={session.questions} answers={userAnswers} onRetry={() => setView('setup')} onFocusWeakness={(w) => handleStartExam(session.files, session.grade, session.language, session.questionCount, w)} />}
      </main>
    </div>
  );
}
