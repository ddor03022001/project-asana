'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, clearTokens } from '../lib/api';
import WorkspaceSwitcher from '../components/workspace-switcher';
import CreateProjectModal from '../components/create-project-modal';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
}

interface Project {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  icon: string;
  created_by: string;
  created_at: string;
}

export default function Home() {
  const router = useRouter();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  // Authenticate user on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Fetch logged in user profile
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
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

  // Fetch projects list when activeWorkspaceId is present
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects', activeWorkspaceId],
    queryFn: async () => {
      const response = await api.get(`/workspaces/${activeWorkspaceId}/projects`);
      return response.data;
    },
    enabled: isMounted && !!activeWorkspaceId,
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

  // Helper to render customized project icons
  const renderProjectIcon = (iconName: string, color: string) => {
    const props = { className: 'h-6 w-6', style: { color } };
    switch (iconName) {
      case 'target':
        return (
          <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <circle cx="12" cy="12" r="6" strokeWidth={2} />
            <circle cx="12" cy="12" r="2" strokeWidth={2} />
          </svg>
        );
      case 'calendar':
        return (
          <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
            <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} />
            <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} />
            <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
          </svg>
        );
      case 'briefcase':
        return (
          <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" strokeWidth={2} />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" strokeWidth={2} />
          </svg>
        );
      case 'check-square':
        return (
          <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <polyline points="9 11 12 14 22 4" strokeWidth={2} />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeWidth={2} />
          </svg>
        );
      case 'folder':
      default:
        return (
          <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeWidth={2} />
          </svg>
        );
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
      {/* Background cosmic gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e1b4b_0%,transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,#311042_0%,transparent_50%)]" />

      {/* Sidebar Panel */}
      <aside className="relative z-10 flex w-72 shrink-0 flex-col justify-between border-r border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl">
        <div className="space-y-6">
          {/* Header Title */}
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <nav className="space-y-1.5 pt-2">
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
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              Quản lý Thành viên (Members)
            </button>
          </nav>

          {/* Sidebar Projects List Section */}
          {activeWorkspaceId && (
            <div className="border-t border-white/5 pt-4 space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Dự án đã tham gia
                </label>
                <button
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="rounded-md p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  title="Tạo dự án mới"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {projectsLoading ? (
                  <p className="px-3 py-1.5 text-xs text-slate-500">Đang tải...</p>
                ) : projects && projects.length > 0 ? (
                  projects.map((pj) => (
                    <button
                      key={pj.id}
                      onClick={() => router.push(`/projects/${pj.id}`)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-850 hover:text-white"
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: pj.color }} />
                      <span className="truncate">{pj.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-1.5 text-xs text-slate-500 italic">Chưa có dự án nào</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Card & Logout */}
        <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-950 font-bold text-indigo-300 border border-indigo-500/20">
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
      <main className="relative z-10 flex-1 overflow-y-auto p-8">
        {!activeWorkspaceId ? (
          // Welcome state when no workspace is selected
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </div>
            <h1 className="bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              Chào mừng trở lại Antigravity Asana!
            </h1>
            <p className="text-sm leading-6 text-slate-400">
              Hãy chọn một không gian làm việc ở danh sách bên trái hoặc tạo mới một không gian làm việc để bắt đầu quản lý dự án và công việc của bạn.
            </p>
          </div>
        ) : (
          // Dashboard view for the active workspace
          <div className="space-y-8 max-w-5xl mx-auto">
            {/* Header banner */}
            <div className="flex items-center justify-between border-b border-white/5 pb-5">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Trang Tổng Quan Dự Án</h1>
                <p className="text-xs text-slate-400">Quản lý toàn bộ dự án và thành viên thuộc không gian làm việc của bạn.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={navigateToMembers}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-850 hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Quản lý Thành viên
                </button>
                <button
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/10 transition hover:bg-indigo-500"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Tạo Dự Án Mới
                </button>
              </div>
            </div>

            {/* Projects cards grid */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Dự án của bạn</h2>
              
              {projectsLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-32 w-full animate-pulse rounded-2xl border border-white/5 bg-slate-900/20" />
                  ))}
                </div>
              ) : projects && projects.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((pj) => (
                    <div
                      key={pj.id}
                      onClick={() => router.push(`/projects/${pj.id}`)}
                      className="group cursor-pointer rounded-2xl border border-white/5 bg-slate-900/20 p-5 backdrop-blur-md transition hover:scale-[1.02] hover:border-white/10 hover:bg-slate-900/40"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 border border-white/5 group-hover:border-white/10 transition">
                          {renderProjectIcon(pj.icon, pj.color)}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                          Dự án
                        </span>
                      </div>
                      
                      <h3 className="truncate text-base font-bold text-white transition group-hover:text-indigo-400">
                        {pj.name}
                      </h3>
                      
                      <p className="mt-1 text-[11px] text-slate-500">
                        Khởi tạo lúc: {new Date(pj.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/10 p-12 text-center">
                  <div className="mb-3 rounded-full bg-slate-950 p-3 border border-white/5 text-slate-400">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2m16 4h-2a2 2 0 00-2 2v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1a2 2 0 00-2-2H2" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-white">Chưa có dự án nào</h3>
                  <p className="mt-1 max-w-xs text-xs text-slate-500 leading-relaxed">
                    Dự án giúp bạn quản lý danh sách công việc riêng biệt. Hãy nhấn nút bên dưới để tạo dự án đầu tiên.
                  </p>
                  <button
                    onClick={() => setIsCreateProjectOpen(true)}
                    className="mt-4 rounded-xl bg-indigo-600/10 px-4 py-2 text-xs font-semibold text-indigo-400 transition hover:bg-indigo-600 hover:text-white"
                  >
                    Tạo Dự Án Đầu Tiên
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Render Project Creation modal */}
      {activeWorkspaceId && (
        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          onClose={() => setIsCreateProjectOpen(false)}
          workspaceId={activeWorkspaceId}
          onSuccess={(newProjectId) => {
            // Automatically navigate to the new project detail view
            router.push(`/projects/${newProjectId}`);
          }}
        />
      )}
    </div>
  );
}
