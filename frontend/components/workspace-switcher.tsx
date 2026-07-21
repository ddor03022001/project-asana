'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import CreateWorkspaceModal from './create-workspace-modal';

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceSwitcherProps {
  onWorkspaceChange?: (workspaceId: string) => void;
}

export default function WorkspaceSwitcher({ onWorkspaceChange }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Fetch user's workspaces
  const { data: workspaces = [], isLoading } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const response = await api.get('/workspaces');
      return response.data;
    },
  });

  // 2. Load active workspace from localStorage on mount and sync with fetched list
  useEffect(() => {
    if (workspaces.length > 0) {
      const storedId = localStorage.getItem('active_workspace_id');
      const found = workspaces.find((w) => w.id === storedId);

      if (found) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveWs(found);
      } else {
        // Fallback to first workspace in list if none stored or invalid ID
        const first = workspaces[0];
        setActiveWs(first);
        localStorage.setItem('active_workspace_id', first.id);
        if (onWorkspaceChange) {
          onWorkspaceChange(first.id);
        }
      }
    } else {
      setActiveWs(null);
    }
  }, [workspaces, onWorkspaceChange]);

  const handleSelect = (ws: Workspace) => {
    setActiveWs(ws);
    localStorage.setItem('active_workspace_id', ws.id);
    setIsOpen(false);
    if (onWorkspaceChange) {
      onWorkspaceChange(ws.id);
    }
  };

  const handleCreateSuccess = (newId: string) => {
    // Set newly created workspace as active immediately
    localStorage.setItem('active_workspace_id', newId);
    if (onWorkspaceChange) {
      onWorkspaceChange(newId);
    }
  };

  return (
    <div className="relative w-full">
      {/* Selector Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-left transition hover:bg-slate-900 focus:outline-none"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white shadow-md">
            {activeWs ? activeWs.name.substring(0, 2).toUpperCase() : 'WS'}
          </div>
          <div className="overflow-hidden">
            <p className="truncate text-sm font-semibold text-white">
              {activeWs ? activeWs.name : isLoading ? 'Đang tải...' : 'Không có Workspace'}
            </p>
            <p className="truncate text-xs text-slate-400">
              {activeWs ? `@${activeWs.slug}` : 'Tạo mới để bắt đầu'}
            </p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Selector Dropdown List */}
      {isOpen && (
        <>
          {/* Backdrop layer to click out */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          <div className="animate-in fade-in slide-in-from-top-1 absolute left-0 z-20 mt-2 w-full rounded-xl border border-white/10 bg-slate-900 p-2 shadow-2xl backdrop-blur-xl duration-150">
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-800 ${
                    activeWs?.id === ws.id
                      ? 'bg-indigo-600/20 font-semibold text-indigo-400'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {activeWs?.id === ws.id && (
                    <svg
                      className="h-4 w-4 text-indigo-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              ))}

              {workspaces.length === 0 && (
                <p className="p-3 text-center text-xs text-slate-500">Chưa có workspace nào</p>
              )}
            </div>

            <div className="mt-2 border-t border-white/10 pt-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600/10 px-3 py-2 text-sm font-semibold text-indigo-400 transition hover:bg-indigo-600 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Tạo Workspace Mới
              </button>
            </div>
          </div>
        </>
      )}

      {/* Creation Modal */}
      <CreateWorkspaceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
