
import React, { useState } from 'react';
import { User } from '../types.ts';

interface HeaderProps {
  user: User | null;
  onHome: () => void;
  onLogout: () => void;
  onManageKey: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onHome, onLogout, onManageKey }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-blue-100">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={onHome}
        >
          <div className="w-10 h-10 questup-logo-bg rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform relative overflow-hidden">
            <i className="fas fa-bolt text-yellow-300 text-lg z-10"></i>
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent hidden sm:block tracking-tighter">
            QuestUp
          </h1>
        </div>
        
        <nav className="flex items-center gap-4">
          {user ? (
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 p-1.5 pr-4 rounded-full border border-slate-100 transition-all"
              >
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full bg-white border" />
                <div className="text-left hidden xs:block">
                  <p className="text-xs font-bold text-slate-800 leading-none">{user.name}</p>
                </div>
                <i className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform ${showMenu ? 'rotate-180' : ''}`}></i>
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-slideUp ring-8 ring-slate-900/5">
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">นักเรียนที่เข้าสู่ระบบ</p>
                    <p className="text-sm font-black truncate text-slate-800">{user.email}</p>
                  </div>
                  <div className="p-2">
                    <button onClick={onHome} className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 text-slate-600 rounded-xl flex items-center gap-3 transition-colors">
                      <i className="fas fa-home text-blue-500 w-4"></i> หน้าแรก
                    </button>
                    {/* 3. เมนูใน Profile Dropdown */}
                    <button 
                      onClick={() => {
                        onManageKey();
                        setShowMenu(false);
                      }} 
                      className="w-full px-4 py-3 text-left text-sm hover:bg-indigo-50 text-indigo-600 rounded-xl flex items-center gap-3 font-black group transition-colors"
                    >
                      <i className="fas fa-key text-indigo-500 w-4 group-hover:rotate-12 transition-transform"></i> จัดการ API Key
                    </button>
                    <hr className="my-2 border-slate-50" />
                    <button onClick={onLogout} className="w-full px-4 py-3 text-left text-sm hover:bg-rose-50 text-rose-600 rounded-xl flex items-center gap-3 transition-colors">
                      <i className="fas fa-sign-out-alt w-4"></i> ออกจากระบบ
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg shadow-blue-100">
              เข้าสู่ระบบ
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
