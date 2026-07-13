import { DATA_DOC, setDoc, onSnapshot } from './firebase-config.js';

export const STORAGE_KEY = 'juanpmt_data_v2';
export const OUT_CATEGORIES = ['Salary', 'Dividend', 'Software & Tools', 'Marketing', 'Office', 'Contractor', 'Travel', 'Other'];
export const IN_CATEGORIES = ['Client Payment', 'Investment', 'Other Income'];
export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

function emptyData() {
  return { team: [], projects: [], tasks: [], transactions: [], leads: [], partners: [] };
}

function migrate(d) {
  d.team         = d.team         || [];
  d.projects     = d.projects     || [];
  d.tasks        = d.tasks        || [];
  d.transactions = d.transactions || [];
  d.leads        = d.leads        || [];
  d.partners     = d.partners     || [];
  return d;
}

export const data = (function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {}
  const fresh = emptyData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
})();

export function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  setDoc(DATA_DOC, JSON.parse(JSON.stringify(data))).catch(() => {});
}

export function watchFirestore(onChange) {
  return onSnapshot(DATA_DOC, snap => {
    if (!snap.exists() || snap.metadata.hasPendingWrites) return;
    const remote = migrate(snap.data());
    Object.assign(data, remote);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    onChange();
  }, () => {});
}

export function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
