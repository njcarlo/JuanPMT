import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, onSnapshot, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCszORDc4Ak23E0YCqOO7f93oNSG1Wa08Q',
  authDomain: 'juanpmt.firebaseapp.com',
  projectId: 'juanpmt',
  storageBucket: 'juanpmt.firebasestorage.app',
  messagingSenderId: '21379742358',
  appId: '1:21379742358:web:ad3369bd07e469fdf9a0b7'
};

export const SUPERADMIN_EMAIL = 'njcarlo@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Secondary app — create users without signing the admin out
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
export const secondaryAuth = getAuth(secondaryApp);

export {
  doc, setDoc, getDoc, deleteDoc, onSnapshot, collection, getDocs,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile, sendPasswordResetEmail
};
export const DATA_DOC = doc(db, 'pmt', 'main');
export const USERS_COL = collection(db, 'users');

export function userDocRef(uid) {
  return doc(db, 'users', uid);
}
