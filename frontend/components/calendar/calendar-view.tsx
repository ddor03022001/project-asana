'use client';

import React, { useState } from 'react';

export interface CalendarTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
  assignee_name?: string;
}

interface CalendarViewProps {
  tasks: CalendarTask[];
  onSelectTask: (taskId: string) => void;
  onDateClick: (dateStr: string) => void;
}

export function CalendarView({ tasks, onSelectTask, onDateClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate calendar grid days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week offset (0 = Sunday, 1 = Monday). We want Monday first (1 = Mon ... 7 = Sun)
  let startDayOfWeek = firstDayOfMonth.getDay();
  if (startDayOfWeek === 0) startDayOfWeek = 7; // Convert Sunday from 0 to 7

  const daysInMonth = lastDayOfMonth.getDate();

  // Previous month padding days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const paddingDaysBefore = startDayOfWeek - 1;

  const calendarCells = [];

  // 1. Previous month padding cells
  for (let i = paddingDaysBefore; i > 0; i--) {
    const pDay = prevMonthLastDay - i + 1;
    const dateObj = new Date(year, month - 1, pDay);
    calendarCells.push({
      dateObj,
      dayNumber: pDay,
      isCurrentMonth: false,
    });
  }

  // 2. Current month cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    calendarCells.push({
      dateObj,
      dayNumber: day,
      isCurrentMonth: true,
    });
  }

  // 3. Next month padding cells to complete full 7-column rows (up to 35 or 42 cells)
  const totalCells = Math.ceil(calendarCells.length / 7) * 7;
  const paddingDaysAfter = totalCells - calendarCells.length;
  for (let i = 1; i <= paddingDaysAfter; i++) {
    const dateObj = new Date(year, month + 1, i);
    calendarCells.push({
      dateObj,
      dayNumber: i,
      isCurrentMonth: false,
    });
  }

  const todayStr = new Date().toISOString().substring(0, 10);

  const getPriorityStyle = (priority: string, status: string) => {
    if (status === 'done') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 line-through';
    }
    switch (priority) {
      case 'high':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const DAYS_OF_WEEK = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/5 bg-slate-950/40 p-6 backdrop-blur-xl">
      {/* Header controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold tracking-tight text-white capitalize">
            {currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={handleToday}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            Hôm nay
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title="Tháng trước"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleNextMonth}
            className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title="Tháng sau"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 border-b border-white/5 pb-3 text-center">
        {DAYS_OF_WEEK.map((dayName) => (
          <div key={dayName} className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid flex-1 grid-cols-7 grid-rows-5 gap-px bg-white/5 pt-px">
        {calendarCells.map((cell, idx) => {
          const dateStr = cell.dateObj.toISOString().substring(0, 10);
          const isToday = dateStr === todayStr;

          // Filter tasks due on this date
          const cellTasks = tasks.filter((t) => {
            if (!t.due_date) return false;
            const taskDateStr = new Date(t.due_date).toISOString().substring(0, 10);
            return taskDateStr === dateStr;
          });

          return (
            <div
              key={idx}
              onClick={() => onDateClick(dateStr)}
              className={`group relative flex flex-col justify-between bg-slate-950/80 p-2 transition hover:bg-slate-900/90 cursor-pointer ${
                !cell.isCurrentMonth ? 'opacity-35 bg-slate-950/40' : ''
              }`}
            >
              {/* Day number header */}
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-indigo-600 font-bold text-white shadow-md'
                      : cell.isCurrentMonth
                      ? 'text-slate-300'
                      : 'text-slate-600'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                <span className="hidden text-[10px] text-slate-600 group-hover:inline-block">
                  + Thêm việc
                </span>
              </div>

              {/* Day's tasks events list */}
              <div className="mt-1 flex-1 space-y-1 overflow-y-auto max-h-24 scrollbar-none">
                {cellTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTask(t.id);
                    }}
                    className={`truncate rounded-md border px-2 py-1 text-[11px] font-medium transition hover:scale-[1.02] shadow-sm ${getPriorityStyle(
                      t.priority,
                      t.status
                    )}`}
                    title={t.title}
                  >
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
