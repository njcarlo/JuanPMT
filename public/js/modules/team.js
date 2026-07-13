import { data, save, uid } from '../data.js';
import { fmtMoney } from '../helpers.js';
import { charts, destroyChart } from '../charts.js';

let _renderAll, _closeModal;
export function init(renderAll, closeModal) { _renderAll = renderAll; _closeModal = closeModal; }

function taskLoadFor(memberId) {
  return data.tasks.filter(t => t.owner === memberId && t.status !== 'Done').reduce((s, t) => s + Number(t.hours || 0), 0);
}

export function render() {
  destroyChart('workload');
  charts.workload = new Chart(document.getElementById('chartWorkload'), {
    type: 'bar',
    data: {
      labels: data.team.map(m => m.name),
      datasets: [
        { label: 'Assigned (open tasks, hrs)', data: data.team.map(m => taskLoadFor(m.id)), backgroundColor: '#4f46e5' },
        { label: 'Weekly capacity (hrs)',       data: data.team.map(m => m.capacity),        backgroundColor: '#e5e7eb' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { beginAtZero: true } } }
  });

  const rows = data.team.map(m => {
    const load = taskLoadFor(m.id);
    const pct  = m.capacity ? Math.round(load / m.capacity * 100) : 0;
    const openTasks = data.tasks.filter(t => t.owner === m.id && t.status !== 'Done').length;
    return `<tr>
      <td><strong>${m.name}</strong></td><td>${m.role || '—'}</td><td>${openTasks}</td>
      <td style="min-width:140px">
        <div class="progress-bar"><div style="width:${Math.min(100, pct)}%;background:${pct > 100 ? 'var(--red)' : 'var(--accent)'}"></div></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${load}h / ${m.capacity}h (${pct}%)</div>
      </td>
      <td>${m.salary ? fmtMoney(m.salary) + '/mo' : '—'}</td>
      <td class="actions"><button class="btn small secondary" onclick="openTeamModal('${m.id}')">Edit</button></td>
    </tr>`;
  }).join('');
  document.getElementById('teamTable').innerHTML = data.team.length
    ? `<table><thead><tr><th>Name</th><th>Role</th><th>Open Tasks</th><th>Workload</th><th>Salary</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty-state">No team members yet.</div>`;
}

export function openModal(id) {
  const m = id ? data.team.find(x => x.id === id) : null;
  document.getElementById('teamModalTitle').textContent = m ? 'Edit Team Member' : 'New Team Member';
  document.getElementById('teamId').value = id || '';
  document.getElementById('teamName').value = m ? m.name : '';
  document.getElementById('teamRole').value = m ? m.role : '';
  document.getElementById('teamCapacity').value = m ? m.capacity : 40;
  document.getElementById('teamSalary').value = m ? (m.salary || 0) : 0;
  document.getElementById('teamDeleteBtn').style.display = m ? 'inline-block' : 'none';
  document.getElementById('teamModalOverlay').classList.add('open');
}

export function saveModal() {
  const id = document.getElementById('teamId').value;
  const name = document.getElementById('teamName').value.trim();
  if (!name) { alert('Name is required.'); return; }
  const obj = {
    id: id || uid('t'), name,
    role: document.getElementById('teamRole').value.trim(),
    capacity: Number(document.getElementById('teamCapacity').value) || 40,
    salary: Number(document.getElementById('teamSalary').value) || 0
  };
  if (id) { data.team[data.team.findIndex(x => x.id === id)] = obj; }
  else { data.team.push(obj); }
  save(); _closeModal('teamModalOverlay'); _renderAll();
}

export function deleteModal() {
  const id = document.getElementById('teamId').value;
  if (!id || !confirm('Delete this team member? Their tasks will be unassigned.')) return;
  data.team = data.team.filter(x => x.id !== id);
  save(); _closeModal('teamModalOverlay'); _renderAll();
}
