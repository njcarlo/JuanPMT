import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCszORDc4Ak23E0YCqOO7f93oNSG1Wa08Q',
  authDomain: 'juanpmt.firebaseapp.com',
  projectId: 'juanpmt',
  storageBucket: 'juanpmt.firebasestorage.app',
  messagingSenderId: '21379742358',
  appId: '1:21379742358:web:ad3369bd07e469fdf9a0b7'
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { doc, setDoc, onSnapshot };
export const DATA_DOC = doc(db, 'pmt', 'main');
