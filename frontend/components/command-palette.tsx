'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export interface SearchResultProject {
  id: string;
  name: string;
  color: string;
}

export interface SearchResultTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  project_id: string;
  project_name: string;
}

export interface SearchResponse {
  projects: SearchResultProject[];
  tasks: SearchResultTask[];
}

interface CommandPaletteProps {
  workspaceId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectTask?: (taskId: string, projectId: string) => void;
}

export function CommandPalette({ workspaceId, isOpen, onClose, onSelectTask }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResponse>({ projects: [], tasks: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results
  useEffect(() => {
    if (!isOpen || !workspaceId || !debouncedQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults({ projects: [], tasks: [] });
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    api
      .get<SearchResponse>('/search', {
        params: { workspace_id: workspaceId, q: debouncedQuery },
      })
      .then((res) => {
        if (isMounted) {
          setResults(res.data || { projects: [], tasks: [] });
          setSelectedIndex(0);
        }
      })
      .catch((err) => {
        console.error('Search error:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, workspaceId, debouncedQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Total items combined
  const totalItems = results.projects.length + results.tasks.length;

  const handleSelectItem = useCallback(
    (index: number) => {
      if (index < results.projects.length) {
        const proj = results.projects[index];
        router.push(`/projects/${proj.id}`);
        onClose();
      } else {
        const taskIndex = index - results.projects.length;
        const task = results.tasks[taskIndex];
        if (onSelectTask) {
          onSelectTask(task.id, task.project_id);
        } else {
          router.push(`/projects/${task.project_id}`);
        }
        onClose();
      }
    },
    [results, router, onClose, onSelectTask]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (totalItems > 0 ? (prev + 1) % totalItems : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (totalItems > 0) {
          handleSelectItem(selectedIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalItems, selectedIndex, handleSelectItem, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Bar */}
        <div className="flex items-center border-b border-white/10 px-5 py-4">
          <svg className="h-5 w-5 text-indigo-400 shrink-0 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm dự án, công việc... (Nhấn Esc để đóng)"
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent shrink-0 ml-2" />
          ) : (
            <kbd className="hidden sm:inline-block rounded-lg border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              ESC
            </kbd>
          )}
        </div>

        {/* Results Area */}
        <div className="overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {!query.trim() && (
            <div className="py-8 text-center text-xs text-slate-500 italic">
              Gõ từ khóa để tìm kiếm nhanh Dự án hoặc Công việc...
            </div>
          )}

          {query.trim() && !isLoading && totalItems === 0 && (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              Không tìm thấy kết quả phù hợp với &quot;{query}&quot;.
            </div>
          )}

          {/* Projects Group */}
          {results.projects.length > 0 && (
            <div>
              <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Dự án ({results.projects.length})
              </div>
              <div className="space-y-1">
                {results.projects.map((proj, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <div
                      key={proj.id}
                      onClick={() => handleSelectItem(idx)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition ${
                        isSelected ? 'bg-indigo-600/30 text-white border border-indigo-500/40' : 'text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: proj.color || '#6366f1' }} />
                        <span className="text-xs font-semibold">{proj.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Dự án</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks Group */}
          {results.tasks.length > 0 && (
            <div>
              <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Công việc ({results.tasks.length})
              </div>
              <div className="space-y-1">
                {results.tasks.map((task, idx) => {
                  const globalIdx = results.projects.length + idx;
                  const isSelected = selectedIndex === globalIdx;
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleSelectItem(globalIdx)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition ${
                        isSelected ? 'bg-indigo-600/30 text-white border border-indigo-500/40' : 'text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <svg className="h-4 w-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-white truncate">{task.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">Dự án: {task.project_name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Status Badge */}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            task.status === 'done'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : task.status === 'in_progress'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {task.status === 'done' ? 'Hoàn thành' : task.status === 'in_progress' ? 'Đang làm' : 'Cần làm'}
                        </span>

                        {/* Priority Badge */}
                        <span
                          className={`text-[9px] font-bold ${
                            task.priority === 'high'
                              ? 'text-rose-400'
                              : task.priority === 'medium'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {task.priority === 'high' ? 'Cao' : task.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-950/60 px-5 py-2.5 text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-300">↑</kbd>{' '}
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-300">↓</kbd> để di chuyển
            </span>
            <span>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-300">↵</kbd> để chọn
            </span>
          </div>
          <span>Phím tắt: <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-300">Ctrl + K</kbd></span>
        </div>
      </div>
    </div>
  );
}
