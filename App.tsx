import React, { useEffect, useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import { MockAPI } from './services/api';
import { User } from './types';

const App: React.FC = () => {
  const [booting, setBooting] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [username, setUsername] = useState((import.meta as any).env?.VITE_ADMIN_USERNAME || 'admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const restore = async () => {
      try {
        const user = await MockAPI.getCurrentUser();
        setCurrentUser(user);
      } catch (_error) {
        setCurrentUser(null);
      } finally {
        setBooting(false);
      }
    };

    restore();
  }, []);

  const handleLogin = async () => {
    setSubmitting(true);
    setError('');
    try {
      const user = await MockAPI.login(username.trim(), password);
      setCurrentUser(user);
      setPassword('');
    } catch (e: any) {
      setError(e?.message || '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (booting) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">加载中...</div>;
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">商家后台登录</h1>
          <p className="mb-6 text-sm text-gray-500">请输入管理员账号与密码</p>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="用户名"
              className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="密码"
              className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLogin();
                }
              }}
            />

            {error ? <div className="text-sm text-red-500">{error}</div> : null}

            <button
              type="button"
              disabled={submitting}
              onClick={handleLogin}
              className="w-full rounded-lg bg-[#07c160] p-3 text-sm font-bold text-white disabled:opacity-70"
            >
              {submitting ? '登录中...' : '登录'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard
      onLogout={() => {
        MockAPI.logout();
        setCurrentUser(null);
      }}
      api={MockAPI}
    />
  );
};

export default App;
