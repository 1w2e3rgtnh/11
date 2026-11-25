import { useState, type FormEvent } from 'react';
import { ArrowLeft, LogIn, UserPlus } from 'lucide-react';

interface AuthViewProps {
  loading: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onBackToList: () => void;
}

export function AuthView({ loading, onSignIn, onSignUp, onBackToList }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await onSignIn(email.trim(), password);
    } else {
      await onSignUp(email.trim(), password);
    }
  };

  return (
    <section className="max-w-md mx-auto py-8 sm:py-12">
      <button
        type="button"
        onClick={onBackToList}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 mb-6 transition-colors whitespace-nowrap"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        예약 현황판으로 돌아가기
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {mode === 'login' ? '로그인' : '회원가입'}
          </h1>
          <p className="text-sm text-slate-600 mt-1.5">
            {mode === 'login'
              ? '학교 이메일과 비밀번호로 로그인해 공간과 기자재를 예약하세요.'
              : '이메일과 비밀번호를 입력해 새 계정을 만드세요.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2.5 px-4 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`py-2.5 px-4 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              mode === 'signup'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 mb-1.5">
              이메일
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소를 입력하세요"
              autoComplete="email"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              비밀번호
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap"
          >
            {mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" aria-hidden="true" />
                {loading ? '로그인 중...' : '로그인하기'}
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                {loading ? '가입 처리 중...' : '회원가입하기'}
              </>
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
