'use client';

import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';

interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function WorkspaceMembersPage({ params }: PageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id: workspaceId } = use(params);

  // Invite states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  const [inviteErrorMsg, setInviteErrorMsg] = useState('');

  // 1. Fetch workspace details
  const { data: workspace, isLoading: isLoadingWs } = useQuery<Workspace>({
    queryKey: ['workspace', workspaceId],
    queryFn: async () => {
      const response = await api.get(`/workspaces/${workspaceId}`);
      return response.data;
    },
  });

  // 2. Fetch workspace members
  const { data: members = [], isLoading: isLoadingMembers } = useQuery<WorkspaceMember[]>({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      const response = await api.get(`/workspaces/${workspaceId}/members`);
      return response.data;
    },
  });

  // 3. Fetch pending invitations
  const { data: pendingInvitations = [], refetch: refetchPending } = useQuery<PendingInvitation[]>({
    queryKey: ['pending-invitations', workspaceId],
    queryFn: async () => {
      const response = await api.get(`/workspaces/${workspaceId}/invitations`);
      return response.data;
    },
  });

  // Mutation: Invite user
  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: string }) => {
      const response = await api.post(`/workspaces/${workspaceId}/invitations`, payload);
      return response.data;
    },
    onSuccess: () => {
      setInviteEmail('');
      setInviteSuccessMsg('Đã gửi lời mời thành công! Thành viên sẽ nhận được liên kết kích hoạt qua Email.');
      setInviteErrorMsg('');
      refetchPending();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      const msg = err.response?.data?.error || 'Không thể gửi thư mời';
      setInviteErrorMsg(msg);
      setInviteSuccessMsg('');
    },
  });

  // Mutation: Cancel invitation
  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await api.delete(`/invitations/${invitationId}`);
    },
    onSuccess: () => {
      refetchPending();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Không thể hủy lời mời');
    },
  });

  // Mutation: Update member role
  const updateRoleMutation = useMutation({
    mutationFn: async (payload: { userId: string; role: string }) => {
      const response = await api.patch(`/workspaces/${workspaceId}/members/${payload.userId}`, {
        role: payload.role,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Không thể cập nhật vai trò');
    },
  });

  // Mutation: Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Không thể xóa thành viên');
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleRemoveMember = (userId: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa thành viên ${name} khỏi Workspace?`)) {
      removeMemberMutation.mutate(userId);
    }
  };

  if (isLoadingWs || isLoadingMembers) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-400">Đang tải cài đặt thành viên...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-10 text-white">
      {/* Background visual depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e1b4b_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,#311042_0%,transparent_50%)]" />

      <div className="relative mx-auto max-w-6xl space-y-8">
        {/* Header Breadcrumb */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-indigo-400 uppercase">
              <button onClick={() => router.push('/')} className="hover:underline">
                Dashboard
              </button>
              <span>/</span>
              <span>Workspace Settings</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white">
              Thành viên: {workspace?.name}
            </h1>
          </div>

          <button
            onClick={() => router.push('/')}
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Quay lại Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Members List Table Column */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
              <h2 className="mb-6 text-lg font-bold text-white">Thành viên đang tham gia</h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-bold tracking-wider text-slate-400 uppercase">
                      <th className="pr-4 pb-3">Thành viên</th>
                      <th className="px-4 pb-3">Vai trò</th>
                      <th className="px-4 pb-3">Ngày tham gia</th>
                      <th className="pb-3 pl-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {members.map((member) => (
                      <tr key={member.id} className="text-sm">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold text-slate-300">
                              {member.user_name
                                ? member.user_name.substring(0, 1).toUpperCase()
                                : 'U'}
                            </div>
                            <div className="overflow-hidden">
                              <div className="truncate font-semibold text-white">
                                {member.user_name || 'Người dùng Asana'}
                              </div>
                              <div className="truncate text-xs text-slate-400">
                                {member.user_email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {member.role === 'owner' ? (
                            <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                              Chủ sở hữu
                            </span>
                          ) : (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white focus:outline-none"
                            >
                              <option value="member">Thành viên</option>
                              <option value="admin">Quản trị viên</option>
                            </select>
                          )}
                        </td>

                        <td className="px-4 py-4 text-xs text-slate-400">
                          {new Date(member.joined_at).toLocaleDateString('vi-VN')}
                        </td>

                        <td className="py-4 pl-4 text-right">
                          {member.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(member.user_id, member.user_name)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500"
                              title="Xóa thành viên khỏi Workspace"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Pending invitations */}
                    {pendingInvitations.map((inv) => (
                      <tr key={inv.id} className="text-sm bg-amber-500/5 border-l-2 border-amber-500">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-300">
                              ✉️
                            </div>
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-semibold text-white">
                                  {inv.email}
                                </span>
                                <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                                  Đang chờ xác nhận
                                </span>
                              </div>
                              <div className="truncate text-xs text-amber-400/80">
                                Lời mời đã được gửi qua email
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-xs font-semibold text-slate-300">
                          {inv.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                        </td>

                        <td className="px-4 py-4 text-xs text-slate-400">
                          {new Date(inv.created_at).toLocaleDateString('vi-VN')}
                        </td>

                        <td className="py-4 pl-4 text-right">
                          <button
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc chắn muốn hủy lời mời gửi tới ${inv.email}?`)) {
                                cancelInviteMutation.mutate(inv.id);
                              }
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500"
                            title="Hủy lời mời này"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Invitation Side Column */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-lg font-bold text-white">Mời thành viên mới</h3>
              <p className="mb-6 text-xs text-slate-400">
                Mời đồng nghiệp gia nhập không gian làm việc này bằng địa chỉ email của họ.
              </p>

              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Địa chỉ Email
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="dongnghiep@company.com"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    disabled={inviteMutation.isPending}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Vai trò gán cho thành viên
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    disabled={inviteMutation.isPending}
                  >
                    <option value="member">Thành viên (Member)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>

                {inviteSuccessMsg && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-400">
                    {inviteSuccessMsg}
                  </div>
                )}

                {inviteErrorMsg && (
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-400">
                    {inviteErrorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={inviteMutation.isPending || !inviteEmail.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {inviteMutation.isPending ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Đang gửi lời mời...
                    </>
                  ) : (
                    'Gửi thư mời gia nhập'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
