import { data } from '../data.js';
import { fmtMoney } from '../helpers.js';

export function render() {
  const totalBudget = data.projects.reduce((s, p) => s + Number(p.budget || 0), 0);
  const totalSpent  = data.projects.reduce((s, p) => s + Number(p.spent  || 0), 0);
  const remaining   = totalBudget - totalSpent;
  const overBudget  = data.projects.filter(p => p.spent > p.budget).length;

  document.getElementById('budgetKpiGrid').innerHTML = `
    <div class="kpi"><div class="label">Total Budget</div><div class="value">${fmtMoney(totalBudget)}</div></div>
    <div class="kpi"><div class="label">Total Spent</div><div class="value">${fmtMoney(totalSpent)}</div></div>
    <div class="kpi"><div class="label">Remaining</div><div class="value" style="color:${remaining < 0 ? 'var(--red)' : 'inherit'}">${fmtMoney(remaining)}</div></div>
    <div class="kpi"><div class="label">Over Budget</div><div class="value" style="color:${overBudget ? 'var(--red)' : 'inherit'}">${overBudget}</div><div class="note">project(s)</div></div>
  `;

  const rows = data.projects.map(p => {
    const pct  = p.budget ? Math.round(p.spent / p.budget * 100) : 0;
    const over = p.spent > p.budget;
    return `<tr>
      <td><strong>${p.name}</strong></td>
      <td>${fmtMoney(p.budget)}</td>
      <td>${fmtMoney(p.spent)}</td>
      <td style="color:${over ? 'var(--red)' : 'inherit'}">${fmtMoney(p.budget - p.spent)}</td>
      <td style="min-width:120px">
        <div class="progress-bar"><div style="width:${Math.min(100, pct)}%;background:${over ? 'var(--red)' : 'var(--accent)'}"></div></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${pct}%</div>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('budgetTable').innerHTML = data.projects.length
    ? `<table><thead><tr><th>Project</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Utilization</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty-state">No projects yet.</div>`;
}
