
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

  useEffect(() => {
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
      if (questions.length === 0) {
         throw new Error("Could not generate questions");
      }
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
      const msg = err.message?.includes("API Key") 
        ? "ระบบขัดข้อง: ไม่พบ API Key สำหรับประมวลผล กรุณาตรวจสอบการตั้งค่า Environment Variable"
        : "AI ไม่สามารถสร้างข้อสอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้งใน 1 นาที";
      alert(msg);
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
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {isLoading && (
          <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className="relative w-28 h-28 mb-8">
              <div className="absolute inset-0 questup-logo-bg rounded-[2rem] animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-gamepad text-orange-400 text-5xl animate-bounce"></i>
              </div>
              <div className="absolute -top-4 -right-4 w-10 h-10 questup-logo-bg rounded-full flex items-center justify-center text-white border-2 border-white animate-spin-slow">
                 <i className="fas fa-star text-xs"></i>
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tighter">QuestUp AI</h2>
            <p className="text-slate-500 max-w-sm font-medium">
              กำลังวิเคราะห์ข้อมูลและเก็งข้อสอบให้ตรงจุดที่สุด...
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
