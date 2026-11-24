import db from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const categories = db
    .prepare('SELECT name FROM categories ORDER BY name COLLATE NOCASE')
    .all() as { name: string }[];

  return NextResponse.json(categories.map(({ name }) => name));
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !('name' in body) ||
    typeof body.name !== 'string' ||
    !body.name.trim() ||
    body.name.trim().length > 40
  ) {
    return NextResponse.json(
      { error: 'Category name must be 1–40 characters.' },
      { status: 400 },
    );
  }

  const name = body.name.trim();
  const existing = db
    .prepare('SELECT name FROM categories WHERE name = ?')
    .get(name) as { name: string } | undefined;

  if (existing) {
    return NextResponse.json(
      { error: 'That category already exists.' },
      { status: 409 },
    );
  }

  db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
  return NextResponse.json({ name }, { status: 201 });
}

export async function DELETE(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !('name' in body) ||
    typeof body.name !== 'string' ||
    !body.name.trim()
  ) {
    return NextResponse.json({ error: 'Choose a category to delete.' }, { status: 400 });
  }

  const name = body.name.trim();
  const category = db
    .prepare('SELECT id FROM categories WHERE name = ?')
    .get(name) as { id: number } | undefined;
  if (!category) {
    return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
  }

  const tasksUsingCategory = db
    .prepare('SELECT COUNT(*) AS count FROM tasks WHERE category = ?')
    .get(name) as { count: number };
  if (tasksUsingCategory.count > 0) {
    return NextResponse.json(
      { error: 'Move its tasks to another category before deleting it.' },
      { status: 409 },
    );
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(category.id);
  return new Response(null, { status: 204 });
}
