/* =====================================================================
   Local File System Storage & Autosave Engine (Chromium File System Access API)
   - Primary autosave: gr8r-data.json with 500 ms debounce after latest change
   - Sequential write queue (mutex) to prevent overlapping writes
   - In-memory preservation of pending changes on write/permission failure
   - Visible error state & manual retry trigger
   - Saves attachment contents to /attachments/ before updating JSON references
   - Recovery backups every 5 minutes while active (/backups/recovery-backup-<timestamp>.json)
   - Daily snapshots (/snapshots/snapshot-<YYYY-MM-DD>.json)
   - Real-time status reporting with last saved timestamp
   ===================================================================== */
import { S, save as saveLocalStorage } from '../core/store.js';
import { render } from '../shell/render.js';
import { toast } from '../ui/toast.js';

let _activeDirHandle = null;

// IndexedDB persistence for DirectoryHandle
const IDB_NAME = 'gr8r_fs_db';
const IDB_STORE = 'handles';
const IDB_KEY = 'workspace_dir';

// Storage State tracked reactively
export const FS_STATUS = {
  state: 'idle', // 'idle' | 'saving' | 'saved' | 'error' | 'permission_needed' | 'unconfigured'
  lastSavedAt: null,
  lastError: null,
  pendingChanges: false,
  lastBackupAt: null,
  backupStatus: 'idle', // 'idle' | 'backing_up' | 'backed_up' | 'error'
  lastBackupError: null,
};

// Queue for serializing file writes
let _writeQueue = Promise.resolve();

// 500ms debounce timer for primary autosave
let _autosaveTimer = null;

// 5-minute interval timer for recovery backups
let _recoveryBackupInterval = null;

function openHandleDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function getPersistedHandle() {
  if (_activeDirHandle) return _activeDirHandle;
  try {
    const db = await openHandleDB();
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        _activeDirHandle = req.result || null;
        resolve(_activeDirHandle);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setPersistedHandle(handle) {
  _activeDirHandle = handle;
  try {
    const db = await openHandleDB();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    if (handle) {
      store.put(handle, IDB_KEY);
    } else {
      store.delete(IDB_KEY);
    }
  } catch {
    /* fallback silently */
  }
}

export function getStorageSettings() {
  if (!S.prefs.storageFolder) {
    S.prefs.storageFolder = {
      name: null,
      status: 'not_configured', // 'not_configured' | 'connected' | 'needs_permission'
      configuredAt: null,
      lastSavedAt: null,
    };
  }
  return S.prefs.storageFolder;
}

export async function checkFolderPermission(handle, prompt = false) {
  if (!handle) return 'not_configured';
  try {
    const options = { mode: 'readwrite' };
    let status = await handle.queryPermission(options);
    if (status === 'prompt' && prompt) {
      status = await handle.requestPermission(options);
    }
    return status === 'granted' ? 'connected' : 'needs_permission';
  } catch {
    return 'needs_permission';
  }
}

/**
 * Atomic write helper that writes content to a file via createWritable()
 */
async function writeFileAtomic(dirHandle, filename, content) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}

/**
 * Builds the comprehensive gr8r-data.json payload
 */
export function buildDataPayload() {
  return JSON.stringify(
    {
      version: '1.0.0',
      exportedAt: Date.now(),
      data: S.data,
      prefs: S.prefs,
      views: S.views,
    },
    null,
    2
  );
}

/**
 * Internal worker that performs the gr8r-data.json write operation inside the queue
 */
async function performFileSave() {
  const handle = await getPersistedHandle();
  if (!handle) {
    FS_STATUS.state = 'unconfigured';
    return false;
  }

  const perm = await checkFolderPermission(handle, false);
  if (perm !== 'connected') {
    FS_STATUS.state = 'permission_needed';
    FS_STATUS.lastError = 'Folder read/write permission is not granted';
    const sf = getStorageSettings();
    sf.status = 'needs_permission';
    render();
    return false;
  }

  FS_STATUS.state = 'saving';
  render();

  try {
    const jsonStr = buildDataPayload();
    await writeFileAtomic(handle, 'gr8r-data.json', jsonStr);

    FS_STATUS.state = 'saved';
    FS_STATUS.lastSavedAt = Date.now();
    FS_STATUS.lastError = null;
    FS_STATUS.pendingChanges = false;

    const sf = getStorageSettings();
    sf.status = 'connected';
    sf.lastSavedAt = FS_STATUS.lastSavedAt;
    saveLocalStorage(); // keep localStorage mirroring
    render();
    return true;
  } catch (err) {
    FS_STATUS.state = 'error';
    FS_STATUS.lastError = err.message || 'Failed to write gr8r-data.json';
    FS_STATUS.pendingChanges = true;
    render();
    toast(`Autosave failed: ${FS_STATUS.lastError}`, { kind: 'err', action: 'Retry', onAction: () => triggerAutosave(true) });
    return false;
  }
}

/**
 * Queues a save request with a 500 ms debounce
 */
export function triggerAutosave(immediate = false) {
  FS_STATUS.pendingChanges = true;

  if (_autosaveTimer) {
    clearTimeout(_autosaveTimer);
    _autosaveTimer = null;
  }

  if (immediate) {
    _writeQueue = _writeQueue.then(() => performFileSave()).catch(err => {
      FS_STATUS.state = 'error';
      FS_STATUS.lastError = err.message;
      render();
    });
    return _writeQueue;
  }

  _autosaveTimer = setTimeout(() => {
    _autosaveTimer = null;
    _writeQueue = _writeQueue.then(() => performFileSave()).catch(err => {
      FS_STATUS.state = 'error';
      FS_STATUS.lastError = err.message;
      render();
    });
  }, 500); // Strict 500ms debounce
}

/**
 * Saves attachment file content directly to /attachments/ folder before metadata is committed
 */
export async function saveAttachmentContent(file, fileId) {
  const handle = await getPersistedHandle();
  if (!handle) return null;

  const perm = await checkFolderPermission(handle, false);
  if (perm !== 'connected') return null;

  return new Promise((resolve, reject) => {
    _writeQueue = _writeQueue.then(async () => {
      try {
        const attachDir = await handle.getDirectoryHandle('attachments', { create: true });
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
        const safeName = `${fileId}${ext}`;
        const fileHandle = await attachDir.getFileHandle(safeName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        resolve(safeName);
      } catch (err) {
        console.error('Failed to write attachment:', err);
        reject(err);
      }
    });
  });
}

/**
 * Creates recovery backup (/backups/recovery-backup-<timestamp>.json)
 * and daily snapshot (/snapshots/snapshot-<YYYY-MM-DD>.json)
 */
export async function createRecoveryBackup(isDaily = false) {
  const handle = await getPersistedHandle();
  if (!handle) return;

  const perm = await checkFolderPermission(handle, false);
  if (perm !== 'connected') return;

  _writeQueue = _writeQueue.then(async () => {
    FS_STATUS.backupStatus = 'backing_up';
    try {
      const now = new Date();
      const payload = buildDataPayload();

      if (isDaily) {
        const snapDir = await handle.getDirectoryHandle('snapshots', { create: true });
        const dateStr = now.toISOString().slice(0, 10);
        await writeFileAtomic(snapDir, `snapshot-${dateStr}.json`, payload);
      }

      // Always create recovery backup
      const backupDir = await handle.getDirectoryHandle('backups', { create: true });
      const timeStr = now.toISOString().replace(/[:.]/g, '-');
      await writeFileAtomic(backupDir, `recovery-backup-${timeStr}.json`, payload);

      FS_STATUS.backupStatus = 'backed_up';
      FS_STATUS.lastBackupAt = Date.now();
      FS_STATUS.lastBackupError = null;
    } catch (err) {
      FS_STATUS.backupStatus = 'error';
      FS_STATUS.lastBackupError = err.message || 'Backup failed';
      toast(`Backup failed: ${FS_STATUS.lastBackupError}`, { kind: 'err' });
    }
    render();
  });
}

/**
 * Checks for daily snapshot and takes one if not yet recorded today
 */
export function checkDailySnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  if (S.prefs.lastDailySnapshotDate !== today) {
    createRecoveryBackup(true).then(() => {
      S.prefs.lastDailySnapshotDate = today;
      saveLocalStorage();
    });
  }
}

/**
 * Safely reads and parses gr8r-data.json from the connected folder if it exists
 */
export async function readDataFileFromFolder(dirHandle) {
  try {
    const fileHandle = await dirHandle.getFileHandle('gr8r-data.json', { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!text || !text.trim()) return null;
    const parsed = JSON.parse(text);
    if (parsed && (parsed.data || parsed.tasks)) {
      return parsed;
    }
    return null;
  } catch (err) {
    if (err.name === 'NotFoundError') {
      return null; // file does not exist yet
    }
    console.warn('Could not read existing gr8r-data.json:', err);
    return null;
  }
}

/**
 * Applies imported data payload into memory and localStorage mirror without data loss
 */
export function applyDataPayload(payload) {
  if (!payload) return;
  const incomingData = payload.data || payload;
  if (!incomingData || !incomingData.tasks) return;

  // Update in-memory state
  Object.assign(S.data, incomingData);
  if (payload.prefs) {
    Object.assign(S.prefs, payload.prefs);
  }
  if (payload.views) {
    Object.assign(S.views, payload.views);
  }

  // Keep localStorage safely mirrored
  saveLocalStorage();
  render();
}

/**
 * Initializes the background 5-minute recovery timer and daily snapshot runner,
 * and loads latest data from gr8r-data.json if present
 */
export function startStorageEngine() {
  if (_recoveryBackupInterval) clearInterval(_recoveryBackupInterval);

  // Initialize status from persisted handle
  getPersistedHandle().then(async handle => {
    if (handle) {
      const perm = await checkFolderPermission(handle, false);
      const sf = getStorageSettings();
      sf.status = perm;
      FS_STATUS.state = perm === 'connected' ? 'idle' : 'permission_needed';

      if (perm === 'connected') {
        // Requirement 1 & 2: Load latest data from selected folder's gr8r-data.json if available
        try {
          const fileData = await readDataFileFromFolder(handle);
          if (fileData) {
            applyDataPayload(fileData);
            FS_STATUS.state = 'saved';
            FS_STATUS.lastSavedAt = fileData.exportedAt || Date.now();
          } else {
            // Folder is empty or newly connected: save existing memory/localStorage data to gr8r-data.json
            await triggerAutosave(true);
          }
        } catch (e) {
          console.warn('Startup load error:', e);
        }

        checkDailySnapshot();
      }
      render();
    } else {
      FS_STATUS.state = 'unconfigured';
    }
  });

  // Every 5 minutes: run recovery backup
  _recoveryBackupInterval = setInterval(() => {
    getPersistedHandle().then(handle => {
      if (handle) {
        createRecoveryBackup(false);
        checkDailySnapshot();
      }
    });
  }, 5 * 60 * 1000);
}

/**
 * Interactive handlers for Settings UI
 */
export async function chooseLocalFolder() {
  if (!('showDirectoryPicker' in window)) {
    toast('Your browser does not support the File System Access API. Please use Chrome or Edge.', { kind: 'err', ms: 4000 });
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });

    const status = await checkFolderPermission(handle, true);
    if (status === 'connected') {
      await setPersistedHandle(handle);
      const sf = getStorageSettings();
      sf.name = handle.name;
      sf.status = 'connected';
      sf.configuredAt = Date.now();

      // Check if folder already contains gr8r-data.json
      const existingInFolder = await readDataFileFromFolder(handle);
      if (existingInFolder) {
        // Load latest data from folder
        applyDataPayload(existingInFolder);
        FS_STATUS.state = 'saved';
        FS_STATUS.lastSavedAt = existingInFolder.exportedAt || Date.now();
        toast(`Loaded existing data from ${handle.name}`, { kind: 'ok' });
      } else {
        // Folder is new: write existing localStorage data into gr8r-data.json
        saveLocalStorage();
        await triggerAutosave(true);
        await createRecoveryBackup(true);
        toast(`Connected local folder: ${handle.name}. Initialized gr8r-data.json.`, { kind: 'ok' });
      }

      render();
    } else {
      toast('Read/write permission was not granted.', { kind: 'warn' });
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast('Failed to select folder: ' + err.message, { kind: 'err' });
    }
  }
}

export async function reconnectLocalFolder() {
  const handle = await getPersistedHandle();
  if (!handle) {
    return chooseLocalFolder();
  }

  try {
    const status = await checkFolderPermission(handle, true);
    const sf = getStorageSettings();
    sf.status = status;
    saveLocalStorage();
    render();
    if (status === 'connected') {
      toast(`Reconnected: ${handle.name}`, { kind: 'ok' });
      // If there were pending changes preserved in memory, save them now!
      if (FS_STATUS.pendingChanges) {
        triggerAutosave(true);
      } else {
        // Check if there is data on disk to load
        const fileData = await readDataFileFromFolder(handle);
        if (fileData) {
          applyDataPayload(fileData);
          FS_STATUS.state = 'saved';
          FS_STATUS.lastSavedAt = fileData.exportedAt || Date.now();
        }
      }
    } else {
      toast('Permission required to connect to folder', { kind: 'warn' });
    }
  } catch {
    chooseLocalFolder();
  }
}

export async function disconnectLocalFolder() {
  await setPersistedHandle(null);
  const sf = getStorageSettings();
  sf.name = null;
  sf.status = 'not_configured';
  sf.configuredAt = null;
  sf.lastSavedAt = null;
  FS_STATUS.state = 'unconfigured';
  FS_STATUS.lastSavedAt = null;
  saveLocalStorage();
  render();
  toast('Folder disconnected');
}
