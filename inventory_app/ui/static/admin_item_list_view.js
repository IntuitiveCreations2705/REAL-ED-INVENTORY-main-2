const state = {
  rows: [],
};

const els = {
  body: document.getElementById('rows-body'),
  rowTemplate: document.getElementById('row-template'),
  statusBar: document.getElementById('status-bar'),
  refreshBtn: document.getElementById('refresh-btn'),
  addRowBtn: document.getElementById('add-row-btn'),
  searchQ: document.getElementById('search-q'),
  statusFilter: document.getElementById('status-filter'),
  capsDialog: document.getElementById('caps-dialog'),
  capsYesBtn: document.getElementById('caps-yes-btn'),
  capsNoBtn: document.getElementById('caps-no-btn'),
};

init();

async function init() {
  initCapsDialog();
  wireEvents();
  await loadRows();
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
    });
    renderRows();
    setStatus('New row added. Fill and Save.');
  });
}

async function loadRows() {
  const params = new URLSearchParams({
    status: els.statusFilter.value,
    q: els.searchQ.value,
  });

  const res = await fetch(`/api/item-list?${params.toString()}`);
  const data = await res.json();
  state.rows = data.map((r) => ({
    ...r,
    original_item_id: r.item_id,
    is_new: false,
  }));
  renderRows();
  setStatus(`Loaded ${state.rows.length} item rows.`);
}

function renderRows() {
  els.body.innerHTML = '';

  for (const row of state.rows) {
    const tr = els.rowTemplate.content.firstElementChild.cloneNode(true);

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

    idInput.addEventListener('input', () => { row.item_id = idInput.value; });
    statusSelect.addEventListener('change', () => {
      row.status = statusSelect.value;
      statusSelect.classList.toggle('status-active', statusSelect.value === 'Active');
      statusSelect.classList.toggle('status-inactive', statusSelect.value === 'Inactive');
    });
    nameInput.addEventListener('input', () => { row.item_name = nameInput.value; });

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
      });

      setStatus(`Saved ${row.item_id}.`);
      await loadRows();
    });

    els.body.appendChild(tr);
  }
}

function setStatus(message, isError = false) {
  els.statusBar.textContent = message;
  els.statusBar.style.color = isError ? '#ff9aa8' : 'var(--muted)';
}

function isAllCapsText(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (!letters) return false;
  return letters === letters.toUpperCase();
}

function toTitleCaseWithJoiners(value) {
  const s = String(value || '').trim();
  if (!s) return s;

  const joiners = new Set(['on', 'in', 'and', 'or', 'of', 'the', 'a', 'an', 'to', 'for', 'at', 'by']);
  const words = s.toLowerCase().split(/\s+/);

  const titled = words
    .map((w, i) => {
      if (i > 0 && joiners.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');

  return normalizeMeasurementText(titled);
}

function normalizeMeasurementText(value) {
  return String(value || '').replace(
    /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|km|in|ft|yd)\b/gi,
    (_, num, unit) => `${num}${String(unit).toLowerCase()}`,
  );
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
