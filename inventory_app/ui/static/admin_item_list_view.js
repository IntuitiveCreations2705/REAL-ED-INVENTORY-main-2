import {
  formatAllowlistForInput,
  isAllCapsText,
  loadCaseAllowlist,
  toTitleCaseWithJoiners,
} from './global_case_rules.js';

const state = {
  rows: [],
  nextClientKey: 1,
};

const els = {
  body: document.getElementById('rows-body'),
  rowTemplate: document.getElementById('row-template'),
  statusBar: document.getElementById('status-bar'),
  refreshBtn: document.getElementById('refresh-btn'),
  addRowBtn: document.getElementById('add-row-btn'),
  searchQ: document.getElementById('search-q'),
  statusFilter: document.getElementById('status-filter'),
  readonlyCaseAllowlistInput: document.getElementById('readonly-case-allowlist-input'),
  capsDialog: document.getElementById('caps-dialog'),
  capsYesBtn: document.getElementById('caps-yes-btn'),
  capsNoBtn: document.getElementById('caps-no-btn'),
};

const REQUIRED_ITEM_LIST_FIELDS = [
  ['item_id', 'Item ID'],
  ['status', 'Status'],
  ['item_name', 'Item Name'],
];

init();

async function init() {
  await hydrateReadonlyCaseAllowlist();
  initCapsDialog();
  wireEvents();
  await loadRows();
  seedNewItemFromQuery();
  await checkHealth();
}

function seedNewItemFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const seededName = (params.get('new_item_name') || '').trim();
  if (!seededName) return;

  state.rows.unshift({
    original_item_id: null,
    item_id: '',
    status: 'Active',
    item_name: seededName,
    used_count: 0,
    is_new: true,
    isDirty: true,
    clientKey: `new-${state.nextClientKey++}`,
  });
  renderRows();
  setStatus(`Add New ready in Item ID List for: ${seededName}`);
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const h = await res.json();
    if (h.foreign_key_violations > 0) {
      const details = (h.fk_violation_rows || []).map((r) => {
        const key = r.item_id ? `${r.item_id} / ${r.item_name || '?'}` : `rowid=${r.rowid}`;
        return `${r.table}[${key}]`;
      }).join('  ·  ');
      setStatus(`⚠ FK violations (${h.foreign_key_violations}): ${details || 'see /api/health for detail'}`, true);
    }
  } catch (_) { /* non-blocking */ }
}

function initCapsDialog() {
  if (!els.capsDialog) return;
  els.capsDialog.addEventListener('cancel', (e) => {
    e.preventDefault();
  });
}

function wireEvents() {
  els.refreshBtn.addEventListener('click', loadRows);

  els.searchQ.addEventListener('input', async () => {
    await loadRows();
  });

  els.statusFilter.addEventListener('change', async () => {
    await loadRows();
  });

  els.addRowBtn.addEventListener('click', () => {
    state.rows.unshift({
      original_item_id: null,
      item_id: '',
      status: 'Active',
      item_name: '',
      used_count: 0,
      is_new: true,
      isDirty: false,
      clientKey: `new-${state.nextClientKey++}`,
    });
    renderRows();
    setStatus('New row added. Fill and Save.');
  });

}

async function hydrateReadonlyCaseAllowlist() {
  if (!els.readonlyCaseAllowlistInput) return;
  const tokens = await loadCaseAllowlist();
  els.readonlyCaseAllowlistInput.value = formatAllowlistForInput(tokens);
}

async function loadRows() {
  const params = new URLSearchParams({
    status: els.statusFilter.value,
    q: els.searchQ.value,
  });

  setTableState('loading', 'Loading item list…');
  setStatus('Loading item list…');

  try {
    const res = await fetch(`/api/item-list?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      state.rows = [];
      setTableState('error', data.error || 'Failed to load Item ID List. Try again.');
      return setStatus(data.error || 'Load failed. Use Refresh to retry.', true);
    }

    state.rows = data.map((r) => ({
      ...r,
      original_item_id: r.item_id,
      is_new: false,
      isDirty: false,
      clientKey: `row-${r.item_id}`,
    }));
    renderRows();
    setStatus(`Loaded ${state.rows.length} item rows.`);
  } catch (err) {
    state.rows = [];
    setTableState('error', `Unable to reach server: ${err.message}. Check app is running and Refresh.`);
    setStatus('Load failed. Use Refresh to retry.', true);
  }
}

function renderRows() {
  els.body.innerHTML = '';

  if (state.rows.length === 0) {
    const q = (els.searchQ.value || '').trim();
    const st = (els.statusFilter.value || 'all');
    const msg = q || st !== 'all'
      ? `No items match the current filter. Clear filters or add a new row.`
      : `No items in the list yet. Use Add Row to create the first entry.`;
    setTableState('empty', msg);
    return;
  }

  for (const row of state.rows) {
    const tr = els.rowTemplate.content.firstElementChild.cloneNode(true);
    tr.dataset.clientKey = row.clientKey;

    attachDirtyRowGuard(tr, row);

    const idInput = tr.querySelector('input[data-field="item_id"]');
    const statusSelect = tr.querySelector('select[data-field="status"]');
    const nameInput = tr.querySelector('input[data-field="item_name"]');
    const usedCell = tr.querySelector('.used-count');

    idInput.value = row.item_id || '';
    statusSelect.value = row.status || 'Active';
    nameInput.value = row.item_name || '';
    const usedCount = Number(row.used_count || 0);
    usedCell.textContent = String(usedCount);
    usedCell.classList.toggle('used-active', usedCount > 0);
    usedCell.classList.toggle('used-inactive', usedCount === 0);
    usedCell.title = usedCount > 0 ? 'Referenced by master_inventory' : 'Not currently referenced';
    statusSelect.classList.toggle('status-active', statusSelect.value === 'Active');
    statusSelect.classList.toggle('status-inactive', statusSelect.value === 'Inactive');

    if (!row.is_new) {
      idInput.disabled = true;
      idInput.title = 'item_id is immutable for existing rows';
    }

    idInput.addEventListener('input', () => {
      row.item_id = idInput.value;
      markRowDirty(row);
    });
    statusSelect.addEventListener('change', () => {
      row.status = statusSelect.value;
      markRowDirty(row);
      statusSelect.classList.toggle('status-active', statusSelect.value === 'Active');
      statusSelect.classList.toggle('status-inactive', statusSelect.value === 'Inactive');
    });
    nameInput.addEventListener('input', () => {
      row.item_name = nameInput.value;
      markRowDirty(row);
    });

    tr.querySelector('.save-btn').addEventListener('click', async () => {
      let itemName = (row.item_name || '').trim();
      if (isAllCapsText(itemName)) {
        const keepCaps = await askRequireCaps();
        if (!keepCaps) {
          itemName = toTitleCaseWithJoiners(itemName);
          row.item_name = itemName;
          nameInput.value = itemName;
        }
      } else {
        itemName = toTitleCaseWithJoiners(itemName);
        row.item_name = itemName;
        nameInput.value = itemName;
      }

      const missingFields = validateItemListRequiredFields(tr, itemName);
      if (missingFields.length > 0) {
        const firstMissing = missingFields[0];
        const target = tr.querySelector(`[data-field="${firstMissing.field}"]`);
        if (target) target.focus();
        return setStatus(
          `${row.is_new ? 'New row' : `Item ${row.item_id || ''}`}: complete required fields. Missing: ${missingFields.map((entry) => entry.label).join(', ')}`,
          true,
        );
      }

      const payload = {
        original_item_id: row.is_new ? null : row.original_item_id,
        version: row.is_new ? undefined : row.version,
        item_id: (row.item_id || '').trim(),
        status: row.status || 'Active',
        item_name: itemName,
      };

      const res = await fetch('/api/item-list/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        return setStatus(data.error || 'Save failed.', true);
      }

      Object.assign(row, data.row, {
        original_item_id: data.row.item_id,
        is_new: false,
        isDirty: false,
        clientKey: `row-${data.row.item_id}`,
      });

      setStatus(`Saved ${row.item_id}.`);
      await loadRows();
      await checkHealth();
    });

    els.body.appendChild(tr);
  }
}

function setStatus(message, isError = false) {
  els.statusBar.textContent = message;
  els.statusBar.style.color = isError ? '#ff9aa8' : 'var(--muted)';
}

/**
 * Renders a loading, error, or empty placeholder row into the main tbody.
 * @param {'loading'|'error'|'empty'} type
 * @param {string} message
 */
function setTableState(type, message) {
  if (!els.body) return;
  const colSpan = 5;
  els.body.innerHTML = `<tr><td colspan="${colSpan}" class="table-state table-state--${type}">
    <span class="table-state-icon">${type === 'loading' ? '⏳' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span class="table-state-msg">${String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
    ${type === 'error' ? `<button class="btn secondary table-state-retry" type="button">Retry</button>` : ''}
  </td></tr>`;
  if (type === 'error') {
    els.body.querySelector('.table-state-retry')?.addEventListener('click', () => loadRows());
  }
}

function markRowDirty(row) {
  row.isDirty = true;
}

function getBlockingDirtyRow(targetRow) {
  return state.rows.find((row) => row.isDirty && row.clientKey !== targetRow.clientKey) || null;
}

function focusRowSave(row) {
  const saveBtn = els.body.querySelector(`tr[data-client-key="${row.clientKey}"] .save-btn`);
  if (saveBtn) {
    setTimeout(() => saveBtn.focus(), 0);
  }
}

function attachDirtyRowGuard(tr, row) {
  tr.addEventListener('mousedown', (e) => {
    const control = e.target.closest('input, button, select');
    if (!control) return;
    const blockingRow = getBlockingDirtyRow(row);
    if (!blockingRow) return;
    e.preventDefault();
    e.stopPropagation();
    setStatus(`Save changes first in row ${blockingRow.item_id || 'NEW'} before editing another row.`, true);
    focusRowSave(blockingRow);
  }, true);

  tr.addEventListener('focusin', () => {
    const blockingRow = getBlockingDirtyRow(row);
    if (!blockingRow) return;
    setStatus(`Save changes first in row ${blockingRow.item_id || 'NEW'} before editing another row.`, true);
    focusRowSave(blockingRow);
  });
}

function validateItemListRequiredFields(tr, itemName) {
  return REQUIRED_ITEM_LIST_FIELDS
    .map(([field, label]) => {
      const control = tr.querySelector(`[data-field="${field}"]`);
      const rawValue = field === 'item_name'
        ? String(itemName || '').trim()
        : String(control?.value || '').trim();
      return rawValue ? null : { field, label };
    })
    .filter(Boolean);
}

function askRequireCaps() {
  if (
    !els.capsDialog ||
    !els.capsYesBtn ||
    !els.capsNoBtn ||
    typeof els.capsDialog.showModal !== 'function'
  ) {
    return Promise.resolve(window.confirm('Require Caps?\n\nOK = Yes, keep ALL CAPS\nCancel = No, apply capitalization rule'));
  }

  return new Promise((resolve) => {
    const onYes = () => close(true);
    const onNo = () => close(false);

    const close = (answer) => {
      els.capsYesBtn.removeEventListener('click', onYes);
      els.capsNoBtn.removeEventListener('click', onNo);
      els.capsDialog.close();
      resolve(answer);
    };

    els.capsYesBtn.addEventListener('click', onYes);
    els.capsNoBtn.addEventListener('click', onNo);
    try {
      els.capsDialog.showModal();
    } catch {
      els.capsYesBtn.removeEventListener('click', onYes);
      els.capsNoBtn.removeEventListener('click', onNo);
      resolve(window.confirm('Require Caps?\n\nOK = Yes, keep ALL CAPS\nCancel = No, apply capitalization rule'));
    }
  });
}
