/* =====================================================================
   PEOPLE: Lightweight Work CRM (Profiles, Companies, Meetings, Notes, Tasks)
   ===================================================================== */
import { ago, esc, fmtDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, contactsList } from '../core/store.js';
import { empty } from '../ui/helpers.js';

export function pagePeople() {
  const u = S.ui;
  const q = (u.crmQ || '').toLowerCase();
  const filterCo = u.crmFilterCo || 'all';
  const tab = u.crmTab || 'people'; // 'people' | 'companies' | 'followups'
  const contacts = contactsList();

  const companies = [...new Set(contacts.map(c => c.company).filter(Boolean))].sort();

  // Filter contacts
  const filtered = contacts.filter(c => {
    const matchQ = !q || c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q);
    const matchCo = filterCo === 'all' || c.company === filterCo;
    return matchQ && matchCo;
  });

  // Follow-up tasks across contacts
  const allFollowUps = contacts.flatMap(c => (c.followUps || []).map(f => ({ ...f, contact: c })));
  const pendingFollowUps = allFollowUps.filter(f => !f.done);

  return `<div class="page wide" style="max-width:1200px">
    <div class="ph">
      <div>
        <h1>People</h1>
        <p>Lightweight relationship CRM to track contacts, companies, meetings, and follow-ups.</p>
      </div>
      <div class="acts">
        <button class="btn btn-secondary" data-a="newMeeting">${ic('calendar-plus', 14)}Log meeting</button>
        <button class="btn btn-primary" data-a="newContact">${ic('user-plus', 14)}New contact</button>
      </div>
    </div>

    <!-- Stats row -->
    <div class="stats" style="margin-bottom:16px">
      <div class="stat">
        <span class="k">${ic('users', 14)}Total contacts</span>
        <span class="v">${contacts.length}</span>
        <span class="d">${companies.length} companies</span>
      </div>
      <div class="stat">
        <span class="k">${ic('calendar', 14)}Meetings logged</span>
        <span class="v">${contacts.reduce((acc, c) => acc + (c.meetings?.length || 0), 0)}</span>
        <span class="d">History recorded</span>
      </div>
      <div class="stat">
        <span class="k">${ic('check-circle', 14)}Pending follow-ups</span>
        <span class="v">${pendingFollowUps.length}</span>
        <span class="d">${pendingFollowUps.length ? 'Action items active' : 'All caught up'}</span>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs" style="margin-bottom:14px">
      <button class="tab ${tab === 'people' ? 'on' : ''}" data-a="set" data-k="crmTab" data-v="people">People (${contacts.length})</button>
      <button class="tab ${tab === 'companies' ? 'on' : ''}" data-a="set" data-k="crmTab" data-v="companies">Companies (${companies.length})</button>
      <button class="tab ${tab === 'followups' ? 'on' : ''}" data-a="set" data-k="crmTab" data-v="followups">Follow-up tasks (${pendingFollowUps.length})</button>
    </div>

    <!-- Tab 1: People directory -->
    ${
      tab === 'people'
        ? `<div class="row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">
            <div class="inwrap">${ic('search', 13)}<input class="input search-sm" id="crm-q" data-in="crmQ" placeholder="Search by name, company, email, or title" value="${esc(u.crmQ || '')}" aria-label="Search contacts"></div>
            ${
              companies.length
                ? `<select class="select" style="height:28px;width:auto;font-size:12px" data-in="crmFilterCo" aria-label="Filter by company">
                    <option value="all">All companies</option>
                    ${companies.map(co => `<option value="${esc(co)}" ${filterCo === co ? 'selected' : ''}>${esc(co)}</option>`).join('')}
                  </select>`
                : ''
            }
          </div>
          <div class="panel" style="overflow-x:auto">
            ${
              filtered.length
                ? `<table class="perm-t" style="min-width:900px">
                    <thead>
                      <tr>
                        <th style="padding-left:14px">Contact</th>
                        <th style="text-align:left">Company</th>
                        <th style="text-align:left">Title</th>
                        <th style="text-align:left">Email & Phone</th>
                        <th>Meetings</th>
                        <th>Follow-ups</th>
                        <th style="text-align:left">Last contacted</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filtered
                        .map(c => {
                          const openFus = (c.followUps || []).filter(f => !f.done).length;
                          return `<tr data-ctx="contact" data-id="${c.id}">
                            <td style="padding-left:14px">
                              <button class="row" data-a="openContact" data-id="${c.id}" style="gap:10px;text-align:left;background:none;border:none;cursor:pointer">
                                <span class="av md" style="background:${c.color || '#4B5BD6'};color:#fff">${(c.name || 'C')[0]}</span>
                                <span class="col">
                                  <b style="font-weight:500;color:var(--text)">${esc(c.name)}</b>
                                  ${c.tags && c.tags.length ? `<span class="faint" style="font-size:11px">${c.tags.map(t => `#${esc(t)}`).join(' ')}</span>` : ''}
                                </span>
                              </button>
                            </td>
                            <td style="text-align:left">
                              ${c.company ? `<button class="pillbtn" data-a="filterByCompany" data-v="${esc(c.company)}">${ic('building-2', 12)}${esc(c.company)}</button>` : '<span class="faint">—</span>'}
                            </td>
                            <td style="text-align:left" class="muted">${esc(c.title || '—')}</td>
                            <td style="text-align:left">
                              <div class="col" style="gap:2px">
                                ${c.email ? `<a href="mailto:${esc(c.email)}" class="link" style="font-size:12px">${esc(c.email)}</a>` : ''}
                                ${c.phone ? `<span class="faint" style="font-size:11.5px">${esc(c.phone)}</span>` : ''}
                                ${!c.email && !c.phone ? '<span class="faint">—</span>' : ''}
                              </div>
                            </td>
                            <td class="num">${c.meetings?.length || 0}</td>
                            <td class="num">${openFus ? `<span class="badge red">${openFus}</span>` : '0'}</td>
                            <td style="text-align:left" class="muted">${c.lastContacted ? ago(c.lastContacted) : '—'}</td>
                            <td>
                              <div class="row" style="gap:4px">
                                <button class="ibtn ibtn-sm" data-a="newMeeting" data-id="${c.id}" data-tip="Log meeting" aria-label="Log meeting">${ic('calendar-plus', 13)}</button>
                                <button class="ibtn ibtn-sm" data-a="editContact" data-id="${c.id}" data-tip="Edit" aria-label="Edit">${ic('pencil', 13)}</button>
                                <button class="ibtn ibtn-sm" data-a="delContact" data-id="${c.id}" data-tip="Delete" aria-label="Delete">${ic('trash-2', 13)}</button>
                              </div>
                            </td>
                          </tr>`;
                        })
                        .join('')}
                    </tbody>
                  </table>`
                : empty('users', 'No contacts yet', 'Keep client, investor, and partner contacts organized with meeting logs and action items.', `<button class="btn btn-primary btn-sm" data-a="newContact">${ic('user-plus', 14)}Add first contact</button>`)
            }
          </div>`
        : ''
    }

    <!-- Tab 2: Companies directory -->
    ${
      tab === 'companies'
        ? `<div class="pgrid">
            ${
              companies.length
                ? companies
                    .map(co => {
                      const coPeople = contacts.filter(c => c.company === co);
                      const coMeetings = coPeople.reduce((acc, c) => acc + (c.meetings?.length || 0), 0);
                      return `<div class="pcard" style="cursor:default">
                        <div class="row">
                          <span class="picon" style="--c:#3B82C4">${ic('building-2', 16)}</span>
                          <b style="font-weight:600;font-size:15px">${esc(co)}</b>
                          <span class="sp"></span>
                          <button class="btn btn-ghost btn-sm" data-a="filterByCompany" data-v="${esc(co)}">View contacts</button>
                        </div>
                        <div class="desc faint" style="font-size:12.5px">${coPeople.length} contact${coPeople.length === 1 ? '' : 's'} · ${coMeetings} meeting${coMeetings === 1 ? '' : 's'} logged</div>
                        <div class="col" style="gap:6px;margin-top:10px">
                          ${coPeople
                            .slice(0, 4)
                            .map(
                              p =>
                                `<div class="row" style="gap:8px;font-size:13px;cursor:pointer" data-a="openContact" data-id="${p.id}">
                                  <span class="av sm" style="background:${p.color || '#4B5BD6'};color:#fff">${p.name[0]}</span>
                                  <span class="grow trunc">${esc(p.name)}</span>
                                  <span class="faint" style="font-size:11.5px">${esc(p.title || '')}</span>
                                </div>`
                            )
                            .join('')}
                        </div>
                      </div>`;
                    })
                    .join('')
                : `<div class="panel" style="grid-column:1/-1">${empty('building-2', 'No companies yet', 'Companies will appear here as you create contacts.', '')}</div>`
            }
          </div>`
        : ''
    }

    <!-- Tab 3: Follow-up Tasks -->
    ${
      tab === 'followups'
        ? `<div class="panel" style="padding:16px;max-width:800px">
            <h2 style="font-size:15px;margin-bottom:12px">All CRM Follow-ups</h2>
            ${
              allFollowUps.length
                ? `<div class="col" style="gap:8px">${allFollowUps
                    .map(
                      f =>
                        `<div class="row" style="padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);gap:10px">
                          <button class="ibtn ibtn-xs" data-a="toggleFollowUp" data-cid="${f.contact.id}" data-fid="${f.id}">
                            ${ic(f.done ? 'check-circle' : 'circle', 15)}
                          </button>
                          <div class="grow ${f.done ? 'faint' : ''}" style="${f.done ? 'text-decoration:line-through' : ''}">
                            <div style="font-weight:500;font-size:13.5px">${esc(f.title)}</div>
                            <div class="faint" style="font-size:11.5px">Contact: <b style="color:var(--text)">${esc(f.contact.name)}</b> ${f.due ? `· Due ${fmtDate(f.due)}` : ''}</div>
                          </div>
                          <button class="ibtn ibtn-xs" data-a="openContact" data-id="${f.contact.id}" data-tip="Open contact">${ic('arrow-right', 13)}</button>
                        </div>`
                    )
                    .join('')}</div>`
                : empty('check-circle', 'No follow-up tasks', 'Schedule follow-up actions inside contact profiles to keep relationships warm.', '')
            }
          </div>`
        : ''
    }
  </div>`;
}

/**
 * Contact detail drawer/modal view
 */
export function contactDetailModal(c) {
  const meetings = c.meetings || [];
  const followUps = c.followUps || [];
  const notes = c.notes || '';

  return `<div class="modal" role="dialog" style="max-width:680px">
    <div class="modal-h">
      <div class="row" style="gap:12px">
        <span class="av lg" style="background:${c.color || '#4B5BD6'};color:#fff;font-size:18px">${(c.name || 'C')[0]}</span>
        <div>
          <h2 style="margin:0">${esc(c.name)}</h2>
          <div class="muted" style="font-size:13px">${esc(c.title || 'Contact')}${c.company ? ` at <b>${esc(c.company)}</b>` : ''}</div>
        </div>
      </div>
      <button class="ibtn ibtn-sm" data-a="closeModal" aria-label="Close">${ic('x', 16)}</button>
    </div>
    
    <div class="modal-b" style="display:flex;flex-direction:column;gap:18px">
      <!-- Contact Info Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        <div class="panel" style="padding:10px">
          <div class="eyebrow">Email</div>
          <div class="trunc" style="font-size:13px;font-weight:500;margin-top:2px">${c.email ? `<a href="mailto:${esc(c.email)}" class="link">${esc(c.email)}</a>` : '—'}</div>
        </div>
        <div class="panel" style="padding:10px">
          <div class="eyebrow">Phone</div>
          <div class="trunc" style="font-size:13px;font-weight:500;margin-top:2px">${esc(c.phone || '—')}</div>
        </div>
        <div class="panel" style="padding:10px">
          <div class="eyebrow">Location</div>
          <div class="trunc" style="font-size:13px;font-weight:500;margin-top:2px">${esc(c.location || '—')}</div>
        </div>
      </div>

      <!-- Private Notes -->
      <div class="panel" style="padding:14px">
        <div class="row" style="margin-bottom:8px">
          <span class="eyebrow">${ic('file-text', 12)}Private Notes & Context</span>
          <span class="sp"></span>
          <button class="btn btn-ghost btn-sm" data-a="editContact" data-id="${c.id}">${ic('pencil', 12)}Edit notes</button>
        </div>
        <div style="font-size:13px;line-height:1.5;color:var(--text);white-space:pre-wrap">${notes ? esc(notes) : '<span class="faint">No private notes recorded yet.</span>'}</div>
      </div>

      <!-- Follow-up tasks -->
      <div class="panel" style="padding:14px">
        <div class="row" style="margin-bottom:10px">
          <span class="eyebrow">${ic('check-circle', 12)}Follow-up Tasks (${followUps.filter(f => !f.done).length} open)</span>
          <span class="sp"></span>
          <button class="btn btn-secondary btn-sm" data-a="addFollowUpPrompt" data-id="${c.id}">${ic('plus', 12)}Add task</button>
        </div>
        ${
          followUps.length
            ? `<div class="col" style="gap:6px">${followUps
                .map(
                  f =>
                    `<div class="row" style="gap:8px;font-size:13px;padding:6px 8px;border-radius:var(--r-sm);background:var(--surface)">
                      <button class="ibtn ibtn-xs" data-a="toggleFollowUp" data-cid="${c.id}" data-fid="${f.id}">${ic(f.done ? 'check-circle' : 'circle', 14)}</button>
                      <span class="grow ${f.done ? 'faint' : ''}" style="${f.done ? 'text-decoration:line-through' : ''}">${esc(f.title)}</span>
                      ${f.due ? `<span class="faint" style="font-size:11px">${fmtDate(f.due)}</span>` : ''}
                    </div>`
                )
                .join('')}</div>`
            : '<div class="faint" style="font-size:12.5px">No pending follow-ups.</div>'
        }
      </div>

      <!-- Meeting History & Upcoming -->
      <div class="panel" style="padding:14px">
        <div class="row" style="margin-bottom:10px">
          <span class="eyebrow">${ic('calendar', 12)}Meetings & Calls (${meetings.length})</span>
          <span class="sp"></span>
          <button class="btn btn-primary btn-sm" data-a="newMeeting" data-id="${c.id}">${ic('plus', 12)}Schedule / Log meeting</button>
        </div>
        ${
          meetings.length
            ? `<div class="col" style="gap:8px">${meetings
                .map(
                  m =>
                    `<div class="panel" style="padding:10px 12px;background:var(--surface);display:flex;flex-direction:column;gap:4px">
                      <div class="row" style="justify-content:space-between">
                        <b style="font-size:13.5px">${esc(m.title)}</b>
                        <span class="badge ${m.type === 'upcoming' ? 'blue' : 'gray'}" style="font-size:10.5px">${m.date} · ${m.time || '10:00'}</span>
                      </div>
                      ${m.notes ? `<div class="muted" style="font-size:12px;margin-top:2px">${esc(m.notes)}</div>` : ''}
                    </div>`
                )
                .join('')}</div>`
            : '<div class="faint" style="font-size:12.5px">No meetings recorded with this person yet.</div>'
        }
      </div>
    </div>

    <div class="modal-f">
      <button class="btn btn-danger-ghost" data-a="delContact" data-id="${c.id}">${ic('trash-2', 13)}Delete contact</button>
      <span class="sp"></span>
      <button class="btn btn-secondary" data-a="closeModal">Close</button>
    </div>
  </div>`;
}
