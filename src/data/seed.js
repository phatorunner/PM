/* ---------- seed data ---------- */

export function seed() {
  const members = [
    {
      id: 'm1',
      name: '',
      email: '',
      role: 'Owner',
      team: '',
      title: '',
      c: '#5A67D8',
      status: 'active',
      last: 0,
      tz: 'San Francisco',
    },
  ];
  const projects = [];
  const T = [];
  const comments = [];
  const activity = [];
  const notifs = [];
  const files = [];
  const events = [];
  return {
    ws: { name: 'Revelation Fintech', url: 'revelation-fintech', c: '#1D1C1A', brand: true },
    workspaces: [
      { id: 'w1', name: 'Revelation Fintech', c: '#1D1C1A', plan: 'Free', brand: true },
    ],
    teams: [],
    me: 'm1',
    members,
    projects,
    tasks: T,
    comments,
    activity,
    notifs,
    files,
    events,
    meetings: [],
    contacts: [],
    calcom: {
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
    },
    gcal: {
      connected: false,
      clientId: '',
      apiKey: '',
      calendarId: 'primary',
      lastSynced: null,
      events: [],
      error: null,
    },
    projOrder: [],
    savedViews: [],
    recentSearches: [],
    sessions: [
      { id: 'se1', dev: 'MacBook Pro · Chrome', loc: 'San Francisco, US', at: 'Active now', cur: true },
    ],
    invoices: [],
    tfa: false,
    notifPrefs: {
      email_mention: true,
      email_assign: true,
      email_digest: true,
      email_comment: false,
      push_mention: true,
      push_assign: true,
      push_comment: true,
      push_due: true,
      mention_all: true,
      assign_self: true,
    },
  };
}
