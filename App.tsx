
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
  const [appError, setAppError] = useState<string | null>(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        // ตรวจสอบ API Key จาก process.env (Netlify)
        const envKey = process.env.API_KEY;
        if (envKey && envKey !== "undefined" && envKey !== "") {
          setHasKey(true);
        } else {
          // ถ้าไม่มีใน env ลองเช็คใน AI Studio Frame
          try {
            const selected = await (window as any).aistudio?.hasSelectedApiKey();
            setHasKey(!!selected);
          } catch (e) {
            setHasKey(false);
          }
        }

        // โหลดข้อมูลผู้ใช้เดิม
        const saved = sessionStorage.getItem('questup_user');
        if (saved && saved !== 'undefined') {
          setUser(JSON.parse(saved));
          setView('setup');
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };
    initApp();
  }, []);

  const handleConnectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasKey(true);
      setAppError(null);
    } else {
      setHasKey(false);
    }
  };

  const handleStartExam = async (files: ReferenceFile[], grade: Grade, lang: Language, count: number, weakTopics?: string[]) => {
    if (!user) return;
    setIsLoading(true);
    setAppError(null);

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
      console.error("Exam Generation Error:", err);
      if (err.message?.includes("AUTH_REQUIRED") || err.message?.includes("API key")) {
        setHasKey(false);
      } else {
        setAppError(err.message || "เกิดข้อผิดพลาดในการสร้างข้อสอบ");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ป้องกันหน้าจอขาวโพลนด้วยการ Render UI พื้นฐานเสมอ
  return (
    <div className="min-h-screen bg-slate-50 font-['Kanit']">
      <Header 
        user={user} 
        onHome={() => { setView('setup'); setAppError(null); }} 
        onLogout={() => { setUser(null); sessionStorage.clear(); setView('login'); }} 
        onManageKey={handleConnectKey} 
      />
      
      {/* ส่วนแสดงข้อผิดพลาด (ถ้ามี) */}
      {appError && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-2xl flex items-center justify-between">
            <span className="text-sm font-bold">⚠️ {appError}</span>
            <button onClick={() => setAppError(null)} className="text-rose-400 hover:text-rose-600">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* หน้าจอตั้งค่า API Key (Overlay) */}
      {!hasKey && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white rounded-[3.5rem] p-12 max-w-xl w-full shadow-2xl border-b-[16px] border-indigo-600 animate-slideUp text-center">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600 mx-auto mb-8 shadow-inner">
              <i className="fas fa-satellite-dish text-4xl"></i>
            </div>
            
            <h2 className="text-4xl font-black text-slate-800 mb-6 tracking-tighter uppercase italic">เชื่อมต่อ AI ไม่สำเร็จ</h2>
            
            <div className="bg-slate-50 rounded-[2rem] p-8 text-left mb-10 border border-slate-100">
              <p className="text-base text-slate-700 font-bold mb-4">วิธีแก้ไข:</p>
              <ul className="text-sm text-slate-500 space-y-4">
                <li className="flex gap-3">
                  <span className="text-indigo-600 font-black">1.</span>
                  <span>ก๊อปปี้ API Key จาก <b>Google AI Studio</b></span>
                </li>
                <li className="flex gap-3">
                  <span className="text-indigo-600 font-black">2.</span>
                  <span>ไปที่ <b>Netlify Settings</b> > <b>Environment Variables</b></span>
                </li>
                <li className="flex gap-3">
                  <span className="text-indigo-600 font-black">3.</span>
                  <span>เพิ่มชื่อ <b>API_KEY</b> แล้ววางรหัสลงไป</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {(window as any).aistudio?.openSelectKey && (
                <button onClick={handleConnectKey} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95">
                  เชื่อมต่อผ่าน AI Studio
                </button>
              )}
              <button onClick={() => window.location.reload()} className="w-full py-6 bg-slate-800 text-white rounded-3xl font-black text-2xl shadow-xl transition-all active:scale-95">
                ตั้งค่าใน Netlify แล้ว (รีโหลด)
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        {isLoading && (
          <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center animate-fadeIn">
            <div className="w-20 h-20 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
            <h3 className="text-3xl font-black text-slate-800 italic tracking-tighter">AI กำลังวิเคราะห์ชีทเรียน...</h3>
            <p className="text-slate-400 font-bold mt-2 animate-pulse">กรุณารอสักครู่ (ไม่เกิน 30 วินาที)</p>
          </div>
        )}

        {view === 'login' && <Login onLogin={(u) => { setUser(u); sessionStorage.setItem('questup_user', JSON.stringify(u)); setView('setup'); }} />}
        {view === 'setup' && user && <SetupForm onStart={handleStartExam} />}
        {view === 'quiz' && session && (
          <Quiz questions={session.questions} language={session.language} onComplete={(ans, score) => { setUserAnswers(ans); setSession({...session, currentScore: score}); setView('analysis'); }} />
        )}
        {view === 'analysis' && session && (
          <Analysis questions={session.questions} answers={userAnswers} onRetry={() => setView('setup')} onFocusWeakness={(w) => handleStartExam(session.files, session.grade, session.language, session.questionCount, w)} />
        )}
      </main>
    </div>
  );
}
