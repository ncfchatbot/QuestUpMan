
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
  const [isAuthError, setIsAuthError] = useState<boolean>(false);
  const [errorDetail, setErrorDetail] = useState<string>("");

  useEffect(() => {
    // 1. ตรวจสอบสถานะ Key ทันที (Background)
    const checkKey = async () => {
      try {
        const selected = await (window as any).aistudio?.hasSelectedApiKey();
        if (!selected) {
          setHasKey(false);
        }
      } catch (e) {
        console.error("Key validation error", e);
      }
    };
    checkKey();

    // 2. โหลด User Session
    try {
      const savedUser = sessionStorage.getItem('questup_user');
      if (savedUser && savedUser !== 'undefined') {
        setUser(JSON.parse(savedUser));
        setView('setup');
      }
    } catch (e) {
      console.error("Session load error", e);
    }
  }, []);

  const handleConnectKey = async () => {
    try {
      if ((window as any).aistudio?.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        // รีเซ็ตสถานะทั้งหมดเพื่อให้แอปพร้อมเริ่มงานใหม่
        setHasKey(true);
        setIsAuthError(false);
        setErrorDetail("");
        console.log("New API Key selected successfully.");
      }
    } catch (e) {
      console.error("Select Key UI Failed", e);
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
    setIsAuthError(false);
    setErrorDetail("");

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
      console.error("Critical API Error:", msg);
      setErrorDetail(msg);

      // ตรวจสอบตามคำแนะนำ: หากเจอ "Requested entity was not found" หรือปัญหาเกี่ยวกับ Key
      if (
        msg.includes("not found") || 
        msg.includes("API key") || 
        msg.includes("403") || 
        msg.includes("401") || 
        msg.includes("billing")
      ) {
        setIsAuthError(true);
        setHasKey(false); // บังคับให้แสดงหน้าจอเลือก Key ใหม่
      } else {
        alert("เกิดข้อผิดพลาดในการสร้างข้อสอบ: " + msg);
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
      
      {/* การ์ดแจ้งเตือนปัญหาการเชื่อมต่อ - บังคับให้เห็นถ้าไม่มี Key หรือ Key ผิดพลาด */}
      {(!hasKey || isAuthError) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white rounded-[3.5rem] p-12 max-w-xl w-full text-center shadow-2xl border-b-[16px] border-indigo-600 animate-slideUp">
            <div className="w-24 h-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center text-rose-600 mx-auto mb-8 shadow-inner relative">
               <i className="fas fa-plug text-4xl"></i>
               <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center border-4 border-white">
                  <i className="fas fa-sync text-[10px] animate-spin"></i>
               </div>
            </div>
            
            <h2 className="text-4xl font-black text-slate-800 mb-6 tracking-tighter uppercase italic">
              {isAuthError ? "API Key มีปัญหา" : "เชื่อมต่อ AI ติวสอบ"}
            </h2>
            
            <div className="bg-slate-50 rounded-[2rem] p-8 text-left mb-10 border border-slate-100">
              <p className="text-base text-slate-700 font-bold mb-6 flex items-center gap-3">
                <i className="fas fa-tools text-indigo-500"></i> วิธีแก้ไขปัญหา:
              </p>
              <ul className="text-sm text-slate-500 space-y-5 font-medium">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">1</span>
                  <span>กดปุ่ม <b>"อัปเดตการเชื่อมต่อ"</b> แล้วเลือก Key ที่ผูกบัตรเครดิตแล้วเท่านั้น</span>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">2</span>
                  <span>หากยังพังอยู่ ให้เช็คที่ <b>Google AI Studio</b> ว่าโปรเจกต์ไม่ได้อยู่ในโหมด Free Tier (ต้องเป็น Paid)</span>
                </li>
              </ul>
              {errorDetail && (
                <div className="mt-6 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Raw Error Message:</p>
                  <p className="text-[11px] text-rose-600 font-mono break-all">{errorDetail}</p>
                </div>
              )}
            </div>

            <button 
              onClick={handleConnectKey}
              className="w-full py-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black text-2xl shadow-2xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-5 group"
            >
              อัปเดตการเชื่อมต่อ <i className="fas fa-bolt group-hover:scale-125 transition-transform"></i>
            </button>
            
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              className="inline-block mt-8 text-xs font-black text-slate-400 hover:text-indigo-500 transition-colors uppercase tracking-widest border-b-2 border-transparent hover:border-indigo-100"
            >
              ดูวิธีตั้งค่า Billing ที่ถูกต้อง <i className="fas fa-external-link-alt ml-1"></i>
            </a>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        {isLoading && (
          <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center animate-fadeIn">
            <div className="w-24 h-24 relative mb-8">
              <div className="absolute inset-0 border-8 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-8 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-brain text-indigo-600 animate-pulse text-3xl"></i>
              </div>
            </div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">QuestUp is Generating...</h3>
            <p className="text-slate-400 text-sm mt-3 font-bold">AI กำลังวิเคราะห์เนื้อหาและเก็งข้อสอบ</p>
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

      {/* ปุ่มลอยจัดการ Key - สำหรับเปลี่ยน Key ได้ตลอดเวลา */}
      <button 
        onClick={handleConnectKey}
        className="fixed bottom-8 right-8 z-[60] bg-white/90 backdrop-blur-xl border-2 border-slate-200 px-6 py-3 rounded-[2rem] shadow-2xl text-[10px] font-black text-slate-600 hover:bg-white hover:border-indigo-500 hover:text-indigo-600 transition-all active:scale-95 flex items-center gap-3 group"
      >
        <div className={`w-3 h-3 rounded-full ${isAuthError ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></div>
        UPDATE API SETTINGS <i className="fas fa-cog group-hover:rotate-180 transition-transform duration-700"></i>
      </button>
    </div>
  );
}
