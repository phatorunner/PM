/* =====================================================================
   ACTIONS · INPUT HANDLERS · DRAG & DROP · KEYBOARD · INIT
   ===================================================================== */
import { $, $$, TODAY, addD, dOff, esc, fmtDate, iso, parse, uid } from '../core/utils.js';
import { PR, PSTAT, ST } from '../core/constants.js';
import { seed } from '../data/seed.js';
import { D, DEFAULT_PREFS, GOOGLE_CLIENT_ID, S, allTasks, calcomState, canSee, commentsOf, contact, gcalState, logAct, me, meeting, mem, proj, save, task, tasksOf, visibleProjects } from '../core/store.js';
import { fileType, fsize } from '../ui/helpers.js';
import { effectiveDark } from '../core/theme.js';
import { mutate, toast } from '../ui/toast.js';
import { autosize, focusKey, fxSet, go, render } from '../shell/render.js';
import { viewOf } from '../shell/view-engine.js';
import { TEMPLATES, closeModal, openModal } from '../overlays/modals.js';
import { closePop, openPop, tgt } from '../overlays/popovers.js';
import { strengthMeter } from '../pages/settings.js';
import { apiRequestRescheduleBooking, apiRescheduleBooking, startCalcomPolling, syncCalcom } from '../features/calcom-sync.js';
import { fetchGoogleUserProfile, requestGoogleOAuth, syncGoogleCalendar } from '../core/gcal.js';
import { chooseLocalFolder, createRecoveryBackup, disconnectLocalFolder, reconnectLocalFolder, saveAttachmentContent, triggerAutosave } from '../features/fs-storage.js';
import { applyPwaUpdate, promptInstallApp } from '../features/pwa.js';

export const A = {},
  IN = {},
  KEY = {},
  DBL = {},
  BLUR = {};

/* ---------- task mutations ---------- */
export function nextKey(p) {
  p.seq = (p.seq || 200) + 1;
  return p.key + '-' + p.seq;
}
export function createTask(f) {
  const p = proj(f.project) || visibleProjects().find(canSee);
  const maxO = Math.max(0, ...D().tasks.map(t => t.order));
  const t = Object.assign(
    {
      project: p.id,
      title: 'Untitled',
      status: 'todo',
      assignee: null,
      priority: 'none',
      due: null,
      start: null,
      labels: [],
      subtasks: [],
      attachments: [],
      deps: [],
      desc: '',
      estimate: null,
      phase: 1,
      created: Date.now(),
      updated: Date.now(),
      order: maxO + 1,
      fav: false,
      recur: null,
    },
    f,
    { project: p.id },
  );
  t.id = f.id || uid('t');
  t.key = f.key || nextKey(p);
  D().tasks.push(t);
  fxSet({ added: t.id });
  logAct('created', t);
  return t;
}
export const RECUR_DAYS = { Daily: 1, Weekly: 7, 'Every 2 weeks': 14, Monthly: 30 };
export function applyPatch(t, patch) {
  const msgs = [];
  for (const k of Object.keys(patch)) {
    const old = t[k],
      nv = patch[k];
    if (JSON.stringify(old) === JSON.stringify(nv)) continue;
    t[k] = nv;
    if (k === 'status') {
      if (nv === 'done') {
        t.completedAt = Date.now();
        t.prevStatus = old;
        logAct('completed', t);
        fxSet({ done: t.id });
      } else logAct('moved', t, `from ${ST[old].name} to ${ST[nv].name}`);
      if (nv === 'done' && t.recur && t.due) {
        const nd = iso(addD(parse(t.due), RECUR_DAYS[t.recur] || 7));
        const n = createTask({
          ...JSON.parse(JSON.stringify(t)),
          id: undefined,
          key: undefined,
          status: 'todo',
          due: nd,
          start: nd,
          subtasks: t.subtasks.map(s => ({ ...s, done: false })),
          completedAt: null,
          attachments: [],
        });
        delete n.prevStatus;
        msgs.push(`Next “${t.title}” scheduled for ${fmtDate(nd)}`);
      }
    } else if (k === 'assignee') logAct('assigned', t, nv ? `to ${mem(nv)?.name}` : '(unassigned)');
    else if (k === 'priority') logAct('changed priority of', t, `to ${PR[nv].name}`);
    else if (k === 'due') logAct('changed due date of', t, nv ? `to ${fmtDate(nv)}` : '(cleared)');
    else if (k === 'start') logAct('changed start date of', t, nv ? `to ${fmtDate(nv)}` : '(cleared)');
    else if (k === 'project') {
      const p = proj(nv);
      t.key = nextKey(p);
      logAct('moved', t, `to ${p.name}`);
    } else if (k === 'labels') logAct('updated labels on', t);
    else if (k === 'title') logAct('renamed', t, `to “${nv}”`);
    else if (k === 'recur') logAct('set repeat on', t, nv ? nv.toLowerCase() : 'off');
    else if (k === 'estimate') logAct('estimated', t, nv || 'none');
    else if (k === 'phase') logAct('moved to phase', t, `P${nv || 1}`);
    else if (k === 'deps') logAct('updated dependencies of', t);
    t.updated = Date.now();
  }
  return msgs;
}
export function updateTask(id, patch) {
  if (id === '__form') {
    Object.assign(S.ui.form, patch);
    render();
    return;
  }
  const t = task(id);
  if (!t) return;
  let msgs = [];
  if (
    mutate(() => {
      msgs = applyPatch(t, patch);
    })
  )
    msgs.forEach(m => toast(m, { kind: 'info' }));
}
export function confirmDlg(o) {
  S.ui.confirmText = '';
  openModal({ type: 'confirm', ...o });
}
export function snapshot() {
  return JSON.stringify(S.data);
}
export function restore(snap) {
  S.data = JSON.parse(snap);
  save();
  triggerAutosave();
  render();
}
export async function copy(text, msg = 'Link copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    toast("Copy isn't available here — " + text, { kind: 'info', ms: 6000 });
  }
}
export function loadingBtn(id, ms, fn) {
  const b = document.getElementById(id);
  if (b) {
    b.classList.add('is-loading');
    b.setAttribute('aria-busy', 'true');
  }
  setTimeout(fn, ms);
}
export function curProjectId() {
  if (S.ui.route === 'project') return S.ui.params.id;
  return null;
}
export function projectFromKey(key) {
  if (!key) return null;
  if (key.startsWith('p:')) return key.slice(2);
  if (key.startsWith('sv:')) return D().savedViews.find(v => v.id === key.slice(3))?.project;
  return null;
}

/* ---------- navigation ---------- */
A.go = el => {
  const r = el.dataset.r;
  const p = {};
  if (el.dataset.id) p.id = el.dataset.id;
  if (el.dataset.tab) p.tab = el.dataset.tab;
  else if (r === 'project') p.tab = S.prefs.defaultTab || 'board';
  if (el.dataset.sec) p.sec = el.dataset.sec;
  S.ui.palette = null;
  const tabOnly = r === 'project' && S.ui.route === 'project' && S.ui.params.id === p.id;
  go(r, p, { tab: tabOnly });
};
A.back = () => {
  const h = S.ui.history.pop();
  if (h) go(h.route, h.params, { back: true });
  else go('home');
};
A.switchTab = el => {
  const id = el.dataset.id;
  const tab = S.ui.browserTabs.find(t => t.id === id);
  if (!tab) return;
  S.ui.activeTabId = id;
  save();
  go(tab.route, tab.params);
};
A.closeTab = (el, e) => {
  if (e) e.stopPropagation();
  const id = el.dataset.id;
  const tabs = S.ui.browserTabs;
  if (tabs.length <= 1) return;
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  tabs.splice(idx, 1);
  if (S.ui.activeTabId === id) {
    const nextTab = tabs[Math.min(idx, tabs.length - 1)];
    S.ui.activeTabId = nextTab.id;
    save();
    go(nextTab.route, nextTab.params);
  } else {
    save();
    render();
  }
};
A.addTab = () => {
  // Opens a new tab defaulting to Home
  go('home', {}, { newTab: true });
};
A.openProject = el => go('project', { id: el.dataset.id, tab: S.prefs.defaultTab || 'board' });
A.set = el => {
  const k = el.dataset.k;
  let v = el.dataset.v;
  if (/Tab$|Cat$|Mode$|View$/.test(k)) fxSet({ tabs: true });
  if (k === 'inboxSel' && !v) v = null;
  S.ui[k] = v;
  if (k === 'membersTab' || k === 'searchCat') S.ui.pop = null;
  render();
};
A.toggleSide = () => {
  S.ui.collapsed = !S.ui.collapsed;
  save();
  render();
};
A.openMnav = () => {
  S.ui.mnav = true;
  render();
};
A.closeMnav = () => {
  S.ui.mnav = false;
  render();
};
A.toggleExpand = el => {
  S.ui.expanded[el.dataset.id] = !S.ui.expanded[el.dataset.id];
  render();
};
A.goTasks = el => {
  const f = el.dataset.f;
  const v = viewOf('tasks');
  v.mode = 'list';
  v.filters =
    f === 'open'
      ? [{ f: 'status', op: 'not', v: ['done'] }]
      : f === 'done'
        ? [
            { f: 'status', op: 'is', v: ['done'] },
            { f: 'updated', op: 'is', v: ['7'] },
          ]
        : f === 'overdue'
          ? [{ f: 'due', op: 'is', v: ['overdue'] }]
          : [];
  go('tasks');
};
A.goFilteredList = el => {
  const v = viewOf('p:' + el.dataset.id);
  v.filters = [{ f: 'status', op: 'is', v: [el.dataset.st] }];
  v.group = 'status';
  go('project', { id: el.dataset.id, tab: 'list' }, { tab: true });
};

/* ---------- theme ---------- */
A.setTheme = el => {
  S.prefs.theme = el.dataset.v;
  save();
  render();
};
A.toggleDark = () => {
  S.prefs.theme = effectiveDark() ? 'light' : 'dark';
  save();
  S.ui.palette = null;
  render();
  toast(effectiveDark() ? 'Dark mode on' : 'Light mode on', { kind: 'info', ms: 1800 });
};
A.setPref = el => {
  S.prefs[el.dataset.k] = el.dataset.v;
  save();
  render();
};

/* ---------- popovers ---------- */
A.pop = el => {
  const d = el.dataset;
  const p = S.ui.pop;
  if (p && p.type === d.pop && p.id === d.id && p.key === d.key && p.i == (d.i != null ? +d.i : undefined) && p.field === d.field) {
    closePop();
    return;
  }
  openPop(el);
};
A.ctxBtn = el => {
  const r = el.getBoundingClientRect();
  const d = el.dataset;
  const p = S.ui.pop;
  if (p && p.type === 'ctx' && p.id === d.id && p.ctx === d.ctx) {
    closePop();
    return;
  }
  S.ui.pop = { type: 'ctx', ctx: d.ctx, id: d.id, key: d.key, vid: d.vid, x: r.left, y: r.bottom + 4, top: r.top, w: r.width };
  render();
};
A.popPick = el => {
  const p = S.ui.pop;
  let v = el.dataset.v;
  if (p.type === 'subassignee' || (p.type === 'date' && p.field === 'subdue')) {
    const t = task(p.id);
    const sb = t?.subtasks[p.i];
    if (!sb) return;
    const k = p.type === 'subassignee' ? 'assignee' : 'due';
    v = v || null;
    S.ui.pop = null;
    mutate(() => {
      sb[k] = v;
      logAct(
        k === 'assignee' ? 'assigned a subtask on' : 'set a subtask due date on',
        t,
        k === 'assignee' ? (v ? `to ${mem(v).name}` : '(unassigned)') : v ? fmtDate(v) : '(cleared)',
      );
    });
    return;
  }
  if (p.type === 'pstatus') {
    const pr = proj(p.id);
    mutate(() => {
      pr.status = v;
      D().activity.unshift({
        id: uid('a'),
        by: D().me,
        verb: 'changed status of project',
        task: null,
        project: pr.id,
        at: Date.now(),
        extra: 'to ' + PSTAT[v].name,
      });
    });
    S.ui.pop = null;
    render();
    toast(`${pr.name} marked ${PSTAT[v].name}`);
    return;
  }
  if (p.type === 'role') {
    const m = mem(p.id);
    mutate(() => {
      m.role = v;
    });
    S.ui.pop = null;
    render();
    toast(`${m.name} is now ${v === 'Admin' ? 'an' : 'a'} ${v}`);
    return;
  }
  const field = { status: 'status', priority: 'priority', assignee: 'assignee', project: 'project', recur: 'recur', estimate: 'estimate', phase: 'phase', date: p.field }[
    p.type
  ];
  if (!field) return;
  if (field === 'phase') v = v ? Number(v) : null;
  if (field === 'assignee' && !v) v = null;
  if (field === 'recur' && v === 'Does not repeat') v = null;
  if ((field === 'estimate' || field === 'due' || field === 'start') && !v) v = null;
  S.ui.pop = null;
  const patch = { [field]: v };
  if (field === 'due' && v && p.id !== '__form') {
    const t = task(p.id);
    if (t.start && t.start > v) patch.start = v;
  }
  updateTask(p.id, patch);
};
A.popToggleLabel = el => {
  const p = S.ui.pop;
  const t = tgt(p);
  const v = el.dataset.v;
  const labels = t.labels.includes(v) ? t.labels.filter(x => x !== v) : [...t.labels, v];
  updateTask(p.id, { labels });
};
A.popToggleDep = el => {
  const p = S.ui.pop;
  const t = task(p.id);
  const v = el.dataset.v;
  updateTask(p.id, { deps: t.deps.includes(v) ? t.deps.filter(x => x !== v) : [...t.deps, v] });
};
A.popMonth = el => {
  const p = S.ui.pop;
  const m = parse(p.m);
  p.m = iso(new Date(m.getFullYear(), m.getMonth() + +el.dataset.d, 1));
  render();
};
IN.popQ = el => {
  if (S.ui.pop) {
    S.ui.pop.q = el.value;
    render();
  }
};
export const ctxTo = type => () => {
  S.ui.pop = { ...S.ui.pop, type, q: '' };
  if (type === 'date') S.ui.pop.m = iso(TODAY);
  render();
};
A.ctxStatus = ctxTo('status');
A.ctxAssign = ctxTo('assignee');
A.ctxPrio = ctxTo('priority');
A.ctxMove = ctxTo('project');
A.ctxRole = ctxTo('role');

/* ---------- tasks ---------- */
A.openTask = el => {
  const id = el.dataset.id;
  if (!task(id)) return;
  if (!canSee(proj(task(id).project))) {
    toast("You don't have access to that task", { kind: 'err' });
    return;
  }
  if (!S.ui.drawer || !document.activeElement?.closest?.('.drawer')) S.ui.drawerOpener = el.isConnected ? focusKey(el) : S.ui.drawerOpener;
  S.ui.drawer = id;
  S.ui.drawerFull = S.prefs.openTasks === 'full' || (S.ui.drawerFull && S.ui.drawer === id);
  S.ui.pop = null;
  S.ui.palette = null;
  S.ui.modals = [];
  S.ui.mention = null;
  S.ui.subOpen = null;
  S.ui.drawerTab = S.ui.drawerTab || 'comments';
  clearTimeout(A._closeDrawerTimer);
  render();
  const dr = $('.drawer');
  if (dr && !dr.contains(document.activeElement)) dr.focus({ preventScroll: true });
};
A.closeDrawer = () => {
  const dr = $('.drawer');
  const scrim = $('.drawer-scrim');
  if (dr && !dr.classList.contains('leave')) {
    dr.classList.remove('enter');
    dr.classList.add('leave');
    if (scrim) {
      scrim.classList.remove('enter');
      scrim.classList.add('leave');
    }
    clearTimeout(A._closeDrawerTimer);
    A._closeDrawerTimer = setTimeout(() => {
      S.ui.drawer = null;
      S.ui.drawerFull = false;
      S.ui.subOpen = null;
      render();
    }, 220);
    return;
  }
  clearTimeout(A._closeDrawerTimer);
  S.ui.drawer = null;
  S.ui.drawerFull = false;
  S.ui.subOpen = null;
  render();
};
A.skipToContent = () => {
  const c = $('#main-content');
  c?.focus();
};
A.projUp = el => A._projMove(el, -1);
A.projDown = el => A._projMove(el, 1);
A._projMove = (el, d) => {
  const vis = visibleProjects().map(p => p.id);
  const i = vis.indexOf(el.dataset.id);
  const j = i + d;
  if (j < 0 || j >= vis.length) return;
  const o = D().projOrder;
  const a = o.indexOf(vis[i]),
    b = o.indexOf(vis[j]);
  [o[a], o[b]] = [o[b], o[a]];
  S.ui.pop = null;
  save();
  render();
  toast(`Moved ${proj(el.dataset.id).name} ${d < 0 ? 'up' : 'down'}`, { ms: 1600 });
};
A.toggleDrawerFull = () => {
  S.ui.drawerFull = !S.ui.drawerFull;
  render();
};
A.toggleDone = el => {
  const t = task(el.dataset.id);
  if (!t) return;
  const wasDone = t.status === 'done';
  S.ui.pop = null;
  updateTask(t.id, { status: wasDone ? (t.prevStatus && t.prevStatus !== 'done' ? t.prevStatus : 'todo') : 'done' });
  if (!wasDone && !S.ui.offline) toast(`Completed “${t.title}”`, { action: 'Undo', onAction: () => updateTask(t.id, { status: t.prevStatus || 'todo' }) });
};
A.toggleFavTask = el => {
  const t = task(el.dataset.id);
  mutate(() => {
    t.fav = !t.fav;
  });
  S.ui.pop = null;
  toast(t.fav ? 'Added to favorites' : 'Removed from favorites', { ms: 1800 });
  render();
};
A.toggleFavProj = el => {
  const p = proj(el.dataset.id);
  mutate(() => {
    p.fav = !p.fav;
  });
  S.ui.pop = null;
  render();
  toast(p.fav ? `Added ${p.name} to favorites` : 'Removed from favorites', { ms: 1800 });
};
A.copyLink = el => {
  S.ui.pop = null;
  render();
  const d = el.dataset;
  const path =
    d.id && task(d.id)
      ? `task/${task(d.id).key}`
      : d.pid
        ? `project/${proj(d.pid).key.toLowerCase()}`
        : d.fid
          ? `file/${d.fid}`
          : d.id && proj(d.id)
            ? `project/${proj(d.id).key.toLowerCase()}`
            : '';
  copy(`https://gr8rstudio.com/${D().ws.url}/${path}`);
};
A.copyText = el => copy(el.dataset.text, 'Copied to clipboard');
A.copyEmail = el => {
  S.ui.pop = null;
  render();
  copy(mem(el.dataset.id).email, 'Email copied');
};
A.dupTask = el => {
  const t = task(el.dataset.id);
  S.ui.pop = null;
  let n;
  mutate(() => {
    n = createTask({ ...JSON.parse(JSON.stringify(t)), id: uid('t'), key: undefined, title: t.title + ' (copy)', created: Date.now(), fav: false });
    n.key = nextKey(proj(n.project));
  });
  toast('Task duplicated', { action: 'Open', onAction: () => A.openTask({ dataset: { id: n.id } }) });
};
A.archiveTask = el => {
  const t = task(el.dataset.id);
  const snap = snapshot();
  S.ui.pop = null;
  if (S.ui.drawer === t.id) S.ui.drawer = null;
  mutate(() => {
    t.archived = true;
    t.archivedAt = Date.now();
    logAct('archived', t);
  });
  toast(`Archived “${t.title}”`, { action: 'Undo', onAction: () => restore(snap) });
};
export function deleteTasks(ids) {
  const set = new Set(ids);
  D().tasks = D().tasks.filter(t => !set.has(t.id));
  D().tasks.forEach(t => (t.deps = t.deps.filter(d => !set.has(d))));
  D().comments = D().comments.filter(c => !set.has(c.task));
  if (set.has(S.ui.drawer)) S.ui.drawer = null;
  ids.forEach(i => S.ui.sel.delete(i));
}
A.delTask = el => {
  const t = task(el.dataset.id);
  S.ui.pop = null;
  if (!t) return;
  const run = () => {
    const snap = snapshot();
    if (mutate(() => deleteTasks([t.id]))) toast(`Deleted “${t.title}”`, { action: 'Undo', onAction: () => restore(snap) });
  };
  if (S.prefs.confirmDel === false && !el.dataset.demo) return run();
  confirmDlg({
    title: 'Delete task?',
    body: `<b>${esc(t.title)}</b>${t.subtasks.length ? `, its ${t.subtasks.length} subtasks,` : ''} and ${commentsOf(t.id).length} comment${commentsOf(t.id).length === 1 ? '' : 's'} will be permanently deleted.`,
    ok: 'Delete task',
    danger: true,
    run,
  });
};
A.editTask = el => {
  const t = task(el.dataset.id);
  if (!t) return;
  S.ui.form = {
    title: t.title,
    desc: (t.desc || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    project: t.project,
    status: t.status,
    assignee: t.assignee,
    priority: t.priority,
    due: t.due,
    start: t.start,
    labels: [...t.labels],
    subtasks: t.subtasks.map(s => ({ ...s })),
    files: [],
    recur: t.recur,
    phase: t.phase || 1,
    more: false,
  };
  S.ui.errors = {};
  openModal({ type: 'task', edit: t.id });
};
A.newTask = el => {
  const d = el?.dataset || {};
  const validProjects = visibleProjects().filter(canSee);
  if (!validProjects.length) {
    toast('Create a project first before adding tasks', { kind: 'warn' });
    openModal({ type: 'project' });
    return;
  }
  const pid =
    (d.project && canSee(proj(d.project)) ? d.project : null) ||
    (curProjectId() && canSee(proj(curProjectId())) ? curProjectId() : null) ||
    (projectFromKey(S.ui.composer?.ctx) && canSee(proj(projectFromKey(S.ui.composer?.ctx))) ? projectFromKey(S.ui.composer?.ctx) : null) ||
    (S.ui.drawer && task(S.ui.drawer) && canSee(proj(task(S.ui.drawer)?.project)) ? task(S.ui.drawer)?.project : null) ||
    validProjects.find(p => p.status !== 'complete')?.id ||
    validProjects[0]?.id;
  S.ui.form = {
    title: '',
    desc: '',
    project: pid,
    status: 'todo',
    assignee: d.assignee || D().me,
    priority: 'medium',
    due: d.due || null,
    start: null,
    labels: [],
    subtasks: [],
    files: [],
    recur: null,
    phase: d.phase ? Number(d.phase) : 1,
    more: S.ui.form?.more || false,
  };
  S.ui.errors = {};
  openModal({ type: 'task' });
};
IN.form = el => {
  S.ui.form[el.dataset.f] = el.value;
  if (el.dataset.f === 'title' && S.ui.errors.title && el.value.trim()) {
    S.ui.errors.title = null;
    render();
  }
};
IN.formMore = el => {
  S.ui.form.more = el.checked;
};
IN.formFiles = el => {
  [...el.files].forEach(f => S.ui.form.files.push({ file: f, name: f.name, size: fsize(f.size), type: fileType(f.name) }));
  render();
};
KEY.formAddSub = el => {
  const v = el.value.trim();
  if (!v) return;
  S.ui.form.subtasks.push({ id: uid('s'), title: v, done: false });
  render();
  setTimeout(() => $('#f-sub')?.focus(), 0);
};
A.formRmSub = el => {
  S.ui.form.subtasks.splice(+el.dataset.i, 1);
  render();
};
A.formRmFile = el => {
  S.ui.form.files.splice(+el.dataset.i, 1);
  render();
};
A.submitTask = () => {
  const m = S.ui.modals[S.ui.modals.length - 1];
  const f = S.ui.form;
  const title = ($('#f-title')?.value ?? f.title).trim();
  f.title = title;
  f.desc = $('#f-desc')?.value ?? f.desc;
  if (!title) {
    S.ui.errors.title = 'Give the task a name';
    render();
    $('#f-title')?.focus();
    return;
  }
  S.ui.errors = {};
  const files = f.files.map(x => {
    const aid = uid('a');
    if (x.file) saveAttachmentContent(x.file, aid).catch(() => {});
    return { id: aid, name: x.name, type: x.type, size: x.size, by: D().me, at: Date.now() };
  });
  const base = {
    title,
    project: f.project,
    status: f.status,
    assignee: f.assignee,
    priority: f.priority,
    due: f.due,
    start: f.start && f.due && f.start > f.due ? f.due : f.start,
    labels: f.labels,
    recur: f.recur,
    phase: f.phase ? Number(f.phase) : 1,
    subtasks: f.subtasks,
  };
  if (m.edit) {
    const t = task(m.edit);
    if (
      !mutate(() => {
        applyPatch(t, base);
        if (
          f.desc !==
          (t.desc || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        )
          t.desc = f.desc ? `<p>${esc(f.desc)}</p>` : '';
        t.attachments.push(...files);
      })
    )
      return;
    S.ui.modals.pop();
    render();
    toast('Changes saved');
    return;
  }
  let t;
  if (
    !mutate(() => {
      t = createTask({ ...base, desc: f.desc ? `<p>${esc(f.desc)}</p>` : '', attachments: files });
      files.forEach(x => D().files.unshift({ ...x, project: t.project, task: t.id }));
    })
  )
    return;
  if (f.more) {
    Object.assign(f, { title: '', desc: '', subtasks: [], files: [] });
    render();
    setTimeout(() => $('#f-title')?.focus(), 0);
    toast(`Created ${t.key}`, { ms: 2000 });
    return;
  }
  S.ui.modals.pop();
  fxSet({ added: t.id });
  render();
  toast(`Created ${t.key}${proj(t.project)?.name ? ` in ${proj(t.project).name}` : ''}`, { action: 'Open', onAction: () => A.openTask({ dataset: { id: t.id } }) });
};

/* inline composer */
A.startComposer = el => {
  S.ui.composer = { ctx: el.dataset.ctx, group: el.dataset.group, gb: JSON.parse(el.dataset.gb || '{}') };
  S.ui.pop = null;
  render();
  setTimeout(() => $('#composer-in')?.focus(), 0);
};
A.cancelComposer = () => {
  S.ui.composer = null;
  render();
};
KEY.commitComposer = () => A.commitComposer();
A.commitComposer = () => {
  const c = S.ui.composer;
  const el = $('#composer-in');
  const v = el?.value.trim();
  if (!c) return;
  if (!v) {
    A.cancelComposer();
    return;
  }
  const f = { title: v, ...c.gb };
  const validProjects = visibleProjects().filter(canSee);
  f.project = f.project || projectFromKey(c.ctx) || curProjectId() || validProjects[0]?.id;
  if (!f.project) {
    toast('Create a project first before adding tasks', { kind: 'warn' });
    openModal({ type: 'project' });
    return;
  }
  if (c.ctx === 'mytasks') f.assignee = D().me;
  mutate(() => createTask(f));
  setTimeout(() => $('#composer-in')?.focus(), 0);
};
KEY.commitTitle = el => DBL._commitTitle(el);
DBL.editTitle = el => {
  const row = el.closest('[data-task-row]');
  if (!row) return;
  S.ui.drawer = null;
  S.ui.editCell = { id: row.dataset.taskRow, f: 'title' };
  render();
  const i = $('#edit-title');
  if (i) {
    i.focus();
    i.select();
  }
};
DBL._commitTitle = el => {
  const c = S.ui.editCell;
  if (!c) return;
  S.ui.editCell = null;
  const v = el.value.trim();
  if (v && v !== task(c.id).title) updateTask(c.id, { title: v });
  else render();
};
DBL.editCell = el => {
  S.ui.drawer = null;
  S.ui.editCell = { id: el.dataset.id || el.closest('[data-id]').dataset.id, f: el.dataset.f };
  render();
  const i = $('#edit-cell');
  if (i) {
    i.focus();
    i.select();
  }
};
A.editCell = el => DBL.editCell(el);
KEY.commitCell = el => {
  const c = S.ui.editCell;
  if (!c) return;
  S.ui.editCell = null;
  const v = el.value.trim();
  if (c.f === 'title' && !v) {
    render();
    return;
  }
  updateTask(c.id, { [c.f]: v || null });
};
BLUR.commitCell = el => KEY.commitCell(el);
BLUR.commitTitle = el => DBL._commitTitle(el);
BLUR.commitDrawerTitle = el => {
  const t = task(el.dataset.id);
  const v = el.value.trim();
  if (t && v && v !== t.title) updateTask(t.id, { title: v });
};
KEY.blur = el => el.blur();

/* subtasks */
A.toggleSub = el => {
  const t = task(el.dataset.id);
  const s = t.subtasks.find(x => x.id === el.dataset.sid);
  if (!s.done) fxSet({ done: s.id });
  mutate(() => {
    s.done = !s.done;
    logAct(s.done ? 'completed subtask on' : 'reopened subtask on', t, `“${s.title}”`);
  });
};
A.rmSub = el => {
  const t = task(el.dataset.id);
  mutate(() => {
    t.subtasks = t.subtasks.filter(x => x.id !== el.dataset.sid);
  });
};
KEY.addSub = el => {
  const t = task(el.dataset.id);
  const v = el.value.trim();
  if (!v) return;
  const nid = uid('s');
  fxSet({ added: nid });
  mutate(() => {
    t.subtasks.push({ id: nid, title: v, done: false });
    logAct('added subtask to', t, `“${v}”`);
  });
  setTimeout(() => $('#d-sub')?.focus(), 0);
};
A.expandRow = el => {
  S.ui.openTasks[el.dataset.id] = !S.ui.openTasks[el.dataset.id];
  render();
};

/* attachments */
A.rmAttach = el => {
  const t = task(el.dataset.id);
  const f = t.attachments.find(a => a.id === el.dataset.aid);
  mutate(() => {
    t.attachments = t.attachments.filter(a => a.id !== el.dataset.aid);
    logAct('removed a file from', t);
  });
  toast(`Removed ${f.name}`);
};
A.filePreview = el => {
  const t = task(el.dataset.tid);
  const f = t.attachments.find(a => a.id === el.dataset.aid);
  openModal({ type: 'filePreview', file: f, tid: t.id });
};
A.previewFile = el => {
  const f = D().files.find(x => x.id === el.dataset.id);
  S.ui.pop = null;
  if (f) openModal({ type: 'filePreview', file: f, tid: f.task });
};
export function handleFiles(files, ctx) {
  if (!files || !files.length) return;
  if (S.ui.offline) {
    toast("Upload failed — you're offline.", { kind: 'err', action: 'Try again', onAction: () => {} });
    return;
  }
  S.ui.uploads = S.ui.uploads || [];
  [...files].forEach(file => {
    const up = { id: uid('u'), name: file.name, size: fsize(file.size), project: ctx.project, task: ctx.task, pct: 0 };
    S.ui.uploads.push(up);
    const iv = setInterval(() => {
      up.pct = Math.min(100, up.pct + 9 + Math.round(Math.random() * 22));
      const bar = document.getElementById('upbar-' + up.id),
        pc = document.getElementById('upct-' + up.id);
      if (bar) bar.style.setProperty('--p', up.pct / 100);
      if (pc) pc.textContent = up.pct + '%';
      if (up.pct >= 100) {
        clearInterval(iv);
        S.ui.uploads = S.ui.uploads.filter(x => x !== up);
        const fileId = uid('f');
        const rec = { id: fileId, name: up.name, type: fileType(up.name), size: up.size, by: D().me, at: Date.now() };

        // Save physical file contents to /attachments/ folder before updating JSON references
        saveAttachmentContent(file, fileId)
          .then(diskPath => {
            if (diskPath) rec.path = diskPath;
          })
          .catch(() => {})
          .finally(() => {
            D().files.unshift({ ...rec, project: up.project, task: up.task || null });
            if (up.task) {
              const t = task(up.task);
              t.attachments.push(rec);
              logAct('added a file to', t, up.name);
            }
            save();
            triggerAutosave();
            render();
            toast(`Uploaded ${up.name}`);
          });
      }
    }, 220);
  });
  render();
}
IN.uploadFiles = el => {
  handleFiles(el.files, { project: el.dataset.project, task: el.dataset.task });
  el.value = '';
};

/* comments */
IN.draft = el => {
  const id = el.dataset.id;
  S.ui.drafts[id] = el.value;
  const before = el.value.slice(0, el.selectionStart);
  const m = before.match(/(?:^|\s)@([A-Za-z]*)$/);
  const prev = JSON.stringify(S.ui.mention);
  S.ui.mention = m ? { tid: id, q: m[1] } : null;
  if (prev !== JSON.stringify(S.ui.mention)) render();
  if (el.dataset.autosize != null) autosize(el);
};
A.pickMention = el => {
  const id = el.dataset.id;
  const d = S.ui.drafts[id] || '';
  S.ui.drafts[id] = d.replace(/@([A-Za-z]*)$/, '@' + el.dataset.name + ' ');
  S.ui.mention = null;
  render();
  const ta = $('#d-cmt');
  if (ta) {
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
};
A.insertAt = el => {
  const id = el.dataset.id;
  const d = S.ui.drafts[id] || '';
  S.ui.drafts[id] = d + (d && !d.endsWith(' ') ? ' @' : '@');
  S.ui.mention = { tid: id, q: '' };
  render();
  const ta = $('#d-cmt');
  if (ta) {
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
};
KEY.postComment = el => A.postComment(el);
A.postComment = el => {
  const id = el.dataset.id;
  const txt = (S.ui.drafts[id] || '').trim();
  if (!txt) {
    $('#d-cmt, #inbox-reply')?.focus();
    return;
  }
  const t = task(id);
  if (
    mutate(() => {
      D().comments.push({ id: uid('c'), task: id, by: D().me, at: Date.now(), text: txt, re: {} });
      logAct('commented on', t);
      S.ui.drafts[id] = '';
      S.ui.mention = null;
      S.ui.drawerTab = 'comments';
    })
  ) {
    if (S.ui.route === 'inbox') toast('Reply posted');
  }
};
A.delComment = el => {
  const c = D().comments.find(x => x.id === el.dataset.id);
  const snap = snapshot();
  mutate(() => {
    D().comments = D().comments.filter(x => x !== c);
  });
  toast('Comment deleted', { action: 'Undo', onAction: () => restore(snap) });
};
A.react = el => {
  const c = D().comments.find(x => x.id === el.dataset.id);
  const e = el.dataset.e;
  S.ui.pop = null;
  mutate(() => {
    c.re = c.re || {};
    const l = c.re[e] || [];
    c.re[e] = l.includes(D().me) ? l.filter(x => x !== D().me) : [...l, D().me];
  });
};

/* rich text description */
document.addEventListener('mousedown', e => {
  const b = e.target.closest('[data-cmd]');
  if (!b) return;
  e.preventDefault();
  const [cmd, arg] = b.dataset.cmd.split(':');
  if (cmd === 'createLink') {
    const s = String(getSelection());
    if (/^https?:\/\//.test(s)) document.execCommand('createLink', false, s);
    else toast('Select a URL starting with https:// to turn it into a link', { kind: 'info' });
  } else document.execCommand(cmd, false, arg ? `<${arg}>` : null);
  const ed = $('#d-desc');
  if (ed) {
    const t = task(ed.dataset.rte);
    t.desc = ed.innerHTML;
    save();
  }
});
document.addEventListener('input', e => {
  const ed = e.target.closest?.('[data-rte]');
  if (!ed) return;
  const t = task(ed.dataset.rte);
  if (t) {
    t.desc = ed.innerHTML;
    t.updated = Date.now();
    save();
  }
});

/* selection & bulk */
A.selRow = el => {
  const id = el.dataset.id;
  S.ui.sel.has(id) ? S.ui.sel.delete(id) : S.ui.sel.add(id);
  render();
};
A.selAll = el => {
  const ids = $$('[data-task-row]', el.closest('.tlist')).map(r => r.dataset.taskRow);
  const all = ids.every(i => S.ui.sel.has(i));
  ids.forEach(i => (all ? S.ui.sel.delete(i) : S.ui.sel.add(i)));
  render();
};
A.clearSel = () => {
  S.ui.sel.clear();
  render();
};
A.bulkSet = el => {
  const f = el.dataset.f;
  let v = el.dataset.v || null;
  const ids = [...S.ui.sel];
  S.ui.pop = null;
  if (mutate(() => ids.forEach(id => applyPatch(task(id), { [f]: v })))) toast(`Updated ${ids.length} task${ids.length > 1 ? 's' : ''}`);
};
A.bulkDelete = () => {
  const ids = [...S.ui.sel];
  confirmDlg({
    title: `Delete ${ids.length} task${ids.length > 1 ? 's' : ''}?`,
    body: 'The selected tasks, their subtasks, and comments will be permanently deleted.',
    ok: `Delete ${ids.length} task${ids.length > 1 ? 's' : ''}`,
    danger: true,
    run: () => {
      const snap = snapshot();
      if (mutate(() => deleteTasks(ids))) toast(`Deleted ${ids.length} tasks`, { action: 'Undo', onAction: () => restore(snap) });
    },
  });
};

/* views: sort, group, filters, columns */
A.sortBy = el => {
  const v = viewOf(el.dataset.key);
  const f = el.dataset.f;
  if (S.ui.justResized) return;
  v.sort = v.sort.f === f ? { f, dir: -v.sort.dir } : { f, dir: 1 };
  save();
  render();
};
A.setSort = el => {
  const v = viewOf(el.dataset.key);
  v.sort = { f: el.dataset.v, dir: v.sort.dir || 1 };
  S.ui.pop = null;
  save();
  render();
};
A.setSortDir = el => {
  viewOf(el.dataset.key).sort.dir = +el.dataset.v;
  save();
  render();
};
A.setGroup = el => {
  viewOf(el.dataset.key).group = el.dataset.v;
  S.ui.pop = null;
  save();
  render();
};
A.toggleGroup = el => {
  const gk = el.dataset.gk;
  S.ui.collapsedGroups[gk] = el.getAttribute('aria-expanded') === 'true';
  render();
};
A.setViewMode = el => {
  viewOf(el.dataset.key).mode = el.dataset.v;
  save();
  render();
};
A.toggleCol2 = el => {
  const v = viewOf(el.dataset.key);
  const c = el.dataset.v;
  v.hidden = v.hidden.includes(c) ? v.hidden.filter(x => x !== c) : [...v.hidden, c];
  save();
  render();
};
A.resetCols = el => {
  viewOf(el.dataset.key).colW = {};
  S.ui.pop = null;
  save();
  render();
};
IN.viewQ = el => {
  viewOf(el.dataset.key).q = el.value;
  render();
};
A.addFilter = el => {
  const v = viewOf(el.dataset.key);
  v.filters.push({ f: el.dataset.f, op: 'is', v: [] });
  if (S.ui.pop?.type === 'filter') S.ui.pop.edit = v.filters.length - 1;
  else {
    const r = el.getBoundingClientRect();
    S.ui.pop = { type: 'filter', key: el.dataset.key, x: r.left, y: r.bottom + 4, edit: v.filters.length - 1 };
  }
  save();
  render();
};
A.fEdit = el => {
  const p = S.ui.pop;
  p.edit = p.edit === +el.dataset.i ? null : +el.dataset.i;
  render();
};
A.fToggleVal = el => {
  const f = viewOf(el.dataset.key).filters[+el.dataset.i];
  const x = el.dataset.v;
  f.v = f.v.includes(x) ? f.v.filter(y => y !== x) : [...f.v, x];
  save();
  render();
};
A.rmFilter = el => {
  const v = viewOf(el.dataset.key);
  v.filters.splice(+el.dataset.i, 1);
  if (S.ui.pop && S.ui.pop.type === 'fvals') S.ui.pop = null;
  if (S.ui.pop?.type === 'filter') S.ui.pop.edit = null;
  save();
  render();
};
A.clearFilters = el => {
  const v = viewOf(el.dataset.key);
  v.filters = [];
  v.q = '';
  S.ui.pop = null;
  save();
  render();
};
IN.fField = el => {
  const f = viewOf(el.dataset.key).filters[+el.dataset.i];
  f.f = el.value;
  f.v = [];
  S.ui.pop.edit = +el.dataset.i;
  save();
  render();
};
IN.fOp = el => {
  viewOf(el.dataset.key).filters[+el.dataset.i].op = el.value;
  save();
  render();
};
A.saveView = el => {
  const k = 'p:' + el.dataset.id;
  openModal({ type: 'saveView', pid: el.dataset.id, nf: viewOf(k).filters.length });
};
A.saveViewSubmit = () => {
  const m = S.ui.modals[S.ui.modals.length - 1];
  const name = $('#sv-name').value.trim() || 'Untitled view';
  const type = $('#sv-type').value;
  const sv = { id: uid('v'), project: m.pid, name, type, filters: JSON.parse(JSON.stringify(viewOf('p:' + m.pid).filters)) };
  D().savedViews.push(sv);
  save();
  S.ui.modals.pop();
  go('project', { id: m.pid, tab: 'v:' + sv.id }, { tab: true });
  toast(`Saved view “${name}”`);
};
A.renameView = el => {
  const v = D().savedViews.find(x => x.id === el.dataset.id);
  S.ui.pop = null;
  openModal({
    type: 'prompt',
    title: 'Rename view',
    label: 'View name',
    value: v.name,
    run: val => {
      if (val) {
        v.name = val;
        save();
      }
    },
  });
};
A.delView = el => {
  const v = D().savedViews.find(x => x.id === el.dataset.id);
  S.ui.pop = null;
  D().savedViews = D().savedViews.filter(x => x !== v);
  save();
  if (S.ui.params.tab === 'v:' + v.id) go('project', { id: v.project, tab: 'list' }, { tab: true });
  else render();
  toast(`Deleted view “${v.name}”`);
};

/* board column menu */
A.toggleCol = el => {
  delete S.ui.collapsedCols[el.dataset.ck];
  render();
};
A.colCollapse = el => {
  S.ui.collapsedCols[S.ui.pop.key + ':' + el.dataset.id] = true;
  S.ui.pop = null;
  render();
};
A.colAdd = el => {
  const key = S.ui.pop.key;
  const pid = projectFromKey(key);
  S.ui.pop = null;
  A.startComposer({ dataset: { ctx: key, group: el.dataset.id, gb: JSON.stringify({ status: el.dataset.id, ...(pid ? { project: pid } : {}) }) } });
};
export function colTasks(key, st) {
  if (key === 'mytasks') {
    return allTasks().filter(t => t.assignee === D().me && t.status === st);
  }
  const pid = projectFromKey(key);
  return (pid ? tasksOf(pid) : allTasks()).filter(t => t.status === st);
}
A.colDoneAll = el => {
  const ts = colTasks(S.ui.pop.key, el.dataset.id);
  S.ui.pop = null;
  if (!ts.length) {
    render();
    return;
  }
  const snap = snapshot();
  if (mutate(() => ts.forEach(t => applyPatch(t, { status: 'done' }))))
    toast(`Marked ${ts.length} tasks as done`, { action: 'Undo', onAction: () => restore(snap) });
};
A.colArchive = () => {
  const ts = colTasks(S.ui.pop.key, 'done');
  S.ui.pop = null;
  const snap = snapshot();
  if (
    mutate(() =>
      ts.forEach(t => {
        t.archived = true;
        t.archivedAt = Date.now();
      }),
    )
  )
    toast(`Archived ${ts.length} completed tasks`, { action: 'Undo', onAction: () => restore(snap) });
};
A.colSortPrio = el => {
  const ts = colTasks(S.ui.pop.key, el.dataset.id).sort((a, b) => PR[b.priority].w - PR[a.priority].w);
  const base = Math.min(...ts.map(t => t.order));
  S.ui.pop = null;
  mutate(() => ts.forEach((t, i) => (t.order = base + i * 0.001)));
};

/* calendar & timeline */
A.calNav = el => {
  const d = +el.dataset.d;
  const cur = parse(S.ui.calDate || iso(TODAY));
  if (d === 0) {
    S.ui.calDate = iso(TODAY);
  } else if (S.ui.route === 'agenda') {
    const mode = S.ui.agendaMode || 'week';
    if (mode === 'day') S.ui.calDate = iso(addD(cur, d));
    else if (mode === 'month') S.ui.calDate = iso(new Date(cur.getFullYear(), cur.getMonth() + d, 1));
    else S.ui.calDate = iso(addD(cur, d * 7));
  } else {
    S.ui.calDate = S.ui.calMode === 'month' ? iso(new Date(cur.getFullYear(), cur.getMonth() + d, 1)) : iso(addD(cur, d * 7));
  }
  render();
};
A.tlToday = () => {
  const r = $('#tl-right');
  if (r) r.scrollTo({ left: Math.max(0, +$('.tl').dataset.tlToday - 160), behavior: 'smooth' });
};
IN.tlGroup = el => {
  S.ui.tlGroup = el.value;
  render();
};

/* projects */
IN.projQ = el => {
  S.ui.projQ = el.value;
  render();
};
IN.projStatus = el => {
  S.ui.projStatus = el.value;
  render();
};
IN.projSort = el => {
  S.ui.projSort = el.value;
  render();
};
A.clearProjFilters = () => {
  S.ui.projQ = '';
  S.ui.projStatus = 'all';
  render();
};
A.newProject = () => {
  S.ui.pform = { name: '', desc: '', icon: 'folder', color: 'indigo', team: me().team, lead: D().me, due: dOff(30), tmpl: 'blank' };
  S.ui.errors = {};
  S.ui.pop = null;
  openModal({ type: 'project' });
};
A.editProject = el => {
  const p = proj(el.dataset.id);
  S.ui.pop = null;
  S.ui.pform = { name: p.name, desc: p.desc, icon: p.icon, color: p.color, team: p.team, lead: p.lead, due: p.due, tmpl: 'blank' };
  S.ui.errors = {};
  openModal({ type: 'project', edit: p.id });
};
IN.pform = el => {
  S.ui.pform[el.dataset.f] = el.value;
  if (el.dataset.f === 'name' && S.ui.errors.pname && el.value.trim()) {
    S.ui.errors.pname = null;
    render();
  }
};
A.pformSet = el => {
  S.ui.pform[el.dataset.f] = el.dataset.v;
  if (el.dataset.f === 'tmpl') {
    const t = TEMPLATES.find(x => x.id === el.dataset.v);
    if (t && S.ui.pform.icon === 'folder') S.ui.pform.icon = t.icon === 'file' ? 'folder' : t.icon;
  }
  render();
};
export function makeKey(name) {
  let k = name
    .split(/\s+/)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);
  if (k.length < 2)
    k =
      name
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PRJ';
  while (D().projects.some(p => p.key === k)) k += 'X';
  return k;
}
export function createProject(f, tmplId) {
  const p = {
    id: uid('p'),
    key: makeKey(f.name),
    name: f.name,
    icon: f.icon,
    color: f.color,
    status: 'planning',
    team: f.team,
    lead: f.lead,
    due: f.due || dOff(30),
    start: dOff(0),
    fav: false,
    members: [...new Set([D().me, f.lead])],
    desc: f.desc || 'No description yet.',
    milestones: [],
    phases: [{ id: 1, name: 'Phase 1' }],
    last: 0,
  };
  D().projects.push(p);
  D().projOrder.unshift(p.id);
  D().activity.unshift({ id: uid('a'), by: D().me, verb: 'created project', task: null, project: p.id, at: Date.now(), extra: '' });
  const tm = TEMPLATES.find(t => t.id === tmplId);
  (tm?.tasks || []).forEach((title, i) =>
    createTask({
      project: p.id,
      title,
      status: i === 0 ? 'todo' : 'backlog',
      assignee: i === 0 ? D().me : null,
      priority: i === 0 ? 'high' : 'medium',
      due: dOff(5 + i * 5),
      start: dOff(i * 5),
    }),
  );
  return p;
}
A.submitProject = () => {
  const m = S.ui.modals[S.ui.modals.length - 1];
  const f = S.ui.pform;
  f.name = ($('#p-name')?.value || '').trim();
  f.desc = $('#p-desc')?.value || '';
  if (!f.name) {
    S.ui.errors.pname = 'Give the project a name';
    render();
    $('#p-name')?.focus();
    return;
  }
  if (m.edit) {
    const p = proj(m.edit);
    if (
      mutate(() =>
        Object.assign(p, {
          name: f.name,
          desc: f.desc,
          icon: f.icon,
          color: f.color,
          team: f.team,
          lead: f.lead,
          due: f.due,
          members: [...new Set([...p.members, f.lead])],
        }),
      )
    ) {
      S.ui.modals.pop();
      render();
      toast('Project updated');
    }
    return;
  }
  let p;
  if (
    !mutate(() => {
      p = createProject(f, f.tmpl);
    })
  )
    return;
  S.ui.modals.pop();
  go('project', { id: p.id, tab: f.tmpl === 'blank' ? 'overview' : S.prefs.defaultTab || 'board' });
  toast(`Created ${p.name}${tasksOf(p.id).length ? ` with ${tasksOf(p.id).length} starter tasks` : ''}`);
};
A.dupProject = el => {
  const p = proj(el.dataset.id);
  S.ui.pop = null;
  let n;
  mutate(() => {
    n = createProject({ ...p, name: p.name + ' copy' }, 'blank');
    tasksOf(p.id).forEach(t => createTask({ ...JSON.parse(JSON.stringify(t)), id: uid('t'), key: undefined, project: n.id, status: 'todo' }));
  });
  toast(`Duplicated ${p.name}`, { action: 'Open', onAction: () => go('project', { id: n.id }) });
};
A.openPhaseModal = el => {
  const pid = el.dataset.project || el.dataset.id;
  const phid = el.dataset.phase ? Number(el.dataset.phase) : null;
  openModal({ type: 'phase', projectId: pid, phaseId: phid });
};
A.submitPhaseModal = el => {
  const modalEl = el.closest('.modal') || document;
  const form = modalEl.querySelector('form');
  const pid = el.dataset.project || form?.dataset.project;
  const phid = el.dataset.phase ? Number(el.dataset.phase) : form?.dataset.phase ? Number(form.dataset.phase) : null;
  const nameInput = modalEl.querySelector('#ph-name');
  const descInput = modalEl.querySelector('#ph-desc');
  const name = nameInput?.value?.trim();
  const desc = descInput?.value?.trim() || '';
  if (!name) {
    toast('Phase name is required', { kind: 'warn' });
    nameInput?.focus();
    return;
  }
  const p = proj(pid);
  if (!p) return;
  if (!p.phases) p.phases = [];
  if (phid) {
    const ph = p.phases.find(x => x.id === phid);
    if (!ph) return;
    mutate(() => {
      ph.name = name;
      ph.desc = desc;
    });
    toast(`Updated ${name}`);
  } else {
    const nextId = p.phases.length ? Math.max(...p.phases.map(x => x.id)) + 1 : 1;
    mutate(() => {
      p.phases.push({ id: nextId, name, desc });
    });
    toast(`Created ${name}`);
  }
  closeModal();
  render();
};
A.movePhaseOrder = el => {
  const pid = el.dataset.project;
  const phid = Number(el.dataset.phase);
  const dir = el.dataset.dir; // 'up' or 'down'
  const p = proj(pid);
  if (!p || !p.phases || p.phases.length < 2) return;
  const idx = p.phases.findIndex(x => x.id === phid);
  if (idx < 0) return;
  const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= p.phases.length) return;
  mutate(() => {
    const temp = p.phases[idx];
    p.phases[idx] = p.phases[targetIdx];
    p.phases[targetIdx] = temp;
  });
  render();
};
A.removePhase = el => {
  const pid = el.dataset.project;
  const phid = Number(el.dataset.phase);
  const p = proj(pid);
  if (!p || !p.phases) return;
  const ph = p.phases.find(x => x.id === phid);
  const affectedTasks = D().tasks.filter(t => t.project === p.id && t.phase === phid);
  confirmDlg({
    title: `Delete ${ph?.name || 'Phase'}?`,
    body: affectedTasks.length
      ? `This phase has <b>${affectedTasks.length} task${affectedTasks.length === 1 ? '' : 's'}</b>. They will be kept in the project and unassigned from this phase.`
      : `Are you sure you want to delete this phase?`,
    ok: 'Delete phase',
    danger: true,
    run: () => {
      mutate(() => {
        p.phases = p.phases.filter(x => x.id !== phid);
        affectedTasks.forEach(t => {
          t.phase = null;
        });
      });
      render();
      toast(`Deleted phase`);
    },
  });
};
A.addPhase = el => A.openPhaseModal(el);
A.renamePhase = el => A.openPhaseModal(el);
A.archiveProject = el => {
  const p = proj(el.dataset.id);
  S.ui.pop = null;
  confirmDlg({
    title: `Archive ${p.name}?`,
    body: 'The project will be hidden from the sidebar and project lists. Tasks, files, and comments are kept, and you can restore it from Settings → Projects.',
    ok: 'Archive project',
    icon: 'archive',
    run: () => {
      const snap = snapshot();
      if (
        mutate(() => {
          p.archived = true;
          p.archivedAt = Date.now();
        })
      ) {
        if (S.ui.route === 'project' && S.ui.params.id === p.id) go('projects');
        toast(`Archived ${p.name}`, { action: 'Undo', onAction: () => restore(snap) });
      }
    },
  });
};
A.restoreProject = el => {
  const p = proj(el.dataset.id);
  mutate(() => {
    p.archived = false;
    p.archivedAt = null;
  });
  toast(`Restored ${p.name}`);
};
A.delProject = el => {
  const p = proj(el.dataset.id);
  S.ui.pop = null;
  const n = tasksOf(p.id).length;
  confirmDlg({
    title: `Delete ${p.name}?`,
    body: `This permanently deletes the project and its <b>${n} task${n === 1 ? '' : 's'}</b>, files, and comments for everyone. This can't be undone.`,
    ok: 'Delete project',
    danger: true,
    typeName: p.name,
    run: () => {
      const snap = snapshot();
      if (
        mutate(() => {
          const ids = tasksOf(p.id).map(t => t.id);
          D()
            .tasks.filter(t => t.project === p.id)
            .forEach(t => ids.push(t.id));
          deleteTasks(ids);
          D().projects = D().projects.filter(x => x !== p);
          D().projOrder = D().projOrder.filter(x => x !== p.id);
          D().files = D().files.filter(f => f.project !== p.id);
        })
      ) {
        if (S.ui.route === 'project' && S.ui.params.id === p.id) go('projects');
        toast(`Deleted ${p.name}`, { action: 'Undo', onAction: () => restore(snap) });
      }
    },
  });
};
A.requestAccess = el => {
  const p = proj(el.dataset.id);
  toast(`Access requested. We'll notify you when ${mem(p?.lead)?.name || 'the owner'} responds.`);
};

/* sharing & invites */
A.share = el => {
  const id = el.dataset.id || curProjectId();
  S.ui.shareQ = '';
  S.ui.pop = null;
  openModal({ type: 'share', id });
};
IN.shareQ = el => {
  S.ui.shareQ = el.value;
  render();
};
A.shareAdd = el => {
  const p = proj(el.dataset.id);
  const m = mem(el.dataset.mid);
  mutate(() => {
    p.members.push(m.id);
  });
  S.ui.shareQ = '';
  render();
  toast(`${m.name} can now edit ${p.name}`);
};
A.shareInvite = () => {
  const m = S.ui.modals[S.ui.modals.length - 1];
  const p = proj(m.id);
  const v = ($('#share-in')?.value || '').trim();
  const perm = $('#share-perm')?.value;
  if (!v) {
    $('#share-in')?.focus();
    return;
  }
  const ex = D().members.find(x => x.email.toLowerCase() === v.toLowerCase() || x.name.toLowerCase() === v.toLowerCase());
  if (ex) {
    if (!p.members.includes(ex.id))
      mutate(() => {
        p.members.push(ex.id);
        p.perms = p.perms || {};
        p.perms[ex.id] = perm;
      });
    S.ui.shareQ = '';
    render();
    toast(`Shared with ${ex.name}`);
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(v)) {
    toast('Enter a valid email address, like name@company.com', { kind: 'err' });
    return;
  }
  const nm = v
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  mutate(() => {
    const id = uid('m');
    D().members.push({ id, name: nm, email: v, role: 'Guest', team: p.team, title: 'Guest', c: '#6B7280', status: 'invited', last: null, tz: '—' });
    p.members.push(id);
    p.perms = p.perms || {};
    p.perms[id] = perm;
  });
  S.ui.shareQ = '';
  render();
  toast(`Invitation sent to ${v}`);
};
IN.sharePerm = el => {
  const p = proj(el.dataset.id);
  const mid = el.dataset.mid;
  if (el.value === '__remove') {
    const snap = snapshot();
    mutate(() => {
      p.members = p.members.filter(x => x !== mid);
    });
    toast(`Removed ${mem(mid).name}`, { action: 'Undo', onAction: () => restore(snap) });
  } else {
    mutate(() => {
      p.perms = p.perms || {};
      p.perms[mid] = el.value;
    });
    toast(`${mem(mid).name}: ${el.value}`, { ms: 1800 });
  }
};
IN.shareAccess = el => {
  const p = proj(el.dataset.id);
  mutate(() => {
    p.access = el.value;
  });
};
A.invite = () => {
  S.ui.inviteDraft = '';
  S.ui.errors = {};
  S.ui.pop = null;
  openModal({ type: 'invite' });
};
A.submitInvite = () => {
  const raw = $('#inv-emails').value;
  S.ui.inviteDraft = raw;
  const role = $('#inv-role').value;
  const team = $('#inv-team').value;
  const list = raw
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const bad = list.filter(e => !/^\S+@\S+\.\S+$/.test(e));
  if (!list.length) {
    S.ui.errors.invite = 'Enter at least one email address';
    render();
    return;
  }
  if (bad.length) {
    S.ui.errors.invite = `${bad[0]} isn't a valid email address`;
    render();
    return;
  }
  loadingBtn('inv-submit', 600, () => {
    if (
      !mutate(() =>
        list.forEach(e => {
          if (!D().members.some(m => m.email === e))
            D().members.push({
              id: uid('m'),
              name: e
                .split('@')[0]
                .replace(/[._-]+/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase()),
              email: e,
              role,
              team,
              title: role,
              c: '#6B7280',
              status: 'invited',
              last: null,
              tz: '—',
            });
        }),
      )
    )
      return;
    S.ui.modals.pop();
    S.ui.errors = {};
    render();
    toast(`${list.length} invitation${list.length > 1 ? 's' : ''} sent`);
  });
};
A.copyInviteLink = () => copy(`https://gr8rstudio.com/join/${D().ws.url}-7f3k2`, 'Invite link copied');
A.resendInvite = el => {
  S.ui.pop = null;
  render();
  toast(`Invite resent to ${mem(el.dataset.id).email}`);
};
A.viewProfile = el => go('member', { id: el.dataset.id });
A.assignToMember = el => {
  S.ui.pop = null;
  A.newTask({ dataset: { assignee: el.dataset.id } });
};
A.removeMember = el => {
  const m = mem(el.dataset.id);
  S.ui.pop = null;
  const n = allTasks().filter(t => t.assignee === m.id && t.status !== 'done').length;
  confirmDlg({
    title: `Remove ${m.name}?`,
    body: `${esc(m.name)} will lose access to ${esc(D().ws.name)} immediately.${n ? ` Their <b>${n} open task${n > 1 ? 's' : ''}</b> will become unassigned.` : ''}`,
    ok: 'Remove member',
    danger: true,
    icon: 'user-minus',
    run: () => {
      const snap = snapshot();
      if (
        mutate(() => {
          D().members = D().members.filter(x => x !== m);
          D().tasks.forEach(t => {
            if (t.assignee === m.id) t.assignee = null;
          });
          D().projects.forEach(p => (p.members = p.members.filter(x => x !== m.id)));
        })
      ) {
        if (S.ui.route === 'member') go('members');
        toast(`Removed ${m.name}`, { action: 'Undo', onAction: () => restore(snap) });
      }
    },
  });
};
IN.memQ = el => {
  S.ui.memQ = el.value;
  render();
};
IN.actWho = el => {
  S.ui.actWho = el.value;
  render();
};

/* files */
IN.fileQ = el => {
  S.ui.fileQ = el.value;
  render();
};
IN.fileType = el => {
  S.ui.fileType = el.value;
  render();
};
IN.fileSort = el => {
  S.ui.fileSort = el.value;
  render();
};
A.renameFile = el => {
  const f = D().files.find(x => x.id === el.dataset.id);
  S.ui.pop = null;
  openModal({
    type: 'prompt',
    title: 'Rename file',
    label: 'File name',
    value: f.name,
    run: v => {
      if (v)
        mutate(() => {
          f.name = v;
          f.type = fileType(v);
        });
    },
  });
};
A.dupFile = el => {
  const f = D().files.find(x => x.id === el.dataset.id);
  S.ui.pop = null;
  mutate(() => {
    const i = D().files.indexOf(f);
    D().files.splice(i + 1, 0, { ...f, id: uid('f'), name: f.name.replace(/(\.[^.]+)$/, ' copy$1'), at: Date.now(), by: D().me });
  });
  toast('File duplicated');
};
A.delFile = el => {
  const f = D().files.find(x => x.id === el.dataset.id);
  S.ui.pop = null;
  confirmDlg({
    title: 'Delete file?',
    body: `<b>${esc(f.name)}</b> will be removed from the project${f.task ? ' and its task' : ''}.`,
    ok: 'Delete file',
    danger: true,
    run: () => {
      const snap = snapshot();
      if (
        mutate(() => {
          D().files = D().files.filter(x => x !== f);
          if (f.task && task(f.task)) task(f.task).attachments = task(f.task).attachments.filter(a => a.name !== f.name);
        })
      )
        toast(`Deleted ${f.name}`, { action: 'Undo', onAction: () => restore(snap) });
    },
  });
};

/* inbox & notifications */
A.selNotif = el => {
  const n = D().notifs.find(x => x.id === el.dataset.id);
  n.read = true;
  S.ui.inboxSel = n.id;
  save();
  render();
};
A.toggleRead = el => {
  const n = D().notifs.find(x => x.id === el.dataset.id);
  n.read = !n.read;
  save();
  render();
};
A.markAllRead = () => {
  const n = D().notifs.filter(x => !x.read).length;
  D().notifs.forEach(x => (x.read = true));
  save();
  render();
  if (n) toast("You're all caught up.");
};
A.toggleUnreadOnly = () => {
  S.ui.inboxUnread = !S.ui.inboxUnread;
  render();
};
A.openNotif = el => {
  const n = D().notifs.find(x => x.id === el.dataset.id);
  n.read = true;
  save();
  if (n.task) A.openTask({ dataset: { id: n.task } });
  else if (n.project) go('project', { id: n.project, tab: 'overview' });
};

/* search & palette */
A.openPalette = () => {
  S.ui.palOpener = focusKey(document.activeElement);
  S.ui.palette = { q: '', mode: 'cmd', scope: 'all', hl: 0 };
  S.ui.pop = null;
  render();
};
A.openSearch = () => {
  S.ui.palOpener = focusKey(document.activeElement);
  S.ui.palette = { q: '', mode: 'search', scope: 'all', hl: 0 };
  S.ui.pop = null;
  S.ui.mnav = false;
  render();
};
A.closePalette = () => {
  S.ui.palette = null;
  render();
};
A.palScope = el => {
  S.ui.palette.scope = el.dataset.v;
  S.ui.palette.hl = 0;
  render();
  $('#pal-in')?.focus();
};
IN.palQ = el => {
  S.ui.palette.q = el.value;
  S.ui.palette.hl = 0;
  render();
};
A.palRun = el => {
  const it = S.ui.palette?._flat?.[+el.dataset.i];
  if (!it) return;
  S.ui.palette = null;
  render();
  it.run();
};
IN.searchQ = el => {
  S.ui.searchQ = el.value;
  render();
};
A.setSearch = el => {
  S.ui.searchQ = el.dataset.q;
  render();
  $('#search-page-q')?.focus();
};

/* workspace, account, prototype controls */
A.switchWs = el => {
  const w = D().workspaces.find(x => x.id === el.dataset.v);
  S.ui.pop = null;
  D().ws = { name: w.name, url: w.name.toLowerCase().replace(/[^a-z0-9]+/g, ''), c: w.c, brand: !!w.brand };
  save();
  go('home');
  toast(`Switched to ${w.name}`);
};
A.newWorkspace = () => {
  S.ui.pop = null;
  S.ui.auth = 'onboarding';
  S.ui.onb = 1;
  S.ui.onbData.ws = '';
  S.ui.onbData.url = '';
  render();
};
A.signOut = () => {
  S.ui.pop = null;
  S.ui.palette = null;
  S.ui.drawer = null;
  S.ui.modals = [];
  S.ui.auth = 'login';
  S.ui.errors = {};
  render();
};
A.shortcuts = () => {
  S.ui.pop = null;
  S.ui.palette = null;
  openModal({ type: 'shortcuts' });
};
A.startOnboarding = () => {
  S.ui.pop = null;
  S.ui.auth = 'onboarding';
  S.ui.onb = 0;
  render();
};
A.toggleOffline = () => {
  S.ui.offline = !S.ui.offline;
  S.ui.pop = null;
  render();
  toast(S.ui.offline ? 'Offline mode on — edits will fail to save' : 'Back online', { kind: S.ui.offline ? 'err' : 'ok' });
};
A.retryOnline = el => {
  el.classList.add('is-loading');
  setTimeout(() => {
    S.ui.offline = false;
    render();
    toast('Reconnected. All changes are synced.');
  }, 700);
};
A.resetDemo = () => {
  S.ui.pop = null;
  confirmDlg({
    title: 'Reset demo data?',
    body: 'All projects, tasks, and settings in this browser go back to the original sample workspace.',
    ok: 'Reset data',
    danger: true,
    icon: 'rotate-ccw',
    run: () => {
      S.data = seed();
      S.views = {};
      S.prefs = { ...DEFAULT_PREFS, theme: S.prefs.theme };
      S.ui.drawer = null;
      save();
      go('home');
      toast('Demo data restored');
    },
  });
};
A.toastInfo = el => toast(el.dataset.msg, { kind: 'info' });
A.demoToast = el => {
  const v = el.dataset.v;
  if (v === 'err') toast("Your changes couldn't be saved.", { kind: 'err', action: 'Try again', onAction: () => toast('Saved') });
  else if (v === 'retry') {
    toast('Retrying…', { kind: 'info', ms: 1200 });
    setTimeout(() => toast('Loaded successfully'), 1300);
  } else toast('Moved “Create homepage wireframes” to Review', { action: 'Undo', onAction: () => toast('Undone', { kind: 'info' }) });
};
A.demoConfirm = () =>
  confirmDlg({
    title: 'Archive Marketing Website?',
    body: 'The project will be hidden from the sidebar. You can restore it any time.',
    ok: 'Archive project',
    icon: 'archive',
    run: () => toast('This was a preview — nothing was archived', { kind: 'info' }),
  });
A.demoLoad = el => {
  el.classList.add('is-loading');
  setTimeout(() => {
    el.classList.remove('is-loading');
    toast('Loaded');
  }, 1400);
};
A.reloadPage = () => {
  S.ui.loading = true;
  render();
  setTimeout(() => {
    S.ui.loading = false;
    render();
  }, 1400);
};

/* modals */
A.closeModal = () => closeModal();
A.closeModalBg = (el, e) => {
  if (e.target === el) closeModal();
};
A.confirmOk = () => {
  const m = S.ui.modals[S.ui.modals.length - 1];
  if (m.typeName && S.ui.confirmText !== m.typeName) return;
  S.ui.modals.pop();
  S.ui.confirmText = '';
  render();
  m.run && m.run();
};
IN.confirmText = el => {
  S.ui.confirmText = el.value;
  const m = S.ui.modals[S.ui.modals.length - 1];
  const b = $('.modal:last-of-type [data-a="confirmOk"]') || $$('[data-a="confirmOk"]').pop();
  if (b) b.disabled = el.value !== m.typeName;
};
A.promptSubmit = () => {
  const m = S.ui.modals[S.ui.modals.length - 1];
  const v = $('#prompt-in').value.trim();
  S.ui.modals.pop();
  render();
  m.run(v);
};
IN.noop = () => {};

/* settings */
IN.prefToggle = el => {
  S.prefs[el.dataset.k] = el.checked;
  save();
};
IN.npToggle = el => {
  D().notifPrefs[el.dataset.k] = el.checked;
  save();
  toast('Notification preferences saved', { ms: 1500 });
};
IN.prefSel = el => {
  const k = el.dataset.k;
  S.prefs[k] = k === 'weekStart' ? +el.value : el.value;
  save();
  render();
  toast('Preference saved', { ms: 1500 });
};
A.wsColor = el => {
  D().ws.c = el.dataset.v;
  save();
  render();
};
A.saveWorkspace = () => {
  const n = $('#ws-name').value.trim();
  const u = $('#ws-url')
    .value.trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  if (!n) {
    toast("Workspace name can't be empty", { kind: 'err' });
    return;
  }
  loadingBtn('ws-save', 600, () => {
    if (
      mutate(() => {
        const old = D().ws.name;
        D().ws.name = n;
        D().ws.url = u || D().ws.url;
        const w = D().workspaces.find(x => x.name === old);
        if (w) w.name = n;
      })
    )
      toast('Workspace settings saved');
  });
};
A.saveGeminiApiKey = () => {
  const input = $('#gemini-api-key');
  const key = (input?.value || '').trim();
  loadingBtn('gemini-key-save', 400, () => {
    S.prefs.geminiApiKey = key;
    save();
    render();
    toast(key ? 'Gemini API key saved' : 'Gemini API key cleared');
  });
};
A.clearGeminiApiKey = () => {
  S.prefs.geminiApiKey = '';
  save();
  render();
  toast('Gemini API key removed');
};
A.delWorkspace = () =>
  confirmDlg({
    title: `Delete ${D().ws.name}?`,
    body: 'Every project, task, file, and comment in this workspace will be permanently deleted for all members.',
    ok: 'Delete workspace',
    danger: true,
    typeName: D().ws.name,
    run: () => {
      S.data = seed();
      S.views = {};
      save();
      S.ui.auth = 'login';
      render();
      toast('Workspace deleted. Demo data was restored for this prototype.', { kind: 'info', ms: 5000 });
    },
  });
A.avColor = el => {
  me().c = el.dataset.v;
  save();
  render();
};
A.saveProfile = () => {
  const n = $('#pf-name').value.trim();
  if (!n) {
    S.ui.errors.pname2 = 'Enter your name';
    render();
    return;
  }
  S.ui.errors.pname2 = null;
  const tt = $('#pf-title').value.trim();
  loadingBtn('pf-save', 600, () => {
    if (
      mutate(() => {
        S.prefs.name = n;
        S.prefs.title = tt;
        me().name = n;
        me().title = tt;
      })
    )
      toast('Profile updated');
  });
};
IN.pwStrength = el => {
  S.ui.pwNew = el.value;
  const m = el.parentElement.querySelector('.row .strength')?.parentElement;
  const tmp = document.createElement('div');
  tmp.innerHTML = strengthMeter(el.value);
  if (m) m.replaceWith(tmp.firstElementChild || document.createTextNode(''));
  else if (tmp.firstElementChild) el.after(tmp.firstElementChild);
};
A.savePassword = () => {
  const e = (S.ui.errors = {});
  const cur = $('#pw-cur').value,
    nw = $('#pw-new').value,
    cf = $('#pw-conf').value;
  S.ui.pwDone = false;
  if (!cur) e.pwCur = 'Enter your current password';
  if (nw.length < 10 || !/[0-9\W]/.test(nw)) e.pwNew = 'Use at least 10 characters, including a number or symbol';
  if (nw !== cf) e.pwConf = "Passwords don't match";
  if (Object.keys(e).length) {
    render();
    return;
  }
  loadingBtn('pw-save', 800, () => {
    S.ui.pwDone = true;
    S.ui.pwNew = '';
    render();
    toast('Password updated');
  });
};
A.revokeSession = el => {
  mutate(() => {
    D().sessions = D().sessions.filter(s => s.id !== el.dataset.id);
  });
  toast('Session signed out');
};
A.revokeAll = () =>
  confirmDlg({
    title: 'Sign out of all other sessions?',
    body: "You'll stay signed in on this device. Other devices will need to sign in again.",
    ok: 'Sign out others',
    danger: true,
    icon: 'log-out',
    run: () => {
      mutate(() => {
        D().sessions = D().sessions.filter(s => s.cur);
      });
      toast('Signed out of other sessions');
    },
  });
A.setup2fa = () => {
  S.ui.tfaSetup = true;
  S.ui.errors = {};
  render();
};
A.cancel2fa = () => {
  S.ui.tfaSetup = false;
  render();
};
A.verify2fa = () => {
  const v = $('#tfa-code').value.trim();
  if (!/^\d{6}$/.test(v)) {
    S.ui.errors.tfa = 'Enter the 6-digit code from your app';
    render();
    return;
  }
  S.ui.errors = {};
  mutate(() => {
    D().tfa = true;
    S.ui.tfaSetup = false;
  });
  toast('Two-factor authentication enabled');
};
A.disable2fa = () =>
  confirmDlg({
    title: 'Turn off two-factor authentication?',
    body: 'Your account will be protected by your password only.',
    ok: 'Turn off',
    danger: true,
    icon: 'shield-off',
    run: () => {
      mutate(() => {
        D().tfa = false;
      });
      toast('Two-factor authentication turned off');
    },
  });
A.changePlan = el => {
  const v = el.dataset.v;
  const price = { Free: 0, Team: 12, Business: 24 }[v];
  confirmDlg({
    title: `${v === 'Free' ? 'Downgrade' : 'Upgrade'} to ${v}?`,
    body: `${D().members.length} members × $${price}/month = <b>$${D().members.length * price}/month</b>, prorated from today and billed to Visa ending 4242.`,
    ok: v === 'Free' ? 'Downgrade' : `Upgrade to ${v}`,
    icon: 'gem',
    run: () => {
      mutate(() => {
        D().plan = v;
      });
      toast(`You're now on the ${v} plan`);
    },
  });
};

/* auth */
A.auth = el => {
  S.ui.auth = el.dataset.v;
  S.ui.errors = {};
  S.ui.pwNew = '';
  render();
  setTimeout(() => $('.auth input')?.focus(), 20);
};
A.toggleShowPw = () => {
  const v = $('#l-pw')?.value;
  S.ui.showPw = !S.ui.showPw;
  render();
  const i = $('#l-pw');
  if (i) {
    i.value = v;
    i.focus();
  }
};
export const EMAIL_RE = /^\S+@\S+\.\S+$/;
export function enterApp(msg) {
  S.ui.auth = null;
  S.ui.errors = {};
  go(S.prefs.home || 'welcome');
  toast(msg);
}
A.doLogin = () => {
  const e = (S.ui.errors = {});
  const em = $('#l-email').value.trim(),
    pw = $('#l-pw').value;
  S.ui.af.email = em;
  if (!em) e.email = 'Enter your email address';
  else if (!EMAIL_RE.test(em)) e.email = 'Enter a valid email, like name@company.com';
  if (!pw) e.pw = 'Enter your password';
  if (Object.keys(e).length) {
    render();
    (e.email ? $('#l-email') : $('#l-pw'))?.focus();
    if (!e.email) $('#l-pw').value = pw;
    return;
  }
  loadingBtn('login-btn', 750, () => enterApp(`Signed in as ${em}`));
};

A.socialAuth = el => {
  const provider = el.dataset.v;
  if (provider === 'Google') {
    el.classList.add('is-loading');
    requestGoogleOAuth({
      clientId: GOOGLE_CLIENT_ID,
      onToken: async token => {
        try {
          const profile = await fetchGoogleUserProfile(token);
          mutate(() => {
            if (profile.name) S.prefs.name = profile.name;
            const curMe = me();
            if (curMe) {
              if (profile.name) curMe.name = profile.name;
              if (profile.email) curMe.email = profile.email;
              if (profile.picture) curMe.avatar = profile.picture;
            }
            D().gcal = {
              ...(D().gcal || {}),
              connected: true,
              accessToken: token,
              clientId: GOOGLE_CLIENT_ID,
              calendarId: 'primary',
              error: null,
            };
          });

          syncGoogleCalendar({ accessToken: token, calendarId: 'primary' })
            .then(events => {
              toast(`Google Calendar synchronized (${events.length} events)`, { kind: 'info' });
              render();
            })
            .catch(err => {
              console.warn('Initial calendar sync notice:', err);
            });

          enterApp(`Signed in as ${profile.name || profile.email || 'Google User'}`);
        } catch (err) {
          el.classList.remove('is-loading');
          toast(`Google sign-in error: ${err.message}`, { kind: 'err' });
        }
      },
      onError: err => {
        el.classList.remove('is-loading');
        toast(`Google sign-in cancelled or failed: ${err.message}`, { kind: 'err' });
      },
    });
    return;
  }
  el.classList.add('is-loading');
  setTimeout(() => enterApp(`Signed in with ${provider}`), 800);
};

A.doSignup = () => {
  const e = (S.ui.errors = {});
  const nm = $('#s-name').value.trim(),
    em = $('#s-email').value.trim(),
    pw = $('#s-pw').value;
  S.ui.af.name = nm;
  S.ui.af.email = em;
  if (!nm) e.name = 'Enter your name';
  if (!EMAIL_RE.test(em)) e.email = 'Enter a valid work email';
  if (pw.length < 8) e.pw = 'Password must be at least 8 characters';
  if (Object.keys(e).length) {
    render();
    $('#s-email').value = em;
    return;
  }
  loadingBtn('signup-btn', 800, () => {
    S.ui.auth = 'verify';
    startResend();
    render();
  });
};
export function startResend() {
  S.ui.resendT = 30;
  clearInterval(startResend._i);
  startResend._i = setInterval(() => {
    S.ui.resendT--;
    const el = $('#resend-t');
    if (el) el.textContent = S.ui.resendT;
    if (S.ui.resendT <= 0) {
      clearInterval(startResend._i);
      if (S.ui.auth === 'verify') render();
    }
  }, 1000);
}
A.resend = el => {
  if (el.dataset.v === 'verify') {
    startResend();
    render();
    toast(`Verification email sent to ${S.ui.af.email}`);
  } else toast(`Reset link sent to ${S.ui.af.email}`);
};
A.verified = () => {
  S.ui.auth = 'onboarding';
  S.ui.onb = 0;
  S.ui.onbData.ws = '';
  S.ui.onbData.url = '';
  render();
};
A.doForgot = () => {
  const em = $('#f-email').value.trim();
  S.ui.af.email = em;
  S.ui.errors = {};
  if (!EMAIL_RE.test(em)) {
    S.ui.errors.email = 'Enter the email you use to sign in';
    render();
    return;
  }
  loadingBtn('forgot-btn', 700, () => {
    S.ui.auth = 'forgot-sent';
    render();
  });
};
A.doReset = () => {
  const a = $('#r-pw').value,
    b = $('#r-pw2').value;
  const e = (S.ui.errors = {});
  if (a.length < 10 || !/[0-9\W]/.test(a)) e.pw = 'Use at least 10 characters, including a number or symbol';
  if (a !== b) e.pw2 = "Passwords don't match";
  if (Object.keys(e).length) {
    render();
    return;
  }
  loadingBtn('reset-btn', 700, () => {
    S.ui.auth = 'reset-done';
    S.ui.pwNew = '';
    render();
  });
};

/* onboarding */
A.onbSet = el => {
  S.ui.onbData[el.dataset.k] = el.dataset.v;
  if (el.dataset.k === 'tmpl') {
    const t = TEMPLATES.find(x => x.id === el.dataset.v);
    if (t && !S.ui.onbData.projTouched) S.ui.onbData.proj = t.name === 'Website' ? 'Website Launch' : t.name;
  }
  render();
};
IN.onbWs = el => {
  const o = S.ui.onbData;
  o.ws = el.value;
  if (!o.urlTouched)
    o.url = el.value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  if (S.ui.errors.ws && el.value.trim()) S.ui.errors.ws = null;
  render();
};
IN.onbUrl = el => {
  S.ui.onbData.url = el.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  S.ui.onbData.urlTouched = true;
  render();
};
IN.onbProj = el => {
  S.ui.onbData.proj = el.value;
  S.ui.onbData.projTouched = true;
};
IN.onbInv = el => {
  const a = (S.ui.onbData.invites || '').split(',');
  a[+el.dataset.i] = el.value.trim();
  S.ui.onbData.invites = a.join(',');
};
A.onbBack = () => {
  S.ui.onb = Math.max(0, S.ui.onb - 1);
  render();
};
A.onbNext = el => {
  const o = S.ui.onbData;
  if (S.ui.onb === 1 && !o.ws.trim()) {
    S.ui.errors.ws = 'Name your workspace to continue';
    render();
    $('#o-ws')?.focus();
    return;
  }
  if (S.ui.onb === 3 && !o.proj.trim()) {
    toast('Give your project a name', { kind: 'err' });
    return;
  }
  if (S.ui.onb === 4 && el.dataset.skip) o.invites = '';
  if (S.ui.onb === 4 && !el.dataset.skip) {
    const bad = (o.invites || '').split(',').filter(x => x && !EMAIL_RE.test(x));
    if (bad.length) {
      toast(`${bad[0]} isn't a valid email address`, { kind: 'err' });
      return;
    }
  }
  S.ui.onb++;
  render();
  setTimeout(() => $('.auth input')?.focus(), 20);
};
A.onbExit = () => {
  S.ui.auth = null;
  render();
};
A.onbFinish = () => {
  const o = S.ui.onbData;
  let p;
  mutate(() => {
    if (S.ui.af?.name?.trim()) {
      S.prefs.name = S.ui.af.name.trim();
      const curMe = me();
      if (curMe) {
        curMe.name = S.ui.af.name.trim();
        if (S.ui.af.email?.trim()) curMe.email = S.ui.af.email.trim();
      }
    }
    if (o.ws.trim()) {
      const c = ['#2F2E2A', '#5A67D8', '#23918A', '#C54B78'][D().workspaces.length % 4];
      D().ws = { name: o.ws.trim(), url: o.url || 'workspace', c };
      if (!D().workspaces.some(w => w.name === D().ws.name)) D().workspaces.push({ id: uid('w'), name: D().ws.name, c, plan: 'Free' });
    }
    S.prefs.defaultTab = { kanban: 'board', list: 'list', timeline: 'timeline', table: 'table' }[o.team] || 'board';
    const tm = TEMPLATES.find(t => t.id === o.tmpl) || TEMPLATES[2];
    p = createProject(
      {
        name: o.proj.trim() || tm.name,
        icon: tm.icon === 'file' ? 'folder' : tm.icon,
        color: 'indigo',
        team: me().team,
        lead: D().me,
        desc: `Created during setup from the ${tm.name} template.`,
      },
      tm.id,
    );
    (o.invites || '')
      .split(',')
      .filter(x => EMAIL_RE.test(x))
      .forEach(e =>
        D().members.push({
          id: uid('m'),
          name: e.split('@')[0].replace(/\b\w/g, c => c.toUpperCase()),
          email: e,
          role: 'Member',
          team: me().team,
          title: 'Member',
          c: '#6B7280',
          status: 'invited',
          last: null,
          tz: '—',
        }),
      );
  });
  S.ui.auth = null;
  go('project', { id: p.id, tab: S.prefs.defaultTab });
  toast(`Welcome to ${D().ws.name}`);
};

/* =====================================================================
   AGENDA & GOOGLE CALENDAR
   ===================================================================== */
A.setAgendaMode = el => {
  S.ui.agendaMode = el.dataset.v;
  render();
};

A.setAgendaSource = el => {
  S.ui.agendaSource = el.dataset.v;
  render();
};

A.openGcalModal = () => {
  openModal({ type: 'gcal' });
};

A.disconnectGcal = () => {
  mutate(() => {
    const g = D().gcal || {};
    g.connected = false;
    g.accessToken = null;
    g.events = [];
    g.error = null;
    D().gcal = g;
  });
  closeModal();
  toast('Disconnected from Google Calendar');
};

A.syncGcal = async () => {
  const g = D().gcal || {};
  if (!g.connected && !g.clientId && !g.apiKey && !g.accessToken) {
    openModal({ type: 'gcal' });
    return;
  }
  toast('Syncing Google Calendar…', { kind: 'info', ms: 1500 });
  try {
    const events = await syncGoogleCalendar();
    toast(`Google Calendar synchronized (${events.length} events)`);
    render();
  } catch (err) {
    mutate(() => {
      if (D().gcal) D().gcal.error = err.message;
    });
    toast(`Sync error: ${err.message}`, { kind: 'err', ms: 4000 });
  }
};

A.saveGcalConfig = async () => {
  const clientId = ($('#gcal-client-id')?.value || '').trim();
  const apiKey = ($('#gcal-api-key')?.value || '').trim();
  const calendarId = ($('#gcal-cal-id')?.value || 'primary').trim();

  if (!clientId && !apiKey) {
    toast('Please provide either an OAuth Client ID or API Key', { kind: 'err' });
    return;
  }

  mutate(() => {
    D().gcal = {
      ...(D().gcal || {}),
      clientId,
      apiKey,
      calendarId,
      error: null,
    };
  });

  if (clientId) {
    // Attempt OAuth token acquisition
    toast('Requesting Google authorization…', { kind: 'info', ms: 3000 });
    requestGoogleOAuth({
      clientId,
      onToken: async token => {
        mutate(() => {
          D().gcal.accessToken = token;
          D().gcal.connected = true;
          D().gcal.error = null;
        });
        closeModal();
        try {
          const events = await syncGoogleCalendar({ accessToken: token, calendarId });
          toast(`Successfully connected! Synced ${events.length} Google events.`);
          render();
        } catch (err) {
          mutate(() => {
            D().gcal.error = err.message;
          });
          toast(`Connected, but sync failed: ${err.message}`, { kind: 'err' });
        }
      },
      onError: err => {
        mutate(() => {
          D().gcal.error = err.message;
        });
        toast(err.message, { kind: 'err', ms: 4500 });
        render();
      },
    });
  } else {
    // API Key flow
    try {
      const events = await syncGoogleCalendar({ apiKey, calendarId });
      closeModal();
      toast(`Successfully connected! Loaded ${events.length} Google events.`);
      render();
    } catch (err) {
      mutate(() => {
        D().gcal.error = err.message;
      });
      toast(`Connection failed: ${err.message}`, { kind: 'err', ms: 4500 });
      render();
    }
  }
};

A.agendaGcalDetail = el => {
  const gcal = gcalState();
  const ev = (gcal.events || []).find(e => e.id === el.dataset.id);
  if (!ev) return;
  openModal({
    type: 'prompt',
    title: ev.title,
    label: 'Google Calendar Event Details',
    value: `${ev.date} at ${ev.time}${ev.location ? `\nLocation: ${ev.location}` : ''}${ev.desc ? `\n\n${ev.desc}` : ''}${ev.hangoutLink ? `\n\nVideo Call: ${ev.hangoutLink}` : ''}`,
    ok: 'Close',
  });
};

/* =====================================================================
   PEOPLE CRM
   ===================================================================== */
IN.crmQ = el => {
  S.ui.crmQ = el.value;
  render();
};

IN.crmFilterCo = el => {
  S.ui.crmFilterCo = el.value;
  render();
};

A.newContact = () => {
  S.ui.cform = { name: '', company: '', title: '', email: '', phone: '', location: '', tags: '', notes: '' };
  openModal({ type: 'contact' });
};

A.editContact = el => {
  const c = contact(el.dataset.id);
  if (!c) return;
  S.ui.cform = {
    name: c.name || '',
    company: c.company || '',
    title: c.title || '',
    email: c.email || '',
    phone: c.phone || '',
    location: c.location || '',
    tags: Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags || ''),
    notes: c.notes || '',
  };
  openModal({ type: 'contact', edit: c.id });
};

A.openContact = el => {
  const c = contact(el.dataset.id);
  if (!c) return;
  openModal({ type: 'contactDetail', contact: c });
};

A.submitContact = () => {
  const name = ($('#c-name')?.value || '').trim();
  if (!name) {
    toast('Contact name is required', { kind: 'err' });
    $('#c-name')?.focus();
    return;
  }
  const company = ($('#c-company')?.value || '').trim();
  const title = ($('#c-title')?.value || '').trim();
  const email = ($('#c-email')?.value || '').trim();
  const phone = ($('#c-phone')?.value || '').trim();
  const location = ($('#c-loc')?.value || '').trim();
  const tags = ($('#c-tags')?.value || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  const notes = ($('#c-notes')?.value || '').trim();

  const curModal = S.ui.modals[S.ui.modals.length - 1];
  const editId = curModal?.edit;

  mutate(() => {
    D().contacts = D().contacts || [];
    if (editId) {
      const c = contact(editId);
      if (c) {
        c.name = name;
        c.company = company;
        c.title = title;
        c.email = email;
        c.phone = phone;
        c.location = location;
        c.tags = tags;
        c.notes = notes;
        c.updatedAt = Date.now();
      }
    } else {
      const colors = ['#4B5BD6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];
      const c = {
        id: uid('c'),
        name,
        company,
        title,
        email,
        phone,
        location,
        tags,
        notes,
        color: colors[D().contacts.length % colors.length],
        meetings: [],
        followUps: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      D().contacts.push(c);
    }
  });

  closeModal();
  toast(editId ? 'Contact updated' : `Created contact for ${name}`);
};

A.delContact = el => {
  const c = contact(el.dataset.id);
  if (!c) return;
  closeModal();
  confirmDlg({
    title: `Delete ${c.name}?`,
    body: `Are you sure you want to delete ${esc(c.name)}? All logged meetings and follow-ups will be permanently removed.`,
    ok: 'Delete contact',
    danger: true,
    run: () => {
      mutate(() => {
        D().contacts = (D().contacts || []).filter(x => x.id !== c.id);
      });
      toast(`Deleted ${c.name}`);
    },
  });
};

A.filterByCompany = el => {
  S.ui.crmFilterCo = el.dataset.co;
  S.ui.crmTab = 'people';
  render();
};

A.newMeeting = el => {
  const contactId = el?.dataset?.id || '';
  openModal({ type: 'meeting', contactId });
};

A.submitMeeting = () => {
  const title = ($('#m-title')?.value || '').trim();
  const contactId = $('#m-contact')?.value;
  const date = $('#m-date')?.value || new Date().toISOString().slice(0, 10);
  const time = $('#m-time')?.value || '10:00';
  const notes = ($('#m-notes')?.value || '').trim();
  const followUpTask = ($('#m-fu')?.value || '').trim();

  if (!title) {
    toast('Meeting title is required', { kind: 'err' });
    $('#m-title')?.focus();
    return;
  }
  const c = contact(contactId);
  if (!c) {
    toast('Please select an associated contact', { kind: 'err' });
    return;
  }

  mutate(() => {
    c.meetings = c.meetings || [];
    c.meetings.unshift({
      id: uid('m'),
      title,
      date,
      time,
      notes,
      type: date >= new Date().toISOString().slice(0, 10) ? 'upcoming' : 'past',
      createdAt: Date.now(),
    });
    c.lastContacted = date;

    if (followUpTask) {
      c.followUps = c.followUps || [];
      c.followUps.push({
        id: uid('fu'),
        title: followUpTask,
        done: false,
        due: date,
        createdAt: Date.now(),
      });
    }
  });

  closeModal();
  toast(`Logged meeting with ${c.name}`);
};

A.toggleFollowUp = el => {
  const cid = el.dataset.cid;
  const fid = el.dataset.fid;
  const c = contact(cid);
  if (!c) return;
  const fu = (c.followUps || []).find(f => f.id === fid);
  if (!fu) return;

  mutate(() => {
    fu.done = !fu.done;
  });
  render();
  toast(fu.done ? 'Follow-up marked as completed' : 'Follow-up reopened');
};

A.addFollowUpPrompt = el => {
  const c = contact(el.dataset.id);
  if (!c) return;
  openModal({
    type: 'prompt',
    title: `Add follow-up for ${c.name}`,
    label: 'Action item description',
    value: '',
    ok: 'Add follow-up',
    run: val => {
      if (!val || !val.trim()) return;
      mutate(() => {
        c.followUps = c.followUps || [];
        c.followUps.push({
          id: uid('fu'),
          title: val.trim(),
          done: false,
          due: new Date().toISOString().slice(0, 10),
          createdAt: Date.now(),
        });
      });
      toast('Follow-up task added');
      // If contactDetail is open, re-render it
      if (S.ui.modals.some(m => m.type === 'contactDetail' && m.contact?.id === c.id)) {
        render();
      }
    },
  });
};

/* =====================================================================
   SIDEBAR VISIBILITY PREFERENCES
   ===================================================================== */
A.toggleSidebarPage = el => {
  const page = el.dataset.page;
  if (!page) return;
  const isChecked = el.checked;
  S.prefs.sidebarHidden = S.prefs.sidebarHidden || {};
  if (isChecked) {
    delete S.prefs.sidebarHidden[page];
  } else {
    S.prefs.sidebarHidden[page] = true;
  }
  save();
  render();
};

A.showAllSidebarPages = () => {
  S.prefs.sidebarHidden = {};
  save();
  render();
  toast('All pages are now visible in the sidebar');
};

A.resetSidebarPages = () => {
  S.prefs.sidebarHidden = {};
  save();
  render();
  toast('Sidebar reset to default');
};

/* =====================================================================
   MEETINGS & CAL.COM BOOKING WORKFLOWS
   ===================================================================== */
IN.meetingsSearch = el => {
  S.ui.meetingsQ = el.value;
  render();
};

A.openCalcomSettings = () => {
  openModal({ type: 'calcomSettings' });
};

A.openAvailabilityModal = () => {
  openModal({ type: 'calcomAvailability' });
};

A.newMeetingModal = () => {
  openModal({ type: 'newMeeting' });
};

A.openRescheduleModal = el => {
  openModal({ type: 'rescheduleMeeting', id: el.dataset.id, mode: el.dataset.mode || 'reschedule' });
};

A.openRequestRescheduleModal = el => {
  openModal({ type: 'rescheduleMeeting', id: el.dataset.id, mode: 'request' });
};

A.openEditMeetingModal = el => {
  openModal({ type: 'editMeeting', id: el.dataset.id });
};

A.researchMeetingAttendee = el => {
  const m = meeting(el.dataset.id);
  const name = m?.personName || 'Attendee';
  toast(`AI Background Research queued for ${name}… We'll build the full agent pipeline next!`, { kind: 'info', ms: 4000 });
};

A.readMeetingReport = el => {
  const m = meeting(el.dataset.id);
  const name = m?.personName || 'Attendee';
  toast(`Attendee briefing report for ${name}: No issues noted. Previous calls: 0. Notes: “${m?.notes || 'None'}”`, { kind: 'info', ms: 5000 });
};

A.cancelMeeting = el => {
  const m = meeting(el.dataset.id);
  if (!m) return;
  confirmDlg({
    title: `Cancel meeting with ${m.personName || 'attendee'}?`,
    body: `Are you sure you want to cancel “${esc(m.title)}” on ${fmtDate(m.date, true)}? The attendee will receive a cancellation notice.`,
    ok: 'Cancel meeting',
    danger: true,
    run: () => {
      mutate(() => {
        m.status = 'cancelled';
        m.updatedAt = Date.now();
      });
      toast(`Cancelled meeting with ${m.personName || 'attendee'}`);
      render();
    },
  });
};

A.restoreMeeting = el => {
  const m = meeting(el.dataset.id);
  if (!m) return;
  mutate(() => {
    m.status = 'upcoming';
    m.updatedAt = Date.now();
  });
  toast(`Reopened meeting with ${m.personName}`);
  render();
};

A.submitNewMeeting = () => {
  const title = ($('#nm-title')?.value || '').trim();
  const name = ($('#nm-name')?.value || '').trim();
  const email = ($('#nm-email')?.value || '').trim();
  const company = ($('#nm-company')?.value || '').trim();
  const titleRole = ($('#nm-title-role')?.value || '').trim();
  const date = $('#nm-date')?.value || new Date().toISOString().slice(0, 10);
  const time = $('#nm-time')?.value || '14:00';
  const duration = +($('#nm-dur')?.value || 30);
  const location = ($('#nm-loc')?.value || 'Google Meet').trim();
  const meetUrl = ($('#nm-url')?.value || '').trim();
  const guests = ($('#nm-guests')?.value || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
  const notes = ($('#nm-notes')?.value || '').trim();

  if (!title || !name || !email) {
    toast('Meeting title, attendee name, and email are required', { kind: 'err' });
    return;
  }

  mutate(() => {
    const newMtg = {
      id: uid('mtg'),
      title,
      personName: name,
      personEmail: email,
      personCompany: company,
      personTitle: titleRole,
      date,
      time,
      duration,
      location,
      meetUrl,
      guests,
      notes,
      status: 'upcoming',
      source: 'manual',
      createdAt: Date.now(),
    };
    D().meetings = D().meetings || [];
    D().meetings.unshift(newMtg);

    // Auto add/sync person to People CRM
    D().contacts = D().contacts || [];
    let c = D().contacts.find(x => x.email && x.email.toLowerCase() === email.toLowerCase());
    if (!c) {
      c = {
        id: uid('c'),
        name,
        email,
        company,
        title: titleRole,
        phone: '',
        location: '',
        tags: ['client', 'cal.com'],
        notes: `Booked "${title}" on ${fmtDate(date, true)}`,
        meetings: [],
        followUps: [],
        lastContacted: date,
        createdAt: Date.now(),
      };
      D().contacts.unshift(c);

      // Notification 1: Person added to People CRM
      D().notifs.unshift({
        id: uid('n'),
        type: 'assign',
        text: `added new contact profile for ${name}`,
        snippet: `${name} (${company || email}) was added to your People directory from booking.`,
        at: Date.now(),
        read: false,
      });
    }

    // Notification 2: New meeting notification
    D().notifs.unshift({
      id: uid('n'),
      type: 'update',
      text: `New meeting booked: ${title} with ${name}`,
      snippet: `Scheduled for ${fmtDate(date, true)} at ${time} (${location})`,
      at: Date.now(),
      read: false,
    });

    // Notification 3: Post-meeting reminder to update profile
    D().notifs.unshift({
      id: uid('n'),
      type: 'comment',
      text: `Meeting follow-up reminder for ${name}`,
      snippet: `Remember to log meeting notes and update profile for ${name} after the call.`,
      at: Date.now() + 1000,
      read: false,
    });
  });

  closeModal();
  toast(`Scheduled meeting with ${name} and added to People CRM!`);
  render();
};

A.submitReschedule = async () => {
  const id = $('#rs-id')?.value;
  const m = meeting(id);
  if (!m) return;
  const mode = $('#rs-mode')?.value || 'reschedule';
  const isRequest = mode === 'request';
  const newDate = $('#rs-date')?.value;
  const newTime = $('#rs-time')?.value;
  const reason = ($('#rs-reason')?.value || '').trim();

  if (!newDate || !newTime) {
    toast('Please choose a valid date and time', { kind: 'err' });
    return;
  }

  mutate(() => {
    if (isRequest) {
      m.rescheduleRequested = {
        date: newDate,
        time: newTime,
        reason,
        requestedAt: Date.now(),
      };
      if (reason) {
        m.notes = (m.notes ? m.notes + '\n\n' : '') + `[Reschedule Request] Proposed: ${fmtDate(newDate, true)} at ${newTime}. Note: ${reason}`;
      }
      m.updatedAt = Date.now();

      D().notifs.unshift({
        id: uid('n'),
        type: 'update',
        text: `Reschedule request sent: ${m.title}`,
        snippet: `Proposed ${fmtDate(newDate, true)} at ${newTime} to ${m.personName || 'guest'}.${reason ? ` Note: “${reason}”` : ''}`,
        at: Date.now(),
        read: false,
      });
    } else {
      m.date = newDate;
      m.time = newTime;
      m.status = 'upcoming';
      delete m.rescheduleRequested;
      if (reason) m.notes = (m.notes ? m.notes + '\n\n' : '') + `Rescheduled to ${fmtDate(newDate, true)} ${newTime}. Note: ${reason}`;
      m.updatedAt = Date.now();

      D().notifs.unshift({
        id: uid('n'),
        type: 'update',
        text: `Meeting rescheduled: ${m.title}`,
        snippet: `Moved to ${fmtDate(newDate, true)} at ${newTime} with ${m.personName}.`,
        at: Date.now(),
        read: false,
      });
    }
  });

  closeModal();
  render();

  // If this booking came from Cal.com and has an active Cal.com UID/key, execute the API call
  const calUid = m.calcomUid || (m.source === 'calcom' && m.id.startsWith('calcom_') ? m.id.replace('calcom_', '') : null);
  if (calUid) {
    toast(isRequest ? 'Sending reschedule request via Cal.com…' : 'Rescheduling on Cal.com…');
    if (isRequest) {
      const res = await apiRequestRescheduleBooking(calUid, { reason });
      if (res.ok) {
        toast(`Reschedule request sent to ${m.personName || 'attendee'} via Cal.com!`);
      } else {
        toast(`Local request saved (Cal.com API: ${res.message || 'skipped'})`, { kind: 'warn' });
      }
    } else {
      const res = await apiRescheduleBooking(calUid, { date: newDate, time: newTime, reason });
      if (res.ok) {
        toast(`Successfully rescheduled on Cal.com!`);
        syncCalcom(); // refresh latest state from Cal.com
      } else {
        toast(`Updated locally (Cal.com API: ${res.message || 'skipped'})`, { kind: 'warn' });
      }
    }
  } else {
    toast(isRequest ? `Reschedule request recorded for ${m.personName || 'attendee'}` : `Rescheduled meeting with ${m.personName || 'attendee'}`);
  }
};

A.submitEditMeeting = () => {
  const id = $('#em-id')?.value;
  const m = meeting(id);
  if (!m) return;
  const title = ($('#em-title')?.value || '').trim();
  const loc = ($('#em-loc')?.value || '').trim();
  const url = ($('#em-url')?.value || '').trim();
  const guests = ($('#em-guests')?.value || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
  const notes = ($('#em-notes')?.value || '').trim();

  if (!title) {
    toast('Meeting title is required', { kind: 'err' });
    return;
  }

  mutate(() => {
    m.title = title;
    m.location = loc;
    m.meetUrl = url;
    m.guests = guests;
    m.notes = notes;
    m.updatedAt = Date.now();
  });

  closeModal();
  toast('Meeting details updated');
  render();
};

A.saveCalcomSettings = async () => {
  const username = ($('#cal-username')?.value || 'phato').trim();
  const apiKey = ($('#cal-key')?.value || '').trim();

  mutate(() => {
    const cal = calcomState();
    cal.username = username;
    cal.apiKey = apiKey;
    cal.connected = true;

    (cal.eventTypes || []).forEach((et, i) => {
      const toggle = $(`#et-toggle-${i}`);
      if (toggle) et.active = toggle.checked;
    });
  });

  closeModal();
  toast('Cal.com settings saved');
  render();
  startCalcomPolling();

  if (apiKey) {
    const res = await syncCalcom({ manual: true });
    if (res?.ok) {
      toast(`Synced ${res.count || 0} meeting${res.count === 1 ? '' : 's'} from Cal.com`);
    } else if (res?.message) {
      toast(res.message, { kind: 'err' });
    }
  }
};

A.syncCalcomNow = async () => {
  // If inputs are currently visible in the modal, capture them first
  const keyInput = $('#cal-key');
  const userInput = $('#cal-username');
  if (keyInput) {
    const apiKey = keyInput.value.trim();
    const username = (userInput?.value || 'phato').trim();
    mutate(() => {
      const cal = calcomState();
      cal.username = username;
      cal.apiKey = apiKey;
      cal.connected = true;
    });
  }

  toast('Updating meetings from Cal.com…');
  const res = await syncCalcom({ manual: true });
  if (res?.ok) {
    toast(`Updated: ${res.count} meeting${res.count === 1 ? '' : 's'} synced`);
  } else {
    toast(res?.message || 'Failed to update meetings from Cal.com', { kind: 'err' });
  }
};

A.saveAvailability = () => {
  const startTime = $('#av-start')?.value || '09:00';
  const endTime = $('#av-end')?.value || '18:00';
  const days = $$('[data-av-day]:checked').map(el => el.dataset.avDay);

  mutate(() => {
    const cal = calcomState();
    cal.availability = {
      ...(cal.availability || {}),
      startTime,
      endTime,
      days,
    };
  });

  closeModal();
  toast('Weekly availability updated');
  render();
};

A.simulateCalcomBooking = () => {
  const names = [
    ['Marcus Vance', 'marcus@vancecapital.com', 'Vance Capital', 'Managing Partner'],
    ['Chloe Chen', 'chloe@growthpulse.dev', 'GrowthPulse', 'VP of Engineering'],
    ['Liam O\'Connor', 'liam@apexai.tech', 'Apex AI', 'Product Architect'],
  ];
  const pick = names[Math.floor(Math.random() * names.length)];
  const tom = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);

  mutate(() => {
    const newMtg = {
      id: uid('mtg'),
      title: '30 Min Strategy Call',
      eventType: '30min',
      personName: pick[0],
      personEmail: pick[1],
      personCompany: pick[2],
      personTitle: pick[3],
      date: tom,
      time: '15:00',
      duration: 30,
      location: 'Cal Video',
      meetUrl: 'https://app.cal.com/video/phato-strategy',
      notes: 'Automated booking received via Cal.com API webhook.',
      guests: [],
      source: 'calcom',
      status: 'upcoming',
      createdAt: Date.now(),
    };
    D().meetings = D().meetings || [];
    D().meetings.unshift(newMtg);

    // Auto-add to contacts
    D().contacts = D().contacts || [];
    let c = D().contacts.find(x => x.email === pick[1]);
    if (!c) {
      c = {
        id: uid('c'),
        name: pick[0],
        email: pick[1],
        company: pick[2],
        title: pick[3],
        phone: '+1 (555) 234-5678',
        location: 'San Francisco, CA',
        tags: ['client', 'cal.com', 'lead'],
        notes: `Booked via Cal.com API webhook on ${fmtDate(tom, true)}.`,
        meetings: [],
        followUps: [],
        lastContacted: tom,
        createdAt: Date.now(),
      };
      D().contacts.unshift(c);

      // Notification: Added to people list
      D().notifs.unshift({
        id: uid('n'),
        type: 'assign',
        text: `added ${pick[0]} to your People directory`,
        snippet: `${pick[0]} (${pick[2]}) booked a meeting and was automatically saved to contacts.`,
        at: Date.now(),
        read: false,
      });
    }

    // Notification: New meeting booked
    D().notifs.unshift({
      id: uid('n'),
      type: 'update',
      text: `New Cal.com booking: 30 Min Strategy Call with ${pick[0]}`,
      snippet: `Scheduled for ${fmtDate(tom, true)} at 15:00. Added to calendar.`,
      at: Date.now(),
      read: false,
    });

    // Notification: Post-meeting reminder to update profile
    D().notifs.unshift({
      id: uid('n'),
      type: 'comment',
      text: `Meeting follow-up reminder for ${pick[0]}`,
      snippet: `Remember to log meeting notes and update profile for ${pick[0]} after the call.`,
      at: Date.now() + 500,
      read: false,
    });
  });

  toast(`Simulated new Cal.com booking with ${pick[0]}! Added to Meetings, People CRM, and Notifications.`);
  render();
};

A.chooseFolder = () => chooseLocalFolder();
A.reconnectFolder = () => reconnectLocalFolder();
A.disconnectFolder = () => disconnectLocalFolder();
A.retryAutosave = () => triggerAutosave(true);
A.triggerManualBackup = () => {
  createRecoveryBackup(false);
  toast('Recovery backup triggered');
};

A.installApp = async () => {
  const installed = await promptInstallApp();
  if (!installed) {
    // If browser didn't prompt, show informational modal or toast
    toast('Use your browser’s address bar install icon (App available) or menu > Apps > Install HanhPM', { kind: 'info', ms: 5000 });
  }
};
A.applyPwaUpdate = () => applyPwaUpdate();


