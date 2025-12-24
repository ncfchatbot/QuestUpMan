
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
  
  // ปรับให้เป็น true ไว้ก่อน เพื่อลดการวนลูปหน้าแรก
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [isBillingError, setIsBillingError] = useState<boolean>(false);
  const [apiRawError, setApiRawError] = useState<string>("");

  useEffect(() => {
    // โหลดข้อมูลผู้ใช้
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
        
        // ตามกฎ Race Condition: เมื่อกดเลือกแล้ว ให้ถือว่าสำเร็จและสลัดลูปทิ้งทันที
        setHasKey(true);
        setIsBillingError(false);
        setApiRawError("");
        
        // แจ้งเตือนผู้ใช้เล็กน้อย
        console.log("Key selection triggered. App state reset.");
      }
    } catch (e) {
      console.error("Select Key Error", e);
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
    setApiRawError("");

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
      const msg = err.message || "Unknown Error";
      console.error("QuestUp API Error:", msg);
      setApiRawError(msg);

      // ถ้าเจอ Error เกี่ยวกับโปรเจกต์หรือสิทธิ์การใช้งาน
      if (msg.includes("not found") || msg.includes("billing") || msg.includes("403") || msg.includes("401")) {
        setIsBillingError(true);
        setHasKey(false);
      } else {
        alert("เกิดข้อผิดพลาด: " + msg);
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
      
      {/* หน้าจอแจ้งเตือนปัญหา (Overlay) - ปรับปรุงให้ไม่วนลูปและมีข้อมูล Error จริง */}
      {isBillingError && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-lg w-full text-center shadow-2xl border-t-[12px] border-indigo-600 animate-slideUp">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-600 mx-auto mb-6">
              <i className="fas fa-exclamation-triangle text-3xl"></i>
            </div>
            
            <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tighter">
              การเชื่อมต่อถูกปฏิเสธ
            </h2>
            <p className="text-slate-500 text-sm mb-6">Google AI แจ้งว่าโปรเจกต์ของคุณยังไม่พร้อมใช้งาน</p>
            
            <div className="bg-slate-50 rounded-2xl p-5 text-left mb-6 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ข้อความจากระบบ (Raw Error):</p>
              <code className="text-[10px] text-rose-500 block break-all font-mono bg-rose-50 p-2 rounded-lg border border-rose-100">
                {apiRawError || "Project linkage failed or billing not active yet."}
              </code>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleConnectKey}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                เลือก API Key ใหม่ <i className="fas fa-key"></i>
              </button>
              <button 
                onClick={() => { setIsBillingError(false); setHasKey(true); }}
                className="w-full py-4 text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ลองกดใหม่อีกครั้ง (ถ้าผูกบัตรแล้ว)
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        {isLoading && (
          <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h3 className="text-xl font-black text-slate-800 tracking-tighter uppercase italic">QuestUp AI is thinking...</h3>
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

      {/* Floating Status Bar */}
      <div className="fixed bottom-6 right-6 z-[60] flex gap-2">
         <button 
          onClick={handleConnectKey}
          className="bg-white/90 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-2xl shadow-xl text-[10px] font-black text-slate-500 hover:bg-white transition-all flex items-center gap-2"
        >
          <div className={`w-2 h-2 rounded-full ${isBillingError ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
          RE-CONNECT AI
        </button>
      </div>
    </div>
  );
}
