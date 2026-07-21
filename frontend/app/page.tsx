'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, clearTokens } from '../lib/api';
import WorkspaceSwitcher from '../components/workspace-switcher';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
}

export default function Home() {
  const router = useRouter();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);

  // Authenticate user on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Fetch logged in user profile (optional, mock fallback)
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      // Just retrieve JWT context details or get user profile endpoint
      // We can use a test protected endpoint to extract user details
      const response = await api.get('/protected');
      return {
        id: response.data.user_id,
        email: response.data.email,
        name: 'Thành viên Asana',
        avatar_url: '',
      };
    },
    enabled: isMounted && !!getAccessToken(),
  });

  const handleLogout = () => {
    clearTokens();
    router.push('/login');
  };

  const navigateToMembers = () => {
    if (activeWorkspaceId) {
      router.push(`/workspaces/${activeWorkspaceId}/members`);
    } else {
      alert('Vui lòng chọn hoặc tạo mới một Workspace trước');
    }
  };

  if (!isMounted || !getAccessToken()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-400">Đang kiểm tra bảo mật...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e1b4b_0%,transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,#311042_0%,transparent_50%)]" />

      {/* Sidebar Panel */}
      <aside className="relative z-10 flex w-72 shrink-0 flex-col justify-between border-r border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl">
        <div className="space-y-6">
          {/* Header Title */}
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <span className="bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              Antigravity Asana
            </span>
          </div>

          {/* Workspace Switcher */}
          <div className="pt-2">
            <label className="mb-1.5 block px-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Không gian làm việc
            </label>
            <WorkspaceSwitcher onWorkspaceChange={(id) => setActiveWorkspaceId(id)} />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-4">
            <button className="flex w-full items-center gap-3 rounded-xl bg-indigo-600/10 px-4 py-3 text-sm font-semibold text-indigo-400 transition">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"
                />
              </svg>
              Trang Tổng Quan (Dashboard)
            </button>

            <button
              onClick={navigateToMembers}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <svg
                className="h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              Quản lý Thành viên (Members)
            </button>

            <button
              disabled
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-500"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
                />
              </svg>
              Danh sách Công việc (Tasks)
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase">
                E4/5
              </span>
            </button>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 font-bold text-slate-300">
              {profile?.email ? profile.email.substring(0, 1).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-semibold text-white">
                {profile?.email || 'Đang tải...'}
              </p>
              <p className="text-[10px] font-medium text-slate-500">Phiên đăng nhập bảo mật</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/10 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500 hover:text-white"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Đăng xuất tài khoản
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="relative z-10 mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center space-y-6 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
        </div>
        <h1 className="bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
          Chào mừng trở lại dự án Asana!
        </h1>
        <p className="max-w-md text-sm leading-6 text-slate-400">
          Không gian quản lý công việc tối giản, hỗ trợ chia sẻ dự án, lập kế hoạch công việc và
          cộng tác tức thì cùng đồng nghiệp.
        </p>

        <div className="flex gap-4 pt-4">
          <button
            onClick={navigateToMembers}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            Quản lý thành viên trong Workspace
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
}
