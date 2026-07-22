'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWebSocket } from '@/hooks/use-websocket';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  content: string;
  related_task_id?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationDropdownProps {
  onSelectTask?: (taskId: string) => void;
}

export function NotificationDropdown({ onSelectTask }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Listen for real-time WebSocket notifications
  useWebSocket((data) => {
    if (data.event === 'notification') {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    }
  });

  // Fetch notifications
  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications?limit=15');
      return res.data;
    },
  });

  // Fetch unread count
  const { data: unreadData } = useQuery<{ unread_count: number }>({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count');
      return res.data;
    },
    refetchInterval: 30000, // Poll every 30s as fallback
  });

  const unreadCount = unreadData?.unread_count || 0;

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markReadMutation.mutate(item.id);
    }
    if (item.related_task_id && onSelectTask) {
      onSelectTask(item.related_task_id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-xl border border-white/10 bg-slate-900/80 p-2.5 text-slate-300 backdrop-blur-md transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        title="Thông báo"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 z-50 mt-3 w-80 sm:w-96 rounded-3xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Thông báo</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/30">
                    {unreadCount} chưa đọc
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
                >
                  Đánh dấu tất cả đã đọc
                </button>
              )}
            </div>

            {/* List */}
            <div className="mt-3 max-h-80 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`group cursor-pointer rounded-2xl border p-3 transition ${
                      item.is_read
                        ? 'border-transparent bg-slate-950/40 text-slate-400 hover:bg-slate-800/50'
                        : 'border-indigo-500/30 bg-indigo-950/30 text-white hover:bg-indigo-900/40 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs leading-relaxed font-medium">
                        {item.content}
                      </p>
                      {!item.is_read && (
                        <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-1" />
                      )}
                    </div>
                    <span className="mt-2 block text-[10px] text-slate-500">
                      {new Date(item.created_at).toLocaleDateString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'numeric',
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-500 italic">
                  Không có thông báo nào.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
