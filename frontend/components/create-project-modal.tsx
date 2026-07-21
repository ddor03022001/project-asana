'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSuccess?: (projectId: string) => void;
}

const COLORS = [
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Blue', value: '#3b82f6' },
];

const ICONS = [
  { name: 'Thư mục', value: 'folder' },
  { name: 'Mục tiêu', value: 'target' },
  { name: 'Lịch', value: 'calendar' },
  { name: 'Hồ sơ', value: 'briefcase' },
  { name: 'Checklist', value: 'check-square' },
];

export default function CreateProjectModal({ isOpen, onClose, workspaceId, onSuccess }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0].value);
  const [errorMsg, setErrorMsg] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; color: string; icon: string }) => {
      const response = await api.post(`/workspaces/${workspaceId}/projects`, payload);
      return response.data;
    },
    onSuccess: (data) => {
      setName('');
      setSelectedColor(COLORS[0].value);
      setSelectedIcon(ICONS[0].value);
      setErrorMsg('');

      // Refresh workspaces project lists
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });

      if (onSuccess) {
        onSuccess(data.id);
      }
      onClose();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      const msg = err.response?.data?.error || 'Không thể tạo Dự án mới';
      setErrorMsg(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên Dự án');
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      color: selectedColor,
      icon: selectedIcon,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Tạo Dự Án Mới</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tên Dự Án
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Landing Page, App Development..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              disabled={createMutation.isPending}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Màu Sắc Đại Diện
            </label>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    selectedColor === c.value ? 'scale-110 border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Biểu Tượng (Icon)
            </label>
            <div className="flex gap-2">
              {ICONS.map((ico) => (
                <button
                  key={ico.value}
                  type="button"
                  onClick={() => setSelectedIcon(ico.value)}
                  className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 border text-xs font-medium transition ${
                    selectedIcon === ico.value
                      ? 'border-indigo-500 bg-indigo-600/10 text-indigo-400'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <span className="capitalize">{ico.name}</span>
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs font-medium text-rose-500">{errorMsg}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang tạo...
                </>
              ) : (
                'Tạo Dự Án'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
