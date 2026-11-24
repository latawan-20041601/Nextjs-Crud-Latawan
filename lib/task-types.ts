export type Priority = 'high' | 'medium' | 'low';

export type TaskRow = {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  due_date: string | null;
  completed: number;
  created_at: string;
};

export type Task = Omit<TaskRow, 'completed'> & { completed: boolean };
