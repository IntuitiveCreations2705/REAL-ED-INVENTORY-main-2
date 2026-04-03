const state = {
  rows: [],
  filteredRows: [],
  suggestions: [],
};

const els = {
  body: document.getElementById('rows-body'),
  rowTemplate: document.getElementById('row-template'),
  statusBar: document.getElementById('status-bar'),
  refreshBtn: document.getElementById('refresh-btn'),
  viewMode: document.getElementById('view-mode'),
  eventFilter: document.getElementById('event-filter'),
  boxFilter: document.getElementById('box-filter'),
  searchItem: document.getElementById('search-item'),
  themeSelect: document.getElementById('theme-select'),
  progressCounter: document.getElementById('progress-counter'),
  capsDialog: document.getElementById('caps-dialog'),
  capsYesBtn: document.getElementById('caps-yes-btn'),
  capsNoBtn: document.getElementById('caps-no-btn'),
};

init();

async function init() {
  initCapsDialog();
  wireEvents();
  await loadEvents();
  await loadRows();
  await checkHealth();
}

function initCapsDialog() {
  if (!els.capsDialog) return;
  els.capsDialog.addEventListener('cancel', (e) => {
    e.preventDefault();
  });
}

function wireEvents() {
  els.refreshBtn.addEventListener('click', async () => {
    await loadRows();
    await checkHealth();
  });

  els.viewMode.addEventListener('change', applyFilters);
  els.boxFilter.addEventListener('input', applyFilters);
  els.eventFilter.addEventListener('change', loadRows);

  els.searchItem.addEventListener('input', () => {
    applyFilters();
  });

  els.themeSelect.addEventListener('change', () => {
    document.documentElement.dataset.theme = els.themeSelect.value;
  });
}

async function loadRows() {
  const params = new URLSearchParams({
    view: els.viewMode.value,
    box: els.boxFilter.value,
  });
  if (els.eventFilter.value) {
    params.set('event', els.eventFilter.value);
  }
  const res = await fetch(`/api/master?${params.toString()}`);
  state.rows = await res.json();
  applyFilters();
  setStatus(`Loaded ${state.rows.length} rows.`);
}

async function loadEvents() {
  const res = await fetch('/api/events');
  const events = await res.json();

  els.eventFilter.innerHTML = '<option value="">All</option>';
  for (const e of events) {
    const opt = document.createElement('option');
    opt.value = e.event_name;
    opt.textContent = e.event_name;
    els.eventFilter.appendChild(opt);
  }
}

function applyFilters() {
  const view = els.viewMode.value;
  const box = els.boxFilter.value.trim().toLowerCase();
  const desc = els.searchItem.value.trim().toLowerCase();

  state.filteredRows = state.rows.filter((r) => {
    if (view === 'active' && r.is_active !== 1) return false;
    if (view === 'inactive' && r.is_active !== 0) return false;
    if (view === 'unlinked' && (r.item_id !== null && r.item_id !== '')) return false;
    if (view === 'linked' && (r.item_id === null || r.item_id === '')) return false;
    if (box && !(r.box_number || '').toLowerCase().includes(box)) return false;
    if (desc && !(r.description || '').toLowerCase().includes(desc)) return false;
    return true;
  });
  updateProgress();
  renderRows();
}

function renderRows() {
  els.body.innerHTML = '';

  for (const row of state.filteredRows) {
    const tr = els.rowTemplate.content.firstElementChild.cloneNode(true);
    tr.dataset.rowId = row.row_id;

    tr.querySelector('.row-id').textContent = row.row_id;

    const linkCell = tr.querySelector('.link-status');
    const isLinked = row.item_id !== null && row.item_id !== '';
    linkCell.innerHTML = isLinked
      ? '<span class="badge badge-linked">&#10003; Linked</span>'
      : '<span class="badge badge-unlinked">&#9679; Unlinked</span>';

    const stateBtn = tr.querySelector('.state-toggle');
    syncStateBtn(stateBtn, row.is_active);
    stateBtn.addEventListener('click', async () => {
      const res = await fetch(`/api/master/${row.row_id}/toggle-active`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) return setStatus(payload.error || 'Toggle failed', true);
      row.is_active = payload.is_active;
      syncStateBtn(stateBtn, row.is_active);
      setStatus(`Row ${row.row_id} is now ${row.is_active ? 'Active' : 'Inactive'}.`);
    });

    for (const input of tr.querySelectorAll('input[data-field]')) {
      const field = input.dataset.field;
      input.value = row[field] ?? '';
      input.addEventListener('input', () => {
        row[field] = input.type === 'number' ? Number(input.value || 0) : input.value;
      });
    }

    // Per-row item_name inline suggestion
    const itemNameInput = tr.querySelector('input[data-field="item_name"]');
    const rowSuggestBox = tr.querySelector('.row-suggestions');

    itemNameInput.addEventListener('input', async () => {
      const q = itemNameInput.value.trim();
      if (!q) { rowSuggestBox.style.display = 'none'; rowSuggestBox.innerHTML = ''; return; }
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
      const suggestions = await res.json();
      if (!suggestions.length) { rowSuggestBox.style.display = 'none'; rowSuggestBox.innerHTML = ''; return; }
      rowSuggestBox.innerHTML = '';
      for (const s of suggestions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'suggestion-item';
        btn.innerHTML = `<strong>${escapeHtml(s.item_name)}</strong><span class="suggestion-meta">${escapeHtml(s.item_id)} · ${escapeHtml(s.status)}</span>`;
        btn.addEventListener('mousedown', async (e) => {
          e.preventDefault();
          const res2 = await fetch(`/api/master/${row.row_id}/link-item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: s.item_id, item_name: s.item_name }),
          });
          const data = await res2.json();
          if (!res2.ok) return setStatus(data.error || 'Link failed', true);
          row.item_id = data.item_id;
          row.item_name = data.item_name;
          itemNameInput.value = data.item_name;
          tr.querySelector('input[data-field="item_id"]').value = data.item_id;
          rowSuggestBox.style.display = 'none';
          rowSuggestBox.innerHTML = '';
          const linkCell = tr.querySelector('.link-status');
          linkCell.innerHTML = '<span class="badge badge-linked">&#10003; Linked</span>';
          updateProgress();
          setStatus(`Linked row ${row.row_id} → ${s.item_id} / ${s.item_name}`);
          await checkHealth();
        });
        rowSuggestBox.appendChild(btn);
      }
      rowSuggestBox.style.display = 'block';
    });

    itemNameInput.addEventListener('blur', () => {
      setTimeout(() => { rowSuggestBox.style.display = 'none'; }, 150);
    });

    tr.querySelector('.save-btn').addEventListener('click', async () => {
      const descriptionInput = tr.querySelector('input[data-field="description"]');
      let descriptionValue = stripBrackets(descriptionInput.value || '');

      if (hasAllCapsWords(descriptionValue)) {
        const keepCapsWords = await askRequireCaps();
        descriptionValue = normalizeDescriptionCase(descriptionValue, keepCapsWords);
        descriptionInput.value = descriptionValue;
      } else {
        descriptionValue = normalizeDescriptionCase(descriptionValue, false);
        descriptionInput.value = descriptionValue;
      }

      const payload = {
        item_id: tr.querySelector('input[data-field="item_id"]').value || null,
        item_name: tr.querySelector('input[data-field="item_name"]').value || null,
        box_number: tr.querySelector('input[data-field="box_number"]').value || null,
        storage_location: tr.querySelector('input[data-field="storage_location"]').value || null,
        event_tags: tr.querySelector('input[data-field="event_tags"]').value || null,
        description: descriptionValue || null,
        qty_required: tr.querySelector('input[data-field="qty_required"]').value || 0,
        stock_on_hand: tr.querySelector('input[data-field="stock_on_hand"]').value || 0,
        order_stock_qty: tr.querySelector('input[data-field="order_stock_qty"]').value || null,
        crew_notes: tr.querySelector('input[data-field="crew_notes"]').value || null,
        restock_comments: tr.querySelector('input[data-field="restock_comments"]').value || null,
      };

      if (!payload.item_id && payload.item_name) {
        tr.classList.add('row-discrepancy');
        return setStatus(`Row ${row.row_id}: item_name cannot be set without item_id.`, true);
      }

      const res = await fetch(`/api/master/${row.row_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        tr.classList.add('row-discrepancy');
        return setStatus(`Row ${row.row_id}: ${data.error || 'Save failed'}`, true);
      }

      tr.classList.remove('row-discrepancy');

      Object.assign(row, data.row);
      setStatus(`Saved row ${row.row_id}.`);
      await checkHealth();
      renderRows();
    });

    els.body.appendChild(tr);
  }
}

function normalizeDescriptionCase(value, keepCapsWords) {
  const s = String(value || '').trim();
  if (!s) return s;

  const joiners = new Set(['on', 'in', 'and', 'or', 'of', 'the', 'a', 'an', 'to', 'for', 'at', 'by']);
  const words = s.split(/\s+/);

  return words
    .map((originalWord, i) => {
      const letterOnly = originalWord.replace(/[^A-Za-z]/g, '');
      const isCapsWord = letterOnly.length >= 2 && letterOnly === letterOnly.toUpperCase();

      if (keepCapsWords && isCapsWord) {
        return originalWord.toUpperCase();
      }

      const lowerWord = originalWord.toLowerCase();
      const joinerKey = lowerWord.replace(/[^a-z]/g, '');
      if (i > 0 && joiners.has(joinerKey)) return lowerWord;

      return capitalizeFirstLetter(lowerWord);
    })
    .join(' ');
}

function hasAllCapsWords(value) {
  const words = String(value || '').trim().split(/\s+/);
  return words.some((w) => {
    const letters = w.replace(/[^A-Za-z]/g, '');
    return letters.length >= 2 && letters === letters.toUpperCase();
  });
}

function capitalizeFirstLetter(word) {
  const idx = word.search(/[a-z]/);
  if (idx === -1) return word;
  return word.slice(0, idx) + word.charAt(idx).toUpperCase() + word.slice(idx + 1);
}

function stripBrackets(value) {
  return String(value || '')
    .replace(/[\[\](){}]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
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

function syncStateBtn(btn, isActive) {
  btn.textContent = isActive ? 'Active' : 'Inactive';
  btn.classList.toggle('state-active', isActive === 1);
  btn.classList.toggle('state-inactive', isActive === 0);
}

function updateProgress() {
  const total = state.rows.length;
  const linked = state.rows.filter((r) => r.item_id !== null && r.item_id !== '').length;
  const unlinked = total - linked;
  const pct = total ? Math.round((linked / total) * 100) : 0;
  els.progressCounter.innerHTML =
    `<span class="prog-linked">${linked} linked</span>` +
    `<span class="prog-sep">/</span>` +
    `<span class="prog-unlinked">${unlinked} unlinked</span>` +
    `<span class="prog-pct">${pct}%</span>` +
    `<span class="prog-bar"><span class="prog-fill" style="width:${pct}%"></span></span>`;
}

async function checkHealth() {
  const res = await fetch('/api/health');
  const h = await res.json();
  if (h.foreign_key_violations > 0) {
    setStatus(`WARNING: FK violations = ${h.foreign_key_violations}`, true);
  }
}

function setStatus(message, isError = false) {
  els.statusBar.textContent = message;
  els.statusBar.style.color = isError ? '#ff9aa8' : 'var(--muted)';
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.cell-item-name')) {
    document.querySelectorAll('.row-suggestions').forEach((d) => { d.style.display = 'none'; });
  }
});
