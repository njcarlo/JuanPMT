import { data } from '../data.js';
import {
  fmtMoney, projectSpent, projectIncome,
  totalBudget, totalProjectSpent, totalProjectIncome, unallocatedOut
} from '../helpers.js';

export function render() {
  const budget = totalBudget();
  const spent  = totalProjectSpent();
  const income = totalProjectIncome();
  const remaining = budget - spent;
  const overBudget = data.projects.filter(p => projectSpent(p.id) > Number(p.budget || 0)).length;
  const unalloc = unallocatedOut();

  document.getElementById('budgetKpiGrid').innerHTML = `
    <div class="kpi"><div class="label">Total Budget</div><div class="value">${fmtMoney(budget)}</div></div>
    <div class="kpi"><div class="label">Spent (Expenses)</div><div class="value" style="color:var(--red)">${fmtMoney(spent)}</div><div class="note">from Finance Out transactions</div></div>
    <div class="kpi"><div class="label">Received (Income)</div><div class="value" style="color:var(--green)">${fmtMoney(income)}</div><div class="note">from Finance In transactions</div></div>
    <div class="kpi"><div class="label">Remaining</div><div class="value" style="color:${remaining < 0 ? 'var(--red)' : 'inherit'}">${fmtMoney(remaining)}</div><div class="note">${overBudget ? overBudget + ' over budget' : 'budget − expenses'}${unalloc ? ' · ' + fmtMoney(unalloc) + ' unallocated' : ''}</div></div>
  `;

  const rows = data.projects.map(p => {
    const pSpent  = projectSpent(p.id);
    const pIncome = projectIncome(p.id);
    const pBudget = Number(p.budget || 0);
    const pct  = pBudget ? Math.round(pSpent / pBudget * 100) : 0;
    const over = pSpent > pBudget;
    return `<tr>
      <td><strong>${p.name}</strong></td>
      <td>${fmtMoney(pBudget)}</td>
      <td style="color:var(--red)">${fmtMoney(pSpent)}</td>
      <td style="color:var(--green)">${fmtMoney(pIncome)}</td>
      <td style="color:${over ? 'var(--red)' : 'inherit'}">${fmtMoney(pBudget - pSpent)}</td>
      <td style="min-width:120px">
        <div class="progress-bar"><div style="width:${Math.min(100, pct)}%;background:${over ? 'var(--red)' : 'var(--accent)'}"></div></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${pct}%</div>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('budgetTable').innerHTML = data.projects.length
    ? `<table><thead><tr><th>Project</th><th>Budget</th><th>Spent</th><th>Received</th><th>Remaining</th><th>Utilization</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty-state">No projects yet. Tag Finance transactions with a project to track spend here.</div>`;
}
