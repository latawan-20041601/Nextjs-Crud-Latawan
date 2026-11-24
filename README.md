# TaskFlow

TaskFlow is a responsive task-management dashboard built with Next.js, React, and SQLite. Tasks and categories are stored in `data/tasks.db`; the database creates and safely migrates its schema on startup.

## Run locally

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app supports creating, editing, completing, searching, filtering, sorting, and deleting tasks, plus category management and a saved light/dark theme preference.

## Data

SQLite is the only database. The `data` directory is ignored by Git so your local task data stays on your machine. Existing task rows are retained when the added description, category, priority, and due-date columns are migrated.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```
