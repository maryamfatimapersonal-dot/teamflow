/* ============================
   TeamFlow — app.js
   Full client-side logic
   ============================ */

const API = '';   // Base URL (empty = same origin)

/* ── State ─────────────────────────────────── */
let tasks = [];
let editingId = null;
let currentFilter = 'all';
let currentView = 'dashboard';

/* ── DOM Refs ───────────────────────────────── */
const views       = document.querySelectorAll('.view');
const navItems    = document.querySelectorAll('.nav-item');
const modalOverlay= document.getElementById('modalOverlay');
const toastEl     = document.getElementById('toast');
const searchInput = document.getElementById('searchInput');

/* ── Init ───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  fetchTasks();
  bindEvents();
  animateOnScroll();
});

/* ── Event Bindings ─────────────────────────── */
function bindEvents() {
  // Nav
  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      switchView(item.dataset.view);
    });
  });

  // Sidebar member chips → filter to that member's tasks
  document.querySelectorAll('.member-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      switchView('tasks');
      setFilter(chip.dataset.member);
    });
  });

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Close sidebar on overlay click (mobile)
  document.addEventListener('click', e => {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !hamburger.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  // Modal
  document.getElementById('openModal').addEventListener('click', openAddModal);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  document.getElementById('saveTask').addEventListener('click', saveTask);
  modalOverlay.addEventListener('click', e => { if(e.target === modalOverlay) closeModal(); });

  // Kanban filters
  document.querySelectorAll('.ftab').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  // Search
  searchInput.addEventListener('input', () => renderTasks(tasks));

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && modalOverlay.classList.contains('open')) saveTask();
  });
}

/* ── View Switching ─────────────────────────── */
function switchView(view) {
  currentView = view;
  views.forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  navItems.forEach(n => n.classList.toggle('active', n.dataset.view === view));

  const titles = {
    dashboard: ['Dashboard', 'Overview of team activity'],
    tasks:     ['Task Board', 'Manage and track all tasks'],
    tracker:   ['Team Tracer', 'See what each member is working on'],
    members:   ['Members', 'Team member profiles and stats'],
  };
  document.getElementById('pageTitle').textContent = titles[view][0];
  document.getElementById('pageSub').textContent   = titles[view][1];

  // Refresh views when switched
  if (view === 'tasks')   renderTasks(tasks);
  if (view === 'tracker') renderTracer(tasks);
  if (view === 'members') renderMembers(tasks);
  if (view === 'dashboard') renderDashboard(tasks);
}

/* ── Filter ─────────────────────────────────── */
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.ftab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderTasks(tasks);
}

function filteredTasks(allTasks) {
  const q = searchInput.value.trim().toLowerCase();
  return allTasks.filter(t => {
    const matchMember = currentFilter === 'all' || t.member === currentFilter;
    const matchSearch = !q || t.title.toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q);
    return matchMember && matchSearch;
  });
}

/* ── API Calls ──────────────────────────────── */
async function fetchTasks() {
  try {
    const res = await fetch(`${API}/api/tasks`);
    tasks = await res.json();
    renderAll(tasks);
  } catch(err) {
    showToast('Failed to load tasks', 'error');
  }
}

async function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { showToast('Task title is required', 'error'); return; }

  const payload = {
    title,
    description: document.getElementById('taskDesc').value.trim(),
    member: document.getElementById('taskMember').value,
    status: document.getElementById('taskStatus').value,
    priority: document.querySelector('input[name="priority"]:checked')?.value || 'medium',
    due_date: document.getElementById('taskDue').value,
  };

  try {
    let res;
    if (editingId) {
      res = await fetch(`${API}/api/tasks/${editingId}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
      });
    } else {
      res = await fetch(`${API}/api/tasks`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
      });
    }
    if (!res.ok) throw new Error();
    tasks = await (await fetch(`${API}/api/tasks`)).json();
    renderAll(tasks);
    closeModal();
    showToast(editingId ? 'Task updated!' : 'Task created!', 'success');
  } catch {
    showToast('Failed to save task', 'error');
  }
}

async function deleteTask(id) {
  try {
    await fetch(`${API}/api/tasks/${id}`, { method: 'DELETE' });
    tasks = tasks.filter(t => t.id !== id);
    renderAll(tasks);
    showToast('Task deleted', 'info');
  } catch {
    showToast('Failed to delete task', 'error');
  }
}

async function quickStatusUpdate(id, status) {
  try {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await fetch(`${API}/api/tasks/${id}`, {
      method: 'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...task, status})
    });
    tasks = await (await fetch(`${API}/api/tasks`)).json();
    renderAll(tasks);
    showToast('Status updated', 'success');
  } catch {
    showToast('Update failed', 'error');
  }
}

/* ── Render All ─────────────────────────────── */
function renderAll(allTasks) {
  renderDashboard(allTasks);
  renderTasks(allTasks);
  renderTracer(allTasks);
  renderMembers(allTasks);
}

/* ── Dashboard ──────────────────────────────── */
function renderDashboard(allTasks) {
  const total   = allTasks.length;
  const done    = allTasks.filter(t=>t.status==='complete').length;
  const prog    = allTasks.filter(t=>t.status==='in_progress').length;
  const pend    = allTasks.filter(t=>t.status==='pending').length;

  animCounter('statTotal', total);
  animCounter('statDone', done);
  animCounter('statProg', prog);
  animCounter('statPend', pend);

  // Progress bars
  setTimeout(() => {
    document.getElementById('fillTotal').style.width = '100%';
    document.getElementById('fillDone').style.width  = total ? `${(done/total)*100}%` : '0%';
    document.getElementById('fillProg').style.width  = total ? `${(prog/total)*100}%` : '0%';
    document.getElementById('fillPend').style.width  = total ? `${(pend/total)*100}%` : '0%';
  }, 100);

  // Activity Feed (last 6 tasks sorted by id desc)
  const feed = document.getElementById('activityFeed');
  const recent = [...allTasks].reverse().slice(0,6);
  feed.innerHTML = recent.length ? recent.map(t => `
    <li class="activity-item">
      <span class="avatar av-${memberClass(t.member)}">${memberInitial(t.member)}</span>
      <div>
        <div class="activity-text"><strong>${escHtml(t.member)}</strong> — ${escHtml(t.title)}</div>
        <div class="activity-time">${statusLabel(t.status)} · ${priorityLabel(t.priority)}</div>
      </div>
    </li>
  `).join('') : '<li class="activity-empty">No activity yet</li>';

  // Workload bars
  const members = ['Huzaifa', 'Maryam Duryab', 'Mohsin'];
  const wl = document.getElementById('workloadList');
  wl.innerHTML = members.map(m => {
    const mTasks = allTasks.filter(t=>t.member===m);
    const pct = total ? Math.round((mTasks.length / total)*100) : 0;
    const color = m==='Huzaifa' ? 'var(--accent-blue)' : m==='Maryam Duryab' ? 'var(--accent-purple)' : 'var(--accent-teal)';
    return `
      <div class="workload-item">
        <div class="workload-top">
          <span class="workload-name">
            <span class="avatar av-${memberClass(m)}">${memberInitial(m)}</span>
            ${escHtml(m)}
          </span>
          <span class="workload-pct">${mTasks.length} task${mTasks.length!==1?'s':''} · ${pct}%</span>
        </div>
        <div class="workload-bar"><div class="workload-fill" data-pct="${pct}" style="background:${color}"></div></div>
      </div>`;
  }).join('');

  setTimeout(() => {
    document.querySelectorAll('.workload-fill').forEach(el => {
      el.style.width = el.dataset.pct + '%';
    });
  }, 150);
}

/* ── Tasks / Kanban ─────────────────────────── */
function renderTasks(allTasks) {
  const filtered = filteredTasks(allTasks);
  const statuses = ['pending', 'in_progress', 'complete'];

  statuses.forEach(status => {
    const col = document.getElementById(`list-${statusToId(status)}`);
    const cnt = document.getElementById(`cnt-${statusToId(status)}`);
    const colTasks = filtered.filter(t => t.status === status);
    cnt.textContent = colTasks.length;

    col.innerHTML = colTasks.length ? colTasks.map(t => taskCardHTML(t)).join('') : `
      <div style="text-align:center;color:var(--text-muted);font-size:12px;padding:20px 0">No tasks</div>`;
  });

  bindTaskCardEvents();
}

function taskCardHTML(t) {
  const due     = t.due_date ? formatDue(t.due_date) : '';
  const overdue = isOverdue(t.due_date) && t.status !== 'complete';
  return `
    <div class="task-card" data-id="${t.id}" data-status="${t.status}">
      <div class="task-header">
        <div class="task-title">${escHtml(t.title)}</div>
        <div class="task-actions">
          <button class="task-btn edit" title="Edit" data-id="${t.id}">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="task-btn delete" title="Delete" data-id="${t.id}">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
      ${t.description ? `<div class="task-desc">${escHtml(t.description)}</div>` : ''}
      <div class="task-meta">
        <span class="task-member">
          <span class="avatar av-${memberClass(t.member)}">${memberInitial(t.member)}</span>
          ${escHtml(t.member)}
        </span>
        <span class="priority-badge ${t.priority}">${t.priority}</span>
      </div>
      ${due ? `<div class="task-due ${overdue?'overdue':''}" style="margin-top:8px;font-size:11px">📅 ${due}${overdue?' · Overdue':''}</div>` : ''}
    </div>`;
}

function bindTaskCardEvents() {
  document.querySelectorAll('.task-btn.edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openEditModal(btn.dataset.id);
    });
  });
  document.querySelectorAll('.task-btn.delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Delete this task?')) deleteTask(btn.dataset.id);
    });
  });
}

/* ── Team Tracer ────────────────────────────── */
function renderTracer(allTasks) {
  const memberMap = {
    'Huzaifa':      'huzaifa',
    'Maryam Duryab':'maryam',
    'Mohsin':       'mohsin',
  };
  Object.entries(memberMap).forEach(([member, key]) => {
    const el = document.getElementById(`trace-${key}`);
    const mTasks = allTasks.filter(t => t.member === member);
    el.innerHTML = mTasks.length ? mTasks.map(t => `
      <div class="tracer-task-item">
        <span class="tracer-task-name">${escHtml(t.title)}</span>
        <span class="status-pill ${t.status}">${statusLabel(t.status)}</span>
      </div>`).join('') : `<div class="tracer-empty">No tasks assigned</div>`;
  });
}

/* ── Members ────────────────────────────────── */
function renderMembers(allTasks) {
  const defs = [
    { id:'huzaifa',  member:'Huzaifa' },
    { id:'maryam',   member:'Maryam Duryab' },
    { id:'mohsin',   member:'Mohsin' },
  ];
  defs.forEach(({id, member}) => {
    const el = document.getElementById(`mc-${id}`);
    const mTasks = allTasks.filter(t => t.member === member);
    const done = mTasks.filter(t=>t.status==='complete').length;
    const prog = mTasks.filter(t=>t.status==='in_progress').length;
    const pend = mTasks.filter(t=>t.status==='pending').length;
    el.innerHTML = `
      <div class="mc-stat">
        <div class="mc-stat-num" style="color:var(--accent-green)">${done}</div>
        <div class="mc-stat-label">Done</div>
      </div>
      <div class="mc-stat">
        <div class="mc-stat-num" style="color:var(--accent-amber)">${prog}</div>
        <div class="mc-stat-label">Active</div>
      </div>
      <div class="mc-stat">
        <div class="mc-stat-num" style="color:var(--accent-red)">${pend}</div>
        <div class="mc-stat-label">Pending</div>
      </div>`;
  });
}

/* ── Modal ──────────────────────────────────── */
function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'New Task';
  document.getElementById('taskId').value = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskMember').value = 'Huzaifa';
  document.getElementById('taskStatus').value = 'pending';
  document.querySelector('input[name="priority"][value="medium"]').checked = true;
  document.getElementById('taskDue').value = '';
  modalOverlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function openEditModal(id) {
  const task = tasks.find(t => t.id === id || t.id === parseInt(id));
  if (!task) return;
  editingId = task.id;
  document.getElementById('modalTitle').textContent = 'Edit Task';
  document.getElementById('taskId').value = task.id;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.description || '';
  document.getElementById('taskMember').value = task.member;
  document.getElementById('taskStatus').value = task.status;
  const pri = document.querySelector(`input[name="priority"][value="${task.priority}"]`);
  if (pri) pri.checked = true;
  document.getElementById('taskDue').value = task.due_date || '';
  modalOverlay.classList.add('open');
}

function closeModal() { modalOverlay.classList.remove('open'); }

/* ── Toast ──────────────────────────────────── */
let toastTimer;
function showToast(msg, type='info') {
  toastEl.textContent = msg;
  toastEl.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); }, 3000);
}

/* ── Animated Counter ───────────────────────── */
function animCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const dur = 600;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / dur, 1);
    el.textContent = Math.round(start + (target - start) * easeOut(progress));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function easeOut(t) { return 1 - Math.pow(1-t, 3); }

/* ── Scroll Animation ───────────────────────── */
function animateOnScroll() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.style.animationPlayState = 'running';
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('[data-anim]').forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });
}

/* ── Helpers ────────────────────────────────── */
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function memberClass(member) {
  if (member === 'Huzaifa')      return 'huzaifa';
  if (member === 'Maryam Duryab')return 'maryam';
  return 'mohsin';
}

function memberInitial(member) {
  if (member === 'Huzaifa')      return 'H';
  if (member === 'Maryam Duryab')return 'M';
  return 'Mo';
}

function statusLabel(s) {
  return { pending:'Pending', in_progress:'In Progress', complete:'Complete' }[s] || s;
}
function priorityLabel(p) {
  return { low:'Low', medium:'Medium', high:'High' }[p] || p;
}
function statusToId(s) {
  return { pending:'pending', in_progress:'inprogress', complete:'complete' }[s];
}

function formatDue(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString());
}
