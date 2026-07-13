import { data, save, uid } from '../data.js';
import { fmtMoney, fmtDate, slugStatus, todayStr } from '../helpers.js';

let _renderAll, _closeModal;
export function init(renderAll, closeModal) { _renderAll = renderAll; _closeModal = closeModal; }

export function render() {
  const filter = document.getElementById('projStatusFilter').value;
  const rows = data.projects.filter(p => !filter || p.status === filter).map(p => {
    const pct = p.budget ? Math.min(100, Math.round(p.spent / p.budget * 100)) : 0;
    return `<tr>
      <td><strong>${p.name}</strong><div style="color:var(--text-muted);font-size:11.5px">${p.client || ''}</div></td>
      <td><span class="badge status-${slugStatus(p.status)}">${p.status}</span></td>
      <td><span class="badge priority-${slugStatus(p.priority)}">${p.priority}</span></td>
      <td>${fmtDate(p.start)} &rarr; ${fmtDate(p.end)}</td>
      <td style="min-width:120px">
        <div class="progress-bar"><div style="width:${pct}%;background:${pct >= 100 ? 'var(--red)' : 'var(--accent)'}"></div></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${fmtMoney(p.spent)} / ${fmtMoney(p.budget)} (${pct}%)</div>
      </td>
      <td class="actions"><button class="btn small secondary" onclick="openProjectModal('${p.id}')">Edit</button></td>
    </tr>`;
  }).join('');
  document.getElementById('projectsTable').innerHTML = data.projects.length
    ? `<table><thead><tr><th>Project</th><th>Status</th><th>Priority</th><th>Timeline</th><th>Budget</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No projects match this filter.</td></tr>'}</tbody></table>`
    : `<div class="empty-state">No projects yet. Click "+ New Project" to add one.</div>`;
}

export function openModal(id) {
  const p = id ? data.projects.find(x => x.id === id) : null;
  document.getElementById('projectModalTitle').textContent = p ? 'Edit Project' : 'New Project';
  document.getElementById('projectId').value = id || '';
  document.getElementById('projectName').value = p ? p.name : '';
  document.getElementById('projectClient').value = p ? p.client : '';
  document.getElementById('projectStart').value = p ? p.start : todayStr();
  document.getElementById('projectEnd').value = p ? p.end : todayStr();
  document.getElementById('projectStatus').value = p ? p.status : 'Active';
  document.getElementById('projectPriority').value = p ? p.priority : 'Medium';
  document.getElementById('projectBudget').value = p ? p.budget : 0;
  document.getElementById('projectSpent').value = p ? p.spent : 0;
  document.getElementById('projectDeleteBtn').style.display = p ? 'inline-block' : 'none';
  document.getElementById('projectModalOverlay').classList.add('open');
}

export function saveModal() {
  const id = document.getElementById('projectId').value;
  const name = document.getElementById('projectName').value.trim();
  if (!name) { alert('Project name is required.'); return; }
  const obj = {
    id: id || uid('p'), name,
    client: document.getElementById('projectClient').value.trim(),
    start: document.getElementById('projectStart').value || todayStr(),
    end: document.getElementById('projectEnd').value || todayStr(),
    status: document.getElementById('projectStatus').value,
    priority: document.getElementById('projectPriority').value,
    budget: Number(document.getElementById('projectBudget').value) || 0,
    spent: Number(document.getElementById('projectSpent').value) || 0
  };
  if (id) { data.projects[data.projects.findIndex(x => x.id === id)] = obj; }
  else { data.projects.push(obj); }
  save(); _closeModal('projectModalOverlay'); _renderAll();
}

export function deleteModal() {
  const id = document.getElementById('projectId').value;
  if (!id || !confirm('Delete this project and its tasks?')) return;
  data.projects = data.projects.filter(x => x.id !== id);
  data.tasks = data.tasks.filter(x => x.project !== id);
  save(); _closeModal('projectModalOverlay'); _renderAll();
}
