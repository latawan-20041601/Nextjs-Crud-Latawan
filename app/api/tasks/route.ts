import db from '@/lib/db';
import type { TaskRow } from '@/lib/task-types';
import {
  isValidDueDate,
  isValidPriority,
  serializeTask,
} from '@/lib/task-validation';
import { NextResponse } from 'next/server';

export async function GET() {
  const tasks = db
    .prepare('SELECT * FROM tasks ORDER BY id DESC')
    .all() as TaskRow[];

  return NextResponse.json(tasks.map(serializeTask));
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const title = input.title;
  const description = input.description === undefined ? '' : input.description;
  const category = input.category === undefined ? 'Personal' : input.category;
  const priority = input.priority === undefined ? 'medium' : input.priority;
  const dueDate = input.due_date === undefined ? null : input.due_date;

  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.trim().length > 120 ||
    typeof description !== 'string' ||
    description.length > 1000 ||
    typeof category !== 'string' ||
    category.trim().length === 0 ||
    category.trim().length > 40 ||
    !isValidPriority(priority) ||
    !isValidDueDate(dueDate)
  ) {
    return NextResponse.json(
      { error: 'Check the title, description, category, priority, and due date.' },
      { status: 400 },
    );
  }

  const validCategory = db
    .prepare('SELECT 1 FROM categories WHERE name = ?')
    .get(category.trim());
  if (!validCategory) {
    return NextResponse.json(
      { error: 'Choose an existing category.' },
      { status: 400 },
    );
  }

  const result = db
    .prepare(
      `INSERT INTO tasks (title, description, category, priority, due_date)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      title.trim(),
      description.trim(),
      category.trim(),
      priority,
      dueDate || null,
    );
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(result.lastInsertRowid) as TaskRow;

  return NextResponse.json(serializeTask(task), { status: 201 });
}
