/* ---------- MY TASKS ---------- */
import { TODAY, dOff, diffD, parse } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { D, S, allTasks, isOver } from '../core/store.js';
import { applyView, groupTasks, viewOf, viewToolbar } from '../shell/view-engine.js';
import { listHtml } from '../components/task-list.js';
import { boardHtml } from '../views/board.js';
import { calendarHtml } from '../views/calendar.js';

export function pageMyTasks() {
  const key = 'mytasks';
  const v = viewOf(key);
  const mode = v.mode || S.ui.myView || 'board';
  v.mode = mode;

  const mine = applyView(
    allTasks().filter(t => t.assignee === D().me),
    mode === 'list' && v.sort.f === 'manual' ? { ...v, sort: { f: 'due', dir: 1 } } : v,
  );

  const groups = [
    { key: 'overdue', name: 'Overdue', html: `<span style="color:var(--red)">${ic('clock-alert', 14)}</span>`, tasks: mine.filter(isOver), set: {} },
    {
      key: 'today',
      name: 'Today',
      html: ic('sun', 14),
      tasks: mine.filter(t => t.status !== 'done' && t.due && diffD(parse(t.due), TODAY) === 0),
      set: { due: dOff(0) },
    },
    {
      key: 'upcoming',
      name: 'Upcoming',
      html: ic('calendar-days', 14),
      tasks: mine.filter(t => t.status !== 'done' && (!t.due || diffD(parse(t.due), TODAY) > 0)),
      set: { due: dOff(3) },
    },
    {
      key: 'completed',
      name: 'Completed',
      html: `<span style="color:var(--green)">${ic('circle-check', 14)}</span>`,
      tasks: mine.filter(t => t.status === 'done'),
      set: { status: 'done' },
      collapsed: true,
    },
  ];

  const right = `<div class="seg" role="tablist" aria-label="View">${[
    ['list', 'List', 'list'],
    ['board', 'Board', 'square-kanban'],
    ['calendar', 'Calendar', 'calendar'],
  ]
    .map(
      ([k, n, i]) =>
        `<button class="${mode === k ? 'on' : ''}" data-a="setViewMode" data-key="${key}" data-v="${k}">${ic(i, 13)}<span class="hide-m">${n}</span></button>`,
    )
    .join('')}</div>`;

  let body;
  if (mode === 'board') {
    body = boardHtml(mine, key, {});
  } else if (mode === 'calendar') {
    body = calendarHtml(mine, { key: 'my' });
  } else if (v.group && v.group !== 'none' && v.group !== 'status') {
    body = `<div class="list-wrap">${listHtml(groupTasks(mine, v.group), key, { cols: ['project', 'status', 'priority', 'due'], complete: true, drag: false, keepEmpty: true })}</div>`;
  } else {
    body = `<div class="list-wrap">${listHtml(groups, key, { cols: ['project', 'status', 'priority', 'due'], complete: true, drag: false, keepEmpty: true })}</div>`;
  }

  return `<div class="page flush">
    <div class="ph">
      <div>
        <h1>My Tasks</h1>
        <p>${groups[1].tasks.length} due today · ${groups[0].tasks.length} overdue · ${groups[2].tasks.length} upcoming</p>
      </div>
      <div class="acts">
        <button class="btn btn-primary" data-a="newTask" data-assignee="${D().me}">${ic('plus', 14)}New task</button>
      </div>
    </div>
    ${viewToolbar(key, { right, group: mode === 'list' })}
    ${body}
  </div>`;
}
