'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { KanbanColumn, Column } from './kanban-column';
import { KanbanCard, KanbanTask } from './kanban-card';

const COLUMNS: Column[] = [
  { id: 'todo', title: 'Cần Làm', color: '#6366f1' },       // Indigo
  { id: 'in_progress', title: 'Đang Làm', color: '#f59e0b' }, // Amber
  { id: 'done', title: 'Hoàn Thành', color: '#10b981' },    // Emerald
];

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onSelectTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, newStatus: string) => Promise<void>;
  onUpdatePosition: (taskId: string, newPosition: number) => Promise<void>;
  onAddTask?: (title: string, status: string) => void;
}

export function KanbanBoard({
  tasks: initialTasks,
  onSelectTask,
  onUpdateStatus,
  onUpdatePosition,
  onAddTask,
}: KanbanBoardProps) {
  const [taskList, setTaskList] = useState<KanbanTask[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);

  // Synchronize internal state when props change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTaskList(initialTasks);
  }, [initialTasks]);

  // Configure pointer sensors with distance threshold to distinguish click vs drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = taskList.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeItem = taskList.find((t) => t.id === activeId);
    if (!activeItem) return;

    // Check if dragging over a column container or another card
    const isOverColumn = COLUMNS.some((col) => col.id === overId);
    const overItem = taskList.find((t) => t.id === overId);

    const targetStatus = isOverColumn
      ? (overId as string)
      : overItem
      ? overItem.status
      : activeItem.status;

    if (activeItem.status !== targetStatus) {
      setTaskList((prev) =>
        prev.map((item) =>
          item.id === activeId ? { ...item, status: targetStatus } : item
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeItem = taskList.find((t) => t.id === activeId);
    if (!activeItem) return;

    // Check target status column
    const isOverColumn = COLUMNS.some((col) => col.id === overId);
    const overItem = taskList.find((t) => t.id === overId);
    const targetStatus = isOverColumn
      ? overId
      : overItem
      ? overItem.status
      : activeItem.status;

    // Check if column status changed
    const originalTask = initialTasks.find((t) => t.id === activeId);
    if (originalTask && originalTask.status !== targetStatus) {
      await onUpdateStatus(activeId, targetStatus);
    }

    // Handle position reordering within the target column
    const columnTasks = taskList.filter((t) => t.status === targetStatus);
    const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
    const newIndex = isOverColumn
      ? columnTasks.length - 1
      : columnTasks.findIndex((t) => t.id === overId);

    if (oldIndex !== newIndex && newIndex >= 0) {
      const reorderedColumn = arrayMove(columnTasks, oldIndex, newIndex);

      // Calculate new Fractional Indexing position
      let newPosition = 65536.0;
      if (reorderedColumn.length === 1) {
        newPosition = 65536.0;
      } else if (newIndex === 0) {
        // Moved to top of column
        newPosition = reorderedColumn[1].position / 2.0;
      } else if (newIndex === reorderedColumn.length - 1) {
        // Moved to bottom of column
        newPosition = reorderedColumn[reorderedColumn.length - 2].position + 65536.0;
      } else {
        // Moved between two tasks
        const prevPos = reorderedColumn[newIndex - 1].position;
        const nextPos = reorderedColumn[newIndex + 1].position;
        newPosition = (prevPos + nextPos) / 2.0;
      }

      // Update position in database
      await onUpdatePosition(activeId, newPosition);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full w-full gap-6 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colTasks = taskList
            .filter((t) => t.status === col.id)
            .sort((a, b) => a.position - b.position);

          return (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={colTasks}
              onSelectTask={onSelectTask}
              onAddTask={onAddTask}
            />
          );
        })}
      </div>

      {/* Floating Drag Overlay Preview */}
      <DragOverlay>
        {activeTask ? (
          <KanbanCard task={activeTask} onSelectTask={() => {}} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
