/* =====================================================================
   MEETINGS & CAL.COM INTEGRATION PAGE
   ===================================================================== */
import { WDL, esc, fmtDate, parse, relDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, calcomState, meetingsList } from '../core/store.js';
import { empty } from '../ui/helpers.js';

export function pageMeetings() {
  const all = meetingsList().slice().sort((a, b) => {
    const da = `${a.date} ${a.time}`;
    const db = `${b.date} ${b.time}`;
    return da.localeCompare(db);
  });

  const tab = S.ui.meetingsTab || 'upcoming'; // upcoming | past | cancelled
  const q = (S.ui.meetingsQ || '').toLowerCase().trim();
  const cal = calcomState();

  const filteredBySearch = all.filter(m => {
    if (!q) return true;
    return (
      m.title.toLowerCase().includes(q) ||
      m.personName.toLowerCase().includes(q) ||
      (m.personEmail && m.personEmail.toLowerCase().includes(q)) ||
      (m.personCompany && m.personCompany.toLowerCase().includes(q)) ||
      (m.location && m.location.toLowerCase().includes(q))
    );
  });

  const lists = {
    upcoming: filteredBySearch.filter(m => m.status === 'upcoming' || (!m.status && m.date >= new Date().toISOString().slice(0, 10))),
    past: filteredBySearch.filter(m => m.status === 'past' || (!m.status && m.date < new Date().toISOString().slice(0, 10))),
    cancelled: filteredBySearch.filter(m => m.status === 'cancelled'),
  };

  const cur = lists[tab] || [];

  return `<div class="page flush">
    <div class="ph">
      <div>
        <h1 class="row" style="gap:10px">
          Meetings
          <span class="badge accent" style="font-size:12px">${lists.upcoming.length} upcoming</span>
        </h1>
        <p>Bookings, live meeting links, Cal.com scheduling availability, and guest details.</p>
      </div>
      <div class="acts">
        <div class="inwrap" style="width:240px">
          <input class="input input-sm" style="padding-left:28px" placeholder="Search attendee, title…" data-in="meetingsSearch" value="${esc(S.ui.meetingsQ || '')}">
          <span style="position:absolute;left:8px;top:7px;color:var(--text-3);pointer-events:none">${ic('search', 13)}</span>
        </div>
        <button class="btn btn-secondary" data-a="syncCalcomNow" title="Manually update bookings from Cal.com API">
          ${ic('refresh-cw', 14)}Sync Cal.com
        </button>
        <button class="btn btn-secondary" data-a="openAvailabilityModal">
          ${ic('clock', 14)}Change availability
        </button>
        <button class="btn btn-secondary" data-a="openCalcomSettings">
          ${ic('settings', 14)}Cal.com Settings
        </button>
        <button class="btn btn-primary" data-a="newMeetingModal">
          ${ic('plus', 14)}Schedule meeting
        </button>
      </div>
    </div>

    <!-- Quick Booking Links & Tabs Bar -->
    <div style="padding:12px var(--gutter) 4px var(--gutter)">
      <div class="row" style="flex-wrap:wrap;gap:12px;align-items:center">
        <div class="row" style="gap:6px;flex-wrap:wrap" class="grow">
          ${(cal.eventTypes || [])
            .filter(et => et.active !== false)
            .map(et => {
              const url = `https://cal.com/${cal.username || 'phato'}/${et.slug}`;
              return `<div class="row" style="gap:5px;padding:3px 8px 3px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-full);font-size:var(--fs-xs)">
                <span style="font-weight:500;color:var(--text)">${esc(et.title)}</span>
                <span class="faint">(${et.length}m)</span>
                <button class="ibtn ibtn-xs" data-a="copyText" data-text="${esc(url)}" data-msg="Copied ${esc(et.title)} link!" title="Copy link" aria-label="Copy link">${ic('copy', 12)}</button>
                <a class="ibtn ibtn-xs" href="${esc(url)}" target="_blank" rel="noopener" title="Open booking page" aria-label="Open booking page">${ic('external-link', 12)}</a>
              </div>`;
            })
            .join('')}
        </div>

        <div class="seg" role="tablist" style="margin-left:auto">
          ${[
            ['upcoming', 'Upcoming', lists.upcoming.length],
            ['past', 'Past', lists.past.length],
            ['cancelled', 'Cancelled', lists.cancelled.length],
          ]
            .map(
              ([k, label, count]) =>
                `<button role="tab" class="${tab === k ? 'on' : ''}" data-a="set" data-k="meetingsTab" data-v="${k}">${label} <span class="faint">${count}</span></button>`,
            )
            .join('')}
        </div>
      </div>
    </div>

    <!-- Meetings List with gap separation -->
    <div style="margin-top:24px;background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
      ${
        cur.length
          ? (() => {
              // Group meetings by date
              const groupsMap = new Map();
              cur.forEach(m => {
                const dKey = m.date || 'Unscheduled';
                if (!groupsMap.has(dKey)) groupsMap.set(dKey, []);
                groupsMap.get(dKey).push(m);
              });

              return Array.from(groupsMap.entries())
                .map(([dateKey, mtgs]) => {
                  let dateLabel = dateKey;
                  if (dateKey !== 'Unscheduled') {
                    const parsed = parse(dateKey);
                    const rel = relDate(dateKey);
                    const formatted = fmtDate(dateKey, true);
                    dateLabel = (rel === 'Today' || rel === 'Tomorrow' || rel === 'Yesterday')
                      ? `${rel} · ${formatted}`
                      : `${WDL[parsed.getDay()]}, ${formatted}`;
                  }

                  return `<div>
                    <div class="row" style="padding:8px var(--gutter);background:var(--surface-2);border-top:1px solid var(--border);border-bottom:1px solid var(--divider);gap:8px">
                      <span style="font-size:var(--fs-xs);font-weight:600;color:var(--text);letter-spacing:-.01em">${esc(dateLabel)}</span>
                      <span class="faint" style="font-size:var(--fs-2xs);font-weight:500;padding:1px 6px;border-radius:var(--r-full);background:var(--surface-3);border:1px solid var(--border)">${mtgs.length}</span>
                    </div>
                    ${mtgs.map(m => meetingRowHtml(m)).join('')}
                  </div>`;
                })
                .join('');
            })()
          : empty(
              tab === 'upcoming' ? 'video' : tab === 'cancelled' ? 'ban' : 'calendar-check',
              tab === 'upcoming' ? 'No upcoming meetings' : tab === 'cancelled' ? 'No cancelled meetings' : 'No past meetings',
              tab === 'upcoming' ? 'Share your booking links or create a manual meeting above.' : 'Meeting archives and histories will be displayed here.',
              tab === 'upcoming' ? `<button class="btn btn-primary btn-sm" data-a="newMeetingModal">${ic('plus', 14)}Schedule meeting</button>` : '',
              'sm',
            )
      }
    </div>
  </div>`;
}

export function meetingRowHtml(m) {
  const isPast = m.status === 'past' || (!m.status && m.date < new Date().toISOString().slice(0, 10));
  const isCancelled = m.status === 'cancelled';

  let statusBadge = '';
  if (isCancelled) statusBadge = '<span class="badge red">Cancelled</span>';
  else if (isPast) statusBadge = '<span class="badge gray">Completed</span>';
  else statusBadge = '<span class="badge green">Confirmed</span>';

  const guestsCount = (m.guests || []).length;

  return `<div class="mini" style="min-height:58px;padding:10px var(--gutter);border-bottom:1px solid var(--divider);gap:14px;align-items:center" data-mid="${m.id}">
    <div style="min-width:76px;flex-shrink:0">
      <div style="font-weight:600;font-size:var(--fs);color:var(--text)">${m.time || '10:00'}</div>
      <div class="faint" style="font-size:var(--fs-2xs);margin-top:1px">${m.duration || 30} mins</div>
    </div>

    <div class="grow" style="min-width:0">
      <div class="row" style="gap:8px;margin-bottom:3px;align-items:center">
        <b style="font-size:var(--fs);color:var(--text)">${esc(m.title || 'Meeting')}</b>
        ${statusBadge}
        ${m.source === 'calcom' ? '<span class="badge">Cal.com</span>' : ''}
      </div>

      <div class="row" style="gap:8px;font-size:var(--fs-xs);color:var(--text-2);flex-wrap:wrap;align-items:center">
        <span class="row" style="gap:4px">
          ${ic('user', 12)}
          <b style="color:var(--text)">${esc(m.personName || 'Guest')}</b>
          ${m.personCompany ? `<span class="faint">· ${esc(m.personCompany)}</span>` : ''}
          ${m.personTitle ? `<span class="faint">(${esc(m.personTitle)})</span>` : ''}
        </span>
        ${m.personEmail ? `<span class="faint">· <a href="mailto:${esc(m.personEmail)}" style="color:var(--text-2)">${esc(m.personEmail)}</a></span>` : ''}
        ${
          m.location
            ? `<span class="row" style="gap:4px;color:var(--accent)">
                ${ic(m.location.includes('Meet') || m.location.includes('Zoom') || m.location.includes('Video') ? 'video' : 'map-pin', 12)}
                ${esc(m.location)}
              </span>`
            : ''
        }
        ${guestsCount ? `<span class="faint">· +${guestsCount} guest${guestsCount > 1 ? 's' : ''}</span>` : ''}
      </div>

      ${m.notes ? `<div class="muted trunc" style="font-size:var(--fs-xs);margin-top:3px;max-width:680px">${esc(m.notes)}</div>` : ''}
    </div>

    <div class="row" style="gap:6px;flex-shrink:0;align-items:center">
      ${
        m.meetUrl && !isCancelled
          ? `<a class="btn btn-secondary btn-sm" href="${esc(m.meetUrl)}" target="_blank" rel="noopener" title="Join Video Call">
              ${ic('video', 13)}<span>Join</span>
            </a>`
          : ''
      }

      ${
        !isCancelled
          ? `<button class="btn btn-secondary btn-sm" data-a="openRescheduleModal" data-id="${m.id}" title="Reschedule date or time directly">
              ${ic('calendar-clock', 13)}<span class="hide-m">Reschedule</span>
            </button>
            <button class="btn btn-secondary btn-sm" data-a="openRequestRescheduleModal" data-id="${m.id}" title="Request attendee to reschedule">
              ${ic('send', 13)}<span class="hide-m">Request reschedule</span>
            </button>
            <button class="ibtn ibtn-sm" data-a="openEditMeetingModal" data-id="${m.id}" data-tip="Edit details" aria-label="Edit meeting">
              ${ic('pencil', 13)}
            </button>
            <button class="ibtn ibtn-sm" data-a="cancelMeeting" data-id="${m.id}" data-tip="Cancel booking" aria-label="Cancel meeting">
              ${ic('x-circle', 13)}
            </button>`
          : `<button class="btn btn-secondary btn-sm" data-a="restoreMeeting" data-id="${m.id}">
              ${ic('rotate-ccw', 13)}Reopen
            </button>`
      }
    </div>
  </div>`;
}

