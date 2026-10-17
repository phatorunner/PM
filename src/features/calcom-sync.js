/* =====================================================================
   CAL.COM SYNC · polls bookings every 20 min and updates S.data.meetings
   ===================================================================== */
import { D, calcomState } from '../core/store.js';
import { mutate } from '../ui/toast.js';
import { render } from '../shell/render.js';
import { fmtDate, uid } from '../core/utils.js';

const POLL_MS = 20 * 60 * 1000; // 20 minutes
let _pollTimer = null;

/** Map a Cal.com booking status to our internal meeting status */
function mapStatus(calStatus) {
  if (calStatus === 'cancelled' || calStatus === 'rejected') return 'cancelled';
  if (calStatus === 'accepted') return 'upcoming';
  return 'upcoming'; // pending / unknown → treat as upcoming
}

/** Fetch bookings with proxy fallback and multiple version support */
async function fetchBookingsFromCalcom(apiKey) {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  // Use Vite dev proxy /api/calcom to bypass browser CORS in dev; fallback to direct API
  const bases = isDev
    ? ['/api/calcom', 'https://api.cal.com']
    : ['https://api.cal.com'];

  let lastError = null;

  for (const base of bases) {
    // 1. Try Cal.com v1 bookings
    try {
      const url = `${base}/v1/bookings?apiKey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.bookings ?? (Array.isArray(json) ? json : null);
        if (list) return { ok: true, bookings: list };
      } else if (res.status === 401 || res.status === 403) {
        return { ok: false, status: res.status, message: 'Invalid Cal.com API key. Please check your credentials.' };
      }
    } catch (e) {
      lastError = e;
    }

    // 2. Try Cal.com v2 bookings (Bearer header + cal-api-version)
    try {
      const url = `${base}/v2/bookings`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'cal-api-version': '2024-08-13',
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.data ?? json.bookings ?? (Array.isArray(json) ? json : null);
        if (list) return { ok: true, bookings: list };
      } else if (res.status === 401 || res.status === 403) {
        return { ok: false, status: res.status, message: 'Invalid Cal.com API key. Please check your credentials.' };
      }
    } catch (e) {
      lastError = e;
    }
  }

  return {
    ok: false,
    message: lastError
      ? 'Network/CORS error contacting Cal.com. Please restart the dev server to activate the proxy.'
      : 'Cal.com API did not return bookings.',
  };
}

/** Pull bookings from Cal.com API and merge into S.data.meetings */
export async function syncCalcom(opts = {}) {
  const cal = calcomState();
  if (!cal.connected || !cal.apiKey) {
    if (opts.manual) {
      return { ok: false, reason: 'missing_key', message: 'Please add and save your Cal.com API key first.' };
    }
    return { ok: false, reason: 'missing_key' };
  }

  const result = await fetchBookingsFromCalcom(cal.apiKey);
  if (!result.ok) {
    if (opts.manual) {
      return { ok: false, reason: 'error', message: result.message };
    }
    return { ok: false };
  }

  const bookings = result.bookings;
  if (!Array.isArray(bookings)) {
    return { ok: true, count: 0 };
  }

  mutate(() => {
    const d = D();
    if (!d.meetings) d.meetings = [];

    for (const b of bookings) {
      const uid = b.uid || b.id;
      if (!uid) continue;

      const existing = d.meetings.find(m => m.calcomUid === String(uid));
      // Cal.com v1 uses startTime; v2 uses start
      const startIso = b.start || b.startTime || '';
      const date = startIso ? startIso.slice(0, 10) : '';
      const time = startIso ? startIso.slice(11, 16) : '';
      
      // Attendee extraction supporting both v1 & v2 shapes
      const attendees = b.attendees || [];
      const attendee =
        attendees.find(a => a.email && a.email !== cal.username) ??
        attendees[0];

      const status = mapStatus(b.status);
      const title = b.title || 'Meeting';
      const meetUrl = b.meetingUrl || b.videoCallData?.url || b.location || '';
      const location = typeof b.location === 'string' ? b.location : '';

      const personName = attendee?.name || attendee?.displayName || 'Guest';
      const personEmail = attendee?.email || '';

      if (existing) {
        existing.status = status;
        existing.title  = title;
        if (date) existing.date = date;
        if (time) existing.time = time;
        if (meetUrl && !existing.meetUrl) existing.meetUrl = meetUrl;
      } else {
        d.meetings.push({
          id:           `calcom_${uid}`,
          calcomUid:    String(uid),
          title,
          date,
          time,
          personName,
          personEmail,
          personCompany: '',
          status,
          source:       'calcom',
          meetUrl,
          location,
        });
      }

      // Automatically create or sync person in People directory
      if (personName && personName !== 'Guest') {
        d.contacts = d.contacts || [];
        let c = personEmail
          ? d.contacts.find(x => x.email && x.email.toLowerCase() === personEmail.toLowerCase())
          : d.contacts.find(x => x.name.toLowerCase() === personName.toLowerCase());

        const colors = ['#4B5BD6', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#2563EB', '#0D9488'];

        if (!c) {
          c = {
            id: uid('c'),
            name: personName,
            email: personEmail,
            company: '',
            title: '',
            phone: attendee?.phoneNumber || '',
            location: location || '',
            tags: ['client', 'cal.com'],
            notes: `Booked "${title}" on ${fmtDate(date, true)} via Cal.com`,
            color: colors[d.contacts.length % colors.length],
            meetings: [],
            followUps: [],
            lastContacted: date || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          d.contacts.unshift(c);

          d.notifs = d.notifs || [];
          d.notifs.unshift({
            id: uid('n'),
            type: 'assign',
            text: `added new contact profile for ${personName}`,
            snippet: `${personName} (${personEmail || 'Cal.com attendee'}) was automatically added to your People directory.`,
            at: Date.now(),
            read: false,
          });
        } else {
          // Keep contact up to date with newest booking details
          if (personEmail && !c.email) c.email = personEmail;
          if (date && (!c.lastContacted || date > c.lastContacted)) c.lastContacted = date;
          if (!c.tags) c.tags = [];
          if (!c.tags.includes('cal.com')) c.tags.push('cal.com');
          c.updatedAt = Date.now();
        }
      }
    }
  });

  render();
  return { ok: true, count: bookings.length };
}

/** Start (or restart) the 20-minute polling loop */
export function startCalcomPolling() {
  stopCalcomPolling();
  syncCalcom();                          // immediate fetch on start
  _pollTimer = setInterval(syncCalcom, POLL_MS);
}

/** Clear the polling loop (called when settings change / user disconnects) */
export function stopCalcomPolling() {
  if (_pollTimer !== null) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

/** Reschedule a booking directly on Cal.com via API */
export async function apiRescheduleBooking(bookingUid, { date, time, reason }) {
  const cal = calcomState();
  if (!cal.apiKey) return { ok: false, message: 'No Cal.com API key configured.' };

  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const bases = isDev ? ['/api/calcom', 'https://api.cal.com'] : ['https://api.cal.com'];

  // Format ISO start time string, e.g. "2026-06-15T14:30:00"
  const startIso = `${date}T${time}:00`;

  let lastStatus = 0;
  let lastMsg = '';

  for (const base of bases) {
    try {
      const url = `${base}/v2/bookings/${encodeURIComponent(bookingUid)}/reschedule`;
      const bodyPayload = {
        start: startIso,
        reschedulingReason: reason || undefined,
        reason: reason || undefined,
        note: reason || undefined,
        notes: reason || undefined,
        rescheduledBy: cal.username || undefined,
        metadata: reason ? { note: reason, message: reason } : undefined,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cal.apiKey}`,
          'cal-api-version': '2024-08-13',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      lastStatus = res.status;
      if (res.ok) {
        const json = await res.json();
        return { ok: true, data: json };
      }
      const errJson = await res.json().catch(() => null);
      lastMsg = errJson?.message || errJson?.error || `HTTP ${res.status}`;
    } catch (e) {
      lastMsg = e.message;
    }
  }

  return { ok: false, status: lastStatus, message: lastMsg || 'Failed to reschedule on Cal.com' };
}

/** Request attendee to reschedule via Cal.com API */
export async function apiRequestRescheduleBooking(bookingUid, { reason }) {
  const cal = calcomState();
  if (!cal.apiKey) return { ok: false, message: 'No Cal.com API key configured.' };

  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const bases = isDev ? ['/api/calcom', 'https://api.cal.com'] : ['https://api.cal.com'];

  let lastStatus = 0;
  let lastMsg = '';

  for (const base of bases) {
    try {
      const url = `${base}/v2/bookings/${encodeURIComponent(bookingUid)}/request-reschedule`;
      const bodyPayload = {
        rescheduleReason: reason || undefined,
        reschedulingReason: reason || undefined,
        reason: reason || undefined,
        note: reason || undefined,
        message: reason || undefined,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cal.apiKey}`,
          'cal-api-version': '2024-08-13',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      lastStatus = res.status;
      if (res.ok) {
        const json = await res.json();
        return { ok: true, data: json };
      }
      const errJson = await res.json().catch(() => null);
      lastMsg = errJson?.message || errJson?.error || `HTTP ${res.status}`;
    } catch (e) {
      lastMsg = e.message;
    }
  }

  return { ok: false, status: lastStatus, message: lastMsg || 'Failed to request reschedule on Cal.com' };
}


