import { data, save, uid, LEAD_STATUSES } from '../data.js';
import { fmtMoney, todayStr, monthKey, monthLabel, memberName } from '../helpers.js';

let _renderAll, _closeModal;
export function init(renderAll, closeModal) { _renderAll = renderAll; _closeModal = closeModal; }

// ── render ────────────────────────────────────────────────────────────────────
export function render() {
  const totalPartners = data.partners.length;
  const pctPartners   = data.partners.filter(p => p.shareType === 'Percentage');
  const flatPartners  = data.partners.filter(p => p.shareType === 'Flat Rate');
  const totalEquity   = pctPartners.reduce((s, p) => s + Number(p.shareValue || 0), 0);
  const monthlyFlat   = flatPartners.reduce((s, p) => s + Number(p.shareValue || 0), 0);
  const totalPaid     = data.transactions
    .filter(t => t.type === 'Out' && t.category === 'Dividend')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  document.getElementById('partnersKpiGrid').innerHTML = `
    <div class="kpi"><div class="label">Total Partners</div><div class="value">${totalPartners}</div></div>
    <div class="kpi"><div class="label">Total Equity</div><div class="value" style="color:${totalEquity > 100 ? 'var(--red)' : 'inherit'}">${totalEquity}%</div><div class="note">${pctPartners.length} equity partner(s)</div></div>
    <div class="kpi"><div class="label">Flat-Rate / Period</div><div class="value">${fmtMoney(monthlyFlat)}</div><div class="note">${flatPartners.length} flat-rate partner(s)</div></div>
    <div class="kpi"><div class="label">Total Dividends Paid</div><div class="value" style="color:var(--red)">${fmtMoney(totalPaid)}</div></div>
  `;

  const rows = data.partners.map(p => {
    const paid = data.transactions
      .filter(t => t.type === 'Out' && t.category === 'Dividend' && t.partnerId === p.id)
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const linkedMember = p.teamMemberId ? memberName(p.teamMemberId) : '—';
    return `<tr>
      <td><strong>${p.name}</strong>${p.notes ? `<div style="color:var(--text-muted);font-size:11.5px">${p.notes}</div>` : ''}</td>
      <td>${linkedMember}</td>
      <td><span class="badge" style="background:${p.shareType === 'Percentage' ? 'var(--blue-bg)' : 'var(--green-bg)'};color:${p.shareType === 'Percentage' ? 'var(--blue)' : 'var(--green)'}">${p.shareType}</span></td>
      <td style="font-weight:600">${p.shareType === 'Percentage' ? p.shareValue + '%' : fmtMoney(p.shareValue)}</td>
      <td>${fmtMoney(paid)}</td>
      <td class="actions"><button class="btn small secondary" onclick="openPartnerModal('${p.id}')">Edit</button></td>
    </tr>`;
  }).join('');

  document.getElementById('partnersTable').innerHTML = data.partners.length
    ? `<table><thead><tr><th>Partner</th><th>Linked Team Member</th><th>Type</th><th>Share / Amount</th><th>Total Paid</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty-state">No partners yet. Click "+ New Partner" to add one.</div>`;
}

// ── partner modal ─────────────────────────────────────────────────────────────
export function openModal(id) {
  const p = id ? data.partners.find(x => x.id === id) : null;
  document.getElementById('partnerModalTitle').textContent = p ? 'Edit Partner' : 'New Partner';
  document.getElementById('partnerId').value         = id || '';
  document.getElementById('partnerName').value       = p ? p.name : '';
  document.getElementById('partnerShareType').value  = p ? p.shareType : 'Percentage';
  document.getElementById('partnerShareValue').value = p ? p.shareValue : '';
  document.getElementById('partnerNotes').value      = p ? (p.notes || '') : '';
  // populate team member select
  document.getElementById('partnerTeamMember').innerHTML =
    '<option value="">— not a team member —</option>' +
    data.team.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('partnerTeamMember').value = p ? (p.teamMemberId || '') : '';
  document.getElementById('partnerDeleteBtn').style.display = p ? 'inline-block' : 'none';
  onPartnerShareTypeChange();
  document.getElementById('partnerModalOverlay').classList.add('open');
}

export function onPartnerShareTypeChange() {
  const type = document.getElementById('partnerShareType').value;
  document.getElementById('partnerShareValueLabel').textContent =
    type === 'Percentage' ? 'Equity share (%)' : 'Fixed amount per distribution (₱)';
}

export function saveModal() {
  const id   = document.getElementById('partnerId').value;
  const name = document.getElementById('partnerName').value.trim();
  if (!name) { alert('Partner name is required.'); return; }
  const shareValue = Number(document.getElementById('partnerShareValue').value);
  if (!shareValue || shareValue <= 0) { alert('Enter a share value greater than 0.'); return; }
  const shareType = document.getElementById('partnerShareType').value;
  if (shareType === 'Percentage' && shareValue > 100) { alert('Percentage cannot exceed 100%.'); return; }
  const obj = {
    id: id || uid('prt'), name,
    teamMemberId: document.getElementById('partnerTeamMember').value,
    shareType,
    shareValue,
    notes: document.getElementById('partnerNotes').value.trim()
  };
  if (id) { data.partners[data.partners.findIndex(x => x.id === id)] = obj; }
  else { data.partners.push(obj); }
  save(); _closeModal('partnerModalOverlay'); _renderAll();
}

export function deleteModal() {
  const id = document.getElementById('partnerId').value;
  if (!id || !confirm('Delete this partner?')) return;
  data.partners = data.partners.filter(x => x.id !== id);
  save(); _closeModal('partnerModalOverlay'); _renderAll();
}

// ── run dividends modal ───────────────────────────────────────────────────────
export function openRunDividendsModal() {
  if (!data.partners.length) { alert('No partners added yet.'); return; }
  document.getElementById('dividendPeriod').value = todayStr().slice(0, 7);
  document.getElementById('dividendPool').value   = '';
  document.getElementById('dividendPoolRow').style.display =
    data.partners.some(p => p.shareType === 'Percentage') ? 'grid' : 'none';
  updateDividendPreview();
  document.getElementById('dividendModalOverlay').classList.add('open');
}

export function updateDividendPreview() {
  const pool = Number(document.getElementById('dividendPool').value) || 0;
  const rows = data.partners.map(p => {
    const amount = p.shareType === 'Percentage'
      ? pool * (p.shareValue / 100)
      : p.shareValue;
    return `<tr>
      <td>${p.name}</td>
      <td><span class="badge" style="background:${p.shareType === 'Percentage' ? 'var(--blue-bg)' : 'var(--green-bg)'};color:${p.shareType === 'Percentage' ? 'var(--blue)' : 'var(--green)'}">${p.shareType === 'Percentage' ? p.shareValue + '%' : 'Flat'}</span></td>
      <td style="font-weight:700;color:var(--red)">${fmtMoney(amount)}</td>
    </tr>`;
  }).join('');
  const total = data.partners.reduce((s, p) =>
    s + (p.shareType === 'Percentage' ? pool * (p.shareValue / 100) : p.shareValue), 0);
  document.getElementById('dividendPreview').innerHTML = `
    <table>
      <thead><tr><th>Partner</th><th>Share</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2" style="font-weight:600">Total</td><td style="font-weight:700">${fmtMoney(total)}</td></tr></tfoot>
    </table>`;
}

export function runDividends() {
  const period = document.getElementById('dividendPeriod').value;
  if (!period) { alert('Select a period.'); return; }
  const pool   = Number(document.getElementById('dividendPool').value) || 0;
  const hasPct = data.partners.some(p => p.shareType === 'Percentage');
  if (hasPct && pool <= 0) { alert('Enter a pool amount to distribute among percentage partners.'); return; }

  let created = 0;
  data.partners.forEach(p => {
    const alreadyPaid = data.transactions.some(
      t => t.category === 'Dividend' && t.partnerId === p.id && monthKey(t.date) === period
    );
    if (alreadyPaid) return;
    const amount = p.shareType === 'Percentage' ? pool * (p.shareValue / 100) : p.shareValue;
    if (amount <= 0) return;
    data.transactions.push({
      id: uid('div'),
      type: 'Out',
      category: 'Dividend',
      amount: Math.round(amount * 100) / 100,
      date: period + '-01',
      project: '',
      member: p.teamMemberId || '',
      partnerId: p.id,
      note: `Dividend — ${monthLabel(period)} — ${p.name}`
    });
    created++;
  });

  if (!created) {
    alert('Dividends for this period were already distributed to all partners.');
    return;
  }
  save(); _closeModal('dividendModalOverlay'); _renderAll();
  alert(`Distributed dividends to ${created} partner(s) for ${monthLabel(period)}.`);
}
