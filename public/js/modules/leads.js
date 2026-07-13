import { data, save, uid, LEAD_STATUSES } from '../data.js';
import { fmtMoney, todayStr, memberName } from '../helpers.js';
import { charts, destroyChart } from '../charts.js';

let _renderAll, _closeModal;
export function init(renderAll, closeModal) { _renderAll = renderAll; _closeModal = closeModal; }

export function render() {
  const total         = data.leads.length;
  const pipeline      = data.leads.filter(l => !['Won', 'Lost'].includes(l.status));
  const pipelineValue = pipeline.reduce((s, l) => s + Number(l.value || 0), 0);
  const won           = data.leads.filter(l => l.status === 'Won');
  const wonValue      = won.reduce((s, l) => s + Number(l.value || 0), 0);
  const winRate       = total ? Math.round(won.length / total * 100) : 0;

  document.getElementById('leadsKpiGrid').innerHTML = `
    <div class="kpi"><div class="label">Total Leads</div><div class="value">${total}</div></div>
    <div class="kpi"><div class="label">Pipeline Value</div><div class="value">${fmtMoney(pipelineValue)}</div><div class="note">${pipeline.length} open leads</div></div>
    <div class="kpi"><div class="label">Won Value</div><div class="value" style="color:var(--green)">${fmtMoney(wonValue)}</div><div class="note">${won.length} won</div></div>
    <div class="kpi"><div class="label">Win Rate</div><div class="value">${winRate}%</div><div class="note">of all leads</div></div>
  `;

  const statusColors = ['#9ca3af','#2563eb','#15803d','#d97706','#16a34a','#dc2626'];
  destroyChart('leadStatus');
  charts.leadStatus = new Chart(document.getElementById('chartLeadStatus'), {
    type: 'doughnut',
    data: { labels: LEAD_STATUSES, datasets: [{ data: LEAD_STATUSES.map(s => data.leads.filter(l => l.status === s).length), backgroundColor: statusColors }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });

  destroyChart('leadValue');
  charts.leadValue = new Chart(document.getElementById('chartLeadValue'), {
    type: 'bar',
    data: { labels: LEAD_STATUSES, datasets: [{ label: 'Value ($)', data: LEAD_STATUSES.map(s => data.leads.filter(l => l.status === s).reduce((sum, l) => sum + Number(l.value || 0), 0)), backgroundColor: statusColors }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  const ownerSel  = document.getElementById('leadOwnerFilter');
  const curOwner  = ownerSel.value;
  ownerSel.innerHTML = '<option value="">All assignees</option>' + data.team.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  ownerSel.value  = curOwner;

  const sf   = document.getElementById('leadStatusFilter').value;
  const srcf = document.getElementById('leadSourceFilter').value;
  const of   = document.getElementById('leadOwnerFilter').value;
  const list = data.leads
    .filter(l => (!sf || l.status === sf) && (!srcf || l.source === srcf) && (!of || l.assignedTo === of))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = list.map(l => `<tr>
    <td><strong>${l.name}</strong>${l.contact ? `<div style="color:var(--text-muted);font-size:11.5px">${l.contact}</div>` : ''}</td>
    <td>${l.email ? `<a href="mailto:${l.email}" style="color:var(--accent)">${l.email}</a>` : '—'}</td>
    <td>${l.phone || '—'}</td>
    <td><span class="badge lead-${l.status.toLowerCase()}">${l.status}</span></td>
    <td>${l.source || '—'}</td>
    <td style="font-weight:600">${l.value ? fmtMoney(l.value) : '—'}</td>
    <td>${l.assignedTo ? memberName(l.assignedTo) : '—'}</td>
    <td style="color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.notes || ''}</td>
    <td class="actions"><button class="btn small secondary" onclick="openLeadModal('${l.id}')">Edit</button></td>
  </tr>`).join('');
  document.getElementById('leadsTable').innerHTML = data.leads.length
    ? `<table><thead><tr><th>Lead</th><th>Email</th><th>Phone</th><th>Status</th><th>Source</th><th>Value</th><th>Assigned</th><th>Notes</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">No leads match this filter.</td></tr>'}</tbody></table>`
    : `<div class="empty-state">No leads yet. Click "+ New Lead" to add one.</div>`;
}

export function openModal(id) {
  const l = id ? data.leads.find(x => x.id === id) : null;
  document.getElementById('leadModalTitle').textContent = l ? 'Edit Lead' : 'New Lead';
  document.getElementById('leadId').value        = id || '';
  document.getElementById('leadName').value      = l ? l.name        : '';
  document.getElementById('leadContact').value   = l ? (l.contact  || '') : '';
  document.getElementById('leadEmail').value     = l ? (l.email    || '') : '';
  document.getElementById('leadPhone').value     = l ? (l.phone    || '') : '';
  document.getElementById('leadStatus').value    = l ? l.status       : 'New';
  document.getElementById('leadSource').value    = l ? l.source       : 'Referral';
  document.getElementById('leadValue').value     = l ? (l.value    || '') : '';
  document.getElementById('leadNotes').value     = l ? (l.notes    || '') : '';
  document.getElementById('leadAssignedTo').innerHTML = '<option value="">&mdash;</option>' + data.team.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('leadAssignedTo').value = l ? (l.assignedTo || '') : '';
  document.getElementById('leadDeleteBtn').style.display = l ? 'inline-block' : 'none';
  document.getElementById('leadModalOverlay').classList.add('open');
}

export function saveModal() {
  const id   = document.getElementById('leadId').value;
  const name = document.getElementById('leadName').value.trim();
  if (!name) { alert('Lead name is required.'); return; }
  const obj = {
    id: id || uid('l'), name,
    contact:    document.getElementById('leadContact').value.trim(),
    email:      document.getElementById('leadEmail').value.trim(),
    phone:      document.getElementById('leadPhone').value.trim(),
    status:     document.getElementById('leadStatus').value,
    source:     document.getElementById('leadSource').value,
    value:      Number(document.getElementById('leadValue').value) || 0,
    assignedTo: document.getElementById('leadAssignedTo').value,
    notes:      document.getElementById('leadNotes').value.trim(),
    createdAt:  id ? (data.leads.find(x => x.id === id)?.createdAt || todayStr()) : todayStr()
  };
  if (id) { data.leads[data.leads.findIndex(x => x.id === id)] = obj; }
  else { data.leads.push(obj); }
  save(); _closeModal('leadModalOverlay'); _renderAll();
}

export function deleteModal() {
  const id = document.getElementById('leadId').value;
  if (!id || !confirm('Delete this lead?')) return;
  data.leads = data.leads.filter(x => x.id !== id);
  save(); _closeModal('leadModalOverlay'); _renderAll();
}
