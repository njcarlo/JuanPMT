import { SUPERADMIN_USERNAME, normalizeUsername, mainDocRestUrl } from './firebase-config.js';
import { data, saveAsync, saveLoginsAsync, syncFromRemote } from './data.js';

export { SUPERADMIN_USERNAME };

const SESSION_KEY = 'juanpmt_session_v1';
const CLOUD_TIMEOUT_MS = 3000;

/** Known hash for temporary password "password" (offline unlock). */
const FALLBACK_SUPERADMIN_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';

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

function superadminFallbackRecord() {
  return {
    name: 'John Carlo Navarro',
    role: 'superadmin',
    active: true,
    passwordHash: FALLBACK_SUPERADMIN_HASH
  };
}

/**
 * XHR with xhr.timeout PLUS an outer Promise.race timer.
 * fetch+AbortController has been observed to hang forever in some browsers/networks.
 */
function fetchLoginsXHR(timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      try { xhr.abort(); } catch (_) {}
      fn(arg);
    };

    const xhr = new XMLHttpRequest();
    xhr.open('GET', mainDocRestUrl(), true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = timeoutMs;

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        done(reject, new Error('Database error (' + xhr.status + ').'));
        return;
      }
      try {
        const doc = JSON.parse(xhr.responseText);
        const fields = doc.fields || {};
        const logins = fields.logins ? fromFirestoreValue(fields.logins) : {};
        const safe = (logins && typeof logins === 'object' && !Array.isArray(logins)) ? logins : {};
        data.logins = { ...safe };
        done(resolve, data.logins);
      } catch (e) {
        done(reject, e);
      }
    };
    xhr.ontimeout = () => done(reject, new Error('Database request timed out.'));
    xhr.onerror = () => done(reject, new Error('Network error contacting database.'));

    const hardTimer = setTimeout(() => {
      done(reject, new Error('Database request timed out.'));
    }, timeoutMs + 500);

    try {
      xhr.send();
    } catch (e) {
      done(reject, e);
    }
  });
}

async function fetchLoginsFromCloud() {
  return fetchLoginsXHR(CLOUD_TIMEOUT_MS);
}

async function softSync() {
  try {
    await Promise.race([
      syncFromRemote(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('sync timeout')), 4000))
    ]);
  } catch (_) {}
  try {
    await fetchLoginsFromCloud();
  } catch (_) {}
}

export function watchAuth(onChange) {
  // Restore local session only — never block on cloud, never bounce the owner.
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      currentUser = null;
      onChange(null);
      return () => {};
    }
    const cached = JSON.parse(raw);
    const username = resolveUsername(cached.username);
    if (!username) {
      clearSession();
      onChange(null);
      return () => {};
    }

    const isOwner =
      username === SUPERADMIN_USERNAME ||
      cached.role === 'superadmin';

    let record = ensureLogins()[username];

    // Stale local data must not kick out a valid session (especially owner).
    if (!record || record.active === false) {
      if (isOwner) {
        record = {
          ...(record && typeof record === 'object' ? record : {}),
          name: cached.name || (record && record.name) || 'John Carlo Navarro',
          role: 'superadmin',
          active: true,
          passwordHash: (record && record.passwordHash) || FALLBACK_SUPERADMIN_HASH
        };
        ensureLogins()[username] = record;
      } else {
        clearSession();
        onChange(null);
        return () => {};
      }
    }

    if (isOwner) {
      record.active = true;
      record.role = record.role || 'superadmin';
      ensureLogins()[username] = record;
    }

    const user = profileFromRecord(username, {
      ...record,
      name: cached.name || record.name,
      role: isOwner ? 'superadmin' : (record.role || cached.role || 'user')
    });
    saveSession(user);
    onChange(user);
    fetchLoginsFromCloud().catch(() => {});
  } catch (err) {
    // Keep session if we can still read it — do not soft-lock the owner out
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const username = resolveUsername(cached.username);
        if (username === SUPERADMIN_USERNAME || cached.role === 'superadmin') {
          const user = {
            username: username || SUPERADMIN_USERNAME,
            name: cached.name || 'Superadmin',
            role: 'superadmin',
            active: true
          };
          currentUser = user;
          onChange(user);
          return () => {};
        }
      }
    } catch (_) {}
    clearSession();
    onChange(null, err);
  }
  return () => {};
}

export async function login(username, password) {
  const user = resolveUsername(username);
  const pass = String(password || '');
  if (!user || !pass) throw new Error('Username and password are required.');

  const hash = await hashPassword(pass);

  // Instant unlock for the known temp password — never wait on Firestore.
  // This is what gets you in when the browser hangs on "Contacting database…".
  if (user === SUPERADMIN_USERNAME && hash === FALLBACK_SUPERADMIN_HASH) {
    const existing = ensureLogins()[user];
    const record = {
      ...(existing || {}),
      ...superadminFallbackRecord(),
      name: (existing && existing.name) || 'John Carlo Navarro'
    };
    ensureLogins()[user] = record;
    syncFromRemote().catch(err => console.warn('syncFromRemote failed', err));
    fetchLoginsFromCloud().catch(() => {});
    const profile = profileFromRecord(user, record);
    saveSession(profile);
    return profile;
  }

  let logins = {};
  let cloudOk = false;
  try {
    logins = await fetchLoginsFromCloud();
    cloudOk = true;
  } catch (err) {
    console.warn('Cloud login fetch failed, trying local cache', err);
    logins = ensureLogins();
  }

  const record = logins[user];
  if (!record) {
    if (!cloudOk) {
      throw new Error('Could not reach the database. For the owner account use username njcarlo and password password.');
    }
    throw new Error(`Unknown username "${user}". Use "njcarlo" (not your email).`);
  }
  if (record.active === false) throw new Error('This account has been deactivated.');
  if (!record.passwordHash || record.passwordHash !== hash) {
    throw new Error('Incorrect password.');
  }

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

  let logins = {};
  try {
    logins = await fetchLoginsFromCloud();
  } catch (_) {
    logins = ensureLogins();
  }

  if (logins[user]) {
    throw new Error('Superadmin already exists. Click “Back to sign in” and sign in with password (try: password).');
  }

  try { await syncFromRemote(); } catch (_) {}

  ensureLogins()[user] = {
    name: (name || '').trim() || 'Superadmin',
    role: 'superadmin',
    active: true,
    passwordHash: await hashPassword(pass),
    createdAt: new Date().toISOString()
  };

  try {
    await saveAsync();
  } catch (err) {
    console.warn('Could not save superadmin to cloud', err);
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

export async function createAppUser({ username, password, name, role }) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can add users.');
  const user = normalizeUsername(username);
  if (!user || !password) throw new Error('Username and password are required.');
  if (password.length < 4) throw new Error('Password must be at least 4 characters.');
  if (!/^[a-z0-9._-]+$/.test(user)) {
    throw new Error('Username can only use letters, numbers, dot, underscore, or hyphen.');
  }
  if (user === SUPERADMIN_USERNAME) throw new Error('That username is reserved for the owner account.');

  const nextRole = role === 'superadmin' ? 'superadmin' : 'user';

  await softSync();

  const logins = ensureLogins();
  if (logins[user]) throw new Error('That username already exists.');

  logins[user] = {
    name: (name || '').trim() || user,
    role: nextRole,
    active: true,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    createdBy: currentUser?.username || SUPERADMIN_USERNAME
  };

  try {
    await saveLoginsAsync();
  } catch (err) {
    delete logins[user];
    throw err;
  }

  return { username: user, name: logins[user].name, role: nextRole, active: true };
}

export async function setUserRole(username, role) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can change roles.');
  const user = normalizeUsername(username);
  const nextRole = role === 'superadmin' ? 'superadmin' : 'user';
  if (user === SUPERADMIN_USERNAME) throw new Error('Cannot change the owner account role.');
  if (user === currentUser?.username) throw new Error('You cannot change your own role.');

  await softSync();
  const logins = ensureLogins();
  if (!logins[user]) throw new Error('User not found.');
  logins[user].role = nextRole;
  logins[user].updatedAt = new Date().toISOString();
  await saveLoginsAsync();
}

export async function setUserActive(username, active) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can change users.');
  const user = normalizeUsername(username);
  if (user === currentUser?.username) throw new Error('You cannot deactivate yourself.');
  if (user === SUPERADMIN_USERNAME) throw new Error('Cannot deactivate the owner account.');
  await softSync();
  const logins = ensureLogins();
  if (!logins[user]) throw new Error('User not found.');
  logins[user].active = !!active;
  logins[user].updatedAt = new Date().toISOString();
  await saveLoginsAsync();
}

export async function removeUser(username) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can remove users.');
  const user = normalizeUsername(username);
  if (user === currentUser?.username) throw new Error('You cannot remove yourself.');
  if (user === SUPERADMIN_USERNAME) throw new Error('Cannot remove the owner account.');
  await softSync();
  const logins = ensureLogins();
  if (!logins[user]) throw new Error('User not found.');
  delete logins[user];
  await saveLoginsAsync();
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
