/* ---------------- MODALS ---------------- */
import { $$, MOD, ago, esc, fmtDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { PCOLORS, PICONS } from '../core/constants.js';
import { D, S, calcomState, meeting, mem, pColor, proj, task, teamsList } from '../core/store.js';
import { FT, av, filePrev, lbl, prPill, stPill } from '../ui/helpers.js';
import { focusKey, render } from '../shell/render.js';
import { teamModal } from '../features/teams.js';
import { contactDetailModal } from '../pages/people.js';

export function openModal(m) {
  S.ui.modalOpeners = S.ui.modalOpeners || [];
  S.ui.modalOpeners[S.ui.modals.length] = S.ui.popOpener && S.ui.pop ? S.ui.popOpener : focusKey(document.activeElement);
  S.ui.modals.push(m);
  S.ui.pop = null;
  render();
  setTimeout(() => {
    const all = $$('.modal');
    const last = all[all.length - 1];
    const af = last?.querySelector('[autofocus]');
    (af || last?.querySelector('input,textarea,button'))?.focus();
  }, 30);
}
export function closeModal() {
  S.ui.modals.pop();
  S.ui.pop = null;
  render();
}
export function modalHtml(m) {
  const H = (title, sub = '') =>
    `<div class="modal-h"><div><h2 id="mt-${m.type}">${title}</h2>${sub ? `<div class="muted" style="font-size:12.5px;margin-top:2px">${sub}</div>` : ''}</div><button class="ibtn ibtn-sm" data-a="closeModal" aria-label="Close">${ic('x', 16)}</button></div>`;
  const wrap = (cls, inner) => `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="mt-${m.type}">${inner}</div>`;
  switch (m.type) {
    case 'task':
      return wrap('', taskModal(m, H));
    case 'project':
      return wrap('', projectModal(m, H));
    case 'share':
      return wrap('', shareModal(m, H));
    case 'invite':
      return wrap('', inviteModal(m, H));
    case 'confirm':
      return wrap('sm', confirmModal(m, H));
    case 'prompt':
      return wrap(
        'sm',
        `${H(m.title)}<form class="modal-b" data-submit="promptSubmit"><div class="field"><label class="label" for="prompt-in">${esc(m.label)}</label><input class="input" id="prompt-in" value="${esc(m.value || '')}" autofocus></div></form><div class="modal-f"><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal">Cancel</button><button class="btn btn-primary" data-a="promptSubmit">${esc(m.ok || 'Save')}</button></div>`,
      );
    case 'shortcuts':
      return wrap('lg', shortcutsModal(H));
    case 'team':
      return wrap('', teamModal(m, H));
    case 'filePreview':
      return wrap('lg', filePreviewModal(m, H));
    case 'saveView':
      return wrap(
        'sm',
        `${H('Save view', 'Save the current filters as a tab on this project.')}<form class="modal-b" data-submit="saveViewSubmit"><div class="field"><label class="label" for="sv-name">View name</label><input class="input" id="sv-name" placeholder="e.g. Design review queue" autofocus></div><div class="field"><label class="label" for="sv-type">Layout</label><select class="select" id="sv-type"><option value="list">List</option><option value="board">Board</option><option value="table">Table</option></select></div>${m.nf ? `<div class="hint">${m.nf} filter${m.nf > 1 ? 's' : ''} will be saved with this view.</div>` : '<div class="alert info">' + ic('info', 14) + '<span>No filters are active — the view will show all tasks. You can add filters after saving.</span></div>'}</form><div class="modal-f"><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal">Cancel</button><button class="btn btn-primary" data-a="saveViewSubmit">Save view</button></div>`,
      );
    case 'gcal':
      return wrap('', gcalConfigModal(H));
    case 'contact':
      return wrap('', contactModal(m, H));
    case 'contactDetail':
      return wrap('', contactDetailModal(m.contact));
    case 'meeting':
      return wrap('', meetingModal(m, H));
    case 'newMeeting':
      return wrap('', newMeetingModal(m, H));
    case 'rescheduleMeeting':
      return wrap('', rescheduleMeetingModal(m, H));
    case 'editMeeting':
      return wrap('', editMeetingModal(m, H));
    case 'calcomSettings':
      return wrap('', calcomSettingsModal(H));
    case 'calcomAvailability':
      return wrap('', calcomAvailabilityModal(H));
    case 'phase':
      return wrap('sm', phaseModal(m, H));
  }
  return '';
}
export function formChip(pop, html, label) {
  return `<button class="pillbtn bordered" data-a="pop" data-pop="${pop}" data-id="__form" ${pop === 'date' ? `data-field="${label}"` : ''} aria-label="${esc(label)}">${html}</button>`;
}
export function taskModal(m, H) {
  const f = S.ui.form;
  const p = proj(f.project);
  const err = S.ui.errors.title;
  return `${H(m.edit ? 'Edit task' : 'New task', m.edit ? `<span class="mono">${task(m.edit)?.key}</span>` : '')}
  <form class="modal-b" data-submit="submitTask" style="gap:12px">
    <div class="field"><label class="sr" for="f-title">Task name</label><input class="input input-lg ${err ? 'is-error' : ''}" id="f-title" data-in="form" data-f="title" value="${esc(f.title)}" placeholder="Task name" autofocus aria-invalid="${!!err}" aria-describedby="f-title-err" style="font-size:15px;font-weight:500">${err ? `<span class="err" id="f-title-err">${ic('circle-alert', 12)}${err}</span>` : ''}</div>
    <div class="field"><label class="sr" for="f-desc">Description</label><textarea class="textarea" id="f-desc" data-in="form" data-f="desc" placeholder="Add a description… (optional)" rows="3">${esc(f.desc)}</textarea></div>
    <div class="row" style="flex-wrap:wrap;gap:6px">
      ${formChip('project', `<span class="pdot" style="--c:${pColor(p)}"></span>${esc(p?.name || 'Project')}`, 'Project')}
      ${formChip('status', stPill(f.status), 'Status')}
      ${formChip('assignee', `${av(f.assignee, 'sm', false)}${esc(mem(f.assignee)?.name || 'Assignee')}`, 'Assignee')}
      ${formChip('priority', prPill(f.priority), 'Priority')}
      ${formChip('date', `${ic('calendar', 13)}${f.due ? 'Due ' + fmtDate(f.due) : 'Due date'}`, 'due')}
      ${formChip('date', `${ic('calendar-arrow-up', 13)}${f.start ? 'Starts ' + fmtDate(f.start) : 'Start date'}`, 'start')}
      ${(() => {
        const phIdx = p?.phases ? p.phases.findIndex(x => x.id === f.phase) : -1;
        const phObj = p?.phases?.find(x => x.id === f.phase);
        const txt = phIdx >= 0 ? `P${phIdx + 1} · ${phObj?.name || 'Phase'}` : 'Phase';
        return formChip('phase', `${ic('layers', 13)}${txt}`, 'Phase');
      })()}
      ${formChip('labels', f.labels.length ? f.labels.map(lbl).join('') : `${ic('tag', 13)}Labels`, 'Labels')}
      ${formChip('recur', `${ic('repeat', 13)}${f.recur || 'Repeat'}`, 'Repeat')}
    </div>
    <div class="field"><span class="label">Subtasks</span>
      ${f.subtasks.map((s, i) => `<div class="subt" style="padding:0 4px">${ic('circle', 13)}<span class="s">${esc(s.title)}</span><button type="button" class="ibtn ibtn-xs x" style="opacity:1" data-a="formRmSub" data-i="${i}" aria-label="Remove">${ic('x', 12)}</button></div>`).join('')}
      <div class="inwrap">${ic('plus', 14)}<input class="input" id="f-sub" data-key-enter="formAddSub" placeholder="Add a subtask and press Enter"></div></div>
    <div class="field"><span class="label">Attachments</span>
      ${f.files.length ? `<div class="col" style="gap:4px">${f.files.map((x, i) => `<div class="upl" style="padding:6px 10px"><span class="ftype" style="--c:${FT[x.type].c};width:22px;height:22px">${ic(FT[x.type].i, 12)}</span><span class="grow trunc">${esc(x.name)}</span><span class="faint" style="font-size:11.5px">${x.size}</span><button type="button" class="ibtn ibtn-xs" data-a="formRmFile" data-i="${i}" aria-label="Remove">${ic('x', 12)}</button></div>`).join('')}</div>` : ''}
      <label class="dropzone" style="padding:10px">${ic('paperclip', 14)}<span>Attach files</span><input type="file" multiple hidden data-in="formFiles"></label></div>
  </form>
  <div class="modal-f">${m.edit ? '' : `<label class="row" style="gap:8px;font-size:12.5px;color:var(--text-2);cursor:pointer"><input type="checkbox" class="toggle" id="f-more" data-in="formMore" ${f.more ? 'checked' : ''}>Create more</label>`}<span class="sp"></span>
    <span class="faint hide-m" style="font-size:11.5px"><kbd>${MOD}</kbd> <kbd>↵</kbd></span>
    <button class="btn btn-secondary" data-a="closeModal">Cancel</button><button class="btn btn-primary" data-a="submitTask" id="f-submit">${m.edit ? 'Save changes' : 'Create task'}</button></div>`;
}
export const TEMPLATES = [
  { id: 'blank', name: 'Blank project', icon: 'file', desc: 'Start from scratch', tasks: [] },
  {
    id: 'product',
    name: 'Product Development',
    icon: 'target',
    desc: 'Discovery to launch',
    tasks: ['Define problem statement', 'User research plan', 'Write PRD', 'Design exploration', 'Build MVP', 'Beta launch'],
  },
  {
    id: 'web',
    name: 'Website',
    icon: 'globe',
    desc: 'IA, design, build, launch',
    tasks: ['Sitemap & information architecture', 'Wireframes', 'Visual design', 'Build page templates', 'Content migration', 'QA & launch'],
  },
  {
    id: 'mkt',
    name: 'Marketing Campaign',
    icon: 'megaphone',
    desc: 'Brief, assets, channels',
    tasks: ['Campaign brief', 'Audience research', 'Creative assets', 'Channel plan', 'Launch campaign', 'Performance report'],
  },
  {
    id: 'design',
    name: 'Design Project',
    icon: 'palette',
    desc: 'Discovery to handoff',
    tasks: ['Discovery workshop', 'Moodboard', 'Concept directions', 'Refinement', 'Developer handoff'],
  },
  {
    id: 'software',
    name: 'Software Development',
    icon: 'code',
    desc: 'Spec, build, ship',
    tasks: ['Technical spec', 'Set up repo & CI', 'Implement core API', 'Write tests', 'Code review', 'Deploy to staging'],
  },
  {
    id: 'personal',
    name: 'Personal Project',
    icon: 'heart',
    desc: 'Plan your own goals',
    tasks: ['Brain dump ideas', 'Pick top 3 priorities', 'Schedule focus time', 'Weekly review'],
  },
];
export function projectModal(m, H) {
  const f = S.ui.pform;
  const err = S.ui.errors.pname;
  return `${H(m.edit ? 'Project settings' : 'New project', m.edit ? '' : 'Projects hold tasks, files, and conversations for one body of work.')}
  <form class="modal-b" data-submit="submitProject">
    <div class="row" style="gap:10px;align-items:flex-start">
      <button type="button" class="picon lg" style="--c:${PCOLORS[f.color]};cursor:default;flex-shrink:0;margin-top:22px" aria-hidden="true" tabindex="-1">${ic(f.icon, 18)}</button>
      <div class="field grow"><label class="label" for="p-name">Project name</label><input class="input ${err ? 'is-error' : ''}" id="p-name" data-in="pform" data-f="name" value="${esc(f.name)}" placeholder="e.g. Website Redesign" autofocus aria-invalid="${!!err}">${err ? `<span class="err">${ic('circle-alert', 12)}${err}</span>` : ''}</div>
    </div>
    <div class="field"><label class="label" for="p-desc">Description</label><textarea class="textarea" id="p-desc" data-in="pform" data-f="desc" rows="2" placeholder="What is this project about?">${esc(f.desc)}</textarea></div>
    <div class="row" style="gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:220px"><span class="label">Icon</span><div class="iconpick" role="radiogroup" aria-label="Icon">${PICONS.map(i => `<button type="button" role="radio" aria-checked="${f.icon === i}" class="${f.icon === i ? 'on' : ''}" data-a="pformSet" data-f="icon" data-v="${i}" aria-label="${i}">${ic(i, 15)}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Color</span><div class="swatches" role="radiogroup" aria-label="Color" style="max-width:140px">${Object.entries(
        PCOLORS,
      )
        .map(
          ([k, v]) =>
            `<button type="button" role="radio" aria-checked="${f.color === k}" class="sw ${f.color === k ? 'on' : ''}" style="--c:${v};width:22px;height:22px" data-a="pformSet" data-f="color" data-v="${k}" aria-label="${k}">${f.color === k ? ic('check', 12) : ''}</button>`,
        )
        .join('')}</div></div>
    </div>
    <div class="row" style="gap:12px;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:150px"><label class="label" for="p-team">Team</label><select class="select" id="p-team" data-in="pform" data-f="team"><option value="" ${!f.team ? 'selected' : ''}>No team</option>${teamsList()
        .map(t => `<option value="${t.id}" ${f.team === t.id ? 'selected' : ''}>${t.name}</option>`)
        .join('')}</select></div>
      <div class="field" style="flex:1;min-width:150px"><label class="label" for="p-lead">Lead</label><select class="select" id="p-lead" data-in="pform" data-f="lead">${D()
        .members.filter(x => x.status === 'active')
        .map(x => `<option value="${x.id}" ${f.lead === x.id ? 'selected' : ''}>${esc(x.name)}</option>`)
        .join('')}</select></div>
      <div class="field" style="flex:1;min-width:150px"><label class="label" for="p-due">Target date</label><input type="date" class="input" id="p-due" data-in="pform" data-f="due" value="${f.due || ''}"></div>
    </div>
    ${m.edit ? '' : `<div class="field"><span class="label">Template</span><div class="tmpls" role="radiogroup">${TEMPLATES.map(t => `<button type="button" role="radio" aria-checked="${f.tmpl === t.id}" class="opt ${f.tmpl === t.id ? 'on' : ''}" data-a="pformSet" data-f="tmpl" data-v="${t.id}" style="padding:10px">${ic(t.icon, 16)}<b style="font-size:12.5px">${t.name}</b><span>${t.tasks.length ? t.tasks.length + ' starter tasks' : t.desc}</span></button>`).join('')}</div></div>`}
  </form>
  <div class="modal-f"><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal">Cancel</button><button class="btn btn-primary" data-a="submitProject">${m.edit ? 'Save changes' : 'Create project'}</button></div>`;
}
export const PERMS = ['Can view', 'Can comment', 'Can edit', 'Full access'];
export function shareModal(m, H) {
  const p = proj(m.id);
  p.perms = p.perms || {};
  p.access = p.access || 'workspace';
  return `${H(`Share “${esc(p.name)}”`)}
  <div class="modal-b">
    <form class="row" style="gap:6px" data-submit="shareInvite"><div class="grow"><label class="sr" for="share-in">Invite by email</label><input class="input" id="share-in" placeholder="Add people by name or email" value="${esc(S.ui.shareQ || '')}" data-in="shareQ" autofocus></div>
      <select class="select" id="share-perm" style="width:132px" aria-label="Permission">${PERMS.map(x => `<option ${x === 'Can edit' ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <button class="btn btn-primary" data-a="shareInvite" type="button">Invite</button></form>
    ${
      S.ui.shareQ
        ? `<div class="panel" style="padding:4px">${
            D()
              .members.filter(
                x => !p.members.includes(x.id) && (x.name.toLowerCase().includes(S.ui.shareQ.toLowerCase()) || x.email.includes(S.ui.shareQ.toLowerCase())),
              )
              .map(
                x =>
                  `<button class="mi" data-a="shareAdd" data-id="${p.id}" data-mid="${x.id}">${av(x.id, 'sm', false)}${esc(x.name)}<span class="r">${esc(x.email)}</span></button>`,
              )
              .join('') ||
            `<div class="mi faint" style="cursor:default">${S.ui.shareQ.includes('@') ? `Press Invite to send an invitation to ${esc(S.ui.shareQ)}` : 'No matching members — enter an email to invite someone new'}</div>`
          }</div>`
        : ''
    }
    <div><div class="eyebrow" style="margin-bottom:4px">People with access</div>
      ${p.members
        .map(id => {
          const x = mem(id);
          if (!x) return '';
          const perm = id === p.lead ? 'Full access' : p.perms[id] || (x.role === 'Guest' ? 'Can comment' : 'Can edit');
          return `<div class="row" style="height:44px">${av(id, 'md', false)}<div class="grow"><div style="font-weight:500;font-size:13px">${esc(x.name)}${id === D().me ? ' <span class="faint" style="font-weight:400">(you)</span>' : ''}</div><div class="faint" style="font-size:11.5px">${esc(x.email)}${id === p.lead ? ' · Project lead' : ''}</div></div>
          ${id === p.lead ? `<span class="muted" style="font-size:12.5px;padding-right:8px">Full access</span>` : `<select class="select" style="width:auto;height:26px;font-size:12px;border-color:transparent;background-color:transparent" data-in="sharePerm" data-id="${p.id}" data-mid="${id}" aria-label="Permission for ${esc(x.name)}">${PERMS.map(q => `<option ${q === perm ? 'selected' : ''}>${q}</option>`).join('')}<option value="__remove">Remove access</option></select>`}</div>`;
        })
        .join('')}
    </div>
    <div style="border-top:1px solid var(--divider);padding-top:12px"><div class="eyebrow" style="margin-bottom:8px">General access</div>
      <div class="row" style="gap:10px"><span class="ftype" style="--c:var(--text-2)">${ic(p.access === 'private' ? 'lock' : 'building-2', 14)}</span><div class="grow"><select class="select" style="height:28px;width:auto;border-color:transparent;padding-left:4px;font-weight:500" data-in="shareAccess" data-id="${p.id}" aria-label="General access"><option value="private" ${p.access === 'private' ? 'selected' : ''}>Only people invited</option><option value="workspace" ${p.access === 'workspace' ? 'selected' : ''}>Everyone at ${esc(D().ws.name)}</option></select><div class="faint" style="font-size:11.5px;padding-left:4px">${p.access === 'private' ? 'Only people listed above can open this project.' : 'Anyone in the workspace can view and comment.'}</div></div></div></div>
  </div>
  <div class="modal-f"><button class="btn btn-secondary" data-a="copyLink" data-pid="${p.id}">${ic('link', 14)}Copy link</button><span class="sp"></span><button class="btn btn-primary" data-a="closeModal">Done</button></div>`;
}
export function inviteModal(m, H) {
  const err = S.ui.errors.invite;
  return `${H('Invite to ' + esc(D().ws.name), 'Invited people get an email with a link to join.')}
  <form class="modal-b" data-submit="submitInvite">
    <div class="field"><label class="label" for="inv-emails">Email addresses</label><textarea class="textarea ${err ? 'is-error' : ''}" id="inv-emails" placeholder="name@company.com, another@company.com" rows="3" autofocus>${esc(S.ui.inviteDraft || '')}</textarea>${err ? `<span class="err">${ic('circle-alert', 12)}${err}</span>` : '<span class="hint">Separate multiple addresses with commas.</span>'}</div>
    <div class="row" style="gap:12px"><div class="field grow"><label class="label" for="inv-role">Role</label><select class="select" id="inv-role">${['Member', 'Admin', 'Guest'].map(r => `<option>${r}</option>`).join('')}</select></div>
    <div class="field grow"><label class="label" for="inv-team">Team</label><select class="select" id="inv-team"><option value="">No team</option>${teamsList()
      .map(t => `<option value="${t.id}">${t.name}</option>`)
      .join('')}</select></div></div>
    <div class="alert info">${ic('info', 14)}<span><b>Guests</b> can only see projects they're added to and can't create projects.</span></div>
  </form>
  <div class="modal-f"><button class="btn btn-ghost" data-a="copyInviteLink">${ic('link', 14)}Copy invite link</button><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal">Cancel</button><button class="btn btn-primary" data-a="submitInvite" id="inv-submit">Send invites</button></div>`;
}
export function confirmModal(m) {
  const needs = m.typeName;
  const ok = !needs || (S.ui.confirmText || '') === needs;
  return `<div class="modal-b" style="padding-top:18px;gap:10px">
    <div class="row" style="gap:12px;align-items:flex-start"><span class="ftype" style="--c:${m.danger ? 'var(--red)' : 'var(--amber)'};width:34px;height:34px;border-radius:9px">${ic(m.icon || (m.danger ? 'trash-2' : 'archive'), 17)}</span>
    <div class="grow"><h2 id="mt-confirm" style="font-size:15px;font-weight:600;margin:4px 0 6px">${esc(m.title)}</h2><p class="muted" style="margin:0;font-size:13px;line-height:1.55">${m.body}</p></div></div>
    ${needs ? `<div class="field" style="margin-top:6px"><label class="label" for="confirm-in" style="font-weight:400;color:var(--text-2)">Type <b style="color:var(--text);font-weight:600">${esc(needs)}</b> to confirm</label><input class="input" id="confirm-in" data-in="confirmText" autocomplete="off" autofocus value="${esc(S.ui.confirmText || '')}"></div>` : ''}
  </div>
  <div class="modal-f"><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal" ${needs ? '' : 'autofocus'}>Cancel</button><button class="btn ${m.danger ? 'btn-danger' : 'btn-primary'}" data-a="confirmOk" ${ok ? '' : 'disabled'}>${esc(m.ok)}</button></div>`;
}
export const SHORTCUTS = [
  [
    'General',
    [
      ['Command menu', [MOD, 'K']],
      ['Search', ['/']],
      ['Keyboard shortcuts', ['?']],
      ['Toggle sidebar', ['[']],
      ['Toggle dark mode', [MOD, 'Shift', 'L']],
      ['Close panel or dialog', ['Esc']],
    ],
  ],
  [
    'Create',
    [
      ['New task', ['N']],
      ['New project', ['P']],
      ['Submit form', [MOD, '↵']],
      ['Send comment', [MOD, '↵']],
    ],
  ],
  [
    'Navigate',
    [
      ['Go to Home', ['G', 'H']],
      ['Go to My Tasks', ['G', 'T']],
      ['Go to Projects', ['G', 'P']],
      ['Go to Inbox', ['G', 'I']],
      ['Go to Calendar', ['G', 'C']],
      ['Go to Settings', ['G', 'S']],
    ],
  ],
  [
    'Command menu',
    [
      ['Move selection', ['↑', '↓']],
      ['Run command', ['↵']],
      ['Search mode', ['Tab']],
    ],
  ],
];
export function shortcutsModal(H) {
  return `${H('Keyboard shortcuts')}<div class="modal-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px">${SHORTCUTS.map(([g, list]) => `<div><div class="eyebrow" style="margin-bottom:6px">${g}</div>${list.map(([n, k]) => `<div class="row" style="height:30px;font-size:13px;border-bottom:1px solid var(--divider)"><span class="grow">${n}</span>${k.map((x, i) => `${i && k[0] === 'G' ? '<span class="faint" style="font-size:11px">then</span>' : ''}<kbd>${x}</kbd>`).join('')}</div>`).join('')}</div>`).join('')}</div>`;
}
export function filePreviewModal(m, H) {
  const f = m.file;
  const t = FT[f.type] || FT.other;
  return `${H(esc(f.name), `${t.n} · ${f.size} · Uploaded by ${esc(mem(f.by)?.name || 'you')} ${ago(f.at)}`)}
  <div class="modal-b"><div style="border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">${filePrev(f).replace('class="fprev"', 'class="fprev" style="aspect-ratio:16/9"')}</div>
  ${m.tid ? `<div class="row faint" style="font-size:12.5px">${ic('link', 13)}Attached to <button class="link" data-a="openTask" data-id="${m.tid}">${esc(task(m.tid)?.title)}</button></div>` : ''}</div>
  <div class="modal-f"><button class="btn btn-secondary" data-a="copyLink" data-fid="${f.id}">${ic('link', 14)}Copy link</button><span class="sp"></span><button class="btn btn-primary" data-a="closeModal">Close</button></div>`;
}

export function gcalConfigModal(H) {
  const g = D().gcal || {};
  return `${H('Google Calendar Integration', 'Connect via Google Calendar API with OAuth 2.0 or an API key to sync meetings.')}
  <form class="modal-b" data-submit="saveGcalConfig" style="gap:14px">
    <div class="panel" style="padding:14px;background:var(--surface)">
      <div class="row" style="gap:10px;margin-bottom:8px">
        <span class="pdot" style="--c:${g.connected ? '#4285F4' : 'var(--text-3)'};width:10px;height:10px"></span>
        <b style="font-size:14px">${g.connected ? 'Connected to Google Calendar' : 'Not Connected'}</b>
        ${g.connected ? '<span class="badge green">Active</span>' : '<span class="badge gray">Disconnected</span>'}
      </div>
      <div class="faint" style="font-size:12.5px">
        ${g.lastSynced ? `Last synchronized ${ago(g.lastSynced)}. ${g.events?.length || 0} events loaded.` : 'Configure your Google Cloud credentials below to synchronize events.'}
      </div>
      ${g.error ? `<div class="alert danger" style="margin-top:10px">${ic('circle-alert', 14)}<span>${esc(g.error)}</span></div>` : ''}
    </div>

    <div class="field">
      <label class="label" for="gcal-client-id">OAuth 2.0 Client ID (Recommended)</label>
      <input class="input" id="gcal-client-id" placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com" value="${esc(g.clientId || '')}">
      <span class="hint">Obtain this from Google Cloud Console → APIs & Services → Credentials.</span>
    </div>

    <div class="field">
      <label class="label" for="gcal-api-key">Google Calendar API Key (Alternative)</label>
      <input class="input" id="gcal-api-key" placeholder="AIzaSy..." value="${esc(g.apiKey || '')}">
      <span class="hint">Used if accessing public or shared calendar IDs directly without user OAuth consent.</span>
    </div>

    <div class="field">
      <label class="label" for="gcal-cal-id">Calendar ID</label>
      <input class="input" id="gcal-cal-id" value="${esc(g.calendarId || 'primary')}" placeholder="primary">
      <span class="hint">Use "primary" for your default account calendar, or a specific calendar address.</span>
    </div>

    <div class="alert info">
      ${ic('info', 14)}
      <span><b>Setup Instructions:</b> In Google Cloud Console, enable the <i>Google Calendar API</i> and add <code>${window.location.origin}</code> to Authorised JavaScript Origins.</span>
    </div>
  </form>
  <div class="modal-f">
    ${g.connected ? `<button class="btn btn-danger-ghost" data-a="disconnectGcal">${ic('unlink', 13)}Disconnect</button>` : ''}
    <span class="sp"></span>
    <button class="btn btn-secondary" data-a="closeModal">Cancel</button>
    <button class="btn btn-primary" data-a="saveGcalConfig">${ic('refresh-cw', 13)}Save & Connect</button>
  </div>`;
}

export function contactModal(m, H) {
  const f = S.ui.cform || { name: '', company: '', title: '', email: '', phone: '', location: '', tags: '', notes: '' };
  const isEdit = !!m.edit;
  return `${H(isEdit ? 'Edit Contact' : 'New Contact', 'Create a person profile to manage meetings, notes, and follow-ups.')}
  <form class="modal-b" data-submit="submitContact" style="gap:12px">
    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="c-name">Full name *</label>
        <input class="input" id="c-name" value="${esc(f.name)}" placeholder="e.g. Jessica Miller" autofocus required>
      </div>
      <div class="field grow">
        <label class="label" for="c-company">Company</label>
        <input class="input" id="c-company" value="${esc(f.company || '')}" placeholder="e.g. Acme Corp">
      </div>
    </div>

    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="c-title">Job title</label>
        <input class="input" id="c-title" value="${esc(f.title || '')}" placeholder="e.g. VP of Product">
      </div>
      <div class="field grow">
        <label class="label" for="c-loc">Location</label>
        <input class="input" id="c-loc" value="${esc(f.location || '')}" placeholder="e.g. San Francisco, CA">
      </div>
    </div>

    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="c-email">Email</label>
        <input class="input" id="c-email" type="email" value="${esc(f.email || '')}" placeholder="name@company.com">
      </div>
      <div class="field grow">
        <label class="label" for="c-phone">Phone number</label>
        <input class="input" id="c-phone" value="${esc(f.phone || '')}" placeholder="+1 (555) 000-0000">
      </div>
    </div>

    <div class="field">
      <label class="label" for="c-tags">Tags (comma separated)</label>
      <input class="input" id="c-tags" value="${esc(f.tags || '')}" placeholder="client, investor, partner, lead">
    </div>

    <div class="field">
      <label class="label" for="c-notes">Private notes</label>
      <textarea class="textarea" id="c-notes" rows="3" placeholder="Context, history, key interests, or mutual connections...">${esc(f.notes || '')}</textarea>
    </div>
  </form>
  <div class="modal-f">
    <button class="btn btn-secondary" data-a="closeModal">Cancel</button>
    <button class="btn btn-primary" data-a="submitContact">${isEdit ? 'Save Changes' : 'Create Contact'}</button>
  </div>`;
}

export function meetingModal(m, H) {
  const contacts = D().contacts || [];
  const preSelectedCid = m.contactId || '';
  return `${H('Log / Schedule Meeting', 'Record meeting notes and attach action items to a contact profile.')}
  <form class="modal-b" data-submit="submitMeeting" style="gap:12px">
    <div class="field">
      <label class="label" for="m-title">Meeting title *</label>
      <input class="input" id="m-title" placeholder="e.g. Intro discovery call, Q4 partnership check-in" autofocus required>
    </div>

    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="m-contact">Associated contact *</label>
        <select class="select" id="m-contact" required>
          ${contacts.length ? contacts.map(c => `<option value="${c.id}" ${c.id === preSelectedCid ? 'selected' : ''}>${esc(c.name)}${c.company ? ` (${esc(c.company)})` : ''}</option>`).join('') : '<option value="">No contacts available</option>'}
        </select>
      </div>
      <div class="field grow">
        <label class="label" for="m-date">Date</label>
        <input type="date" class="input" id="m-date" value="${new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="field" style="width:110px">
        <label class="label" for="m-time">Time</label>
        <input type="time" class="input" id="m-time" value="10:00">
      </div>
    </div>

    <div class="field">
      <label class="label" for="m-notes">Meeting discussion & notes</label>
      <textarea class="textarea" id="m-notes" rows="3" placeholder="Key takeaways, decisions made, client feedback..."></textarea>
    </div>

    <div class="field">
      <label class="label" for="m-fu">Create follow-up task (Optional)</label>
      <input class="input" id="m-fu" placeholder="e.g. Send revised contract draft by Friday">
    </div>
  </form>
  <div class="modal-f">
    <button class="btn btn-secondary" data-a="closeModal">Cancel</button>
    <button class="btn btn-primary" data-a="submitMeeting">Save Meeting</button>
  </div>`;
}

export function newMeetingModal(m, H) {
  const cal = calcomState();
  const contacts = D().contacts || [];
  return `${H('Schedule New Meeting', 'Create a booking and automatically link/sync the attendee with People CRM.')}
  <form class="modal-b" data-submit="submitNewMeeting" style="gap:12px">
    <div class="field">
      <label class="label" for="nm-title">Meeting title *</label>
      <input class="input" id="nm-title" placeholder="e.g. 30 Min Strategy Call" value="30 Min Strategy Call" required autofocus>
    </div>

    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="nm-name">Attendee Name *</label>
        <input class="input" id="nm-name" placeholder="e.g. Sarah Connor" required>
      </div>
      <div class="field grow">
        <label class="label" for="nm-email">Attendee Email *</label>
        <input class="input" id="nm-email" type="email" placeholder="sarah@example.com" required>
      </div>
    </div>

    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="nm-company">Company</label>
        <input class="input" id="nm-company" placeholder="e.g. Cyberdyne Systems">
      </div>
      <div class="field grow">
        <label class="label" for="nm-title-role">Job Title</label>
        <input class="input" id="nm-title-role" placeholder="e.g. Founder & CEO">
      </div>
    </div>

    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="nm-date">Date *</label>
        <input type="date" class="input" id="nm-date" value="${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}" required>
      </div>
      <div class="field" style="width:110px">
        <label class="label" for="nm-time">Time *</label>
        <input type="time" class="input" id="nm-time" value="14:00" required>
      </div>
      <div class="field" style="width:110px">
        <label class="label" for="nm-dur">Duration</label>
        <select class="select" id="nm-dur">
          <option value="15">15 min</option>
          <option value="30" selected>30 min</option>
          <option value="45">45 min</option>
          <option value="60">60 min</option>
        </select>
      </div>
    </div>

    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="nm-loc">Location / Video Service</label>
        <input class="input" id="nm-loc" value="Google Meet" placeholder="Google Meet, Cal Video, Zoom, Phone">
      </div>
      <div class="field grow">
        <label class="label" for="nm-url">Video Call URL</label>
        <input class="input" id="nm-url" placeholder="https://meet.google.com/..." value="https://meet.google.com/${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}">
      </div>
    </div>

    <div class="field">
      <label class="label" for="nm-guests">Additional Guests (comma-separated emails)</label>
      <input class="input" id="nm-guests" placeholder="investor@fund.com, cofounder@startup.com">
    </div>

    <div class="field">
      <label class="label" for="nm-notes">Meeting Agenda / Notes</label>
      <textarea class="textarea" id="nm-notes" rows="2" placeholder="Discussion topics, links to decks, goals for this call..."></textarea>
    </div>
  </form>
  <div class="modal-f">
    <button class="btn btn-secondary" data-a="closeModal">Cancel</button>
    <button class="btn btn-primary" data-a="submitNewMeeting">Schedule Booking</button>
  </div>`;
}

export function rescheduleMeetingModal(m, H) {
  const mtg = meeting(m.id);
  if (!mtg) return '';
  const isRequest = m.mode === 'request';
  const title = isRequest ? 'Request Reschedule' : 'Reschedule Booking';
  const subtitle = isRequest
    ? `Send a reschedule request with preferred date/time to ${esc(mtg.personName || 'attendee')}.`
    : `Change the scheduled date or time for ${esc(mtg.personName || 'attendee')}.`;
  const btnLabel = isRequest ? 'Send Reschedule Request' : 'Confirm Reschedule';

  return `${H(title, subtitle)}
  <form class="modal-b" data-submit="submitReschedule" style="gap:12px">
    <input type="hidden" id="rs-id" value="${mtg.id}">
    <input type="hidden" id="rs-mode" value="${isRequest ? 'request' : 'reschedule'}">
    <div class="panel" style="padding:10px 14px;background:var(--surface)">
      <b style="font-size:13.5px">${esc(mtg.title)}</b>
      <div class="faint" style="font-size:12px;margin-top:2px">Currently set for: <b>${fmtDate(mtg.date, true)} at ${mtg.time}</b> with <b>${esc(mtg.personName || 'Guest')}</b></div>
    </div>

    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="rs-date">${isRequest ? 'Proposed New Date *' : 'New Date *'}</label>
        <input type="date" class="input" id="rs-date" value="${mtg.date}" required autofocus>
      </div>
      <div class="field" style="width:130px">
        <label class="label" for="rs-time">${isRequest ? 'Proposed Time *' : 'New Time *'}</label>
        <input type="time" class="input" id="rs-time" value="${mtg.time}" required>
      </div>
    </div>

    <div class="field">
      <label class="label" for="rs-reason">${isRequest ? 'Reason / Message to Attendee *' : 'Reschedule note / message to attendee'}</label>
      <textarea class="textarea" id="rs-reason" rows="2" placeholder="${isRequest ? 'Let the attendee know why you would like to reschedule…' : 'e.g. Due to an urgent conflict, proposing we move our discussion 2 hours later.'}"></textarea>
    </div>
  </form>
  <div class="modal-f">
    <span class="sp"></span>
    <button class="btn btn-secondary" type="button" data-a="closeModal">Cancel</button>
    <button class="btn btn-primary" type="button" data-a="submitReschedule">${btnLabel}</button>
  </div>`;
}

export function editMeetingModal(m, H) {
  const mtg = meeting(m.id);
  if (!mtg) return '';
  return `${H('Edit Meeting Details', `Modify location, video link, guests, or notes for “${esc(mtg.title)}”.`)}
  <form class="modal-b" data-submit="submitEditMeeting" style="gap:12px">
    <input type="hidden" id="em-id" value="${mtg.id}">

    <div class="field">
      <label class="label" for="em-title">Meeting title *</label>
      <input class="input" id="em-title" value="${esc(mtg.title)}" required autofocus>
    </div>

    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="em-loc">Location</label>
        <input class="input" id="em-loc" value="${esc(mtg.location || '')}" placeholder="Google Meet, Zoom, Phone">
      </div>
      <div class="field grow">
        <label class="label" for="em-url">Video link</label>
        <input class="input" id="em-url" value="${esc(mtg.meetUrl || '')}" placeholder="https://...">
      </div>
    </div>

    <div class="field">
      <label class="label" for="em-guests">Guests (comma-separated)</label>
      <input class="input" id="em-guests" value="${esc((mtg.guests || []).join(', '))}" placeholder="colleague@example.com, manager@example.com">
    </div>

    <div class="field">
      <label class="label" for="em-notes">Meeting Notes</label>
      <textarea class="textarea" id="em-notes" rows="3">${esc(mtg.notes || '')}</textarea>
    </div>
  </form>
  <div class="modal-f">
    <button class="btn btn-secondary" data-a="closeModal">Cancel</button>
    <button class="btn btn-primary" data-a="submitEditMeeting">Save Changes</button>
  </div>`;
}

export function calcomSettingsModal(H) {
  const cal = calcomState();
  return `${H('Cal.com Integration Settings', 'Configure your Cal.com API key, username, and event types for zero-click bookings.')}
  <form class="modal-b" data-submit="saveCalcomSettings" style="gap:14px">
    <div class="field">
      <label class="label" for="cal-username">Cal.com Username</label>
      <div class="row" style="gap:0">
        <span class="input" style="width:auto;background:var(--surface-2);border-right:0;border-radius:6px 0 0 6px;color:var(--text-3);display:flex;align-items:center">cal.com/</span>
        <input class="input" id="cal-username" value="${esc(cal.username || 'phato')}" style="border-radius:0 6px 6px 0">
      </div>
    </div>

    <div class="field">
      <label class="label" for="cal-key">Cal.com API Key (Optional for live API sync)</label>
      <input class="input" id="cal-key" type="password" value="${esc(cal.apiKey || '')}" placeholder="cal_live_...">
      <span class="hint">Generate an API key in Cal.com → Settings → Developer → API Keys.</span>
    </div>

    <div class="sblock" style="margin-top:10px">
      <h2>Active Call Event Types</h2>
      ${(cal.eventTypes || [])
        .map(
          (et, i) => `<div class="srow" style="padding:8px 0">
            <div>
              <b style="font-size:13px">${esc(et.title)}</b>
              <div class="faint" style="font-size:11.5px">cal.com/${esc(cal.username || 'phato')}/${esc(et.slug)} · ${et.length} minutes</div>
            </div>
            <label class="toggle-wrap">
              <input type="checkbox" class="toggle" id="et-toggle-${i}" ${et.active !== false ? 'checked' : ''}>
            </label>
          </div>`,
        )
        .join('')}
    </div>
  </form>
  <div class="modal-f">
    <button class="btn btn-secondary" type="button" data-a="syncCalcomNow" title="Fetch latest bookings using saved key">${ic('refresh-cw', 13)} Sync Now</button>
    <span class="sp"></span>
    <button class="btn btn-secondary" type="button" data-a="closeModal">Cancel</button>
    <button class="btn btn-primary" type="button" data-a="saveCalcomSettings">Save Settings</button>
  </div>`;
}

export function calcomAvailabilityModal(H) {
  const cal = calcomState();
  const av = cal.availability || { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], startTime: '09:00', endTime: '18:00', timeZone: 'Asia/Kolkata' };
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return `${H('Edit Weekly Availability', 'Set your working hours and active booking days for Cal.com calls.')}
  <form class="modal-b" data-submit="saveAvailability" style="gap:14px">
    <div class="row" style="gap:12px">
      <div class="field grow">
        <label class="label" for="av-start">Start Time</label>
        <input type="time" class="input" id="av-start" value="${av.startTime || '09:00'}">
      </div>
      <div class="field grow">
        <label class="label" for="av-end">End Time</label>
        <input type="time" class="input" id="av-end" value="${av.endTime || '18:00'}">
      </div>
    </div>

    <div class="field">
      <label class="label">Available Days</label>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(110px, 1fr));gap:8px">
        ${allDays
          .map(
            d => `<label class="panel row" style="padding:8px 10px;cursor:pointer;gap:8px;font-size:13px">
              <input type="checkbox" class="check" data-av-day="${d}" ${av.days.includes(d) ? 'checked' : ''}>
              <span>${d.slice(0, 3)}</span>
            </label>`,
          )
          .join('')}
      </div>
    </div>
  </form>
  <div class="modal-f">
    <span class="sp"></span>
    <button class="btn btn-secondary" data-a="closeModal">Cancel</button>
    <button class="btn btn-primary" data-a="saveAvailability">Update Availability</button>
  </div>`;
}

export function phaseModal(m, H) {
  const isEdit = !!m.phaseId;
  const p = proj(m.projectId);
  const ph = isEdit ? p?.phases?.find(x => x.id === m.phaseId) : null;
  const name = ph ? ph.name : '';
  const desc = ph ? (ph.desc || '') : '';
  return `${H(isEdit ? 'Edit Phase' : 'Create Phase', p ? `Project: ${esc(p.name)}` : '')}
  <form class="modal-b" data-submit="submitPhaseModal" data-project="${esc(m.projectId)}" ${isEdit ? `data-phase="${m.phaseId}"` : ''} style="gap:14px">
    <div class="field">
      <label class="label" for="ph-name">Phase Name <span style="color:var(--red)">*</span></label>
      <input class="input" id="ph-name" placeholder="e.g. Discovery & Wireframing" value="${esc(name)}" required autofocus>
    </div>
    <div class="field">
      <label class="label" for="ph-desc">Description <span class="faint" style="font-weight:400">(optional)</span></label>
      <textarea class="textarea" id="ph-desc" placeholder="What goals or milestones define this phase?" rows="3">${esc(desc)}</textarea>
    </div>
  </form>
  <div class="modal-f">
    <span class="sp"></span>
    <button class="btn btn-secondary" data-a="closeModal">Cancel</button>
    <button class="btn btn-primary" data-a="submitPhaseModal" data-project="${esc(m.projectId)}" ${isEdit ? `data-phase="${m.phaseId}"` : ''}>${isEdit ? 'Save Changes' : 'Create Phase'}</button>
  </div>`;
}


