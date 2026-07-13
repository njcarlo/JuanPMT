import { data, save, uid, getOutCategories, getInCategories } from '../data.js';
import { fmtMoney, fmtDate, todayStr, monthKey, monthLabel, projectName, memberName } from '../helpers.js';
import { charts, destroyChart } from '../charts.js';

let _renderAll, _closeModal;
export function init(renderAll, closeModal) { _renderAll = renderAll; _closeModal = closeModal; }

function populateFilterOptions() {
  const catSel  = document.getElementById('txnCategoryFilter');
  const projSel = document.getElementById('txnProjectFilter');
  const curCat = catSel.value, curProj = projSel.value;
  const known = [...getOutCategories(), ...getInCategories()];
  const fromTxns = [...new Set(data.transactions.map(t => t.category).filter(Boolean))];
  const allCats = [...known, ...fromTxns.filter(c => !known.includes(c))];
  catSel.innerHTML  = '<option value="">All categories</option>' + allCats.map(c => `<option>${c}</option>`).join('');
  projSel.innerHTML = '<option value="">All projects</option>' + data.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  catSel.value = curCat; projSel.value = curProj;
}

export function onTxnTypeChange() {
  const type = document.getElementById('txnType').value;
  const cats = type === 'In' ? getInCategories() : getOutCategories();
  document.getElementById('txnCategory').innerHTML = cats.map(c => `<option>${c}</option>`).join('');
}

function ensureCategoryOption(category) {
  if (!category) return;
  const sel = document.getElementById('txnCategory');
  if (![...sel.options].some(o => o.value === category)) {
    const opt = document.createElement('option');
    opt.value = category;
    opt.textContent = category;
    sel.appendChild(opt);
  }
}

export function render() {
  populateFilterOptions();
  const totalIn  = data.transactions.filter(t => t.type === 'In').reduce((s, t)  => s + Number(t.amount || 0), 0);
  const totalOut = data.transactions.filter(t => t.type === 'Out').reduce((s, t) => s + Number(t.amount || 0), 0);
  const net      = totalIn - totalOut;
  const monthlyPayroll = data.team.reduce((s, m) => s + Number(m.salary || 0), 0);

  document.getElementById('financeKpiGrid').innerHTML = `
    <div class="kpi"><div class="label">Total In</div><div class="value" style="color:var(--green)">${fmtMoney(totalIn)}</div></div>
    <div class="kpi"><div class="label">Total Out</div><div class="value" style="color:var(--red)">${fmtMoney(totalOut)}</div></div>
    <div class="kpi"><div class="label">Net</div><div class="value" style="color:${net < 0 ? 'var(--red)' : 'var(--green)'}">${fmtMoney(net)}</div></div>
    <div class="kpi"><div class="label">Monthly Payroll</div><div class="value">${fmtMoney(monthlyPayroll)}</div><div class="note">${data.team.filter(m => Number(m.salary || 0) > 0).length} salaried</div></div>
  `;

  const months     = [...new Set(data.transactions.map(t => monthKey(t.date)))].sort();
  const inByMonth  = months.map(mk => data.transactions.filter(t => t.type === 'In'  && monthKey(t.date) === mk).reduce((s, t) => s + Number(t.amount || 0), 0));
  const outByMonth = months.map(mk => data.transactions.filter(t => t.type === 'Out' && monthKey(t.date) === mk).reduce((s, t) => s + Number(t.amount || 0), 0));
  destroyChart('inOut');
  charts.inOut = new Chart(document.getElementById('chartInOut'), {
    type: 'bar',
    data: { labels: months.map(monthLabel), datasets: [{ label: 'In', data: inByMonth, backgroundColor: '#16a34a' }, { label: 'Out', data: outByMonth, backgroundColor: '#dc2626' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { beginAtZero: true } } }
  });

  const knownOut = getOutCategories();
  const orphanOut = [...new Set(data.transactions.filter(t => t.type === 'Out' && t.category && !knownOut.includes(t.category)).map(t => t.category))];
  const expenseCats   = [...knownOut, ...orphanOut].filter(c => data.transactions.some(t => t.type === 'Out' && t.category === c));
  const expenseTotals = expenseCats.map(c => data.transactions.filter(t => t.type === 'Out' && t.category === c).reduce((s, t) => s + Number(t.amount || 0), 0));
  destroyChart('expenseCategory');
  charts.expenseCategory = new Chart(document.getElementById('chartExpenseCategory'), {
    type: 'doughnut',
    data: { labels: expenseCats, datasets: [{ data: expenseTotals, backgroundColor: ['#dc2626','#d97706','#4f46e5','#2563eb','#9333ea','#0891b2','#6b7280'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });

  const tf = document.getElementById('txnTypeFilter').value;
  const cf = document.getElementById('txnCategoryFilter').value;
  const pf = document.getElementById('txnProjectFilter').value;
  const list = data.transactions.filter(t => (!tf || t.type === tf) && (!cf || t.category === cf) && (!pf || t.project === pf)).sort((a, b) => b.date.localeCompare(a.date));
  const rows = list.map(t => `<tr>
    <td>${fmtDate(t.date)}</td>
    <td><span class="badge" style="background:${t.type === 'In' ? 'var(--green-bg)' : 'var(--red-bg)'};color:${t.type === 'In' ? 'var(--green)' : 'var(--red)'}">${t.type}</span></td>
    <td>${t.category}</td>
    <td style="color:${t.type === 'In' ? 'var(--green)' : 'var(--red)'};font-weight:700">${t.type === 'In' ? '+' : '-'}${fmtMoney(t.amount)}</td>
    <td>${t.project ? projectName(t.project) : '—'}</td>
    <td>${t.member ? memberName(t.member) : '—'}</td>
    <td style="color:var(--text-muted)">${t.note || ''}</td>
    <td class="actions"><button class="btn small secondary" onclick="openTransactionModal('${t.id}')">Edit</button></td>
  </tr>`).join('');
  document.getElementById('financeTable').innerHTML = data.transactions.length
    ? `<table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Project</th><th>Member</th><th>Note</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No transactions match this filter.</td></tr>'}</tbody></table>`
    : `<div class="empty-state">No transactions yet. Click "+ New Transaction" to log income or an expense.</div>`;
}

export function runPayroll() {
  const salaried = data.team.filter(m => Number(m.salary || 0) > 0);
  if (!salaried.length) { alert('No team members have a monthly salary set.'); return; }
  const mk = monthKey(todayStr());
  let created = 0;
  salaried.forEach(m => {
    if (data.transactions.some(t => t.category === 'Salary' && t.member === m.id && monthKey(t.date) === mk)) return;
    data.transactions.push({ id: uid('f'), type: 'Out', category: 'Salary', amount: Number(m.salary), date: todayStr(), project: '', member: m.id, note: `Payroll — ${monthLabel(mk)}` });
    created++;
  });
  save(); _renderAll();
  alert(created ? `Logged payroll for ${created} team member(s).` : 'Payroll for this month was already logged for everyone.');
}

export function openModal(id) {
  const t = id ? data.transactions.find(x => x.id === id) : null;
  document.getElementById('transactionModalTitle').textContent = t ? 'Edit Transaction' : 'New Transaction';
  document.getElementById('txnId').value = id || '';
  document.getElementById('txnType').value = t ? t.type : 'Out';
  onTxnTypeChange();
  if (t) ensureCategoryOption(t.category);
  const outCats = getOutCategories();
  document.getElementById('txnCategory').value = t ? t.category : (outCats[0] || '');
  document.getElementById('txnAmount').value = t ? t.amount : '';
  document.getElementById('txnDate').value = t ? t.date : todayStr();
  document.getElementById('txnProject').innerHTML = '<option value="">&mdash;</option>' + data.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('txnMember').innerHTML  = '<option value="">&mdash;</option>' + data.team.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('txnProject').value = t ? (t.project || '') : '';
  document.getElementById('txnMember').value  = t ? (t.member  || '') : '';
  document.getElementById('txnNote').value    = t ? (t.note    || '') : '';
  document.getElementById('txnDeleteBtn').style.display = t ? 'inline-block' : 'none';
  document.getElementById('transactionModalOverlay').classList.add('open');
}

export function saveModal() {
  const id = document.getElementById('txnId').value;
  const amount = Number(document.getElementById('txnAmount').value);
  if (!amount || amount <= 0) { alert('Enter an amount greater than 0.'); return; }
  const obj = {
    id: id || uid('f'),
    type: document.getElementById('txnType').value,
    category: document.getElementById('txnCategory').value,
    amount,
    date: document.getElementById('txnDate').value || todayStr(),
    project: document.getElementById('txnProject').value,
    member: document.getElementById('txnMember').value,
    note: document.getElementById('txnNote').value.trim()
  };
  if (id) { data.transactions[data.transactions.findIndex(x => x.id === id)] = obj; }
  else { data.transactions.push(obj); }
  save(); _closeModal('transactionModalOverlay'); _renderAll();
}

export function deleteModal() {
  const id = document.getElementById('txnId').value;
  if (!id || !confirm('Delete this transaction?')) return;
  data.transactions = data.transactions.filter(x => x.id !== id);
  save(); _closeModal('transactionModalOverlay'); _renderAll();
}
