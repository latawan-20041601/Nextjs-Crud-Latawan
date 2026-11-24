'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Priority, Task } from '@/lib/task-types';

type View = 'dashboard' | 'all' | 'today' | 'upcoming' | 'completed';
type Notice = { kind: 'success' | 'error'; message: string };
type TaskForm = {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  due_date: string;
};

const emptyForm: TaskForm = {
  title: '',
  description: '',
  category: 'Personal',
  priority: 'medium',
  due_date: '',
};

const navigation: { id: View; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'all', label: 'My tasks', icon: 'check' },
  { id: 'today', label: 'Today', icon: 'calendar' },
  { id: 'upcoming', label: 'Upcoming', icon: 'clock' },
  { id: 'completed', label: 'Completed', icon: 'circleCheck' },
];

export default function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('due');
  const [modal, setModal] = useState<'task' | 'categories' | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [categoryName, setCategoryName] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [today, setToday] = useState<Date | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const showNotice = useCallback((nextNotice: Notice) => {
    setNotice(nextNotice);
  }, []);

  const loadData = useCallback(async () => {
    const [tasksResponse, categoriesResponse] = await Promise.all([
      fetch('/api/tasks', { cache: 'no-store' }),
      fetch('/api/categories', { cache: 'no-store' }),
    ]);

    if (!tasksResponse.ok || !categoriesResponse.ok) {
      throw new Error('Unable to load your tasks. Please try again.');
    }

    const [loadedTasks, loadedCategories] = await Promise.all([
      tasksResponse.json() as Promise<Task[]>,
      categoriesResponse.json() as Promise<string[]>,
    ]);
    setTasks(loadedTasks);
    setCategories(loadedCategories);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        await loadData();
      } catch (error) {
        if (active) {
          showNotice({
            kind: 'error',
            message:
              error instanceof Error ? error.message : 'Unable to load tasks.',
          });
        }
      } finally {
        if (active) {
          setToday(new Date());
          setDarkMode(localStorage.getItem('taskflow-theme') === 'dark');
          setLoading(false);
        }
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [loadData, showNotice]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  useEffect(() => {
    if (modal || pendingDelete) {
      function closeOnEscape(event: KeyboardEvent) {
        if (event.key === 'Escape' && !busy) {
          setModal(null);
          setPendingDelete(null);
        }
      }
      window.addEventListener('keydown', closeOnEscape);
      return () => window.removeEventListener('keydown', closeOnEscape);
    }
  }, [modal, pendingDelete, busy]);

  const completedCount = tasks.filter((task) => task.completed).length;
  const pendingCount = tasks.length - completedCount;
  const progress = tasks.length
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;
  const todayKey = today ? toDateKey(today) : '';
  const todayCount = tasks.filter(
    (task) => !task.completed && task.due_date === todayKey,
  ).length;

  const visibleTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filtered = tasks.filter((task) => {
      if (view === 'today' && task.due_date !== todayKey) return false;
      if (
        view === 'upcoming' &&
        (!task.due_date || task.due_date <= todayKey || task.completed)
      ) {
        return false;
      }
      if (view === 'completed' && !task.completed) return false;
      if (view !== 'completed' && statusFilter === 'pending' && task.completed) {
        return false;
      }
      if (
        view !== 'completed' &&
        statusFilter === 'completed' &&
        !task.completed
      ) {
        return false;
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && task.category !== categoryFilter) {
        return false;
      }
      if (selectedCategory && task.category !== selectedCategory) return false;
      if (
        normalizedSearch &&
        !task.title.toLocaleLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      return true;
    });

    return filtered.sort((first, second) => {
      if (sortBy === 'created') {
        return second.created_at.localeCompare(first.created_at);
      }
      if (!first.due_date) return second.due_date ? 1 : 0;
      if (!second.due_date) return -1;
      return first.due_date.localeCompare(second.due_date);
    });
  }, [
    tasks,
    view,
    todayKey,
    statusFilter,
    priorityFilter,
    categoryFilter,
    selectedCategory,
    search,
    sortBy,
  ]);

  const sectionTitle = selectedCategory
    ? selectedCategory
    : view === 'dashboard'
      ? 'My tasks'
      : navigation.find((item) => item.id === view)?.label ?? 'My tasks';

  function selectView(nextView: View) {
    setSelectedCategory(null);
    setView(nextView);
  }

  function openNewTask() {
    setEditingTask(null);
    setForm({
      ...emptyForm,
      category: categories.includes('Personal')
        ? 'Personal'
        : categories[0] ?? 'Personal',
    });
    setModal('task');
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      due_date: task.due_date ?? '',
    });
    setModal('task');
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;

    setBusy(true);
    try {
      const editing = editingTask !== null;
      const response = await fetch(
        editing ? `/api/tasks/${editingTask.id}` : '/api/tasks',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            title: form.title.trim(),
            description: form.description.trim(),
            due_date: form.due_date || null,
          }),
        },
      );
      const task = await readResponse<Task>(response);
      setTasks((current) =>
        editing
          ? current.map((item) => (item.id === task.id ? task : item))
          : [task, ...current],
      );
      setModal(null);
      setEditingTask(null);
      showNotice({
        kind: 'success',
        message: editing ? 'Task updated.' : 'Task added to your list.',
      });
    } catch (error) {
      showNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to save task.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(task: Task) {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      });
      const updatedTask = await readResponse<Task>(response);
      setTasks((current) =>
        current.map((item) => (item.id === updatedTask.id ? updatedTask : item)),
      );
      showNotice({
        kind: 'success',
        message: updatedTask.completed ? 'Nice work — task completed.' : 'Task reopened.',
      });
    } catch (error) {
      showNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to update task.',
      });
    }
  }

  async function deleteTask() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/tasks/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) await readResponse(response);
      setTasks((current) =>
        current.filter((task) => task.id !== pendingDelete.id),
      );
      setPendingDelete(null);
      if (editingTask?.id === pendingDelete.id) setModal(null);
      showNotice({ kind: 'success', message: 'Task deleted.' });
    } catch (error) {
      showNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete task.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName }),
      });
      const result = await readResponse<{ name: string }>(response);
      setCategories((current) =>
        [...current, result.name].sort((a, b) => a.localeCompare(b)),
      );
      setCategoryName('');
      showNotice({ kind: 'success', message: 'Category created.' });
    } catch (error) {
      showNotice({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to create category.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(name: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      await readResponse(response);
      setCategories((current) => current.filter((category) => category !== name));
      if (selectedCategory === name) selectView('all');
      if (categoryFilter === name) setCategoryFilter('all');
      showNotice({ kind: 'success', message: `${name} category deleted.` });
    } catch (error) {
      showNotice({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to delete category.',
      });
    } finally {
      setBusy(false);
    }
  }

  function toggleTheme() {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    localStorage.setItem('taskflow-theme', nextMode ? 'dark' : 'light');
  }

  return (
    <div className={`app-shell${darkMode ? ' dark-mode' : ''}`}>
      <aside className="sidebar">
        <div className="brand" aria-label="TaskFlow">
          <span className="brand-mark"><Icon name="spark" size={21} /></span>
          <span>task<span>flow</span></span>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-item${!selectedCategory && view === item.id ? ' active' : ''}`}
              onClick={() => selectView(item.id)}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.id === 'today' && todayCount > 0 && (
                <span className="nav-count">{todayCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-section-heading">
          <span>YOUR CATEGORIES</span>
          <button
            type="button"
            className="icon-button small-icon"
            aria-label="Manage categories"
            title="Manage categories"
            onClick={() => setModal('categories')}
          >
            <Icon name="plus" size={17} />
          </button>
        </div>
        <nav className="category-nav" aria-label="Task categories">
          {categories.map((category, index) => (
            <button
              type="button"
              key={category}
              className={`nav-item category-nav-item${selectedCategory === category ? ' active' : ''}`}
              onClick={() => {
                setSelectedCategory(category);
                setView('all');
              }}
            >
              <span className={`category-dot category-dot-${index % 4}`} />
              <span>{category}</span>
              <span className="nav-count">
                {tasks.filter((task) => task.category === category && !task.completed).length}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-icon"><Icon name="spark" size={17} /></div>
          <strong>Make space for focus</strong>
          <p>One small step today makes a big difference tomorrow.</p>
        </div>
        <div className="profile-button">
          <span className="avatar">J</span>
          <span className="profile-copy"><strong>Jamie Parker</strong><small>Personal space</small></span>
          <Icon name="more" size={18} />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><Icon name="chevronRight" size={15} /><strong>{selectedCategory ?? sectionTitle}</strong></div>
          <div className="topbar-actions">
            <span className="topbar-date">{today ? formatLongDate(today) : ''}</span>
            <button
              className="icon-button theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <Icon name={darkMode ? 'sun' : 'moon'} size={19} />
            </button>
            <span className="topbar-avatar" aria-label="Jamie Parker">J</span>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{today ? formatShortDate(today) : 'YOUR TASKS'}</p>
              <h1>{today ? greeting(today) : 'Welcome back'}, Jamie <span className="wave">✦</span></h1>
              <p className="welcome-copy">Let&apos;s make today a little more productive.</p>
            </div>
            <button type="button" className="primary-button add-task-button" onClick={openNewTask}>
              <Icon name="plus" size={18} /><span>New task</span>
            </button>
          </section>

          <section className="stats-grid" aria-label="Task statistics">
            <StatCard label="Total tasks" value={tasks.length} icon="grid" tone="blue" note="Across all categories" />
            <StatCard label="Completed" value={completedCount} icon="circleCheck" tone="green" note="Keep up the great work" />
            <StatCard label="In progress" value={pendingCount} icon="clock" tone="orange" note={todayCount ? `${todayCount} due today` : 'Ready when you are'} />
          </section>

          <section className="progress-card" aria-label="Overall progress">
            <div className="progress-main">
              <div className="progress-icon"><Icon name="spark" size={19} /></div>
              <div className="progress-copy">
                <span className="progress-eyebrow">YOUR PROGRESS</span>
                <h2>You&apos;re building momentum</h2>
                <p>{completedCount} of {tasks.length} tasks completed. Every bit of progress counts.</p>
              </div>
            </div>
            <div className="progress-value">{progress}<span>%</span></div>
            <div className="progress-track" role="progressbar" aria-label="Overall task completion" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </section>

          <section className="tasks-section">
            <div className="tasks-heading-row">
              <div>
                <div className="section-title-row">
                  <h2>{sectionTitle}</h2>
                  <span className="task-count">{visibleTasks.length}</span>
                </div>
                <p className="section-subtitle">
                  {view === 'today'
                    ? 'A clear plan for what needs your attention today.'
                    : view === 'upcoming'
                      ? 'A look at what is coming up next.'
                      : view === 'completed'
                        ? 'All the things you have already accomplished.'
                        : 'Keep your focus on what matters most.'}
                </p>
              </div>
              <button type="button" className="text-button" onClick={openNewTask}>
                <Icon name="plus" size={16} /> Add task
              </button>
            </div>

            <div className="filter-toolbar">
              <label className="search-field">
                <Icon name="search" size={18} />
                <input
                  ref={searchInput}
                  type="search"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search tasks by title"
                />
                <kbd>Ctrl K</kbd>
              </label>
              <label className="filter-select">
                <span className="sr-only">Filter by status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All status</option>
                  <option value="pending">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className="filter-select">
                <span className="sr-only">Filter by priority</span>
                <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                  <option value="all">All priority</option>
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
              </label>
              <label className="filter-select category-filter">
                <span className="sr-only">Filter by category</span>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="filter-select sort-select">
                <span className="sr-only">Sort tasks</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="due">Due date</option>
                  <option value="created">Created date</option>
                </select>
              </label>
            </div>

            {loading ? (
              <div className="loading-state" aria-live="polite">
                <span className="loading-spinner" /> Loading your tasks...
              </div>
            ) : visibleTasks.length ? (
              <div className="task-grid">
                {visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    todayKey={todayKey}
                    categoryIndex={Math.max(0, categories.indexOf(task.category))}
                    onToggle={() => void toggleTask(task)}
                    onEdit={() => openEditTask(task)}
                    onDelete={() => setPendingDelete(task)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-illustration"><Icon name={search || selectedCategory ? 'search' : 'spark'} size={27} /></span>
                <h3>{search || selectedCategory || priorityFilter !== 'all' || categoryFilter !== 'all' ? 'No tasks match these filters' : 'A fresh page, full of possibility'}</h3>
                <p>{search || selectedCategory || priorityFilter !== 'all' || categoryFilter !== 'all' ? 'Try adjusting your search or filters to find what you need.' : 'Add your first task and start turning plans into progress.'}</p>
                {!search && !selectedCategory && (
                  <button type="button" className="primary-button empty-add-button" onClick={openNewTask}>
                    <Icon name="plus" size={17} /> Create a task
                  </button>
                )}
              </div>
            )}
          </section>
          <footer className="page-footer"><span>Made for a more focused day</span><span>{pendingCount} {pendingCount === 1 ? 'task' : 'tasks'} left to do</span></footer>
        </div>
      </main>

      {modal === 'task' && (
        <Modal title={editingTask ? 'Edit task' : 'Create a task'} onClose={() => !busy && setModal(null)}>
          <p className="modal-description">Add the details and we&apos;ll keep everything organized for you.</p>
          <form className="task-modal-form" onSubmit={(event) => void saveTask(event)}>
            <label className="form-field">
              <span>Task title <b>*</b></span>
              <input
                autoFocus
                maxLength={120}
                required
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Prepare project proposal"
              />
              <small>Keep it clear and actionable.</small>
            </label>
            <label className="form-field">
              <span>Description <em>Optional</em></span>
              <textarea
                rows={3}
                maxLength={1000}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Add a few details to help you get started..."
              />
            </label>
            <div className="form-row">
              <label className="form-field">
                <span>Category</span>
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Priority</span>
                <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>
            <label className="form-field due-date-field">
              <span>Due date <em>Optional</em></span>
              <input type="date" min={editingTask ? undefined : todayKey} value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} />
            </label>
            <div className="modal-actions">
              <button type="button" className="button-quiet" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy || categories.length === 0}>
                {busy ? <><span className="button-spinner" /> Saving...</> : <><Icon name="check" size={17} /> {editingTask ? 'Save changes' : 'Save task'}</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'categories' && (
        <Modal title="Manage categories" onClose={() => !busy && setModal(null)}>
          <p className="modal-description">Create categories that make your tasks easier to find.</p>
          <form className="category-create-form" onSubmit={(event) => void addCategory(event)}>
            <input
              value={categoryName}
              maxLength={40}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="New category name"
              aria-label="New category name"
              required
            />
            <button className="primary-button" type="submit" disabled={busy || !categoryName.trim()}>
              <Icon name="plus" size={17} /> Add
            </button>
          </form>
          <div className="category-manager-list">
            {categories.map((category, index) => (
              <div className="category-manager-item" key={category}>
                <span className={`category-dot category-dot-${index % 4}`} />
                <span>{category}</span>
                <small>{tasks.filter((task) => task.category === category).length} tasks</small>
                <button
                  type="button"
                  className="icon-button delete-category-button"
                  aria-label={`Delete ${category} category`}
                  title="Delete category"
                  disabled={busy}
                  onClick={() => void deleteCategory(category)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
          <p className="category-manager-note">Categories with tasks can&apos;t be deleted until those tasks are moved.</p>
          <div className="modal-actions">
            <button type="button" className="button-quiet" onClick={() => setModal(null)}>Done</button>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal title="Delete this task?" onClose={() => !busy && setPendingDelete(null)} compact>
          <p className="modal-description">This will permanently remove <strong>{pendingDelete.title}</strong>. You can&apos;t undo this action.</p>
          <div className="modal-actions">
            <button type="button" className="button-quiet" onClick={() => setPendingDelete(null)} disabled={busy}>Keep task</button>
            <button type="button" className="danger-button" onClick={() => void deleteTask()} disabled={busy}>
              <Icon name="trash" size={16} /> {busy ? 'Deleting...' : 'Delete task'}
            </button>
          </div>
        </Modal>
      )}

      {notice && (
        <div className={`toast toast-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <Icon name={notice.kind === 'success' ? 'circleCheck' : 'alert'} size={19} />
          <span>{notice.message}</span>
          <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  todayKey,
  categoryIndex,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  todayKey: string;
  categoryIndex: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={`task-card${task.completed ? ' task-completed' : ''}`}>
      <label className="task-checkbox-label">
        <input type="checkbox" checked={task.completed} onChange={onToggle} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`} />
        <span className="custom-checkbox"><Icon name="check" size={12} /></span>
      </label>
      <div className="task-card-content">
        <div className="task-card-title-row">
          <h3>{task.title}</h3>
          <span className={`priority-badge priority-${task.priority}`}><span />{capitalize(task.priority)}</span>
        </div>
        {task.description && <p className="task-description">{task.description}</p>}
        <div className="task-meta">
          <span className="category-pill"><span className={`category-dot category-dot-${categoryIndex % 4}`} />{task.category}</span>
          {task.due_date && <span className={`due-date${!task.completed && todayKey && task.due_date < todayKey ? ' overdue' : ''}`}><Icon name="calendar" size={14} />{formatDueDate(task.due_date, todayKey)}</span>}
        </div>
      </div>
      <div className="task-card-actions">
        <button type="button" className="icon-button" aria-label={`Edit ${task.title}`} title="Edit task" onClick={onEdit}><Icon name="edit" size={17} /></button>
        <button type="button" className="icon-button card-delete-button" aria-label={`Delete ${task.title}`} title="Delete task" onClick={onDelete}><Icon name="trash" size={17} /></button>
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  note,
}: {
  label: string;
  value: number;
  icon: IconName;
  tone: 'blue' | 'green' | 'orange';
  note: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon stat-icon-${tone}`}><Icon name={icon} size={18} /></span>
      </div>
      <div className="stat-value">{value.toString().padStart(2, '0')}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}

function Modal({
  title,
  onClose,
  compact = false,
  children,
}: {
  title: string;
  onClose: () => void;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal${compact ? ' modal-compact' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div className="modal-heading-icon"><Icon name={compact ? 'trash' : 'spark'} size={18} /></div>
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><Icon name="close" size={19} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

type IconName =
  | 'grid' | 'check' | 'calendar' | 'clock' | 'circleCheck' | 'spark'
  | 'plus' | 'more' | 'chevronRight' | 'sun' | 'moon' | 'search'
  | 'trash' | 'edit' | 'alert' | 'close';

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    circleCheck: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-.8 14H5.8L5 6" /><path d="M10 11v5m4-5v5" /></>,
    edit: <><path d="m15 5 4 4M4 20l4.3-.9L19 8.4a2.1 2.1 0 0 0-3-3L5.3 16.1 4 20Z" /></>,
    alert: <><path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
    close: <path d="m18 6-12 12M6 6l12 12" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

async function readResponse<T = undefined>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const data = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data
        ? data.error
        : 'Something went wrong. Please try again.';
    throw new Error(message || 'Something went wrong. Please try again.');
  }
  return data as T;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

function formatDueDate(value: string, todayKey: string) {
  const date = new Date(`${value}T00:00:00`);
  if (value === todayKey) return 'Today';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
