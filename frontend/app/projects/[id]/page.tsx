'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccessToken, clearTokens, api } from '../../../lib/api';
import WorkspaceSwitcher from '@/components/workspace-switcher';
import CreateProjectModal from '@/components/create-project-modal';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { CalendarView } from '@/components/calendar/calendar-view';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { useWebSocket } from '@/hooks/use-websocket';

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

interface WorkspaceMemberDetailed {
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
  role: string;
}

interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date?: string;
  assignee_id?: string;
  position: number;
  created_at: string;
  assignee?: {
    id: string;
    email: string;
    name: string;
    avatar_url: string;
  };
}

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
}

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'board' | 'calendar'>('list');

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');

  // Creation inline states
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Selected Task for detail drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Authenticate user on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Profile hook
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

  // Project details hook
  const { data: project, error: projectError } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${projectId}`);
      return response.data;
    },
    enabled: isMounted && !!projectId,
  });

  // Set workspace ID when project loads
  useEffect(() => {
    if (project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveWorkspaceId(project.workspace_id);
    }
  }, [project]);

  // Projects list hook
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects', activeWorkspaceId],
    queryFn: async () => {
      const response = await api.get(`/workspaces/${activeWorkspaceId}/projects`);
      return response.data;
    },
    enabled: isMounted && !!activeWorkspaceId,
  });

  // Workspace members hook (for assignees selection)
  const { data: workspaceMembers } = useQuery<WorkspaceMemberDetailed[]>({
    queryKey: ['workspace-members', activeWorkspaceId],
    queryFn: async () => {
      const response = await api.get(`/workspaces/${activeWorkspaceId}/members`);
      return response.data;
    },
    enabled: isMounted && !!activeWorkspaceId,
  });

  // Tasks hook with dynamic filter parameters
  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<Task[]>({
    queryKey: ['tasks', projectId, filterStatus, filterPriority, filterAssignee],
    queryFn: async () => {
      const paramsList: string[] = [];
      if (filterStatus) paramsList.push(`status=${filterStatus}`);
      if (filterPriority) paramsList.push(`priority=${filterPriority}`);
      if (filterAssignee) paramsList.push(`assignee_id=${filterAssignee}`);

      const queryString = paramsList.length > 0 ? `?${paramsList.join('&')}` : '';
      const response = await api.get(`/projects/${projectId}/tasks${queryString}`);
      return response.data;
    },
    enabled: isMounted && !!projectId,
  });

  // Listen for real-time WebSocket updates (comments, task status, subtasks)
  useWebSocket((msg) => {
    if (msg.type === 'COMMENT_CREATED' || msg.type === 'TASK_UPDATED') {
      refetchTasks();
      if (selectedTaskId) {
        queryClient.invalidateQueries({ queryKey: ['task-details', selectedTaskId] });
        queryClient.invalidateQueries({ queryKey: ['comments', selectedTaskId] });
        queryClient.invalidateQueries({ queryKey: ['subtasks', selectedTaskId] });
      }
    }
  });

  const myMember = (workspaceMembers || []).find((m) => m.user_id === profile?.id);
  const isOwnerOrAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';

  // Task creation mutation
  const createTaskMutation = useMutation({
    mutationFn: async (payload: { title: string }) => {
      const response = await api.post(`/projects/${projectId}/tasks`, payload);
      return response.data;
    },
    onSuccess: () => {
      setNewTaskTitle('');
      setIsAddingTask(false);
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  // Task inline creation handler
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    createTaskMutation.mutate({ title: newTaskTitle.trim() });
  };

  const handleKanbanUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      refetchTasks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      alert(err.response?.data?.error || 'Không thể cập nhật trạng thái công việc');
      refetchTasks();
    }
  };

  const handleKanbanUpdatePosition = async (taskId: string, newPosition: number) => {
    try {
      await api.patch(`/tasks/${taskId}/position`, { position: newPosition });
      refetchTasks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      alert(err.response?.data?.error || 'Không thể di chuyển vị trí công việc');
      refetchTasks();
    }
  };

  const handleKanbanAddTask = async (title: string, status: string) => {
    try {
      await api.post(`/projects/${projectId}/tasks`, { title, status });
      refetchTasks();
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const handleCalendarDateClick = async (dateStr: string) => {
    const title = prompt(`Tạo công việc mới cho ngày ${new Date(dateStr).toLocaleDateString('vi-VN')}:`);
    if (title && title.trim()) {
      try {
        await api.post(`/projects/${projectId}/tasks`, {
          title: title.trim(),
          due_date: new Date(dateStr).toISOString(),
        });
        refetchTasks();
      } catch (err) {
        console.error('Failed to create task from calendar:', err);
      }
    }
  };

  const handleLogout = () => {
    clearTokens();
    router.push('/login');
  };

  if (projectError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center">
        <h2 className="text-xl font-bold text-rose-400">Không tìm thấy dự án</h2>
        <p className="mt-2 text-sm text-slate-500">Dự án này không tồn tại hoặc bạn không có quyền truy cập.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Quay lại Trang Chủ
        </button>
      </div>
    );
  }

  if (!isMounted || !getAccessToken() || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-400">Đang đồng bộ dữ liệu dự án...</p>
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
          <div
            onClick={() => router.push('/')}
            className="flex items-center gap-3 px-1 cursor-pointer hover:opacity-80 transition"
          >
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
              Asano
            </span>
          </div>

          {/* Workspace Switcher */}
          <div className="pt-2">
            <label className="mb-1.5 block px-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Không gian làm việc
            </label>
            <WorkspaceSwitcher
              onWorkspaceChange={(id) => {
                if (activeWorkspaceId && id !== activeWorkspaceId) {
                  router.push('/');
                }
              }}
            />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            <button
              onClick={() => router.push('/')}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
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
              onClick={() => router.push(`/workspaces/${activeWorkspaceId}/members`)}
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
                {projects && projects.length > 0 ? (
                  projects.map((pj) => (
                    <button
                      key={pj.id}
                      onClick={() => router.push(`/projects/${pj.id}`)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition ${projectId === pj.id
                          ? 'bg-slate-800 text-white font-semibold border border-white/5'
                          : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                        }`}
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
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Project Header Banner */}
        <header className="border-b border-white/5 bg-slate-900/10 px-8 py-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: project.color }} />
              <h1 className="text-xl font-bold text-white tracking-tight">{project.name}</h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Notification Bell Dropdown */}
              <NotificationDropdown onSelectTask={(id) => setSelectedTaskId(id)} />

              {/* Tab Navigation Switcher */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5">
                <button
                  onClick={() => setActiveTab('list')}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${activeTab === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Danh sách (List)
                </button>
                <button
                  onClick={() => setActiveTab('board')}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${activeTab === 'board' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Kanban Board
                </button>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${activeTab === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Lịch (Calendar)
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Tab content area */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'list' ? (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Filter controls panel */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-slate-900/10 p-4 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Tất cả</option>
                      <option value="todo">Cần làm (Todo)</option>
                      <option value="in_progress">Đang làm</option>
                      <option value="done">Hoàn thành</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Độ ưu tiên</label>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Tất cả</option>
                      <option value="low">Thấp</option>
                      <option value="medium">Trung bình</option>
                      <option value="high">Cao</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Người nhận</label>
                    <select
                      value={filterAssignee}
                      onChange={(e) => setFilterAssignee(e.target.value)}
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Tất cả thành viên</option>
                      {workspaceMembers?.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isOwnerOrAdmin && (
                  <button
                    onClick={() => setIsAddingTask(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/10 hover:bg-indigo-500 transition"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Tạo Công Việc
                  </button>
                )}
              </div>

              {/* Tasks List Table */}
              <div className="rounded-2xl border border-white/5 bg-slate-900/10 overflow-hidden backdrop-blur-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-slate-950/20 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-5">Tên công việc</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4">Độ ưu tiên</th>
                      <th className="py-3 px-4">Hạn chót</th>
                      <th className="py-3 px-4">Người nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Inline Task Creator Row */}
                    {isAddingTask && (
                      <tr className="border-b border-white/5 bg-indigo-600/5">
                        <td colSpan={5} className="p-3">
                          <form onSubmit={handleCreateTask} className="flex gap-3">
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              placeholder="Nhập tiêu đề công việc và nhấn Enter..."
                              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                              autoFocus
                              disabled={createTaskMutation.isPending}
                            />
                            <button
                              type="submit"
                              disabled={createTaskMutation.isPending}
                              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingTask(false);
                                setNewTaskTitle('');
                              }}
                              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400"
                            >
                              Hủy
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}

                    {tasksLoading ? (
                      [1, 2, 3].map((n) => (
                        <tr key={n} className="border-b border-white/5 animate-pulse">
                          <td colSpan={5} className="py-4 px-5 h-12 bg-slate-900/10" />
                        </tr>
                      ))
                    ) : tasks && tasks.length > 0 ? (
                      tasks.map((task) => (
                        <tr
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition"
                        >
                          <td className="py-3.5 px-5 text-sm font-semibold text-white">
                            {task.title}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium">
                            <span className={`inline-flex rounded-full px-2 py-0.5 capitalize border ${task.status === 'done'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : task.status === 'in_progress'
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}>
                              {task.status === 'done' ? 'Đã hoàn thành' : task.status === 'in_progress' ? 'Đang làm' : 'Cần làm'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium">
                            <span className={`capitalize ${task.priority === 'high'
                                ? 'text-rose-400'
                                : task.priority === 'medium'
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }`}>
                              {task.priority === 'high' ? 'Cao' : task.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400 font-medium">
                            {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium">
                            {task.assignee ? (
                              <div className="flex items-center gap-1.5">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-950 font-bold text-[9px] text-indigo-300 border border-indigo-500/20 uppercase">
                                  {task.assignee.email.substring(0, 1)}
                                </div>
                                <span className="text-slate-300 truncate max-w-[120px]">{task.assignee.name || task.assignee.email}</span>
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-slate-500 font-semibold italic">
                          Chưa có công việc nào khớp với bộ lọc của bạn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'board' ? (
            <div className="h-full overflow-hidden p-2">
              <KanbanBoard
                tasks={(tasks || []).map((t) => ({
                  ...t,
                  assignee_name: t.assignee?.name || t.assignee?.email,
                  assignee_avatar: t.assignee?.avatar_url,
                  position: t.position || 65536.0,
                }))}
                onSelectTask={(id) => setSelectedTaskId(id)}
                onUpdateStatus={handleKanbanUpdateStatus}
                onUpdatePosition={handleKanbanUpdatePosition}
                onAddTask={isOwnerOrAdmin ? handleKanbanAddTask : undefined}
              />
            </div>
          ) : (
            <div className="h-full overflow-hidden p-2">
              <CalendarView
                tasks={tasks || []}
                onSelectTask={(id) => setSelectedTaskId(id)}
                onDateClick={handleCalendarDateClick}
              />
            </div>
          )}
        </div>
      </main>

      {/* Slide-over Task Detail Panel drawer */}
      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onRefresh={refetchTasks}
          workspaceMembers={workspaceMembers || []}
          currentUserId={profile?.id}
          currentUserRole={(workspaceMembers || []).find((m) => m.user_id === profile?.id)?.role || 'member'}
        />
      )}

      {/* Render Project Creation modal */}
      {activeWorkspaceId && (
        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          onClose={() => setIsCreateProjectOpen(false)}
          workspaceId={activeWorkspaceId}
        />
      )}
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: TaskDetailDrawer Panel
// ==========================================
interface TaskDetailDrawerProps {
  taskId: string;
  onClose: () => void;
  onRefresh: () => void;
  workspaceMembers: WorkspaceMemberDetailed[];
  currentUserId?: string;
  currentUserRole?: string;
}

interface TagItem {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

interface AttachmentItem {
  id: string;
  task_id: string;
  uploaded_by?: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface CommentItem {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
}

function TaskDetailDrawer({ taskId, onClose, onRefresh, workspaceMembers, currentUserId, currentUserRole }: TaskDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('todo');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Comment state
  const [newCommentText, setNewCommentText] = useState('');

  // Tag creation state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  // File upload loading state
  const [isUploading, setIsUploading] = useState(false);

  // Fetch task details inside drawer
  const { data: task, isLoading: taskLoading } = useQuery<Task>({
    queryKey: ['task-details', taskId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${taskId}`);
      return response.data;
    },
  });

  // Fetch current user profile to determine comment delete permissions
  const { data: currentUser } = useQuery<{ id: string; email: string }>({
    queryKey: ['current-user'],
    queryFn: async () => {
      const response = await api.get('/protected');
      return { id: response.data.user_id, email: response.data.email };
    },
  });

  // Fetch subtask checklists
  const { data: subtasks, refetch: refetchSubtasks } = useQuery<Subtask[]>({
    queryKey: ['subtasks', taskId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${taskId}/subtasks`);
      return response.data;
    },
  });

  // Fetch task tags
  const { data: taskTags, refetch: refetchTaskTags } = useQuery<TagItem[]>({
    queryKey: ['task-tags', taskId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${taskId}/tags`);
      return response.data;
    },
  });

  // Fetch all workspace tags
  const { data: workspaceTags, refetch: refetchWorkspaceTags } = useQuery<TagItem[]>({
    queryKey: ['workspace-tags', task?.workspace_id],
    queryFn: async () => {
      const response = await api.get(`/workspaces/${task?.workspace_id}/tags`);
      return response.data;
    },
    enabled: !!task?.workspace_id,
  });

  // Fetch task attachments
  const { data: attachments, refetch: refetchAttachments } = useQuery<AttachmentItem[]>({
    queryKey: ['attachments', taskId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${taskId}/attachments`);
      return response.data;
    },
  });

  // Fetch task comments
  const { data: comments, refetch: refetchComments } = useQuery<CommentItem[]>({
    queryKey: ['comments', taskId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${taskId}/comments`);
      return response.data;
    },
  });

  // Populate state on load
  useEffect(() => {
    if (task) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setAssigneeId(task.assignee_id || '');
      if (task.due_date) {
        setDueDate(new Date(task.due_date).toISOString().substring(0, 10));
      } else {
        setDueDate('');
      }
    }
  }, [task]);

  // Task property mutations
  const updateTaskMutation = useMutation({
    mutationFn: async (payload: Partial<Task>) => {
      return await api.patch(`/tasks/${taskId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
      onRefresh();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Không thể cập nhật công việc');
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
      onRefresh();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Không thể cập nhật trạng thái công việc');
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
    },
  });

  // Subtask mutations
  const createSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      return await api.post(`/tasks/${taskId}/subtasks`, { title });
    },
    onSuccess: () => {
      setNewSubtaskTitle('');
      refetchSubtasks();
    },
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ subtaskId, isDone }: { subtaskId: string; isDone: boolean }) => {
      return await api.patch(`/subtasks/${subtaskId}`, { is_done: isDone });
    },
    onSuccess: () => {
      refetchSubtasks();
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId: string) => {
      return await api.delete(`/subtasks/${subtaskId}`);
    },
    onSuccess: () => {
      refetchSubtasks();
    },
  });

  // Tag mutations
  const createTagMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      return await api.post(`/workspaces/${task?.workspace_id}/tags`, { name, color });
    },
    onSuccess: () => {
      setNewTagName('');
      setIsCreatingTag(false);
      refetchWorkspaceTags();
    },
  });

  const attachTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return await api.post(`/tasks/${taskId}/tags/${tagId}`);
    },
    onSuccess: () => {
      refetchTaskTags();
    },
  });

  const detachTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return await api.delete(`/tasks/${taskId}/tags/${tagId}`);
    },
    onSuccess: () => {
      refetchTaskTags();
    },
  });

  // Comment mutations
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return await api.post(`/tasks/${taskId}/comments`, { content });
    },
    onSuccess: () => {
      setNewCommentText('');
      refetchComments();
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return await api.delete(`/comments/${commentId}`);
    },
    onSuccess: () => {
      refetchComments();
    },
  });

  // Attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      return await api.delete(`/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      refetchAttachments();
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      return await api.delete(`/tasks/${taskId}`);
    },
    onSuccess: () => {
      onRefresh();
      onClose();
    },
  });

  const handleFieldBlur = () => {
    updateTaskMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      priority,
      assignee_id: assigneeId ? assigneeId : undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    updateStatusMutation.mutate(newStatus);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    createSubtaskMutation.mutate(newSubtaskTitle.trim());
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    createCommentMutation.mutate(newCommentText.trim());
  };

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    createTagMutation.mutate({ name: newTagName.trim(), color: newTagColor });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Tệp tin vượt quá dung lượng cho phép (Tối đa 5MB)');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      refetchAttachments();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      alert(err.response?.data?.error || 'Không thể tải tệp tin lên');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isAssignee = !!(task?.assignee_id && currentUserId && task.assignee_id === currentUserId);
  const canEditTaskFields = isOwnerOrAdmin || isAssignee;

  if (taskLoading) {
    return (
      <div className="fixed inset-y-0 right-0 z-40 w-96 border-l border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex h-full items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[460px] flex flex-col border-l border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-250">
      {/* Header operations */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 bg-slate-950/20">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chi Tiết Công Việc</span>
        <div className="flex items-center gap-3">
          {isOwnerOrAdmin && (
            <button
              onClick={() => {
                if (confirm('Bạn có chắc chắn muốn xóa công việc này không?')) {
                  deleteTaskMutation.mutate();
                }
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition"
              title="Xóa công việc (Chỉ Admin/Owner)"
            >
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Details settings form */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
        {/* Title editing */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleFieldBlur}
            disabled={!canEditTaskFields}
            title={!canEditTaskFields ? "Chỉ Admin/Owner hoặc Người được gán task mới có quyền sửa tiêu đề" : ""}
            className="w-full bg-transparent text-lg font-bold text-white border border-transparent hover:border-slate-800 focus:border-indigo-500 focus:bg-slate-950/40 rounded-lg px-2 py-1 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
            placeholder="Tiêu đề công việc"
          />
        </div>

        {/* Tags Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhãn thẻ (Tags)</label>
            {canEditTaskFields && (
              <button
                onClick={() => setIsCreatingTag(!isCreatingTag)}
                className="text-[11px] font-medium text-indigo-400 hover:underline"
              >
                {isCreatingTag ? 'Hủy' : '+ Tạo nhãn mới'}
              </button>
            )}
          </div>

          {/* Attached tags list */}
          <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
            {taskTags && taskTags.length > 0 ? (
              taskTags.map((tg) => (
                <span
                  key={tg.id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm"
                  style={{ backgroundColor: tg.color }}
                >
                  {tg.name}
                  {canEditTaskFields && (
                    <button
                      onClick={() => detachTagMutation.mutate(tg.id)}
                      className="hover:opacity-75"
                    >
                      &times;
                    </button>
                  )}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-600 italic">Chưa gắn nhãn</span>
            )}
          </div>

          {/* Tag selector dropdown */}
          {canEditTaskFields && workspaceTags && workspaceTags.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-500">Gắn nhãn:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    attachTagMutation.mutate(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 focus:outline-none max-w-[200px]"
              >
                <option value="">+ Thêm nhãn có sẵn</option>
                {workspaceTags
                  .filter((wt) => !(taskTags || []).some((tt) => tt.id === wt.id))
                  .map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Inline Tag Creator Form */}
          {canEditTaskFields && isCreatingTag && (
            <form onSubmit={handleCreateTag} className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tên nhãn mới..."
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              <button
                type="submit"
                disabled={createTagMutation.isPending}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Tạo
              </button>
            </form>
          )}
        </div>

        {/* Task Attributes Panel */}
        <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Trạng thái:</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                updateStatusMutation.mutate(e.target.value);
              }}
              disabled={!canEditTaskFields}
              title={!canEditTaskFields ? "Chỉ Admin/Owner hoặc Người được gán task mới có quyền đổi trạng thái" : ""}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="todo">Cần làm</option>
              <option value="in_progress">Đang làm</option>
              <option value="done">Hoàn thành</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Độ ưu tiên:</span>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                updateTaskMutation.mutate({ priority: e.target.value });
              }}
              disabled={!canEditTaskFields}
              title={!canEditTaskFields ? "Chỉ Admin/Owner hoặc Người được gán task mới có quyền sửa Độ ưu tiên" : ""}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Gán cho:</span>
            <select
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
                updateTaskMutation.mutate({ assignee_id: e.target.value ? e.target.value : undefined });
              }}
              disabled={!canEditTaskFields}
              title={!canEditTaskFields ? "Chỉ Admin/Owner hoặc Người được gán task mới có quyền phân công lại" : ""}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 focus:outline-none max-w-[180px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">Chưa phân công</option>
              {workspaceMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Hạn chót:</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                updateTaskMutation.mutate({ due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined });
              }}
              disabled={!canEditTaskFields}
              title={!canEditTaskFields ? "Chỉ Admin/Owner hoặc Người được gán task mới có quyền sửa Hạn chót" : ""}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Description panel */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mô tả công việc</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleFieldBlur}
            disabled={!canEditTaskFields}
            rows={3}
            placeholder="Viết mô tả ngắn về công việc..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Subtasks checklist panel */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Danh sách việc con (Checklist)</label>

          {canEditTaskFields && (
            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Thêm việc con mới..."
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Thêm
              </button>
            </form>
          )}

          <div className="space-y-1.5">
            {subtasks && subtasks.length > 0 ? (
              subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-950/10 px-3 py-2 transition hover:bg-white/[0.01]"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <input
                      type="checkbox"
                      checked={sub.is_done}
                      disabled={!canEditTaskFields}
                      onChange={(e) => toggleSubtaskMutation.mutate({ subtaskId: sub.id, isDone: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span
                      onClick={() => {
                        if (canEditTaskFields) {
                          toggleSubtaskMutation.mutate({ subtaskId: sub.id, isDone: !sub.is_done });
                        }
                      }}
                      className={`text-xs select-none truncate ${canEditTaskFields ? 'cursor-pointer' : 'cursor-not-allowed'} ${sub.is_done ? 'line-through text-slate-500' : 'text-slate-200 hover:text-white'}`}
                    >
                      {sub.title}
                    </span>
                  </div>
                  {canEditTaskFields && (
                    <button
                      onClick={() => deleteSubtaskMutation.mutate(sub.id)}
                      className="rounded-md p-1 text-slate-600 hover:bg-slate-800 hover:text-rose-400 transition"
                      title="Xóa việc con"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="py-2 text-center text-[11px] text-slate-600 italic">Chưa có việc con nào</p>
            )}
          </div>
        </div>

        {/* Attachments panel */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">File đính kèm (Attachments)</label>
            {canEditTaskFields && (
              <label className="cursor-pointer text-[11px] font-medium text-indigo-400 hover:underline">
                {isUploading ? 'Đang tải lên...' : '+ Tải tệp mới (Tối đa 5MB)'}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            {attachments && attachments.length > 0 ? (
              attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/20 p-3 transition hover:border-white/10"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-400 shrink-0">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                    <div className="overflow-hidden">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088'}${att.file_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs font-semibold text-indigo-300 hover:underline"
                      >
                        {att.file_name}
                      </a>
                      <span className="text-[10px] text-slate-500">
                        {formatFileSize(att.file_size)} • {new Date(att.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {canEditTaskFields && (
                    <button
                      onClick={() => deleteAttachmentMutation.mutate(att.id)}
                      className="rounded-md p-1 text-slate-600 hover:bg-slate-800 hover:text-rose-400 transition shrink-0"
                      title="Xóa tệp đính kèm"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="py-2 text-center text-[11px] text-slate-600 italic">Chưa có file đính kèm nào</p>
            )}
          </div>
        </div>

        {/* Comments timeline section */}
        <div className="border-t border-white/5 pt-4 space-y-4">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thảo luận & Bình luận (Comments)</label>

          {/* New comment input form */}
          <form onSubmit={handleAddComment} className="space-y-2">
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              disabled={!canEditTaskFields}
              rows={2}
              placeholder={canEditTaskFields ? "Viết bình luận của bạn..." : "Chỉ Admin/Owner hoặc Người được gán công việc mới được gửi bình luận..."}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canEditTaskFields || createCommentMutation.isPending || !newCommentText.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Gửi bình luận
              </button>
            </div>
          </form>

          {/* Comments list timeline */}
          <div className="space-y-3 pt-2">
            {comments && comments.length > 0 ? (
              comments.map((cm) => (
                <div key={cm.id} className="flex gap-3 text-xs">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-950 font-bold text-indigo-300 border border-indigo-500/20 text-[10px] uppercase shrink-0 mt-0.5">
                    {cm.user_email ? cm.user_email.substring(0, 1) : 'U'}
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{cm.user_name || cm.user_email}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(cm.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      {currentUser && (currentUser.id === cm.user_id || currentUserRole === 'owner' || currentUserRole === 'admin') && (
                        <button
                          onClick={() => deleteCommentMutation.mutate(cm.id)}
                          className="text-[10px] text-slate-600 hover:text-rose-400 transition"
                          title="Xóa bình luận"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-950/30 p-3 text-slate-300 leading-relaxed break-words">
                      {cm.content}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-2 text-center text-[11px] text-slate-600 italic">Chưa có bình luận nào</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

