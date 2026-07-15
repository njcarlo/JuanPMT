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
import {
  watchAuth, login, register, logout,
  authErrorMessage, SUPERADMIN_USERNAME
} from './auth.js';

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
window.addUser           = () => settings.addUser();
window.toggleUserActive  = (uid, active) => settings.toggleUserActive(uid, active);
window.deleteUser        = uid => settings.deleteUser(uid);

const loginScreen = document.getElementById('loginScreen');
const appEl = document.getElementById('app');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginNameField = document.getElementById('loginNameField');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const toggleRegisterBtn = document.getElementById('toggleRegisterBtn');
let registerMode = false;
let firestoreUnsub = null;
let appReady = false;

function showLoginError(msg) {
  if (!msg) {
    loginError.hidden = true;
    loginError.textContent = '';
    return;
  }
  loginError.hidden = false;
  loginError.textContent = msg;
}

function setRegisterMode(on) {
  registerMode = on;
  loginNameField.hidden = !on;
  loginSubmitBtn.textContent = on ? 'Create superadmin account' : 'Sign in';
  toggleRegisterBtn.textContent = on ? 'Back to sign in' : 'Create superadmin account';
  if (on) {
    const userInput = document.getElementById('loginUsername');
    if (userInput && !userInput.value.trim()) userInput.value = SUPERADMIN_USERNAME;
  }
  showLoginError('');
}

function showApp(user) {
  loginScreen.hidden = true;
  appEl.hidden = false;
  document.getElementById('userChipName').textContent = user.name || 'User';
  document.getElementById('userChipEmail').textContent =
    (user.role === 'superadmin' ? 'Superadmin · ' : '') + (user.username || '');

  if (!appReady) {
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

    firestoreUnsub = watchFirestore(renderAll);
    appReady = true;
  }

  renderAll();
}

function showLogin(err) {
  appEl.hidden = true;
  loginScreen.hidden = false;
  if (firestoreUnsub) {
    try { firestoreUnsub(); } catch (_) {}
    firestoreUnsub = null;
  }
  if (err) showLoginError(authErrorMessage(err));
}

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  showLoginError('');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const name = document.getElementById('loginName').value.trim();
  loginSubmitBtn.disabled = true;
  try {
    let user;
    if (registerMode) {
      user = await register(username, password, name);
    } else {
      user = await login(username, password);
    }
    showApp(user);
  } catch (err) {
    showLoginError(authErrorMessage(err));
  } finally {
    loginSubmitBtn.disabled = false;
  }
});

toggleRegisterBtn.addEventListener('click', () => setRegisterMode(!registerMode));

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await logout();
  } catch (_) {}
  showLogin();
});

watchAuth((user, err) => {
  if (user) {
    showApp(user);
  } else {
    showLogin(err);
  }
});
