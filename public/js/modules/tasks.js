import { data, save, uid } from '../data.js';
import { fmtDate, slugStatus, todayStr, projectName, memberName } from '../helpers.js';

let _renderAll, _closeModal;
export function init(renderAll, closeModal) { _renderAll = renderAll; _closeModal = closeModal; }

function populateFilterOptions() {
  const projSel = document.getElementById('taskProjectFilter');
  const ownerSel = document.getElementById('taskOwnerFilter');
  const curProj = projSel.value, curOwner = ownerSel.value;
  projSel.innerHTML = '<option value="">All projects</option>' + data.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  ownerSel.innerHTML = '<option value="">All owners</option>' + data.team.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  projSel.value = curProj; ownerSel.value = curOwner;
}

export function render() {
  populateFilterOptions();
  const pf = document.getElementById('taskProjectFilter').value;
  const of = document.getElementById('taskOwnerFilter').value;
  const sf = document.getElementById('taskStatusFilter').value;
  const list = data.tasks
    .filter(t => (!pf || t.project === pf) && (!of || t.owner === of) && (!sf || t.status === sf))
    .sort((a, b) => a.due.localeCompare(b.due));
  const rows = list.map(t => {
    const overdueRow = t.status !== 'Done' && t.due < todayStr();
    return `<tr>
      <td>${t.name}</td><td>${projectName(t.project)}</td><td>${memberName(t.owner)}</td>
      <td style="color:${overdueRow ? 'var(--red)' : 'inherit'};font-weight:${overdueRow ? 700 : 400}">${fmtDate(t.due)}</td>
      <td><span class="badge status-${slugStatus(t.status)}">${t.status}</span></td>
      <td><span class="badge priority-${slugStatus(t.priority)}">${t.priority}</span></td>
      <td>${t.hours || 0}h</td>
      <td class="actions"><button class="btn small secondary" onclick="openTaskModal('${t.id}')">Edit</button></td>
    </tr>`;
  }).join('');
  document.getElementById('tasksTable').innerHTML = data.tasks.length
    ? `<table><thead><tr><th>Task</th><th>Project</th><th>Owner</th><th>Due</th><th>Status</th><th>Priority</th><th>Est.</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No tasks match this filter.</td></tr>'}</tbody></table>`
    : `<div class="empty-state">No tasks yet. Click "+ New Task" to add one.</div>`;
}

export function openModal(id) {
  document.getElementById('taskProject').innerHTML = data.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('') || '<option value="">No projects</option>';
  document.getElementById('taskOwner').innerHTML = data.team.map(m => `<option value="${m.id}">${m.name}</option>`).join('') || '<option value="">No team members</option>';
  const t = id ? data.tasks.find(x => x.id === id) : null;
  document.getElementById('taskModalTitle').textContent = t ? 'Edit Task' : 'New Task';
  document.getElementById('taskId').value = id || '';
  document.getElementById('taskName').value = t ? t.name : '';
  document.getElementById('taskProject').value = t ? t.project : (data.projects[0]?.id || '');
  document.getElementById('taskOwner').value = t ? t.owner : (data.team[0]?.id || '');
  document.getElementById('taskDue').value = t ? t.due : todayStr();
  document.getElementById('taskStatus').value = t ? t.status : 'To Do';
  document.getElementById('taskPriority').value = t ? t.priority : 'Medium';
  document.getElementById('taskHours').value = t ? t.hours : 4;
  document.getElementById('taskDeleteBtn').style.display = t ? 'inline-block' : 'none';
  document.getElementById('taskModalOverlay').classList.add('open');
}

export function saveModal() {
  const id = document.getElementById('taskId').value;
  const name = document.getElementById('taskName').value.trim();
  if (!name) { alert('Task name is required.'); return; }
  if (!data.projects.length) { alert('Create a project first.'); return; }
  if (!data.team.length) { alert('Add a team member first.'); return; }
  const obj = {
    id: id || uid('k'), name,
    project: document.getElementById('taskProject').value,
    owner: document.getElementById('taskOwner').value,
    due: document.getElementById('taskDue').value || todayStr(),
    status: document.getElementById('taskStatus').value,
    priority: document.getElementById('taskPriority').value,
    hours: Number(document.getElementById('taskHours').value) || 0
  };
  if (id) { data.tasks[data.tasks.findIndex(x => x.id === id)] = obj; }
  else { data.tasks.push(obj); }
  save(); _closeModal('taskModalOverlay'); _renderAll();
}

export function deleteModal() {
  const id = document.getElementById('taskId').value;
  if (!id || !confirm('Delete this task?')) return;
  data.tasks = data.tasks.filter(x => x.id !== id);
  save(); _closeModal('taskModalOverlay'); _renderAll();
}
