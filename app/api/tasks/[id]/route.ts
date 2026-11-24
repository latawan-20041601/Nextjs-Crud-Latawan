import db from '@/lib/db';
import type { TaskRow } from '@/lib/task-types';
import {
  isValidDueDate,
  isValidPriority,
  serializeTask,
} from '@/lib/task-validation';
import { NextResponse } from 'next/server';

type Context = { params: Promise<{ id: string }> };

function getId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, context: Context) {
  const id = getId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
  }

  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(id) as TaskRow | undefined;

  if (!task) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  return NextResponse.json(serializeTask(task));
}

export async function PATCH(request: Request, context: Context) {
  const id = getId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
  }

  const current = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(id) as TaskRow | undefined;

  if (!current) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

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
  const title = input.title === undefined ? current.title : input.title;
  const description =
    input.description === undefined ? current.description : input.description;
  const category =
    input.category === undefined ? current.category : input.category;
  const priority =
    input.priority === undefined ? current.priority : input.priority;
  const dueDate = input.due_date === undefined ? current.due_date : input.due_date;
  const completed =
    input.completed === undefined
      ? Boolean(current.completed)
      : input.completed;

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
    !isValidDueDate(dueDate) ||
    typeof completed !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'Check the title, description, category, priority, due date, and status.' },
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

  db.prepare(
    `UPDATE tasks
     SET title = ?, description = ?, category = ?, priority = ?, due_date = ?, completed = ?
     WHERE id = ?`,
  ).run(
    title.trim(),
    description.trim(),
    category.trim(),
    priority,
    dueDate || null,
    completed ? 1 : 0,
    id,
  );

  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(id) as TaskRow;

  return NextResponse.json(serializeTask(task));
}

export async function DELETE(_request: Request, context: Context) {
  const id = getId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
  }

  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  if (!result.changes) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
