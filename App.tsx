
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
    checkApiKey();
    
    try {
      const savedUser = sessionStorage.getItem('questup_user');
      if (savedUser && savedUser !== 'undefined') {
        setUser(JSON.parse(savedUser));
        setView('setup');
      }
    } catch (e) {
      console.error("Failed to parse saved user", e);
      sessionStorage.removeItem('questup_user');
    }
  }, []);

  // Check for API key availability via process.env or AI Studio dialog
  const checkApiKey = async () => {
    const envKey = process.env.API_KEY;
    if (!envKey) {
      // Accessing aistudio via any cast to bypass global type collision errors
      const selected = await (window as any).aistudio?.hasSelectedApiKey();
      setHasKey(!!selected);
    } else {
      setHasKey(true);
    }
  };

  // Open the AI Studio key selection dialog
  const handleOpenKeySelector = async () => {
    // Accessing aistudio via any cast to bypass global type collision errors
    await (window as any).aistudio?.openSelectKey();
    // Per instructions: assume key selection was successful to mitigate race condition
    setHasKey(true);
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
      console.error(err);
      if (err.message === "API_KEY_MISSING") {
        setHasKey(false);
      } else {
        alert("ขออภัย ระบบ AI หนาแน่นชั่วคราว กรุณาลองใหม่อีกครั้งใน 10 วินาที");
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

  const handleRetryWithWeaknesses = (weaknesses: string[]) => {
    if (session) {
      handleStartExam(session.files, session.grade, session.language, session.questionCount, weaknesses);
    }
  };

  const resetToSetup = () => {
    setSession(null);
    setView('setup');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Kanit']">
      <Header user={user} onHome={resetToSetup} onLogout={handleLogout} />
      
      {!hasKey && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center shadow-2xl animate-slideUp">
            <div className="w-20 h-20 questup-logo-bg rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl">
              <i className="fas fa-key text-3xl"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">เชื่อมต่อขุมพลัง AI</h2>
            <p className="text-slate-500 mb-6 font-medium">
              QuestUp ต้องใช้ API Key เพื่อประมวลผลข้อสอบอัจฉริยะ กรุณาเชื่อมต่อบัญชีของคุณ
            </p>
            <button 
              onClick={handleOpenKeySelector}
              className="w-full py-4 questup-logo-bg text-white rounded-2xl font-black text-lg shadow-lg hover:brightness-110 transition-all active:scale-95 mb-4"
            >
              ตั้งค่า API Key <i className="fas fa-plug ml-2"></i>
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              ทำไมฉันต้องตั้งค่า API Key? (Google Billing Docs)
            </a>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {isLoading && (
          <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className="relative w-28 h-28 mb-8">
              <div className="absolute inset-0 questup-logo-bg rounded-[2rem] animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-gamepad text-orange-400 text-5xl animate-bounce"></i>
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tighter">QuestUp AI (Pro)</h2>
            <p className="text-slate-500 max-w-sm font-medium">
              กำลังใช้สมองกลรุ่น Pro วิเคราะห์เนื้อหาอย่างละเอียด...
            </p>
          </div>
        )}

        {view === 'login' && <Login onLogin={handleLogin} />}
        {view === 'setup' && user && <SetupForm onStart={handleStartExam} />}
        
        {view === 'quiz' && session && (
          <Quiz 
            questions={session.questions} 
            language={session.language}
            onComplete={handleCompleteQuiz} 
          />
        )}
        
        {view === 'analysis' && session && (
          <Analysis 
            questions={session.questions} 
            answers={userAnswers} 
            onRetry={resetToSetup}
            onFocusWeakness={handleRetryWithWeaknesses}
          />
        )}
      </main>
    </div>
  );
}
