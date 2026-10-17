import { MONL, TODAY, WDL, diffD, esc, fmtDate, parse } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { D, S, allTasks, canSee, isOver, pColor, progressOf, proj, visibleProjects } from '../core/store.js';
import { av, avStack, empty, pIcon, pStatus, prIcon, progBar } from '../ui/helpers.js';
import { sortTasks } from '../shell/view-engine.js';
import { actHtml, miniRow } from '../components/task-list.js';

export function pageHome() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const all = allTasks();
  const mineAll = all.filter(t => t.assignee === D().me);
  const activeP = visibleProjects().filter(p => canSee(p) && p.status !== 'complete');
  const open = all.filter(t => t.status !== 'done');
  const over = all.filter(isOver);
  const tab = S.ui.homeTab;
  const lists = {
    upcoming: sortTasks(
      mineAll.filter(t => t.status !== 'done' && !isOver(t)),
      { f: 'due', dir: 1 },
    ),
    overdue: mineAll.filter(isOver),
    completed: sortTasks(
      mineAll.filter(t => t.status === 'done'),
      { f: 'updated', dir: 1 },
    ),
  };
  const cur = lists[tab].slice(0, 7);
  const dl = (lab, a, b) => {
    const ts = sortTasks(
      open.filter(t => t.due && diffD(parse(t.due), TODAY) >= a && diffD(parse(t.due), TODAY) <= b),
      { f: 'priority', dir: 1 },
    );
    return { lab, ts };
  };
  const dls = [dl('Today', 0, 0), dl('Tomorrow', 1, 1), dl('This week', 2, 7)];

  // Meetings calculation
  const allMeetings = (D().meetings || []).slice().sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const mTab = S.ui.homeMeetingsTab || 'upcoming';
  const meetingLists = {
    upcoming: allMeetings.filter(m => m.status === 'upcoming' || (!m.status && m.date >= new Date().toISOString().slice(0, 10))),
    past: allMeetings.filter(m => m.status === 'past' || (!m.status && m.date < new Date().toISOString().slice(0, 10))),
    cancelled: allMeetings.filter(m => m.status === 'cancelled'),
  };
  const curMeetings = meetingLists[mTab].slice(0, 5);

  // Find imminent meeting starting within 1 hour (60 minutes)
  const now = Date.now();
  let imminentMeeting = null;
  for (const m of meetingLists.upcoming) {
    if (!m.date || !m.time) continue;
    const mtgTime = new Date(`${m.date}T${m.time.length === 5 ? m.time : '00:00'}:00`).getTime();
    const diffMs = mtgTime - now;
    const diffMins = Math.round(diffMs / (60 * 1000));
    // If meeting starts within the next 60 minutes or is currently in progress (within duration)
    if (diffMins >= -(m.duration || 30) && diffMins <= 60) {
      imminentMeeting = m;
      break;
    }
  }


  return `<div class="page">
    <div class="ph"><div><h1>${greet}, ${esc(S.prefs.name.split(' ')[0])}</h1><p><span class="num">${WDL[TODAY.getDay()]}, ${MONL[TODAY.getMonth()]} ${TODAY.getDate()}</span> · Here's what's happening across your workspace.</p></div>
      <div class="acts">
        <button class="btn btn-secondary hide-m" data-a="invite">${ic('user-plus', 14)}Invite member</button>
        <button class="btn btn-secondary hide-m" data-a="newProject">${ic('folder-plus', 14)}New project</button>
        <button class="btn btn-secondary" data-a="newMeetingModal">${ic('video', 14)}Schedule</button>
        <button class="btn btn-primary" data-a="newTask">${ic('plus', 14)}New task</button>
      </div>
    </div>
    <div class="stats" style="margin-bottom:16px">
      <button class="stat" data-a="go" data-r="projects"><span class="k">${ic('folder-kanban', 14)}Active projects</span><span class="v">${activeP.length}</span><span class="d">${activeP.filter(p => p.status === 'risk').length} at risk</span></button>
      <button class="stat" data-a="goTasks" data-f="open"><span class="k">${ic('circle-dashed', 14)}Open tasks</span><span class="v">${open.length}</span><span class="d">${open.filter(t => t.assignee === D().me).length} assigned to you</span></button>
      <button class="stat" data-a="go" data-r="meetings"><span class="k">${ic('video', 14)}Meetings</span><span class="v">${meetingLists.upcoming.length}</span><span class="d">scheduled calls</span></button>
      <button class="stat" data-a="goTasks" data-f="overdue"><span class="k">${ic('clock-alert', 14)}Overdue</span><span class="v" style="${over.length ? 'color:var(--red)' : ''}">${over.length}</span><span class="d ${over.length ? 'bad' : ''}">${over.length ? 'need attention' : 'all on track'}</span></button>
    </div>
    <div class="grid2">
      <div class="stack">
        <!-- Meetings component (above My tasks) -->
        <section class="panel home-meetings-panel" aria-labelledby="h-meetings" style="min-height:220px;display:flex;flex-direction:column">
          <div class="panel-h">
            <h2 id="h-meetings">Meetings</h2>
            <div class="acts">
              <div class="seg" role="tablist">${[
                ['upcoming', 'Upcoming'],
                ['cancelled', 'Cancelled'],
              ]
                .map(
                  ([k, n]) =>
                    `<button role="tab" class="${mTab === k ? 'on' : ''}" data-a="set" data-k="homeMeetingsTab" data-v="${k}">${n} <span class="faint">${meetingLists[k].length}</span></button>`,
                )
                .join('')}</div>
              <button class="ibtn ibtn-sm" data-a="syncCalcomNow" data-tip="Sync meetings now" aria-label="Sync meetings now">${ic('refresh-cw', 13)}</button>
              <button class="ibtn ibtn-sm" data-a="go" data-r="meetings" data-tip="Open Meetings" aria-label="Open Meetings">${ic('arrow-up-right', 15)}</button>
            </div>
          </div>
          ${
            curMeetings.length
              ? curMeetings
                  .map(
                    m => `<div class="mini" style="min-height:50px;padding:10px 14px;border-bottom:1px solid var(--divider);gap:10px;align-items:center">
                      <div style="min-width:65px">
                        <b style="font-size:13px;color:var(--text)">${m.time || '10:00'}</b>
                        <div class="faint" style="font-size:11px">${fmtDate(m.date, true)}</div>
                      </div>
                      <div class="grow" style="min-width:0">
                        <div class="row" style="gap:6px">
                          <b class="trunc" style="font-size:13px">${esc(m.title)}</b>
                          ${m.source === 'calcom' ? '<span class="badge" style="background:#111;color:#fff;border:1px solid #333;font-size:9.5px;padding:1px 5px">Cal.com</span>' : ''}
                        </div>
                        <div class="faint trunc" style="font-size:12px;margin-top:1px">
                          with <b>${esc(m.personName || 'Guest')}</b> ${m.personCompany ? `· ${esc(m.personCompany)}` : ''}
                          ${m.location ? `<span style="color:var(--accent);margin-left:4px">· ${esc(m.location)}</span>` : ''}
                        </div>
                      </div>
                      <div class="row" style="gap:6px">
                        ${m.meetUrl && m.status !== 'cancelled' ? `<a class="btn btn-secondary btn-xs" href="${esc(m.meetUrl)}" target="_blank" rel="noopener">${ic('video', 12)}Join</a>` : ''}
                        <button class="ibtn ibtn-xs" data-a="openRescheduleModal" data-id="${m.id}" data-tip="Reschedule" aria-label="Reschedule">${ic('calendar-clock', 13)}</button>
                        <button class="ibtn ibtn-xs" data-a="openRequestRescheduleModal" data-id="${m.id}" data-tip="Request reschedule" aria-label="Request reschedule">${ic('send', 12)}</button>
                        <button class="ibtn ibtn-xs" data-a="openEditMeetingModal" data-id="${m.id}" data-tip="Edit meeting" aria-label="Edit meeting">${ic('pencil', 12)}</button>
                      </div>
                    </div>`,
                  )
                  .join('')
              : empty(mTab === 'upcoming' ? 'video' : 'calendar-check', mTab === 'upcoming' ? 'No upcoming meetings' : 'No meetings in this tab', mTab === 'upcoming' ? 'Share your Cal.com link to get booked.' : '', '', 'sm')
          }
          ${meetingLists[mTab].length > 5 ? `<button class="addrow" style="padding-left:14px;border-top:1px solid var(--divider);border-bottom:0" data-a="go" data-r="meetings">View all ${meetingLists[mTab].length} meetings ${ic('arrow-right', 13)}</button>` : ''}
        </section>

        <!-- My tasks -->
        <section class="panel" aria-labelledby="h-mytasks">
          <div class="panel-h"><h2 id="h-mytasks">My tasks</h2>
            <div class="acts"><div class="seg" role="tablist">${[
              ['upcoming', 'Upcoming'],
              ['overdue', 'Overdue'],
              ['completed', 'Completed'],
            ]
              .map(
                ([k, n]) =>
                  `<button role="tab" class="${tab === k ? 'on' : ''}" data-a="set" data-k="homeTab" data-v="${k}">${n} <span class="faint">${lists[k].length}</span></button>`,
              )
              .join('')}</div>
            <button class="ibtn ibtn-sm" data-a="go" data-r="mytasks" data-tip="Open My Tasks" aria-label="Open My Tasks">${ic('arrow-up-right', 15)}</button></div></div>
          ${cur.length ? cur.map(t => miniRow(t, { av: false })).join('') : empty(tab === 'overdue' ? 'circle-check' : 'list-checks', tab === 'overdue' ? 'Nothing overdue' : 'No tasks here', tab === 'overdue' ? 'Every task assigned to you is on schedule.' : 'Add a task to get things moving.', '', 'sm')}
          ${lists[tab].length > 7 ? `<button class="addrow" style="padding-left:14px;border-top:1px solid var(--divider);border-bottom:0" data-a="go" data-r="mytasks">View all ${lists[tab].length} tasks ${ic('arrow-right', 13)}</button>` : ''}
        </section>
        <section class="panel">
          <div class="panel-h"><h2>Project progress</h2><div class="acts"><button class="btn btn-sm btn-ghost" data-a="go" data-r="projects">All projects</button></div></div>
          <div style="overflow-x:auto"><table class="perm-t" style="min-width:560px"><thead><tr><th style="padding-left:14px">Project</th><th style="text-align:left">Status</th><th style="text-align:left;width:26%">Progress</th><th style="text-align:left">Due</th><th style="text-align:right;padding-right:14px">Team</th></tr></thead><tbody>
          ${activeP
            .filter(canSee)
            .map(p => {
              const pr = progressOf(p.id);
              return `<tr style="cursor:pointer" data-a="go" data-r="project" data-id="${p.id}" data-tab="overview"><td style="padding-left:14px"><span class="row">${pIcon(p, '', 14)}<b style="font-weight:500">${esc(p.name)}</b></span></td><td style="text-align:left">${pStatus(p.status)}</td><td><span class="row">${progBar(pr, p.status === 'risk' ? 'red' : '')}<span class="num faint" style="font-size:11.5px;width:30px">${pr}%</span></span></td><td style="text-align:left" class="num muted">${fmtDate(p.due)}</td><td style="text-align:right;padding-right:14px">${avStack(p.members, 3)}</td></tr>`;
            })
            .join('')}
          </tbody></table></div>
        </section>
      </div>
      <div class="stack">
        ${
          imminentMeeting
            ? (() => {
                const personDetails = [
                  imminentMeeting.personName,
                  imminentMeeting.personRole || imminentMeeting.personTitle,
                  imminentMeeting.personCompany ? `@ ${imminentMeeting.personCompany}` : '',
                ].filter(Boolean).join(' · ');

                return `<div class="imminent-meeting-card" aria-label="Upcoming meeting">
                  <div class="imminent-bg"></div>
                  <div class="imminent-bg-overlay"></div>

                  <div class="row" style="justify-content:flex-end;align-items:center">
                    <div class="row" style="gap:4px">
                      <button class="ibtn ibtn-xs" data-a="openRescheduleModal" data-id="${imminentMeeting.id}" data-tip="Reschedule" aria-label="Reschedule" style="color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.06);border-radius:var(--r-sm)">${ic('calendar-clock', 13)}</button>
                      <button class="ibtn ibtn-xs" data-a="openRequestRescheduleModal" data-id="${imminentMeeting.id}" data-tip="Request reschedule" aria-label="Request reschedule" style="color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.06);border-radius:var(--r-sm)">${ic('send', 13)}</button>
                      <button class="ibtn ibtn-xs" data-a="openEditMeetingModal" data-id="${imminentMeeting.id}" data-tip="Edit details" aria-label="Edit details" style="color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.06);border-radius:var(--r-sm)">${ic('pencil', 13)}</button>
                    </div>
                  </div>

                  <div class="imminent-content">
                    <h3 class="imminent-title">${esc(imminentMeeting.title)}</h3>
                    <div class="imminent-desc">
                      <div>${imminentMeeting.time} · ${imminentMeeting.duration || 30} mins ${imminentMeeting.location ? `· ${esc(imminentMeeting.location)}` : ''}</div>
                      ${personDetails ? `<div style="margin-top:3px"><span class="imminent-person-highlight">${esc(imminentMeeting.personName || '')}</span> ${imminentMeeting.personCompany ? `<span class="imminent-company-highlight">(${esc(imminentMeeting.personCompany)})</span>` : ''} ${imminentMeeting.personTitle ? `· ${esc(imminentMeeting.personTitle)}` : ''}</div>` : ''}
                    </div>
                  </div>

                  <div class="imminent-actions">
                    <div class="row" style="gap:6px">
                      <button class="imminent-btn-icon" data-a="researchMeetingAttendee" data-id="${imminentMeeting.id}" data-tip="AI Research" aria-label="AI Research">
                        ${ic('sparkles', 15)}
                      </button>
                      <button class="imminent-btn-report" data-a="readMeetingReport" data-id="${imminentMeeting.id}">
                        ${ic('file-text', 13)} Read report
                      </button>
                    </div>
                    ${
                      imminentMeeting.meetUrl
                        ? `<a class="imminent-btn-join" href="${esc(imminentMeeting.meetUrl)}" target="_blank" rel="noopener">
                            Join Call
                          </a>`
                        : ''
                    }
                  </div>
                </div>`;
              })()
            : ''
        }
        <section class="panel">
          <div class="panel-h"><h2>Upcoming deadlines</h2><div class="acts"><button class="btn btn-sm btn-ghost" data-a="go" data-r="calendar">${ic('calendar', 13)}Calendar</button></div></div>
          <div class="panel-b" style="padding-bottom:6px">
          ${dls
            .map(
              g => `<div style="margin-bottom:10px"><div class="row" style="font-size:11.5px;font-weight:600;color:var(--text-2);margin-bottom:4px">${g.lab}<span class="faint" style="font-weight:500">${g.ts.length}</span></div>
            ${
              g.ts.length
                ? g.ts
                    .slice(0, 4)
                    .map(
                      t =>
                        `<div class="row" style="height:30px;cursor:pointer;gap:8px;font-size:13px" data-a="openTask" data-id="${t.id}"><span class="pdot" style="--c:${pColor(proj(t.project))}"></span><span class="trunc grow">${esc(t.title)}</span>${prIcon(t.priority, 13)}${av(t.assignee, 'sm')}</div>`,
                    )
                    .join('') + (g.ts.length > 4 ? `<div class="faint" style="font-size:11.5px;padding-left:16px">+${g.ts.length - 4} more</div>` : '')
                : `<div class="faint" style="font-size:12.5px;padding:4px 0 2px">Nothing due</div>`
            }</div>`,
            )
            .join('')}
          </div>
        </section>
        <section class="panel">
          <div class="panel-h"><h2>Recent activity</h2><div class="acts"><button class="btn btn-sm btn-ghost" data-a="go" data-r="activity">View all</button></div></div>
          <div class="panel-b feed lined">${D()
            .activity.slice(0, 7)
            .map(a => actHtml(a, { proj: true }))
            .join('')}</div>
        </section>
      </div>
    </div>
  </div>`;
}
