'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface KanbanTask {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_avatar?: string;
  position: number;
  created_at?: string;
  updated_at?: string;
}

interface KanbanCardProps {
  task: KanbanTask;
  onSelectTask: (taskId: string) => void;
}

export function KanbanCard({ task, onSelectTask }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return (
          <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
            Ưu tiên cao
          </span>
        );
      case 'medium':
        return (
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
            Trung bình
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-700">
            Ưu tiên thấp
          </span>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelectTask(task.id)}
      className={`group relative cursor-grab rounded-2xl border border-white/5 bg-slate-900/80 p-4 shadow-lg backdrop-blur-md transition hover:border-indigo-500/40 hover:bg-slate-850 hover:shadow-indigo-500/5 active:cursor-grabbing ${
        isDragging ? 'shadow-2xl ring-2 ring-indigo-500/50 z-50' : ''
      }`}
    >
      {/* Top badges bar */}
      <div className="flex items-center justify-between gap-2">
        {getPriorityBadge(task.priority)}

        {task.due_date && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-950/40 rounded-md px-2 py-0.5 border border-white/5">
            <svg className="h-3 w-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(task.due_date).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="mt-3 text-sm font-semibold text-white leading-snug group-hover:text-indigo-300 transition line-clamp-2">
        {task.title}
      </h4>

      {/* Description preview if present */}
      {task.description && (
        <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Footer assignee info */}
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <div className="flex items-center gap-2">
          {task.assignee_name ? (
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-950 text-[10px] font-bold text-indigo-300 border border-indigo-500/20 uppercase shrink-0">
                {task.assignee_name.substring(0, 1)}
              </div>
              <span className="truncate text-xs text-slate-300 max-w-[100px] font-medium">
                {task.assignee_name}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-600 italic">Chưa gán</span>
          )}
        </div>

        {/* Drag handle icon indicator */}
        <div className="text-slate-600 group-hover:text-slate-400 transition">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      </div>
    </div>
  );
}
