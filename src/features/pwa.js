/* =====================================================================
   PWA & Service Worker Manager
   - Service worker registration with update checking.
   - Non-intrusive update notification when new version is available.
   - PWA installation prompt handling (beforeinstallprompt, appinstalled).
   ===================================================================== */
import { toast } from '../ui/toast.js';
import { render } from '../shell/render.js';

export const PWA_STATE = {
  isSupported: 'serviceWorker' in navigator,
  isInstalled: false,
  installPrompt: null,
  updateAvailable: false,
  waitingWorker: null,
  registration: null,
};

// Check if app is already running in standalone mode
if (typeof window !== 'undefined') {
  PWA_STATE.isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  window.matchMedia('(display-mode: standalone)').addEventListener('change', e => {
    PWA_STATE.isInstalled = e.matches;
    render();
  });
}

/**
 * Register the PWA service worker and listen for lifecycle updates.
 */
export function registerPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Listen for beforeinstallprompt event (Chrome, Edge on Windows/Android)
  window.addEventListener('beforeinstallprompt', e => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    PWA_STATE.installPrompt = e;
    render();
  });

  window.addEventListener('appinstalled', () => {
    PWA_STATE.isInstalled = true;
    PWA_STATE.installPrompt = null;
    toast({
      text: 'HanhPM installed successfully! You can launch it from your desktop or start menu.',
      type: 'ok',
      duration: 6000,
    });
    render();
  });

  window.addEventListener('load', async () => {
    try {
      // Determine service worker path relative to base
      const swUrl = import.meta.env.BASE_URL + 'sw.js';
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: import.meta.env.BASE_URL,
      });

      PWA_STATE.registration = registration;

      // Check if there is already a waiting worker
      if (registration.waiting) {
        notifyUpdateAvailable(registration.waiting);
      }

      // Listen for updates on the registration
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content is available and waiting
              notifyUpdateAvailable(newWorker);
            }
          }
        });
      });

      // Periodic check for updates every 60 minutes
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);

      // Listen for controlling service worker changing (after skipWaiting)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    } catch (err) {
      console.warn('PWA service worker registration failed:', err);
    }
  });
}

/**
 * Notify user that an update is available without disrupting ongoing work.
 */
function notifyUpdateAvailable(worker) {
  PWA_STATE.updateAvailable = true;
  PWA_STATE.waitingWorker = worker;
  render();

  toast({
    text: 'A new version of HanhPM is available. Reload when you are ready to update.',
    type: 'info',
    actionText: 'Update Now',
    action: () => applyPwaUpdate(),
    duration: 12000,
  });
}

/**
 * Safely trigger the waiting worker to activate and reload the page.
 */
export function applyPwaUpdate() {
  if (PWA_STATE.waitingWorker) {
    PWA_STATE.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else if (PWA_STATE.registration && PWA_STATE.registration.waiting) {
    PWA_STATE.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

/**
 * Trigger the native browser install prompt if available.
 */
export async function promptInstallApp() {
  if (!PWA_STATE.installPrompt) {
    return false;
  }

  const promptEvent = PWA_STATE.installPrompt;
  PWA_STATE.installPrompt = null;
  render();

  promptEvent.prompt();
  const choiceResult = await promptEvent.userChoice;
  if (choiceResult.outcome === 'accepted') {
    PWA_STATE.isInstalled = true;
    render();
    return true;
  }
  return false;
}

