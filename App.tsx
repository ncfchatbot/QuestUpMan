
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
  const [isBillingError, setIsBillingError] = useState<boolean>(false);

  useEffect(() => {
    checkKeyStatus();
    
    try {
      const savedUser = sessionStorage.getItem('questup_user');
      if (savedUser && savedUser !== 'undefined') {
        setUser(JSON.parse(savedUser));
        setView('setup');
      }
    } catch (e) {
      console.error("Failed to load session", e);
    }
  }, []);

  const checkKeyStatus = async () => {
    try {
      const isSelected = await (window as any).aistudio?.hasSelectedApiKey();
      const hasEnv = !!(process.env.API_KEY);
      setHasKey(isSelected || hasEnv);
    } catch (e) {
      setHasKey(false);
    }
  };

  const handleConnectKey = async () => {
    try {
      // เรียกหน้าต่างระบบเพื่อให้ผู้ใช้เลือก Key ตัวที่ผูก Billing สำเร็จแล้ว
      await (window as any).aistudio?.openSelectKey();
      setHasKey(true);
      setIsBillingError(false);
      // รีเฟรชแอปเพื่อให้ใช้ Key ล่าสุดทันที
      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      console.error("Connection failed", e);
    }
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    sessionStorage.setItem('questup_user', JSON.stringify(newUser));
    setView('setup');
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('questup_user');
    setView('login');
  };

  const handleStartExam = async (files: ReferenceFile[], grade: Grade, lang: Language, count: number, weakTopics?: string[]) => {
    if (!user) return;
    setIsLoading(true);
    setIsBillingError(false);

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
      const msg = err.message || "";
      console.error("API Error Trace:", msg);

      // ดักจับปัญหา Billing/Key โดยเฉพาะ
      if (msg.includes("billing") || msg.includes("403") || msg.includes("not found") || msg.includes("API_KEY_INVALID")) {
        setIsBillingError(true);
        setHasKey(false);
      } else {
        alert("ขออภัย ระบบขัดข้อง: " + msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteQuiz = (finalAnswers: (number | null)[], finalScore: number) => {
    setUserAnswers(finalAnswers);
    if (session) {
      setSession({ ...session, currentScore: finalScore });
    }
    setView('analysis');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Kanit']">
      <Header 
        user={user} 
        onHome={() => setView('setup')} 
        onLogout={handleLogout} 
        onManageKey={handleConnectKey}
      />
      
      {/* 1. ปุ่มลอยมุมขวาล่าง (Floating Badge) เพื่อจัดการ Key */}
      <button 
        onClick={handleConnectKey}
        className="fixed bottom-6 right-6 z-[60] group flex flex-col items-end gap-2"
        title="จัดการ API Key"
      >
        <span className="bg-slate-800 text-white text-[10px] py-1 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-widest shadow-xl">
          คลิกเพื่อเปลี่ยน Key
        </span>
        <div className={`px-5 py-3 rounded-2xl text-[12px] font-black flex items-center gap-3 shadow-2xl backdrop-blur-md border transition-all hover:scale-105 active:scale-95 ${hasKey ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-rose-500/10 text-rose-600 border-rose-200'}`}>
          <div className={`w-3 h-3 rounded-full animate-pulse ${hasKey ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          AI STATUS: {hasKey ? 'READY' : 'ERROR'}
          <i className="fas fa-key opacity-40 group-hover:rotate-12 transition-transform text-lg ml-2"></i>
        </div>
      </button>

      {/* 2. หน้าจอแจ้งเตือน (Overlay) เมื่อมีปัญหา Key/Billing */}
      {(!hasKey || isBillingError) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[3rem] p-10 max-w-lg w-full text-center shadow-2xl border-t-[12px] border-indigo-600 animate-slideUp">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 mx-auto mb-8 shadow-inner">
              <i className="fas fa-shield-halved text-4xl"></i>
            </div>
            
            <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tighter">
              {isBillingError ? "ตรวจพบปัญหา Billing" : "ยังไม่ได้เชื่อมต่อระบบ AI"}
            </h2>
            
            <div className="bg-slate-50 rounded-3xl p-6 text-left mb-8 border border-slate-100">
              <p className="text-sm text-slate-700 font-bold mb-4 flex items-center gap-2">
                <i className="fas fa-lightbulb text-amber-500"></i> ทำตาม 3 ขั้นตอนนี้เพื่อให้ใช้งานได้:
              </p>
              <ul className="text-xs text-slate-500 space-y-4 font-medium">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                  <span>ไปที่ <b>Google AI Studio</b> และสร้าง API Key ใหม่ โดยเลือกโปรเจกต์ที่ผูกบัตรเครดิตแล้ว (Project: <u>gen-lang-client-0630622454</u>)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                  <span>กลับมาที่หน้าจอนี้แล้วกดปุ่ม <b>"อัปเดตการเชื่อมต่อ"</b> สีน้ำเงินด้านล่าง</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                  <span>เลือก Key ตัวใหม่ที่คุณเพิ่งสร้างจากรายการที่ปรากฏขึ้น</span>
                </li>
              </ul>
            </div>

            <button 
              onClick={handleConnectKey}
              className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-4"
            >
              อัปเดตการเชื่อมต่อ <i className="fas fa-bolt text-yellow-300"></i>
            </button>
            
            <p className="mt-6 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
              QuestUp personalized learning platform
            </p>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        {isLoading && (
          <div className="fixed inset-0 bg-white/90 z-50 flex flex-col items-center justify-center animate-fadeIn">
            <div className="w-20 h-20 relative mb-6">
              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-brain text-indigo-600 animate-pulse text-2xl"></i>
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">QuestUp AI is analyzing...</h3>
            <p className="text-slate-400 text-sm mt-2">กำลังดึงข้อมูลจากชีทเรียนของคุณ</p>
          </div>
        )}

        {view === 'login' && <Login onLogin={handleLogin} />}
        {view === 'setup' && user && <SetupForm onStart={handleStartExam} />}
        {view === 'quiz' && session && (
          <Quiz questions={session.questions} language={session.language} onComplete={handleCompleteQuiz} />
        )}
        {view === 'analysis' && session && (
          <Analysis 
            questions={session.questions} 
            answers={userAnswers} 
            onRetry={() => setView('setup')}
            onFocusWeakness={(w) => handleStartExam(session.files, session.grade, session.language, session.questionCount, w)}
          />
        )}
      </main>
    </div>
  );
}
