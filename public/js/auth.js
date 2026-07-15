import {
  SUPERADMIN_USERNAME, USERS_COL, userDocRef, normalizeUsername,
  getDoc, setDoc, deleteDoc, getDocs
} from './firebase-config.js';

export { SUPERADMIN_USERNAME };

const SESSION_KEY = 'juanpmt_session_v1';

/** @type {{ username: string, name: string, role: string, active: boolean } | null} */
export let currentUser = null;

export function isSuperadmin() {
  return !!(currentUser && (
    currentUser.role === 'superadmin' ||
    currentUser.username === SUPERADMIN_USERNAME
  ));
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(String(password));
  const buf = await crypto.subtle.digest('SHA-256', data);
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

function profileFromDoc(username, data) {
  return {
    username,
    name: data.name || username,
    role: data.role || 'user',
    active: data.active !== false
  };
}

/**
 * Restore session from localStorage and re-validate against Firestore.
 * Calls onChange(user|null, err?).
 */
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
      const username = normalizeUsername(cached.username);
      const snap = await getDoc(userDocRef(username));
      if (!snap.exists() || snap.data().active === false) {
        clearSession();
        onChange(null);
        return;
      }
      const user = profileFromDoc(username, snap.data());
      saveSession(user);
      onChange(user);
    } catch (err) {
      clearSession();
      onChange(null, err);
    }
  })();

  // No realtime auth listener without Firebase Auth — return a no-op unsubscribe
  return () => {};
}

export async function login(username, password) {
  const user = normalizeUsername(username);
  if (!user || !password) throw new Error('Username and password are required.');

  const snap = await getDoc(userDocRef(user));
  if (!snap.exists()) throw new Error('Incorrect username or password.');

  const data = snap.data();
  if (data.active === false) throw new Error('This account has been deactivated.');

  const hash = await hashPassword(password);
  if (data.passwordHash !== hash) throw new Error('Incorrect username or password.');

  const profile = profileFromDoc(user, data);
  saveSession(profile);
  return profile;
}

/** First-time setup: create the superadmin account in Firestore. */
export async function register(username, password, name) {
  const user = normalizeUsername(username);
  if (user !== SUPERADMIN_USERNAME) {
    throw new Error(`First account must be username "${SUPERADMIN_USERNAME}". Other users are added in Settings.`);
  }
  if (!password || password.length < 4) throw new Error('Password must be at least 4 characters.');

  const existing = await getDoc(userDocRef(user));
  if (existing.exists()) throw new Error('Superadmin already exists. Sign in instead.');

  const profile = {
    username: user,
    name: (name || '').trim() || 'Superadmin',
    role: 'superadmin',
    active: true,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString()
  };
  await setDoc(userDocRef(user), profile);
  const session = profileFromDoc(user, profile);
  saveSession(session);
  return session;
}

export async function logout() {
  clearSession();
}

export async function listUsers() {
  const snap = await getDocs(USERS_COL);
  return snap.docs
    .map(d => {
      const data = d.data();
      return {
        username: d.id,
        name: data.name || d.id,
        role: data.role || 'user',
        active: data.active !== false,
        createdAt: data.createdAt || ''
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

  const snap = await getDoc(userDocRef(user));
  if (snap.exists()) throw new Error('That username already exists.');

  const profile = {
    username: user,
    name: (name || '').trim() || user,
    role: 'user',
    active: true,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    createdBy: currentUser.username
  };
  await setDoc(userDocRef(user), profile);
  return { username: user, name: profile.name, role: 'user', active: true };
}

export async function setUserActive(username, active) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can change users.');
  const user = normalizeUsername(username);
  if (user === currentUser?.username) throw new Error('You cannot deactivate yourself.');
  if (user === SUPERADMIN_USERNAME) throw new Error('Cannot deactivate the superadmin.');
  const ref = userDocRef(user);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('User not found.');
  await setDoc(ref, { active: !!active, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function removeUser(username) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can remove users.');
  const user = normalizeUsername(username);
  if (user === currentUser?.username) throw new Error('You cannot remove yourself.');
  if (user === SUPERADMIN_USERNAME) throw new Error('Cannot remove the superadmin.');
  const ref = userDocRef(user);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('User not found.');
  await deleteDoc(ref);
}

export function authErrorMessage(err) {
  return err?.message || 'Something went wrong.';
}
