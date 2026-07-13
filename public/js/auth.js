import {
  auth, secondaryAuth, SUPERADMIN_EMAIL,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile, sendPasswordResetEmail,
  userDocRef, USERS_COL, getDoc, setDoc, deleteDoc, getDocs
} from './firebase-config.js';

export { SUPERADMIN_EMAIL };

/** @type {{ uid: string, email: string, name: string, role: string, active: boolean } | null} */
export let currentUser = null;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isSuperadminEmail(email) {
  return normalizeEmail(email) === SUPERADMIN_EMAIL;
}

export function isSuperadmin() {
  return !!(currentUser && (currentUser.role === 'superadmin' || isSuperadminEmail(currentUser.email)));
}

async function ensureUserProfile(fbUser) {
  const email = normalizeEmail(fbUser.email);
  const ref = userDocRef(fbUser.uid);
  const snap = await getDoc(ref);
  const now = new Date().toISOString();

  if (isSuperadminEmail(email)) {
    const profile = {
      email,
      name: (snap.exists() && snap.data().name) || fbUser.displayName || 'Superadmin',
      role: 'superadmin',
      active: true,
      createdAt: (snap.exists() && snap.data().createdAt) || now,
      updatedAt: now
    };
    await setDoc(ref, profile, { merge: true });
    return { uid: fbUser.uid, ...profile };
  }

  if (!snap.exists()) {
    await signOut(auth);
    throw new Error('Your account is not authorized. Ask a superadmin to add you in Settings → Users.');
  }

  const data = snap.data();
  if (data.active === false) {
    await signOut(auth);
    throw new Error('Your account has been deactivated. Contact a superadmin.');
  }

  // Keep email in sync
  if (normalizeEmail(data.email) !== email) {
    await setDoc(ref, { email, updatedAt: now }, { merge: true });
  }

  return {
    uid: fbUser.uid,
    email,
    name: data.name || fbUser.displayName || email,
    role: data.role || 'user',
    active: data.active !== false
  };
}

/**
 * Subscribe to auth state. Resolves once with the first auth decision,
 * then calls onChange for later changes.
 */
export function watchAuth(onChange) {
  return onAuthStateChanged(auth, async (fbUser) => {
    try {
      if (!fbUser) {
        currentUser = null;
        onChange(null);
        return;
      }
      currentUser = await ensureUserProfile(fbUser);
      onChange(currentUser);
    } catch (err) {
      currentUser = null;
      onChange(null, err);
    }
  });
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
  currentUser = await ensureUserProfile(cred.user);
  return currentUser;
}

/** First-time account creation — allowed for superadmin email, or if invited profile exists under that email. */
export async function register(email, password, name) {
  const normalized = normalizeEmail(email);
  if (!isSuperadminEmail(normalized)) {
    // Only superadmin can self-register; everyone else must be created by an admin
    throw new Error('New accounts must be created by a superadmin in Settings → Users.');
  }
  const cred = await createUserWithEmailAndPassword(auth, normalized, password);
  if (name) await updateProfile(cred.user, { displayName: name.trim() });
  currentUser = await ensureUserProfile(cred.user);
  if (name) {
    await setDoc(userDocRef(cred.user.uid), { name: name.trim() }, { merge: true });
    currentUser.name = name.trim();
  }
  return currentUser;
}

export async function logout() {
  currentUser = null;
  await signOut(auth);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, normalizeEmail(email));
}

export async function listUsers() {
  const snap = await getDocs(USERS_COL);
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .sort((a, b) => {
      if (a.role === 'superadmin' && b.role !== 'superadmin') return -1;
      if (b.role === 'superadmin' && a.role !== 'superadmin') return 1;
      return String(a.email || '').localeCompare(String(b.email || ''));
    });
}

/**
 * Superadmin creates a user (Auth account + Firestore profile) without losing their session.
 */
export async function createAppUser({ email, password, name, role = 'user' }) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can add users.');
  const normalized = normalizeEmail(email);
  if (!normalized || !password) throw new Error('Email and password are required.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  if (isSuperadminEmail(normalized)) throw new Error('Superadmin account already exists — sign in with that email.');

  const existing = await listUsers();
  if (existing.some(u => normalizeEmail(u.email) === normalized)) {
    throw new Error('A user with that email already exists.');
  }

  const cred = await createUserWithEmailAndPassword(secondaryAuth, normalized, password);
  try {
    if (name) await updateProfile(cred.user, { displayName: name.trim() });
    const profile = {
      email: normalized,
      name: (name || '').trim() || normalized.split('@')[0],
      role: role === 'superadmin' ? 'user' : (role || 'user'), // only hardcoded email is superadmin
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid
    };
    await setDoc(userDocRef(cred.user.uid), profile);
    return { uid: cred.user.uid, ...profile };
  } finally {
    await signOut(secondaryAuth);
  }
}

export async function setUserActive(uid, active) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can change users.');
  if (uid === currentUser?.uid) throw new Error('You cannot deactivate yourself.');
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('User not found.');
  if (isSuperadminEmail(snap.data().email) || snap.data().role === 'superadmin') {
    throw new Error('Cannot deactivate the superadmin.');
  }
  await setDoc(ref, { active: !!active, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function removeUser(uid) {
  if (!isSuperadmin()) throw new Error('Only the superadmin can remove users.');
  if (uid === currentUser?.uid) throw new Error('You cannot remove yourself.');
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('User not found.');
  if (isSuperadminEmail(snap.data().email) || snap.data().role === 'superadmin') {
    throw new Error('Cannot remove the superadmin.');
  }
  // Remove Firestore profile (Auth account remains — they just can't access the app)
  await deleteDoc(ref);
}

export function authErrorMessage(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'That email is already registered.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled in Firebase Console.'
  };
  return map[code] || err?.message || 'Something went wrong.';
}
