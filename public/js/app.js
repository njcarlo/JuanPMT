import * as overview  from './modules/overview.js';
import * as projects  from './modules/projects.js';
import * as tasks     from './modules/tasks.js';
import * as timeline  from './modules/timeline.js';
import * as team      from './modules/team.js';
import * as budget    from './modules/budget.js';
import * as finance   from './modules/finance.js';
import * as leads     from './modules/leads.js';
import * as partners  from './modules/partners.js';
import * as settings  from './modules/settings.js';
import { watchFirestore } from './data.js';

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function renderAll() {
  overview.render();
  projects.render();
  tasks.render();
  timeline.render();
  team.render();
  budget.render();
  finance.render();
  leads.render();
  partners.render();
  settings.render();
}

projects.init(renderAll, closeModal);
tasks.init(renderAll, closeModal);
team.init(renderAll, closeModal);
finance.init(renderAll, closeModal);
leads.init(renderAll, closeModal);
partners.init(renderAll, closeModal);
settings.init(renderAll);

window.closeModal            = closeModal;
window.openProjectModal      = id => projects.openModal(id);
window.saveProject           = ()  => projects.saveModal();
window.deleteProject         = ()  => projects.deleteModal();
window.openTaskModal         = id => tasks.openModal(id);
window.saveTask              = ()  => tasks.saveModal();
window.deleteTask            = ()  => tasks.deleteModal();
window.openTeamModal         = id => team.openModal(id);
window.saveTeamMember        = ()  => team.saveModal();
window.deleteTeamMember      = ()  => team.deleteModal();
window.openTransactionModal  = id => finance.openModal(id);
window.saveTransaction       = ()  => finance.saveModal();
window.deleteTransaction     = ()  => finance.deleteModal();
window.runPayroll            = ()  => finance.runPayroll();
window.onTxnTypeChange       = ()  => finance.onTxnTypeChange();
window.openLeadModal         = id => leads.openModal(id);
window.saveLead              = ()  => leads.saveModal();
window.deleteLead            = ()  => leads.deleteModal();
window.openPartnerModal      = id => partners.openModal(id);
window.savePartner           = ()  => partners.saveModal();
window.deletePartner         = ()  => partners.deleteModal();
window.openRunDividendsModal = ()  => partners.openRunDividendsModal();
window.runDividends          = ()  => partners.runDividends();
window.updateDividendPreview = ()  => partners.updateDividendPreview();
window.onPartnerShareTypeChange = () => partners.onPartnerShareTypeChange();
window.addCategory    = kind => settings.addCategory(kind);
window.renameCategory = (kind, index) => settings.renameCategory(kind, index);
window.deleteCategory = (kind, index) => settings.deleteCategory(kind, index);

document.getElementById('tabs').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  renderAll();
});

document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
});

document.getElementById('projStatusFilter').addEventListener('change',  projects.render);
document.getElementById('taskProjectFilter').addEventListener('change', tasks.render);
document.getElementById('taskOwnerFilter').addEventListener('change',   tasks.render);
document.getElementById('taskStatusFilter').addEventListener('change',  tasks.render);
document.getElementById('txnTypeFilter').addEventListener('change',     finance.render);
document.getElementById('txnCategoryFilter').addEventListener('change', finance.render);
document.getElementById('txnProjectFilter').addEventListener('change',  finance.render);
document.getElementById('leadStatusFilter').addEventListener('change',  leads.render);
document.getElementById('leadSourceFilter').addEventListener('change',  leads.render);
document.getElementById('leadOwnerFilter').addEventListener('change',   leads.render);

// Real-time Firestore sync — updates any device when another saves
watchFirestore(renderAll);

renderAll();
