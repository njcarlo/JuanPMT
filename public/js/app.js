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
import { watchFirestore } from './data.js?v=20260715g';
import {
  watchAuth, login, register, logout,
  authErrorMessage, SUPERADMIN_USERNAME
} from './auth.js?v=20260715g';

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
      try { renderAll(); } catch (err) { console.error(err); }
    });

    document.querySelectorAll('.modal-overlay').forEach(ov => {
      ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    });

    document.getElementById('projStatusFilter').addEventListener('change',  () => { try { projects.render(); } catch (e) { console.error(e); } });
    document.getElementById('taskProjectFilter').addEventListener('change', () => { try { tasks.render(); } catch (e) { console.error(e); } });
    document.getElementById('taskOwnerFilter').addEventListener('change',   () => { try { tasks.render(); } catch (e) { console.error(e); } });
    document.getElementById('taskStatusFilter').addEventListener('change',  () => { try { tasks.render(); } catch (e) { console.error(e); } });
    document.getElementById('txnTypeFilter').addEventListener('change',     () => { try { finance.render(); } catch (e) { console.error(e); } });
    document.getElementById('txnCategoryFilter').addEventListener('change', () => { try { finance.render(); } catch (e) { console.error(e); } });
    document.getElementById('txnProjectFilter').addEventListener('change',  () => { try { finance.render(); } catch (e) { console.error(e); } });
    document.getElementById('leadStatusFilter').addEventListener('change',  () => { try { leads.render(); } catch (e) { console.error(e); } });
    document.getElementById('leadSourceFilter').addEventListener('change',  () => { try { leads.render(); } catch (e) { console.error(e); } });
    document.getElementById('leadOwnerFilter').addEventListener('change',   () => { try { leads.render(); } catch (e) { console.error(e); } });

    try {
      firestoreUnsub = watchFirestore(() => {
        try { renderAll(); } catch (err) { console.error(err); }
      });
    } catch (err) {
      console.error('watchFirestore failed', err);
    }
    appReady = true;
  }

  try {
    renderAll();
  } catch (err) {
    console.error('renderAll failed', err);
  }
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
  e.stopPropagation();
  showLoginError('');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const name = document.getElementById('loginName').value.trim();
  if (!username || !password) {
    showLoginError('Enter username and password.');
    return;
  }
  const prevLabel = registerMode ? 'Create superadmin account' : 'Sign in';
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = registerMode ? 'Creating…' : 'Signing in…';
  // Owner temp password unlocks locally — no DB wait message
  const looksLikeOfflineOwner =
    !registerMode &&
    username.trim().toLowerCase().replace(/@.*$/, '') === 'njcarlo' &&
    password === 'password';
  showLoginError(
    registerMode ? 'Creating account…' :
    looksLikeOfflineOwner ? 'Signing in…' :
    'Contacting database…'
  );
  let user = null;
  try {
    if (registerMode) {
      user = await register(username, password, name);
    } else {
      user = await login(username, password);
    }
  } catch (err) {
    console.error('Login failed', err);
    showLoginError(authErrorMessage(err));
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = prevLabel;
    delete loginSubmitBtn.dataset.busy;
    return;
  }

  loginSubmitBtn.disabled = false;
  loginSubmitBtn.textContent = prevLabel;
  delete loginSubmitBtn.dataset.busy;

  try {
    showApp(user);
  } catch (err) {
    console.error('App render failed', err);
    showLoginError('Signed in, but the app failed to open: ' + (err?.message || err));
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
  window.__juanpmtReady = true;
  if (user) {
    showApp(user);
    return;
  }
  // If a session still exists, prefer it over bouncing to login (boot/module race)
  try {
    const raw = localStorage.getItem('juanpmt_session_v1');
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && cached.username) {
        showApp({
          username: cached.username,
          name: cached.name || cached.username,
          role: cached.role || 'user',
          active: true
        });
        return;
      }
    }
  } catch (_) {}
  showLogin(err);
});
