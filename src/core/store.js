/* ---------- store ---------- */
import { TODAY, diffD, iso, parse, uid } from './utils.js';
import { PCOLORS, TEAMS_SEED } from './constants.js';
import { seed } from '../data/seed.js';

export const STORE_KEY = 'gr8r.v5';
export const SIDEBAR_PAGES = [
  { group: 'Overview', items: [
    { id: 'welcome', name: 'Welcome', icon: 'sun' },
    { id: 'agents', name: 'Agent', icon: 'bot' },
    { id: 'home', name: 'Home', icon: 'house' },
    { id: 'inbox', name: 'Inbox', icon: 'inbox' },
    { id: 'mytasks', name: 'My Tasks', icon: 'circle-check' },
    { id: 'meetings', name: 'Meetings', icon: 'video' },
    { id: 'agenda', name: 'Agenda', icon: 'calendar-days' },
    { id: 'people', name: 'People', icon: 'contact' },
    { id: 'favorites', name: 'Favorites', icon: 'star' },
    { id: 'notifications', name: 'Notifications', icon: 'bell' },
  ]},
  { group: 'Workspace', items: [
    { id: 'overview', name: 'Overview', icon: 'layout-dashboard' },
    { id: 'projects', name: 'Projects', icon: 'folder-kanban' },
    { id: 'tasks', name: 'Tasks', icon: 'list-checks' },
    { id: 'calendar', name: 'Calendar', icon: 'calendar' },
    { id: 'timeline', name: 'Timeline', icon: 'chart-gantt' },
    { id: 'members', name: 'Members', icon: 'users' },
    { id: 'activity', name: 'Activity', icon: 'activity' },
  ]},
];
export const DEFAULT_PREFS = {
  theme: 'revelation',
  accent: 'indigo',
  side: 'comfortable',
  density: 'comfortable',
  weekStart: 1,
  dateFmt: 'MMM d',
  lang: 'English (US)',
  tz: '(GMT-07:00) Pacific Time',
  motion: 'system',
  home: 'welcome',
  openTasks: 'drawer',
  name: '',
  title: '',
  sidebarHidden: {},
};
export function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (j && j.data && j.data.tasks) return j;
    }
  } catch {
    /* storage blocked or corrupt: start from seed data */
  }
  return null;
}
export const saved = load();
if (saved?.prefs) {
  if (saved.prefs.home === 'home' || saved.prefs.home === 'agents' || !saved.prefs.home) saved.prefs.home = 'welcome';
}
if (saved?.prefs?.name === 'Tanjim Islam') saved.prefs.name = 'Phato';
if (saved?.data?.members) {
  saved.data.members.forEach(m => {
    if (m.name === 'Tanjim Islam') m.name = 'Phato';
  });
}
if (saved?.data?.ws?.name === 'Gr8r Studio' || !saved?.data?.ws?.name) {
  if (saved?.data?.ws) {
    saved.data.ws.name = 'Revelation Fintech';
    saved.data.ws.url = 'revelation-fintech';
  }
}
if (saved?.data?.workspaces) {
  saved.data.workspaces.forEach(w => {
    if (w.name === 'Gr8r Studio') w.name = 'Revelation Fintech';
  });
}
if (saved?.data && !saved.data.calcom) {
  saved.data.calcom = seed().calcom;
}

export const S = {
  data: saved?.data || seed(),
  prefs: Object.assign({}, DEFAULT_PREFS, saved?.prefs || {}),
  views: saved?.views || {},
  ui: {
    fx: {},
    auth: !saved && !localStorage.getItem('gr8r_onb_done') ? 'onboarding' : null,
    authStep: 'login',
    onb: 0,
    onbData: { name: '', use: 'product', team: 'kanban', size: 'Just me', ws: '', proj: 'My First Project', tmpl: 'blank', invites: '' },
    route: saved?.browserTabs?.find(t => t.id === saved?.activeTabId)?.route || 'home',
    params: saved?.browserTabs?.find(t => t.id === saved?.activeTabId)?.params || {},
    history: [],
    browserTabs: saved?.browserTabs && saved.browserTabs.length ? saved.browserTabs : [{ id: 'tab_home', route: 'home', params: {}, title: 'Home', icon: 'house' }],
    activeTabId: saved?.activeTabId || 'tab_home',
    collapsed: !!saved?.collapsed,
    mnav: false,
    expanded: {},
    drawer: null,
    drawerFull: false,
    drawerTab: 'comments',
    modals: [],
    pop: null,
    palette: null,
    loading: false,
    offline: false,
    sel: new Set(),
    composer: null,
    editCell: null,
    openTasks: {},
    collapsedGroups: {},
    calDate: iso(TODAY),
    calMode: 'month',
    agendaMode: 'week',
    agendaSource: 'all',
    crmTab: 'all',
    crmQ: '',
    crmFilterCo: 'all',
    tlZoom: 'week',
    tlGroup: 'status',
    fileView: 'grid',
    projView: 'grid',
    homeTab: 'upcoming',
    homeMeetingsTab: 'upcoming',
    meetingsTab: 'upcoming',
    meetingsQ: '',
    inboxCat: 'all',
    inboxUnread: false,
    inboxSel: null,
    notifFilter: 'all',
    settings: 'appearance',
    searchQ: '',
    searchCat: 'all',
    myView: 'list',
    membersTab: 'members',
    collapsedCols: {},
    errors: {},
    drafts: {},
  },
};
export let _saveT;
export function save() {
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        data: S.data,
        prefs: S.prefs,
        views: S.views,
        collapsed: S.ui.collapsed,
        browserTabs: S.ui.browserTabs,
        activeTabId: S.ui.activeTabId,
      }));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, 150);
}

/* ---------- lookups ---------- */
export const D = () => S.data;
export const me = () => D().members.find(m => m.id === D().me);
export const mem = id => D().members.find(m => m.id === id);
export const proj = id => D().projects.find(p => p.id === id);
export const task = id => D().tasks.find(t => t.id === id);
export const pColor = p => PCOLORS[p?.color] || PCOLORS.slate;
export const visibleProjects = () =>
  D()
    .projOrder.map(proj)
    .filter(Boolean)
    .filter(p => !p.archived);
export const canSee = p => !p.private || p.members.includes(D().me);
export const tasksOf = pid => D().tasks.filter(t => t.project === pid && !t.archived);
export const allTasks = () => D().tasks.filter(t => !t.archived && canSee(proj(t.project)));
export const isOver = t => t.due && t.status !== 'done' && diffD(parse(t.due), TODAY) < 0;
export const commentsOf = tid => D().comments.filter(c => c.task === tid);
export function progressOf(pid) {
  const ts = tasksOf(pid);
  if (!ts.length) return 0;
  return Math.round((ts.filter(t => t.status === 'done').length / ts.length) * 100);
}
export function taskProg(t) {
  if (t.status === 'done') return 100;
  if (t.subtasks.length) return Math.round((t.subtasks.filter(s => s.done).length / t.subtasks.length) * 100);
  return { backlog: 0, todo: 5, progress: 45, review: 80 }[t.status] || 0;
}

/* ---------- activity + notification helpers ---------- */
export function logAct(verb, t, extra = '') {
  D().activity.unshift({ id: uid('a'), by: D().me, verb, task: t?.id || null, project: t?.project || null, at: Date.now(), extra });
  if (t) t.updated = Date.now();
}

/* ---------- teams (workspace data, seeded on first use) ---------- */
export const NO_TEAM = { id: '', name: 'No team', icon: 'users', c: '#8A867E', desc: '' };
export function teamsList() {
  const d = D();
  if (!d.teams) d.teams = TEAMS_SEED.map(t => ({ ...t }));
  return d.teams;
}
export function team(id) {
  return teamsList().find(t => t.id === id) || null;
}
export const TM = new Proxy({}, { get: (_, k) => team(k) || NO_TEAM });

/* ---------- personal (agenda & people crm) ---------- */
export function contactsList() {
  const d = D();
  if (!d.contacts) d.contacts = [];
  return d.contacts;
}
export function contact(id) {
  return contactsList().find(c => c.id === id) || null;
}
export function meetingsList() {
  const d = D();
  if (!d.meetings) d.meetings = [];
  return d.meetings;
}
export function meeting(id) {
  return meetingsList().find(m => m.id === id) || null;
}
export function calcomState() {
  const d = D();
  if (!d.calcom) {
    d.calcom = {
      username: 'phato',
      apiKey: '',
      connected: false,
      eventTypes: [
        { id: '15min', title: '15 Min Quick Chat', slug: '15min', length: 15, active: true },
        { id: '30min', title: '30 Min Strategy Call', slug: '30min', length: 30, active: true },
        { id: '60min', title: '60 Min Deep Dive', slug: '60min', length: 60, active: true },
      ],
      availability: {
        timeZone: 'Asia/Kolkata',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        startTime: '09:00',
        endTime: '18:00',
      },
    };
  }
  return d.calcom;
}
export const GOOGLE_CLIENT_ID = '571607149519-2b1mv8q6c477g372oncoa7f0hspcgrm9.apps.googleusercontent.com';

export function gcalState() {
  const d = D();
  if (!d.gcal) {
    d.gcal = {
      connected: false,
      clientId: GOOGLE_CLIENT_ID,
      apiKey: '',
      calendarId: 'primary',
      lastSynced: null,
      events: [],
      error: null,
    };
  } else if (!d.gcal.clientId) {
    d.gcal.clientId = GOOGLE_CLIENT_ID;
  }
  return d.gcal;
}
