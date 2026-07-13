import {
  data, save,
  getOutCategories, getInCategories,
  PROTECTED_OUT_CATEGORIES
} from '../data.js';

let _renderAll;

export function init(renderAll) {
  _renderAll = renderAll;
  ['newOutCategory', 'newInCategory'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      addCategory(id === 'newOutCategory' ? 'out' : 'in');
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function usageCount(category, type) {
  return data.transactions.filter(t => t.category === category && t.type === type).length;
}

function renderList(kind) {
  const isOut = kind === 'out';
  const list = isOut ? getOutCategories() : getInCategories();
  const type = isOut ? 'Out' : 'In';
  const el = document.getElementById(isOut ? 'settingsOutCategories' : 'settingsInCategories');

  if (!list.length) {
    el.innerHTML = `<div class="empty-state" style="padding:24px">No categories yet.</div>`;
    return;
  }

  const rows = list.map((name, idx) => {
    const used = usageCount(name, type);
    const protectedCat = isOut && PROTECTED_OUT_CATEGORIES.includes(name);
    const deleteDisabled = protectedCat
      ? 'disabled title="Required by payroll / dividends"'
      : used
        ? `title="Used by ${used} transaction(s) — remove or reassign those first"`
        : '';
    const deleteBtn = protectedCat
      ? `<span class="badge" style="background:var(--gray-bg);color:var(--gray)">System</span>`
      : `<button class="btn small danger" onclick="deleteCategory('${kind}',${idx})" ${used ? 'disabled' : ''} ${deleteDisabled}>Delete</button>`;

    return `<tr>
      <td><strong>${escapeHtml(name)}</strong>${used ? `<div style="color:var(--text-muted);font-size:11.5px">${used} transaction(s)</div>` : ''}</td>
      <td class="actions">
        <button class="btn small secondary" onclick="renameCategory('${kind}',${idx})">Rename</button>
        ${deleteBtn}
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `<table><thead><tr><th>Category</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function render() {
  renderList('out');
  renderList('in');
}

export function addCategory(kind) {
  const inputId = kind === 'out' ? 'newOutCategory' : 'newInCategory';
  const input = document.getElementById(inputId);
  const name = (input.value || '').trim();
  if (!name) { alert('Enter a category name.'); return; }

  const list = kind === 'out' ? data.outCategories : data.inCategories;
  if (list.some(c => c.toLowerCase() === name.toLowerCase())) {
    alert('That category already exists.');
    return;
  }

  list.push(name);
  input.value = '';
  save();
  _renderAll();
}

export function renameCategory(kind, index) {
  const list = kind === 'out' ? data.outCategories : data.inCategories;
  const oldName = list[index];
  if (!oldName) return;

  const next = prompt('Rename category', oldName);
  if (next === null) return;
  const name = next.trim();
  if (!name) { alert('Name cannot be empty.'); return; }
  if (list.some((c, i) => i !== index && c.toLowerCase() === name.toLowerCase())) {
    alert('That category already exists.');
    return;
  }

  // Keep Salary/Dividend names if they're protected — allow rename but warn if used by system features
  if (kind === 'out' && PROTECTED_OUT_CATEGORIES.includes(oldName) && name !== oldName) {
    if (!confirm(`"${oldName}" is used by payroll/dividends. Renaming it will break those features unless you rename it back. Continue?`)) {
      return;
    }
  }

  const type = kind === 'out' ? 'Out' : 'In';
  data.transactions.forEach(t => {
    if (t.type === type && t.category === oldName) t.category = name;
  });
  list[index] = name;
  save();
  _renderAll();
}

export function deleteCategory(kind, index) {
  const list = kind === 'out' ? data.outCategories : data.inCategories;
  const name = list[index];
  if (!name) return;

  if (kind === 'out' && PROTECTED_OUT_CATEGORIES.includes(name)) {
    alert(`"${name}" is a system category and cannot be deleted.`);
    return;
  }

  const type = kind === 'out' ? 'Out' : 'In';
  const used = usageCount(name, type);
  if (used) {
    alert(`Cannot delete "${name}" — it is used by ${used} transaction(s). Rename or reassign those first.`);
    return;
  }

  if (!confirm(`Delete category "${name}"?`)) return;
  list.splice(index, 1);
  save();
  _renderAll();
}
