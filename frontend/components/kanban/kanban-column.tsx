'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard, KanbanTask } from './kanban-card';

export interface Column {
  id: string; // 'todo', 'in_progress', 'done'
  title: string;
  color: string;
}

interface KanbanColumnProps {
  column: Column;
  tasks: KanbanTask[];
  onSelectTask: (taskId: string) => void;
  onAddTask?: (title: string, status: string) => void;
}

export function KanbanColumn({ column, tasks, onSelectTask, onAddTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const [quickTitle, setQuickTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    if (onAddTask) {
      onAddTask(quickTitle.trim(), column.id);
    }
    setQuickTitle('');
    setIsAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-80 flex-col rounded-3xl border border-white/5 bg-slate-950/40 p-4 backdrop-blur-xl transition ${
        isOver ? 'ring-2 ring-indigo-500/50 bg-slate-900/60' : ''
      }`}
    >
      {/* Column Header */}
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 rounded-full shadow-sm"
            style={{ backgroundColor: column.color }}
          />
          <h3 className="text-sm font-bold tracking-tight text-white">
            {column.title}
          </h3>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-800 px-1.5 text-[10px] font-bold text-slate-300">
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          title="Thêm công việc nhanh"
        >
          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Quick Task Creation Form */}
      {isAdding && (
        <form onSubmit={handleQuickAddSubmit} className="mb-3 space-y-2">
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Tên công việc mới..."
            autoFocus
            className="w-full rounded-xl border border-indigo-500/50 bg-slate-900 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-lg"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-white"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500"
            >
              Tạo
            </button>
          </div>
        </form>
      )}

      {/* Sortable Tasks List Container */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onSelectTask={onSelectTask} />
          ))}

          {tasks.length === 0 && !isAdding && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 text-center p-4">
              <p className="text-xs text-slate-600 italic">Thả thẻ công việc vào đây</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
