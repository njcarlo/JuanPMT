import { data } from './data.js';

export function fmtMoney(n) {
  return '₱' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function fmtDate(s) {
  if (!s) return '—';
  const dt = new Date(s + 'T00:00:00');
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function slugStatus(s) {
  return s.toLowerCase().replace(/\s+/g, '');
}

export function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7);
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function projectName(id) {
  const p = data.projects.find(x => x.id === id);
  return p ? p.name : '—';
}

export function memberName(id) {
  const m = data.team.find(x => x.id === id);
  return m ? m.name : '—';
}

/** Sum of Out transactions tagged to a project (true spent). */
export function projectSpent(projectId) {
  if (!projectId) return 0;
  return data.transactions
    .filter(t => t.type === 'Out' && t.project === projectId)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
}

/** Sum of In transactions tagged to a project. */
export function projectIncome(projectId) {
  if (!projectId) return 0;
  return data.transactions
    .filter(t => t.type === 'In' && t.project === projectId)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
}

export function totalBudget() {
  return data.projects.reduce((s, p) => s + Number(p.budget || 0), 0);
}

export function totalProjectSpent() {
  return data.projects.reduce((s, p) => s + projectSpent(p.id), 0);
}

export function totalProjectIncome() {
  return data.projects.reduce((s, p) => s + projectIncome(p.id), 0);
}

/** All Out transactions (including unallocated). */
export function totalOut() {
  return data.transactions
    .filter(t => t.type === 'Out')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
}

/** All In transactions. */
export function totalIn() {
  return data.transactions
    .filter(t => t.type === 'In')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
}

export function financeNet() {
  return totalIn() - totalOut();
}

/** Out expenses not linked to any project. */
export function unallocatedOut() {
  return data.transactions
    .filter(t => t.type === 'Out' && !t.project)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
}

export function statusColor(status) {
  const map = {
    'Active': 'var(--blue)', 'In Progress': 'var(--blue)',
    'On Hold': 'var(--amber)', 'Review': 'var(--amber)',
    'At Risk': 'var(--red)',
    'Completed': 'var(--green)', 'Done': 'var(--green)',
    'To Do': 'var(--gray)'
  };
  return map[status] || 'var(--gray)';
}
