import {
  SUPERADMIN_USERNAME, normalizeUsername, mainDocRestUrl
} from './firebase-config.js';
import { data, saveAsync, syncFromRemote } from './data.js';

export { SUPERADMIN_USERNAME };

const SESSION_KEY = 'juanpmt_session_v1';
const CLOUD_TIMEOUT_MS = 12000;

/** @type {{ username: string, name: string, role: string, active: boolean } | null} */
export let currentUser = null;

function ensureLogins() {
  if (!data.logins || typeof data.logins !== 'object' || Array.isArray(data.logins)) {
    data.logins = {};
  }
  return data.logins;
}

function resolveUsername(raw) {
  let user = normalizeUsername(raw);
  if (user.includes('@')) {
    const local = user.split('@')[0];
    if (local === SUPERADMIN_USERNAME) return SUPERADMIN_USERNAME;
  }
  return user;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out. Check your network and try again.`)), ms);
    promise.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

function fromFirestoreValue(val) {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('nullValue' in val) return null;
  if ('mapValue' in val) {
    const fields = val.mapValue.fields || {};
    const out = {};
    Object.keys(fields).forEach(k => { out[k] = fromFirestoreValue(fields[k]); });
    return out;
  }
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  return null;
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    Object.keys(val).forEach(k => { fields[k] = toFirestoreValue(val[k]); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function isSuperadmin() {
  return !!(currentUser && (
    currentUser.role === 'superadmin' ||
    currentUser.username === SUPERADMIN_USERNAME
  ));
}

async function hashPassword(password) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure browser context required (open the site via HTTPS).');
  }
  const bytes = new TextEncoder().encode(String(password));
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function saveSession(user) {
  currentUser = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    username: user.username,
    name: user.name,
    role: user.role
  }));
}

function clearSession() {
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
}

function profileFromRecord(username, record) {
  return {
    username,
    name: record.name || username,
    role: record.role || 'user',
    active: record.active !== false
  };
}

/** Read logins via Firestore REST (avoids SDK WebChannel hangs). */
async function fetchLoginsFromCloud() {
  const res = await withTimeout(fetch(mainDocRestUrl()), CLOUD_TIMEOUT_MS, 'Database request');
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Database error (${res.status}). ${errBody.slice(0, 120)}`);
  }
  const doc = await res.json();
  const fields = doc.fields || {};
  const logins = fields.logins ? fromFirestoreValue(fields.logins) : {};
  const safe = (logins && typeof logins === 'object' && !Array.isArray(logins)) ? logins : {};
  data.logins = { ...safe };
  return data.logins;
}

export function watchAuth(onChange) {
  (async () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        currentUser = null;
        onChange(null);
        return;
      }
      const cached = JSON.parse(raw);
      const username = resolveUsername(cached.username);
      let record;
      try {
        const logins = await fetchLoginsFromCloud();
        record = logins[username];
      } catch (_) {
        record = ensureLogins()[username];
      }
      if (!record || record.active === false) {
        clearSession();
        onChange(null);
        return;
      }
      const user = profileFromRecord(username, record);
      saveSession(user);
      onChange(user);
    } catch (err) {
      clearSession();
      onChange(null, err);
    }
  })();

  return () => {};
}

export async function login(username, password) {
  const user = resolveUsername(username);
  const pass = String(password || '');
  if (!user || !pass) throw new Error('Username and password are required.');

  let logins;
  try {
    logins = await fetchLoginsFromCloud();
  } catch (err) {
    console.error('login fetch failed', err);
    throw new Error(err?.message || 'Could not reach the database. Check your connection and try again.');
  }

  const record = logins[user];
  if (!record) {
    throw new Error(`Unknown username "${user}". Use "njcarlo" (not your email).`);
  }
  if (record.active === false) throw new Error('This account has been deactivated.');

  const hash = await hashPassword(pass);
  if (record.passwordHash !== hash) {
    throw new Error('Incorrect password.');
  }

  // Background full sync for the app after unlock
  syncFromRemote().catch(err => console.warn('syncFromRemote failed', err));

  const profile = profileFromRecord(user, record);
  saveSession(profile);
  return profile;
}

export async function register(username, password, name) {
  const user = resolveUsername(username);
  if (user !== SUPERADMIN_USERNAME) {
    throw new Error(`First account must be username "${SUPERADMIN_USERNAME}". Other users are added in Settings.`);
  }
  const pass = String(password || '');
  if (pass.length < 4) throw new Error('Password must be at least 4 characters.');

  let logins;
  try {
    logins = await fetchLoginsFromCloud();
  } catch (_) {
    logins = ensureLogins();
  }

  if (logins[user]) throw new Error('Superadmin already exists. Click “Back to sign in” and sign in.');

  try { await syncFromRemote(); } catch (_) {}

  ensureLogins()[user] = {
    name: (name || '').trim() || 'Superadmin',
    role: 'superadmin',
    active: true,
    passwordHash: await hashPassword(pass),
    createdAt: new Date().toISOString()
  };

  try {
    await withTimeout(saveAsync(), CLOUD_TIMEOUT_MS, 'Saving account');
  } catch (err) {
    delete ensureLogins()[user];
    throw err;
  }

  const session = profileFromRecord(user, ensureLogins()[user]);
  saveSession(session);
  return session;
}

export async function logout() {
  clearSession();
}

export async function listUsers() {
  try { await fetchLoginsFromCloud(); } catch (_) {}
  const logins = ensureLogins();
  return Object.keys(logins)
    .map(username => {
      const record = logins[username];
      return {
        username,
        name: record.name || username,
        role: record.role || 'user',
        active: record.active !== false,
        createdAt: record.createdAt || ''
      };
    })
    .sort((a, b) => {
      if (a.role === 'superadmin' && b.role !== 'superadmin') return -1;
      if (b.role === 'superadmin' && a.role !== 'superadmin') return 1;
      return a.username.localeCompare(b.username);
    });
}

export async function createAppUser({ username, password, name }) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can add users.');
  const user = normalizeUsername(username);
  if (!user || !password) throw new Error('Username and password are required.');
  if (password.length < 4) throw new Error('Password must be at least 4 characters.');
  if (!/^[a-z0-9._-]+$/.test(user)) {
    throw new Error('Username can only use letters, numbers, dot, underscore, or hyphen.');
  }
  if (user === SUPERADMIN_USERNAME) throw new Error('That username is reserved for the superadmin.');

  try { await syncFromRemote(); } catch (_) {}
  try { await fetchLoginsFromCloud(); } catch (_) {}

  const logins = ensureLogins();
  if (logins[user]) throw new Error('That username already exists.');

  logins[user] = {
    name: (name || '').trim() || user,
    role: 'user',
    active: true,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    createdBy: currentUser.username
  };

  try {
    await saveAsync();
  } catch (err) {
    delete logins[user];
    throw err;
  }

  return { username: user, name: logins[user].name, role: 'user', active: true };
}

export async function setUserActive(username, active) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can change users.');
  const user = normalizeUsername(username);
  if (user === currentUser?.username) throw new Error('You cannot deactivate yourself.');
  if (user === SUPERADMIN_USERNAME) throw new Error('Cannot deactivate the superadmin.');
  try { await syncFromRemote(); } catch (_) {}
  const logins = ensureLogins();
  if (!logins[user]) throw new Error('User not found.');
  logins[user].active = !!active;
  logins[user].updatedAt = new Date().toISOString();
  await saveAsync();
}

export async function removeUser(username) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can remove users.');
  const user = normalizeUsername(username);
  if (user === currentUser?.username) throw new Error('You cannot remove yourself.');
  if (user === SUPERADMIN_USERNAME) throw new Error('Cannot remove the superadmin.');
  try { await syncFromRemote(); } catch (_) {}
  const logins = ensureLogins();
  if (!logins[user]) throw new Error('User not found.');
  delete logins[user];
  await saveAsync();
}

export function authErrorMessage(err) {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  if (code === 'permission-denied' || /permission|insufficient/i.test(msg)) {
    return 'Firestore blocked the write. Deploy rules or check Console permissions, then try again.';
  }
  if (/secure browser|crypto\.subtle/i.test(msg)) {
    return 'Open the site over HTTPS (e.g. https://juanpmt.web.app), then try again.';
  }
  return err?.message || 'Something went wrong.';
}
