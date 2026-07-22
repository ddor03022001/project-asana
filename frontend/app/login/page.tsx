'use client';

import React from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088';

export default function LoginPage() {
  const handleGoogleLogin = () => {
    // Redirect directly to the Go backend google authentication handler
    window.location.href = `${API_URL}/auth/google`;
  };

  const handleMockLogin = () => {
    // Redirect directly to the mock backend login for local dev bypass
    window.location.href = `${API_URL}/auth/mock`;
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Sleek radial background gradients for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e1b4b_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,#311042_0%,transparent_50%)]" />

      {/* Main glassmorphism container */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand identity */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <h1 className="bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Asano
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Hệ thống quản lý công việc và cộng tác tối giản, hiệu quả.
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:border-slate-500 hover:bg-slate-900 active:scale-[0.98]"
          >
            {/* Google Icon SVG */}
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
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
            Tiếp tục với Google
          </button>

          {/* Development Bypass Section */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute w-full border-t border-slate-800" />
            <span className="relative bg-slate-900 px-3 text-xs tracking-wider text-slate-500 uppercase">
              Dành cho Developer
            </span>
          </div>

          <button
            onClick={handleMockLogin}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all duration-200 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98]"
          >
            Đăng nhập nhanh (Mock User Bypass)
          </button>
        </div>

        <div className="mt-8 text-center text-xs text-slate-500">
          Bằng việc đăng nhập, bạn đồng ý với Điều khoản Dịch vụ và Chính sách Bảo mật của chúng
          tôi.
        </div>
      </div>
    </div>
  );
}
