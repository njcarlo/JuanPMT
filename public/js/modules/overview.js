import { data } from '../data.js';
import { fmtMoney, fmtDate, daysBetween, todayStr, slugStatus, projectName, memberName } from '../helpers.js';
import { charts, destroyChart } from '../charts.js';

export function render() {
  const activeProjects = data.projects.filter(p => p.status === 'Active').length;
  const overdue = data.tasks.filter(t => t.status !== 'Done' && t.due < todayStr()).length;
  const dueSoon = data.tasks.filter(t => t.status !== 'Done' && t.due >= todayStr() && daysBetween(todayStr(), t.due) <= 7).length;
  const totalBudget = data.projects.reduce((s, p) => s + Number(p.budget || 0), 0);
  const totalSpent  = data.projects.reduce((s, p) => s + Number(p.spent  || 0), 0);
  const util = totalBudget ? Math.round(totalSpent / totalBudget * 100) : 0;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi"><div class="label">Active Projects</div><div class="value">${activeProjects}</div><div class="note">${data.projects.length} total</div></div>
    <div class="kpi"><div class="label">Overdue Tasks</div><div class="value" style="color:${overdue ? 'var(--red)' : 'inherit'}">${overdue}</div><div class="note">needs attention</div></div>
    <div class="kpi"><div class="label">Due in 7 Days</div><div class="value">${dueSoon}</div><div class="note">upcoming</div></div>
    <div class="kpi"><div class="label">Budget Utilization</div><div class="value">${util}%</div><div class="note">${fmtMoney(totalSpent)} / ${fmtMoney(totalBudget)}</div></div>
  `;

  const statuses = ['To Do', 'In Progress', 'Review', 'Done'];
  const counts = statuses.map(s => data.tasks.filter(t => t.status === s).length);
  destroyChart('taskStatus');
  charts.taskStatus = new Chart(document.getElementById('chartTaskStatus'), {
    type: 'doughnut',
    data: { labels: statuses, datasets: [{ data: counts, backgroundColor: ['#9ca3af', '#2563eb', '#d97706', '#16a34a'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });

  destroyChart('budget');
  charts.budget = new Chart(document.getElementById('chartBudget'), {
    type: 'bar',
    data: {
      labels: data.projects.map(p => p.name),
      datasets: [
        { label: 'Budget', data: data.projects.map(p => p.budget), backgroundColor: '#c7d2fe' },
        { label: 'Spent',  data: data.projects.map(p => p.spent),  backgroundColor: '#4f46e5' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true } } }
  });

  const upcoming = data.tasks
    .filter(t => t.status !== 'Done' && daysBetween(todayStr(), t.due) <= 14)
    .sort((a, b) => a.due.localeCompare(b.due));
  const rows = upcoming.map(t => {
    const overdueRow = t.due < todayStr();
    return `<tr>
      <td>${t.name}</td><td>${projectName(t.project)}</td><td>${memberName(t.owner)}</td>
      <td style="color:${overdueRow ? 'var(--red)' : 'inherit'};font-weight:${overdueRow ? 700 : 400}">${fmtDate(t.due)}${overdueRow ? ' (overdue)' : ''}</td>
      <td><span class="badge status-${slugStatus(t.status)}">${t.status}</span></td>
    </tr>`;
  }).join('');
  document.getElementById('upcomingTasksTable').innerHTML = upcoming.length
    ? `<table><thead><tr><th>Task</th><th>Project</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty-state">Nothing due in the next 14 days.</div>`;
}
