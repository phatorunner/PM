/* =====================================================================
   GOOGLE CALENDAR API SERVICE: OAuth 2.0 Token Flow & Calendar Sync
   ===================================================================== */
import { D, save } from './store.js';

/**
 * Sync Google Calendar events via Google Calendar API v3
 * Uses OAuth 2.0 Token Client (Google Identity Services) if configured,
 * or direct API key / Bearer Token.
 */
export async function syncGoogleCalendar(options = {}) {
  const gcal = D().gcal;
  if (!gcal) throw new Error('Google Calendar configuration is missing.');

  // Validate configuration
  const clientId = options.clientId || gcal.clientId;
  const apiKey = options.apiKey || gcal.apiKey;
  const accessToken = options.accessToken || gcal.accessToken;
  const calendarId = encodeURIComponent(options.calendarId || gcal.calendarId || 'primary');

  if (!accessToken && !apiKey && !clientId) {
    throw new Error(
      'Missing Google API Credentials. Please provide an OAuth Client ID or API Key in Google Calendar Settings.'
    );
  }

  // If accessToken is present, use Authorization header, otherwise query param key
  const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  let url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=100`;

  const headers = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else if (apiKey) {
    url += `&key=${encodeURIComponent(apiKey)}`;
  } else {
    throw new Error(
      'OAuth Client ID is configured, but no active access token was found. Please click "Authorize with Google".'
    );
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    let errMsg = `Google Calendar API returned status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const rawItems = data.items || [];

  // Normalize Google events into internal format
  const normalizedEvents = rawItems.map(item => {
    let date = '';
    let time = '';
    let isAllDay = false;

    if (item.start?.dateTime) {
      const d = new Date(item.start.dateTime);
      date = d.toISOString().slice(0, 10);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      time = `${hours}:${mins}`;
    } else if (item.start?.date) {
      date = item.start.date;
      time = 'All day';
      isAllDay = true;
    }

    return {
      id: 'gcal_' + item.id,
      gcalId: item.id,
      title: item.summary || '(Untitled Event)',
      desc: item.description || '',
      date,
      time,
      isAllDay,
      location: item.location || '',
      htmlLink: item.htmlLink || '',
      status: item.status || 'confirmed',
      source: 'gcal',
      hangoutLink: item.hangoutLink || '',
    };
  });

  gcal.events = normalizedEvents;
  gcal.connected = true;
  gcal.lastSynced = Date.now();
  gcal.error = null;
  save();

  return normalizedEvents;
}

export async function fetchGoogleUserProfile(accessToken) {
  const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error('Failed to fetch Google profile');
  return await resp.json();
}

/**
 * Triggers GIS (Google Identity Services) OAuth popup if script is available
 */
export function requestGoogleOAuth({ clientId, onToken, onError, scope }) {
  if (!clientId || !clientId.trim()) {
    onError(new Error('Please enter a valid Google OAuth Client ID.'));
    return;
  }

  const scopes = scope || 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.readonly';

  if (typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.oauth2) {
    // Dynamically inject Google Identity Services script if not already loaded
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initTokenClient(clientId, onToken, onError, scopes);
    };
    script.onerror = () => {
      onError(new Error('Failed to load Google Identity Services script. Check your internet connection.'));
    };
    document.head.appendChild(script);
  } else {
    initTokenClient(clientId, onToken, onError, scopes);
  }
}

function initTokenClient(clientId, onToken, onError, scopes) {
  try {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: scopes,
      callback: resp => {
        if (resp.error) {
          onError(new Error(resp.error_description || resp.error));
        } else if (resp.access_token) {
          onToken(resp.access_token);
        } else {
          onError(new Error('No access token returned from Google.'));
        }
      },
      error_callback: err => {
        onError(new Error(err?.message || 'Google OAuth prompt was closed or blocked.'));
      },
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (err) {
    onError(err);
  }
}

