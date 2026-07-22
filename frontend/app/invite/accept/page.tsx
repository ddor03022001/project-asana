'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getAccessToken, clearTokens } from '../../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088';

interface InvitationResponse {
  email: string;
  workspace_name: string;
  role: string;
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check login status client-side on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAuthenticated(!!getAccessToken());
  }, []);

  // 1. Fetch invitation details using React Query
  const { data, isLoading, error } = useQuery<InvitationResponse>({
    queryKey: ['invitation', token],
    queryFn: async () => {
      if (!token) throw new Error('Token is missing');
      const response = await api.get(`/invitations/${token}`);
      return response.data;
    },
    enabled: !!token,
    retry: false,
  });

  // 2. Mutation to accept the invitation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Token is missing');
      const response = await api.post(`/invitations/${token}/accept`);
      return response.data;
    },
    onSuccess: () => {
      // Successfully joined, redirect to app home
      router.push('/');
    },
  });

  const handleJoin = () => {
    acceptMutation.mutate();
  };

  const handleLoginToAccept = () => {
    if (token) {
      // Save token to resume acceptance after redirect back from Google OAuth
      localStorage.setItem('pending_invite_token', token);
      window.location.href = `${API_URL}/auth/google`;
    }
  };

  const handleMockLoginToAccept = () => {
    if (token) {
      localStorage.setItem('pending_invite_token', token);
      // Fallback redirect URL for mock login
      window.location.href = `${API_URL}/auth/mock`;
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-rose-500">
          Mã lời mời không tồn tại hoặc bị thiếu.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Quay lại Đăng nhập
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="text-sm font-medium text-slate-400">Đang kiểm tra lời mời...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md rounded-2xl border border-rose-500/20 bg-slate-900/40 p-8 text-center backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Lời mời không hợp lệ</h2>
        <p className="mt-2 text-sm text-slate-400">
          Liên kết lời mời này có thể đã hết hạn, đã được chấp nhận, hoặc mã xác thực không đúng.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-6 w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Quay lại Đăng nhập
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Lời Mời Tham Gia</h2>
        <p className="mt-2 text-sm text-slate-400">
          Bạn được mời tham gia vào không gian làm việc chuyên nghiệp.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-800/50 bg-slate-950/50 p-5 text-center">
        <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">
          Workspace
        </span>
        <div className="mt-1 text-xl font-extrabold text-white">{data?.workspace_name}</div>
        <div className="mt-2 text-xs text-slate-400">
          Thành viên với vai trò:{' '}
          <span className="font-semibold text-indigo-300 capitalize">{data?.role}</span>
        </div>
      </div>

      {isAuthenticated ? (
        <div className="space-y-4">
          <p className="text-center text-xs text-slate-400">
            Bạn đang đăng nhập bằng email: <strong className="text-slate-200">{data?.email}</strong>
            . (Nếu không đúng tài khoản, bạn có thể{' '}
            <button
              onClick={() => {
                clearTokens();
                setIsAuthenticated(false);
              }}
              className="text-indigo-400 hover:underline"
            >
              Đăng xuất
            </button>
            )
          </p>
          <button
            onClick={handleJoin}
            disabled={acceptMutation.isPending}
            className="flex w-full items-center justify-center rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {acceptMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Đang gia nhập...
              </span>
            ) : (
              'Chấp nhận và Gia nhập Workspace'
            )}
          </button>
          {acceptMutation.isError && (
            <p className="mt-2 text-center text-xs text-rose-400">
              Lỗi:{' '}
              {acceptMutation.error instanceof Error
                ? acceptMutation.error.message
                : 'Gia nhập thất bại'}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-center text-xs text-amber-300">
            Bạn cần đăng nhập bằng tài khoản email <strong>{data?.email}</strong> để tiếp tục chấp
            nhận lời mời này.
          </div>
          <button
            onClick={handleLoginToAccept}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                fill="#EA4335"
              />
            </svg>
            Đăng nhập Google để chấp nhận
          </button>

          <button
            onClick={handleMockLoginToAccept}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:to-purple-500"
          >
            Đăng nhập nhanh làm Test User
          </button>
        </div>
      )}
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e1b4b_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,#311042_0%,transparent_50%)]" />

      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <p className="text-sm font-medium text-slate-400">Đang tải...</p>
          </div>
        }
      >
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
