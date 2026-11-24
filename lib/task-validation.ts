import type { Priority, TaskRow } from '@/lib/task-types';

export function isValidDueDate(value: unknown): value is string | null {
  if (value === null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function isValidPriority(value: unknown): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low';
}

export function serializeTask(task: TaskRow) {
  return { ...task, completed: Boolean(task.completed) };
}
