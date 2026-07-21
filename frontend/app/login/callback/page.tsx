'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setTokens } from '../../../lib/api';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (accessToken && refreshToken) {
      // Store token credentials locally
      setTokens(accessToken, refreshToken);

      // Check if there is a pending workspace invitation to accept
      const pendingInviteToken = localStorage.getItem('pending_invite_token');
      if (pendingInviteToken) {
        localStorage.removeItem('pending_invite_token');
        router.push(`/invite/accept?token=${pendingInviteToken}`);
      } else {
        // Redirect to home/dashboard
        router.push('/');
      }
    } else {
      // Fallback if token parameters are missing
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      {/* Smooth loading spinner */}
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      <p className="text-sm font-medium text-slate-400">
        Đang xác thực tài khoản và chuyển hướng...
      </p>
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      {/* Suspense wrapper is mandatory when calling useSearchParams in App Router static builds */}
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <p className="text-sm font-medium text-slate-400">Đang khởi tạo...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
