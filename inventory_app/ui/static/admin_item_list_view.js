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
};

init();

async function init() {
  wireEvents();
  await loadRows();
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
      const payload = {
        original_item_id: row.is_new ? null : row.original_item_id,
        item_id: (row.item_id || '').trim(),
        status: row.status || 'Active',
        item_name: (row.item_name || '').trim(),
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
