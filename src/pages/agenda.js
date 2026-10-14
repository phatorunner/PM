/* =====================================================================
   AGENDA: Unified Personal Calendar (Google Calendar + Workspace Deadlines & Events)
   ===================================================================== */
import { MONL, TODAY, WD, addD, diffD, esc, fmtDate, iso, parse } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { D, S, allTasks, gcalState, pColor, proj, visibleProjects } from '../core/store.js';
import { av, prIcon, stIcon } from '../ui/helpers.js';
import { fxc } from '../shell/render.js';
import { startOfWeek } from '../views/calendar.js';

export function pageAgenda() {
  const cur = parse(S.ui.calDate || iso(TODAY));
  const mode = S.ui.agendaMode || 'week'; // 'day' | 'week' | 'month'
  const filterSrc = S.ui.agendaSource || 'all'; // 'all' | 'gcal' | 'workspace' | 'milestones'
  const gcal = gcalState();

  // 1. Gather all calendar items without duplicating records
  const allWorkspaceTasks = allTasks();
  const allWorkspaceEvents = D().events || [];
  const gcalEvents = (gcal.connected && gcal.events) ? gcal.events : [];

  // Important Workspace Deadlines
  const taskItems = allWorkspaceTasks
    .filter(t => t.due)
    .map(t => ({
      type: 'task',
      id: t.id,
      title: t.title,
      date: t.due,
      time: 'Due',
      priority: t.priority,
      status: t.status,
      project: t.project,
      assignee: t.assignee,
      source: 'workspace',
      raw: t,
    }));

  // Workspace Scheduled Meetings / Events
  const eventItems = allWorkspaceEvents.map(e => ({
    type: 'event',
    id: e.id,
    title: e.title,
    date: e.date,
    time: e.time || '10:00',
    project: e.project,
    source: 'workspace',
    raw: e,
  }));

  // Workspace Milestones (from visible projects)
  const milestoneItems = visibleProjects().flatMap(p =>
    (p.milestones || []).map((m, idx) => ({
      type: 'milestone',
      id: `ms_${p.id}_${idx}`,
      title: `${m.name} (${p.name})`,
      date: m.date,
      time: 'Milestone',
      project: p.id,
      source: 'milestones',
      raw: m,
    }))
  );

  // Google Calendar Events
  const gcalItems = gcalEvents.map(g => ({
    type: 'gcal',
    id: g.id,
    title: g.title,
    date: g.date,
    time: g.time,
    source: 'gcal',
    location: g.location,
    link: g.htmlLink || g.hangoutLink,
    raw: g,
  }));

  // Filter by source
  const allItems = [...gcalItems, ...eventItems, ...taskItems, ...milestoneItems].filter(item => {
    if (filterSrc === 'all') return true;
    if (filterSrc === 'gcal') return item.source === 'gcal';
    if (filterSrc === 'workspace') return item.source === 'workspace';
    if (filterSrc === 'milestones') return item.source === 'milestones';
    return true;
  });

  const getItemsForDate = ds => allItems.filter(it => it.date === ds);

  // Render chip for calendar / agenda
  const renderItemChip = it => {
    if (it.type === 'gcal') {
      return `<div class="cev gcal-ev" style="--c:#4285F4;cursor:pointer" data-a="agendaGcalDetail" data-id="${it.id}" title="${esc(it.title)} · Google Calendar">
        <span class="num faint" style="font-size:11px;color:#4285F4">${it.time}</span>
        <span class="trunc" style="font-weight:500">${esc(it.title)}</span>
      </div>`;
    }
    if (it.type === 'milestone') {
      const p = proj(it.project);
      return `<div class="cev ms-ev" style="--c:${pColor(p)};border-style:dotted" title="Project Milestone: ${esc(it.title)}">
        <span class="num faint" style="font-size:10.5px">◆ ${it.time}</span>
        <span class="trunc">${esc(it.title)}</span>
      </div>`;
    }
    if (it.type === 'event') {
      const p = proj(it.project);
      return `<button class="cev event" style="--c:${pColor(p)}" data-a="pop" data-pop="event" data-id="${it.id}" title="${esc(it.title)} · ${it.time}">
        <span class="num faint" style="font-size:11px">${it.time}</span>
        <span class="trunc">${esc(it.title)}</span>
      </button>`;
    }
    // Task
    const t = it.raw;
    const p = proj(t.project);
    return `<button class="cev ${t.status === 'done' ? 'done' : ''}${fxc('moved', t.id)}" style="--c:${pColor(p)}" draggable="true" data-drag-cal="${t.id}" data-a="openTask" data-id="${t.id}" data-ctx="task" title="${esc(t.title)}">
      ${t.status === 'done' ? stIcon('done', 11) : prIcon(t.priority, 11)}
      <span class="trunc">${esc(t.title)}</span>
      ${av(t.assignee, '', false)}
    </button>`;
  };

  const wdn = Array.from({ length: 7 }, (_, i) => WD[(i + S.prefs.weekStart) % 7]);

  let label = '';
  let viewBody = '';

  // Mode 1: Month View
  if (mode === 'month') {
    label = `${MONL[cur.getMonth()]} ${cur.getFullYear()}`;
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const start = startOfWeek(first);
    const cells = Array.from({ length: 42 }, (_, i) => addD(start, i));
    const trimmed = cells[35].getMonth() !== cur.getMonth() ? cells.slice(0, 35) : cells;

    viewBody = `<div class="cal-h">${wdn.map(d => `<div>${d}</div>`).join('')}</div>
      <div class="cal-g" style="grid-template-rows:repeat(${trimmed.length / 7},minmax(116px,1fr))">${trimmed
        .map(d => {
          const ds = iso(d);
          const dayItems = getItemsForDate(ds);
          const isToday = diffD(d, TODAY) === 0;
          return `<div class="cday ${d.getMonth() !== cur.getMonth() ? 'out' : ''} ${isToday ? 'today' : ''}" data-drop-day="${ds}">
            <div class="row" style="justify-content:space-between">
              <span class="dn" ${isToday ? 'aria-current="date"' : ''}>${d.getDate()}</span>
              ${dayItems.length ? `<span class="faint num" style="font-size:11px">${dayItems.length}</span>` : ''}
            </div>
            ${dayItems.slice(0, 3).map(renderItemChip).join('')}
            ${dayItems.length > 3 ? `<button class="cmore" data-a="pop" data-pop="daylist" data-date="${ds}">+${dayItems.length - 3} more</button>` : ''}
          </div>`;
        })
        .join('')}</div>`;
  }
  // Mode 2: Week View
  else if (mode === 'week') {
    const ws = startOfWeek(cur);
    const days = Array.from({ length: 7 }, (_, i) => addD(ws, i));
    label = `${fmtDate(iso(days[0]))} – ${fmtDate(iso(days[6]))}, ${days[6].getFullYear()}`;

    viewBody = `<div class="week">${days
      .map(d => {
        const ds = iso(d);
        const dayItems = getItemsForDate(ds).sort((a, b) => {
          if (a.type === 'gcal') return -1;
          if (b.type === 'gcal') return 1;
          return 0;
        });
        const isToday = diffD(d, TODAY) === 0;
        return `<div class="wcol">
          <div class="wcol-h ${isToday ? 'today' : ''}">
            <span class="n">${d.getDate()}</span>
            <span class="muted" style="font-size:12px">${WD[d.getDay()]}</span>
            <span class="sp"></span>
            ${dayItems.length ? `<span class="badge ${isToday ? 'accent' : 'gray'}" style="font-size:10px">${dayItems.length}</span>` : ''}
          </div>
          <div class="wcol-b" data-drop-day="${ds}">${
            dayItems.length
              ? dayItems.map(it => {
                  if (it.type === 'gcal') {
                    return `<div class="wcard event" style="--c:#4285F4;border-color:color-mix(in srgb,#4285F4 30%,transparent);background:color-mix(in srgb,#4285F4 6%,var(--surface))" data-a="agendaGcalDetail" data-id="${it.id}">
                      <div class="t"><span class="pdot" style="--c:#4285F4;border-radius:50%"></span>${esc(it.title)}</div>
                      <div class="m"><span class="badge blue" style="font-size:9.5px;padding:1px 4px">Google Cal</span><span class="sp"></span><span>${it.time}</span></div>
                    </div>`;
                  }
                  if (it.type === 'milestone') {
                    const p = proj(it.project);
                    return `<div class="wcard" style="--c:${pColor(p)};border-style:dashed">
                      <div class="t"><span class="pdot" style="--c:${pColor(p)}"></span><b>Milestone</b></div>
                      <div class="trunc" style="font-size:12.5px">${esc(it.title)}</div>
                    </div>`;
                  }
                  if (it.type === 'event') {
                    const p = proj(it.project);
                    return `<button class="wcard event" style="--c:${pColor(p)}" data-a="pop" data-pop="event" data-id="${it.id}">
                      <span class="t"><span class="pdot" style="--c:${pColor(p)};border-radius:50%"></span>${esc(it.title)}</span>
                      <span class="m">${ic('clock', 11)}${it.time} · ${esc(p.name)}</span>
                    </button>`;
                  }
                  const t = it.raw;
                  const p = proj(t.project);
                  return `<button class="wcard${fxc('moved', t.id)}" style="--c:${pColor(p)}" draggable="true" data-drag-cal="${t.id}" data-a="openTask" data-id="${t.id}" data-ctx="task">
                    <span class="t" style="${t.status === 'done' ? 'text-decoration:line-through;color:var(--text-3)' : ''}"><span class="pdot" style="--c:${pColor(p)}"></span>${esc(t.title)}</span>
                    <span class="m">${stIcon(t.status, 11)}${prIcon(t.priority, 11)}<span class="trunc grow">${esc(p.name)}</span>${av(t.assignee, 'sm', false)}</span>
                  </button>`;
                }).join('')
              : '<span class="faint" style="font-size:12px;padding:6px">No scheduled items</span>'
          }</div>
        </div>`;
      })
      .join('')}</div>`;
  }
  // Mode 3: Day View
  else {
    const ds = iso(cur);
    const dayItems = getItemsForDate(ds);
    const isToday = diffD(cur, TODAY) === 0;
    label = `${WD[cur.getDay()]}, ${MONL[cur.getMonth()]} ${cur.getDate()}, ${cur.getFullYear()}`;

    viewBody = `<div class="panel" style="padding:16px;max-width:800px;margin:0 auto">
      <div class="row" style="margin-bottom:14px">
        <h3 style="font-size:16px;font-weight:600">${label} ${isToday ? '<span class="badge accent">Today</span>' : ''}</h3>
        <span class="sp"></span>
        <span class="faint">${dayItems.length} item${dayItems.length === 1 ? '' : 's'} scheduled</span>
      </div>
      ${
        dayItems.length
          ? `<div class="col" style="gap:10px">${dayItems
              .map(it => {
                if (it.type === 'gcal') {
                  return `<div class="panel" style="padding:12px 14px;border-left:4px solid #4285F4;display:flex;align-items:center;gap:12px">
                    <div style="font-size:13px;color:#4285F4;font-weight:600;min-width:70px">${it.time}</div>
                    <div class="grow">
                      <div style="font-weight:600;font-size:14px">${esc(it.title)}</div>
                      <div class="faint" style="font-size:12px">Google Calendar ${it.location ? `· ${esc(it.location)}` : ''}</div>
                    </div>
                    ${it.link ? `<a class="btn btn-secondary btn-sm" href="${esc(it.link)}" target="_blank" rel="noopener">${ic('external-link', 12)}Join / Open</a>` : ''}
                  </div>`;
                }
                if (it.type === 'milestone') {
                  const p = proj(it.project);
                  return `<div class="panel" style="padding:12px 14px;border-left:4px solid ${pColor(p)};display:flex;align-items:center;gap:12px">
                    <div style="font-size:12px;font-weight:600;color:var(--text-2);min-width:70px">Milestone</div>
                    <div class="grow">
                      <div style="font-weight:600;font-size:14px">${esc(it.title)}</div>
                      <div class="faint" style="font-size:12px">Project Milestone · ${esc(p.name)}</div>
                    </div>
                  </div>`;
                }
                if (it.type === 'event') {
                  const p = proj(it.project);
                  return `<div class="panel" style="padding:12px 14px;border-left:4px solid ${pColor(p)};display:flex;align-items:center;gap:12px;cursor:pointer" data-a="pop" data-pop="event" data-id="${it.id}">
                    <div style="font-size:13px;font-weight:600;color:var(--text);min-width:70px">${it.time}</div>
                    <div class="grow">
                      <div style="font-weight:600;font-size:14px">${esc(it.title)}</div>
                      <div class="faint" style="font-size:12px">Workspace Event · ${esc(p.name)}</div>
                    </div>
                  </div>`;
                }
                const t = it.raw;
                const p = proj(t.project);
                return `<div class="panel" style="padding:12px 14px;border-left:4px solid ${pColor(p)};display:flex;align-items:center;gap:12px;cursor:pointer" data-a="openTask" data-id="${t.id}">
                  <div style="min-width:70px">${stIcon(t.status, 15)}</div>
                  <div class="grow">
                    <div style="font-weight:600;font-size:14px;${t.status === 'done' ? 'text-decoration:line-through;color:var(--text-3)' : ''}">${esc(t.title)}</div>
                    <div class="faint" style="font-size:12px">Deadline in ${esc(p.name)}</div>
                  </div>
                  <div class="row" style="gap:8px">${prIcon(t.priority, 13)}${av(t.assignee, 'sm', false)}</div>
                </div>`;
              })
              .join('')}</div>`
          : `<div class="panel-b faint" style="padding:28px;text-align:center">No meetings, tasks, or milestones on this day.</div>`
      }
    </div>`;
  }

  // Google Calendar Connection Status Banner (only shown when connected)
  const gcalBanner = gcal.connected
    ? `<div class="row" style="gap:8px;padding:6px 10px;background:color-mix(in srgb, #4285F4 12%, var(--surface));border:1px solid color-mix(in srgb, #4285F4 25%, transparent);border-radius:var(--r);font-size:12.5px;margin-bottom:12px">
        <span class="pdot" style="--c:#4285F4;border-radius:50%"></span>
        <span><b>Google Calendar connected</b> · ${gcal.events.length} events synced</span>
        <span class="sp"></span>
        <button class="btn btn-ghost btn-sm" data-a="syncGcal">${ic('refresh-cw', 12)}Sync now</button>
        <button class="btn btn-ghost btn-sm" data-a="openGcalModal">${ic('settings', 12)}Settings</button>
      </div>`
    : '';

  return `<div class="page flush">
    <div class="ph">
      <div>
        <h1>Agenda</h1>
        <p>Unified personal schedule combining meetings, appointments, and workspace deadlines.</p>
      </div>
      <div class="acts">
        <button class="btn btn-secondary" data-a="openGcalModal">${ic('calendar', 14)}${gcal.connected ? 'Google Account' : 'Connect Google'}</button>
        <button class="btn btn-primary" data-a="newTask">${ic('plus', 14)}New task</button>
      </div>
    </div>

    ${gcalBanner}

    <div class="toolbar" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" data-a="calNav" data-d="0">Today</button>
      <div class="row" style="gap:0">
        <button class="ibtn ibtn-sm" data-a="calNav" data-d="-1" aria-label="Previous">${ic('chevron-left', 16)}</button>
        <button class="ibtn ibtn-sm" data-a="calNav" data-d="1" aria-label="Next">${ic('chevron-right', 16)}</button>
      </div>
      <h2 style="font-size:15px;font-weight:600;margin:0 4px;letter-spacing:-.01em" aria-live="polite">${label}</h2>
      <span class="sp"></span>

      <!-- Event Source Filter -->
      <div class="row" style="gap:6px">
        <span class="faint hide-m" style="font-size:12px">Source:</span>
        <div class="seg">${[
          ['all', 'All sources'],
          ['gcal', 'Google Cal'],
          ['workspace', 'Workspace'],
          ['milestones', 'Milestones'],
        ].map(([srcId, srcName]) => `<button class="${filterSrc === srcId ? 'on' : ''}" data-a="setAgendaSource" data-v="${srcId}">${srcName}</button>`).join('')}</div>
      </div>

      <!-- View Modes: Day / Week / Month -->
      <div class="seg">${[
        ['day', 'Day'],
        ['week', 'Week'],
        ['month', 'Month'],
      ].map(([mId, mName]) => `<button class="${mode === mId ? 'on' : ''}" data-a="setAgendaMode" data-v="${mId}">${mName}</button>`).join('')}</div>
    </div>

    <div class="cal" style="min-height:600px">
      ${viewBody}
    </div>
  </div>`;
}
