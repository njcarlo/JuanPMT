import { DATA_DOC, setDoc, onSnapshot } from './firebase-config.js';

export const STORAGE_KEY = 'juanpmt_data_v2';

/** Defaults used for new installs and migration. Salary & Dividend are required by payroll/dividends. */
export const DEFAULT_OUT_CATEGORIES = ['Salary', 'Dividend', 'Software & Tools', 'Marketing', 'Office', 'Contractor', 'Travel', 'Other'];
export const DEFAULT_IN_CATEGORIES = ['Client Payment', 'Investment', 'Other Income'];
export const PROTECTED_OUT_CATEGORIES = ['Salary', 'Dividend'];

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

function emptyData() {
  return {
    team: [],
    projects: [],
    tasks: [],
    transactions: [],
    leads: [],
    partners: [],
    outCategories: [...DEFAULT_OUT_CATEGORIES],
    inCategories: [...DEFAULT_IN_CATEGORIES]
  };
}

function migrate(d) {
  d.team         = d.team         || [];
  d.projects     = d.projects     || [];
  d.tasks        = d.tasks        || [];
  d.transactions = d.transactions || [];
  d.leads        = d.leads        || [];
  d.partners     = d.partners     || [];
  if (!Array.isArray(d.outCategories) || !d.outCategories.length) {
    d.outCategories = [...DEFAULT_OUT_CATEGORIES];
  }
  if (!Array.isArray(d.inCategories) || !d.inCategories.length) {
    d.inCategories = [...DEFAULT_IN_CATEGORIES];
  }
  // Ensure system categories used by payroll / dividends always exist
  PROTECTED_OUT_CATEGORIES.forEach(c => {
    if (!d.outCategories.includes(c)) d.outCategories.unshift(c);
  });
  // Align cached spent with Finance Out transactions
  d.projects.forEach(p => {
    p.spent = (d.transactions || [])
      .filter(t => t.type === 'Out' && t.project === p.id)
      .reduce((s, t) => s + Number(t.amount || 0), 0);
  });
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

/** Live lists — prefer these over the old hardcoded constants. */
export function getOutCategories() {
  return data.outCategories;
}

export function getInCategories() {
  return data.inCategories;
}

/** @deprecated Use getOutCategories() — kept for any leftover imports during transition. */
export const OUT_CATEGORIES = DEFAULT_OUT_CATEGORIES;
/** @deprecated Use getInCategories() */
export const IN_CATEGORIES = DEFAULT_IN_CATEGORIES;

export function save() {
  // Keep legacy project.spent caches aligned with Finance Out transactions
  data.projects.forEach(p => {
    p.spent = data.transactions
      .filter(t => t.type === 'Out' && t.project === p.id)
      .reduce((s, t) => s + Number(t.amount || 0), 0);
  });
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
