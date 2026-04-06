const state = {
  rows: [],
  filteredRows: [],
  suggestions: [],
  eventTagCatalog: [],
  nextClientKey: 1,
  saveInProgressClientKey: null,
};

const els = {
  body: document.getElementById('rows-body'),
  rowTemplate: document.getElementById('row-template'),
  statusBar: document.getElementById('status-bar'),
  refreshBtn: document.getElementById('refresh-btn'),
  addRowBtn: document.getElementById('add-row-btn'),
  viewMode: document.getElementById('view-mode'),
  eventFilter: document.getElementById('event-filter'),
  boxFilter: document.getElementById('box-filter'),
  searchItem: document.getElementById('search-item'),
  themeSelect: document.getElementById('theme-select'),
  progressCounter: document.getElementById('progress-counter'),
  boxOptions: document.getElementById('box-options'),
  locationOptions: document.getElementById('location-options'),
  eventTagOptions: document.getElementById('event-tag-options'),
  capsDialog: document.getElementById('caps-dialog'),
  capsYesBtn: document.getElementById('caps-yes-btn'),
  capsNoBtn: document.getElementById('caps-no-btn'),
};

const REQUIRED_ROW_FIELDS = [
  ['item_id', 'Item ID'],
  ['item_name', 'Item Name'],
  ['box_number', 'Box'],
  ['storage_location', 'Location'],
  ['event_tags', 'Event Tags'],
  ['description', 'Description'],
  ['qty_required', 'Qty Req'],
  ['stock_on_hand', 'Stock'],
  ['crew_notes', 'Notes'],
];

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

  if (els.addRowBtn) {
    els.addRowBtn.addEventListener('click', () => {
      const blank = {
        row_id: null, is_new: true, is_active: 1,
        item_id: null, item_name: null, box_number: null,
        storage_location: null, event_tags: '', description: '',
        crew_notes: null, qty_required: 0, stock_on_hand: 0,
        order_stock_qty: 0, restock_comments: null, version: null,
        manualOrderStockQtyOverride: false,
        isDirty: false,
        clientKey: `new-${state.nextClientKey++}`,
      };
      state.rows.unshift(blank);
      state.filteredRows.unshift(blank);
      renderRows();
      setStatus('New row ready — fill fields and Save.');
    });
  }

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
  state.rows = (await res.json()).map((row) => ({
    ...row,
    manualOrderStockQtyOverride: false,
    isDirty: false,
    clientKey: `row-${row.row_id}`,
  }));
  refreshFieldOptionLists();
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

  state.eventTagCatalog = Array.from(new Set(
    events.flatMap((e) => String(e.tags || '')
      .split('|')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)),
  )).sort((a, b) => a.localeCompare(b));

  refreshFieldOptionLists();
}

function refreshFieldOptionLists() {
  if (!els.boxOptions || !els.locationOptions || !els.eventTagOptions) return;

  const boxes = Array.from(new Set(
    state.rows.map((r) => String(r.box_number || '').trim()).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  const locations = Array.from(new Set(
    state.rows.map((r) => normalizeLocationLabel(r.storage_location)).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  const rowTags = state.rows.flatMap((r) =>
    String(r.event_tags || '')
      .split('|')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean),
  );
  const tags = Array.from(new Set([...state.eventTagCatalog, ...rowTags])).sort((a, b) => a.localeCompare(b));

  writeDatalist(els.boxOptions, boxes, 'ADD NEW');
  writeDatalist(els.locationOptions, locations, 'ADD NEW');
  writeDatalist(els.eventTagOptions, tags, 'ADD NEW');
}

function writeDatalist(listEl, values, addNewLabel) {
  listEl.innerHTML = '';
  values.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    listEl.appendChild(opt);
  });
  const addNew = document.createElement('option');
  addNew.value = '__ADD_NEW__';
  addNew.label = addNewLabel;
  listEl.appendChild(addNew);
}

function markRowDirty(row) {
  row.isDirty = true;
}

function clearDirtyForRow(row) {
  row.isDirty = false;
  for (const r of state.rows) {
    if (r === row) continue;
    if (r.clientKey && row.clientKey && r.clientKey === row.clientKey) {
      r.isDirty = false;
      continue;
    }
    if (r.row_id != null && row.row_id != null && Number(r.row_id) === Number(row.row_id)) {
      r.isDirty = false;
    }
  }
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
    if (state.saveInProgressClientKey) return;
    const control = e.target.closest('input, button, select');
    if (!control) return;
    const blockingRow = getBlockingDirtyRow(row);
    if (!blockingRow) return;
    e.preventDefault();
    e.stopPropagation();
    setStatus(`Save changes first in row ${blockingRow.row_id ?? 'NEW'} before editing another row.`, true);
    focusRowSave(blockingRow);
  }, true);
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

  // When a box filter is active: sort alphabetically by description (size/length-normalised),
  // then by meter value (e.g., 25Mtr before 10Mtr), then size weight, then item_name.
  // Otherwise preserve DB row_id order.
  if (box) {
    state.filteredRows.sort((a, b) => {
      const baseA = descBase((a.description || ''));
      const baseB = descBase((b.description || ''));
      if (baseA !== baseB) return baseA < baseB ? -1 : 1;
      const mw = meterWeight((b.description || '')) - meterWeight((a.description || ''));
      if (mw !== 0) return mw;
      const sw = sizeWeight((a.description || '')) - sizeWeight((b.description || ''));
      if (sw !== 0) return sw;
      const ia = (a.item_name || '').toLowerCase();
      const ib = (b.item_name || '').toLowerCase();
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
  }

  updateProgress();
  renderRows();
}

// ── Sort helpers ─────────────────────────────────────────────────────────────
// Size tokens recognised (case-insensitive, whole-word or abbreviation).
const _SIZE_PATTERN = /\b(x-?large|xlarge|xl|extra-?large|large|lge|lg|medium|med|md|small|sml|sm|x-?small|xsmall|xs|extra-?small)\b/gi;
const _MTR_PATTERN = /\b(\d+(?:\.\d+)?)\s*(mtr|meter|metre|m)\b/gi;

/** Return description with all size tokens stripped, lowercased — used as alpha sort key. */
function descBase(desc) {
  return desc
    .replace(_MTR_PATTERN, '')
    .replace(_SIZE_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();
}

/** Extract first meter value from description; returns -1 when no value is present. */
function meterWeight(desc) {
  const match = String(desc || '').toLowerCase().match(/\b(\d+(?:\.\d+)?)\s*(mtr|meter|metre|m)\b/);
  if (!match) return -1;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : -1;
}

/** Map size token found in description to a numeric weight (lower = bigger). */
function sizeWeight(desc) {
  const m = desc.match(_SIZE_PATTERN);
  if (!m) return 99; // no size token → sort after all sized items
  const token = m[0].toLowerCase().replace(/[-\s]/g, '');
  if (['xsmall','xs','extrasmall'].includes(token)) return 4;
  if (['small','sml','sm'].includes(token))          return 3;
  if (['medium','med','md'].includes(token))          return 2;
  if (['large','lge','lg'].includes(token))           return 1;
  if (['xlarge','xl','extralarge'].includes(token))   return 0;
  return 99;
}
// ─────────────────────────────────────────────────────────────────────────────

function renderRows() {
  els.body.innerHTML = '';

  if (!state.filteredRows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 15;
    td.style.padding = '14px';
    td.style.color = 'var(--muted)';
    td.textContent = 'No rows match current filters. Set View mode to All and clear filters, then Refresh.';
    tr.appendChild(td);
    els.body.appendChild(tr);
    return;
  }

  for (const row of state.filteredRows) {
    const tr = els.rowTemplate.content.firstElementChild.cloneNode(true);
    tr.dataset.rowId = row.row_id;
    tr.dataset.clientKey = row.clientKey;

    attachDirtyRowGuard(tr, row);
    const saveBtn = tr.querySelector('.save-btn');

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
      row.version = payload.version;
      row.updated_at = payload.updated_at;
      row.updated_by = payload.updated_by;
      syncStateBtn(stateBtn, row.is_active);
      setStatus(`Row ${row.row_id} is now ${row.is_active ? 'Active' : 'Inactive'}.`);
    });

    for (const input of tr.querySelectorAll('input[data-field]')) {
      const field = input.dataset.field;
      input.value = row[field] ?? '';
      input.addEventListener('input', () => {
        row[field] = input.type === 'number' ? Number(input.value || 0) : input.value;
        markRowDirty(row);
      });
    }

    const boxInput = tr.querySelector('input[data-field="box_number"]');
    const locationInput = tr.querySelector('input[data-field="storage_location"]');
    const tagsInput = tr.querySelector('input[data-field="event_tags"]');
    const qtyRequiredInput = tr.querySelector('input[data-field="qty_required"]');
    const stockOnHandInput = tr.querySelector('input[data-field="stock_on_hand"]');
    const orderStockQtyInput = tr.querySelector('input[data-field="order_stock_qty"]');
    const allFieldInputs = Array.from(tr.querySelectorAll('input[data-field]'));

    const syncComputedOrderQty = () => {
      if (row.manualOrderStockQtyOverride) return;
      const computed = computeOrderStockQty(qtyRequiredInput.value, stockOnHandInput.value);
      row.order_stock_qty = computed;
      orderStockQtyInput.value = formatNumericField(computed);
    };

    qtyRequiredInput.addEventListener('input', () => {
      row.qty_required = Number(qtyRequiredInput.value || 0);
      markRowDirty(row);
      syncComputedOrderQty();
    });

    stockOnHandInput.addEventListener('input', () => {
      row.stock_on_hand = Number(stockOnHandInput.value || 0);
      markRowDirty(row);
      syncComputedOrderQty();
    });

    orderStockQtyInput.addEventListener('input', () => {
      const raw = String(orderStockQtyInput.value || '').trim();
      row.manualOrderStockQtyOverride = raw !== '';
      markRowDirty(row);
      if (!row.manualOrderStockQtyOverride) {
        syncComputedOrderQty();
        return;
      }
      row.order_stock_qty = Number(raw || 0);
    });

    if (!row.manualOrderStockQtyOverride && !String(orderStockQtyInput.value || '').trim()) {
      syncComputedOrderQty();
    }

    const applyNewRowEntryMode = () => {
      if (!row.is_new) {
        stateBtn.disabled = false;
        saveBtn.disabled = false;
        allFieldInputs.forEach((input) => {
          input.disabled = false;
          input.readOnly = false;
        });
        return;
      }

      const hasLinkedItem = Boolean(String(row.item_id || '').trim());
      stateBtn.disabled = true;
      saveBtn.disabled = !hasLinkedItem;
      allFieldInputs.forEach((input) => {
        const field = input.dataset.field;
        if (field === 'item_name') {
          input.disabled = false;
          input.readOnly = false;
          return;
        }
        if (field === 'item_id') {
          input.disabled = false;
          input.readOnly = true;
          return;
        }
        input.disabled = !hasLinkedItem;
      });
    };

    applyNewRowEntryMode();

    [
      [boxInput, 'Box syntax: Title Case letters/numbers (example: Zen Zone 2).'],
      [locationInput, 'Location syntax: UPPER CASE letters/numbers (example: ZEN ZONE 2).'],
      [tagsInput, 'Event Tags syntax: |NEEDED||PIPES| in CAPS (single or combined).'],
    ].forEach(([input, hint]) => {
      if (!input) return;
      input.addEventListener('change', () => {
        if (String(input.value || '').trim() === '__ADD_NEW__') {
          input.value = '';
          input.focus();
          setStatus(`Add New selected. ${hint}`);
        }
      });
    });

    // Per-row item_name inline suggestion
    const itemNameInput = tr.querySelector('input[data-field="item_name"]');
    const rowSuggestBox = tr.querySelector('.row-suggestions');

    itemNameInput.addEventListener('input', async () => {
      const q = itemNameInput.value.trim();
      if (!q) { rowSuggestBox.style.display = 'none'; rowSuggestBox.innerHTML = ''; return; }
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
      const suggestions = await res.json();
      if (!suggestions.length) {
        if (row.is_new) {
          rowSuggestBox.innerHTML = '';
          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'suggestion-item';
          addBtn.innerHTML = `<strong>No existing Item ID match.</strong><span class="suggestion-meta">Open Item ID List to Add New</span>`;
          addBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const url = `/item-list?new_item_name=${encodeURIComponent(q)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
            setStatus('Existing=False: Add New opened in Item ID List.', false);
          });
          rowSuggestBox.appendChild(addBtn);
          rowSuggestBox.style.display = 'block';
        } else {
          rowSuggestBox.style.display = 'none';
          rowSuggestBox.innerHTML = '';
        }
        return;
      }
      rowSuggestBox.innerHTML = '';
      for (const s of suggestions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'suggestion-item';
        btn.innerHTML = `<strong>${escapeHtml(s.item_name)}</strong><span class="suggestion-meta">${escapeHtml(s.item_id)} · ${escapeHtml(s.status)}</span>`;
        btn.addEventListener('mousedown', async (e) => {
          e.preventDefault();
          if (row.is_new) {
            row.item_id = s.item_id;
            row.item_name = s.item_name;
            markRowDirty(row);
            itemNameInput.value = s.item_name;
            tr.querySelector('input[data-field="item_id"]').value = s.item_id;
            applyNewRowEntryMode();
          } else {
            const res2 = await fetch(`/api/master/${row.row_id}/link-item`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ item_id: s.item_id, item_name: s.item_name }),
            });
            const data = await res2.json();
            if (!res2.ok) return setStatus(data.error || 'Link failed', true);
            row.item_id = data.item_id;
            row.item_name = data.item_name;
            row.version = data.version;
            itemNameInput.value = data.item_name;
            tr.querySelector('input[data-field="item_id"]').value = data.item_id;
          }
          rowSuggestBox.style.display = 'none';
          rowSuggestBox.innerHTML = '';
          const linkCell = tr.querySelector('.link-status');
          linkCell.innerHTML = '<span class="badge badge-linked">&#10003; Linked</span>';
          updateProgress();
          if (row.is_new) {
            setStatus(`Selected item ready for save. Complete all fields in row.`, false);
          } else {
            setStatus(`Linked row ${row.row_id} → ${s.item_id} / ${s.item_name}`);
          }
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
      if (state.saveInProgressClientKey) return;
      state.saveInProgressClientKey = row.clientKey;

      try {
      if (row.is_new && !String(tr.querySelector('input[data-field="item_id"]').value || '').trim()) {
        itemNameInput.focus();
        return setStatus('New row: first action must be Item Name search + existing link. If Existing=False, use Add New in Item ID List.', true);
      }

      const descriptionInput = tr.querySelector('input[data-field="description"]');
      const crewNotesInput = tr.querySelector('input[data-field="crew_notes"]');
      const restockCommentsInput = tr.querySelector('input[data-field="restock_comments"]');
      let descriptionValue = stripBrackets(descriptionInput.value || '');
      let crewNotesValue = stripBrackets(crewNotesInput.value || '');
      let restockCommentsValue = stripBrackets(restockCommentsInput.value || '');

      const needsCapsPrompt =
        hasAllCapsWords(descriptionValue) ||
        hasAllCapsWords(crewNotesValue) ||
        hasAllCapsWords(restockCommentsValue);
      const keepCapsWords = needsCapsPrompt ? await askRequireCaps() : false;

      descriptionValue = normalizeDescriptionCase(descriptionValue, keepCapsWords);
      crewNotesValue = normalizeDescriptionCase(crewNotesValue, keepCapsWords);
      restockCommentsValue = normalizeDescriptionCase(restockCommentsValue, keepCapsWords);

      descriptionInput.value = descriptionValue;
      crewNotesInput.value = crewNotesValue;
      restockCommentsInput.value = restockCommentsValue;

      const missingFields = validateRequiredRowFields(tr, descriptionValue);
      if (missingFields.length > 0) {
        tr.classList.add('row-discrepancy');
        const firstMissing = tr.querySelector(`input[data-field="${missingFields[0].field}"]`);
        if (firstMissing) firstMissing.focus();
        return setStatus(
          `Row ${row.row_id ?? 'NEW'}: complete all fields. Missing: ${missingFields.map((entry) => entry.label).join(', ')}`,
          true,
        );
      }

      const boxInputSave = tr.querySelector('input[data-field="box_number"]');
      const locationInputSave = tr.querySelector('input[data-field="storage_location"]');
      const tagsInputSave = tr.querySelector('input[data-field="event_tags"]');

      const boxValue = normalizeCatalogLabel(boxInputSave.value);
      const locationValue = normalizeLocationLabel(locationInputSave.value);
      const tagValue = normalizeEventTagsValue(tagsInputSave.value);

      if (boxInputSave.value && !boxValue) {
        tr.classList.add('row-discrepancy');
        boxInputSave.focus();
        return setStatus(`Row ${row.row_id ?? 'NEW'}: invalid Box syntax. Use Title Case letters/numbers (e.g., Zen Zone 2).`, true);
      }
      if (locationInputSave.value && !locationValue) {
        tr.classList.add('row-discrepancy');
        locationInputSave.focus();
        return setStatus(`Row ${row.row_id ?? 'NEW'}: invalid Location syntax. Use UPPER CASE letters/numbers (e.g., ZEN ZONE 2).`, true);
      }
      if (tagsInputSave.value && !tagValue) {
        tr.classList.add('row-discrepancy');
        tagsInputSave.focus();
        return setStatus(`Row ${row.row_id ?? 'NEW'}: invalid Event Tags. Use |NEEDED||PIPES| format in CAPS.`, true);
      }

      boxInputSave.value = boxValue;
      locationInputSave.value = locationValue;
      tagsInputSave.value = tagValue;

      const payload = {
        version: row.version ?? undefined,
        item_id: tr.querySelector('input[data-field="item_id"]').value || null,
        item_name: tr.querySelector('input[data-field="item_name"]').value || null,
        box_number: boxValue || null,
        storage_location: locationValue || null,
        event_tags: tagValue || null,
        description: descriptionValue || null,
        qty_required: tr.querySelector('input[data-field="qty_required"]').value || 0,
        stock_on_hand: tr.querySelector('input[data-field="stock_on_hand"]').value || 0,
        order_stock_qty: tr.querySelector('input[data-field="order_stock_qty"]').value || null,
        order_stock_qty_manual_override: Boolean(row.manualOrderStockQtyOverride),
        crew_notes: crewNotesValue || null,
        restock_comments: restockCommentsValue || null,
      };

      if (!payload.item_id && payload.item_name) {
        tr.classList.add('row-discrepancy');
        return setStatus(`Row ${row.row_id ?? 'NEW'}: item_name cannot be set without item_id.`, true);
      }

      let res, data;
      if (row.is_new) {
        res = await fetch('/api/master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
        if (!res.ok) {
          tr.classList.add('row-discrepancy');
          return setStatus(`New row: ${data.error || 'Insert failed'}`, true);
        }
        Object.assign(row, data.row, { is_new: false, clientKey: `row-${data.row.row_id}` });
        clearDirtyForRow(row);
        setStatus(`Inserted new row ${row.row_id}.`);
      } else {
        res = await fetch(`/api/master/${row.row_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
        if (!res.ok) {
          tr.classList.add('row-discrepancy');
          return setStatus(`Row ${row.row_id}: ${data.error || 'Save failed'}`, true);
        }
        Object.assign(row, data.row);
        clearDirtyForRow(row);
        setStatus(`Saved row ${row.row_id}.`);
      }

      tr.classList.remove('row-discrepancy');
      await checkHealth();
      renderRows();
      } finally {
        state.saveInProgressClientKey = null;
      }
    });

    els.body.appendChild(tr);
  }
}

function normalizeDescriptionCase(value, keepCapsWords) {
  const s = String(value || '').trim();
  if (!s) return s;

  const joiners = new Set(['on', 'in', 'and', 'or', 'of', 'the', 'a', 'an', 'to', 'for', 'at', 'by']);
  const words = s.split(/\s+/);

  const titled = words
    .map((originalWord, i) => {
      const letterOnly = originalWord.replace(/[^A-Za-z]/g, '');
      const isCapsWord = letterOnly.length >= 2 && letterOnly === letterOnly.toUpperCase();

      if (keepCapsWords && isCapsWord) {
        return originalWord.toUpperCase();
      }

      const lowerWord = originalWord.toLowerCase();
      const joinerKey = lowerWord.replace(/[^a-z]/g, '');
      const isPureAlphaWord = /^[a-z]+$/.test(lowerWord);
      if (i > 0 && isPureAlphaWord && joiners.has(joinerKey)) return lowerWord;

      return capitalizeFirstLetter(lowerWord);
    })
    .join(' ');

  return normalizeMeasurementText(titled);
}

function validateRequiredRowFields(tr, descriptionValue) {
  return REQUIRED_ROW_FIELDS
    .map(([field, label]) => {
      const input = tr.querySelector(`input[data-field="${field}"]`);
      const rawValue = field === 'description'
        ? String(descriptionValue || '').trim()
        : String(input?.value || '').trim();
      return rawValue ? null : { field, label };
    })
    .filter(Boolean);
}

function computeOrderStockQty(qtyRequired, stockOnHand) {
  const qty = Number(qtyRequired || 0);
  const stock = Number(stockOnHand || 0);
  return Math.max(qty - stock, 0);
}

function formatNumericField(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value).toFixed(2)).replace(/\.00$/, '');
}

function normalizeCatalogLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^[A-Za-z0-9][A-Za-z0-9\- ]*$/.test(raw)) return '';
  return raw
    .split(/\s+/)
    .map((part) => {
      if (/^\d+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizeLocationLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\s{2,}/g, ' ').toUpperCase();
}

function normalizeEventTagsValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const tokens = raw
    .replaceAll(',', '|')
    .split('|')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .filter((part) => /^[A-Z0-9_\-]+$/.test(part));
  const unique = Array.from(new Set(tokens));
  return unique.map((t) => `|${t}|`).join('');
}

function normalizeMeasurementText(value) {
  return String(value || '').replace(
    /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|km|in|ft|yd)\b/gi,
    (_, num, unit) => `${num}${String(unit).toLowerCase()}`,
  );
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
    const details = (h.fk_violation_rows || []).map((r) => {
      const key = r.item_id ? `${r.item_id} / ${r.item_name || '?'}` : `rowid=${r.rowid}`;
      return `${r.table}[${key}]`;
    }).join('  ·  ');
    setStatus(`⚠ FK violations (${h.foreign_key_violations}): ${details || 'see /api/health for detail'}`, true);
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
