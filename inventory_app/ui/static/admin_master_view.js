import {
  formatAllowlistForInput,
  hasAllCapsWords,
  loadCaseAllowlist,
  normalizeDescriptionCase as sharedNormalizeDescriptionCase,
  resetCaseAllowlist as sharedResetCaseAllowlist,
  saveCaseAllowlist as sharedSaveCaseAllowlist,
} from './global_case_rules.js';

const state = {
  rows: [],
  filteredRows: [],
  suggestions: [],
  eventTagChoices: [],
  knownBoxes: [],
  knownLocations: [],
  events: [],
};

const SESSION_EVENT_KEY = 'admin.master.event';
const SESSION_VIEW_KEY = 'admin.master.view';

const els = {
  body: document.getElementById('rows-body'),
  rowTemplate: document.getElementById('row-template'),
  statusBar: document.getElementById('status-bar'),
  refreshBtn: document.getElementById('refresh-btn'),
  addRowBtn: document.getElementById('add-row-btn'),
  viewMode: document.getElementById('view-mode'),
  eventFilter: document.getElementById('event-filter'),
  boxFilter: document.getElementById('box-filter'),
  boxFilterOptions: document.getElementById('box-filter-options'),
  boxOptions: document.getElementById('box-options'),
  searchItem: document.getElementById('search-item'),
  themeSelect: document.getElementById('theme-select'),
  progressCounter: document.getElementById('progress-counter'),
  locationOptions: document.getElementById('location-options'),
  eventTagOptions: document.getElementById('event-tag-options'),
  eventTagsEditor: document.getElementById('event-tags-editor'),
  eventTagsSaveBtn: document.getElementById('event-tags-save-btn'),
  capsDialog: document.getElementById('caps-dialog'),
  capsYesBtn: document.getElementById('caps-yes-btn'),
  capsNoBtn: document.getElementById('caps-no-btn'),
  caseAllowlistInput: document.getElementById('case-allowlist-input'),
  caseAllowlistSaveBtn: document.getElementById('case-allowlist-save-btn'),
  caseAllowlistResetBtn: document.getElementById('case-allowlist-reset-btn'),
};

init();

async function init() {
  await hydrateCaseAllowlistInput();
  initCapsDialog();
  restoreSessionFilters();
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
    els.boxFilter.value = '';
    els.searchItem.value = '';
    await loadRows();
    await checkHealth();
  });

  if (els.addRowBtn) {
    els.addRowBtn.addEventListener('click', () => {
      const blank = {
        row_id: null,
        is_new: true,
        is_active: 1,
        item_id: null,
        item_name: null,
        box_number: null,
        storage_location: null,
        event_tags: '',
        description: '',
        qty_required: 0,
        stock_on_hand: 0,
        qty_flag_limit: null,
        order_stock_qty: 0,
        crew_notes: null,
        restock_comments: null,
        count_confirmed: 0,
        version: null,
      };
      state.rows.unshift(blank);
      applyFilters();
      setStatus('New row added. Link Item first, then complete and Save.');
    });
  }

  els.viewMode.addEventListener('change', async () => {
    persistSessionFilters();
    await loadRows();
  });
  els.boxFilter.addEventListener('change', applyFilters);
  els.boxFilter.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    applyFilters();
  });
  els.eventFilter.addEventListener('change', async () => {
    persistSessionFilters();
    syncEventTagsEditor();
    await loadRows();
  });

  els.searchItem.addEventListener('input', () => {
    applyFilters();
  });

  els.themeSelect.addEventListener('change', () => {
    document.documentElement.dataset.theme = els.themeSelect.value;
  });

  if (els.caseAllowlistSaveBtn) {
    els.caseAllowlistSaveBtn.addEventListener('click', async () => {
      await saveCaseAllowlistFromInput();
    });
  }

  if (els.caseAllowlistResetBtn) {
    els.caseAllowlistResetBtn.addEventListener('click', async () => {
      await resetCaseAllowlist();
    });
  }

  if (els.eventTagsSaveBtn) {
    els.eventTagsSaveBtn.addEventListener('click', async () => {
      await validateAndSaveSelectedEventTags();
    });
  }
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
  refreshBoxOptions();
  refreshLocationOptions();
  refreshEventTagOptions();
  applyFilters();
  setStatus(`Loaded ${state.rows.length} rows.`);
}

async function loadEvents() {
  const res = await fetch('/api/events');
  const events = await res.json();
  state.events = Array.isArray(events) ? events : [];

  const previouslySelected = sessionStorage.getItem(SESSION_EVENT_KEY) || els.eventFilter.value;

  els.eventFilter.innerHTML = '<option value="">EVERYTHING</option>';
  for (const e of events) {
    const opt = document.createElement('option');
    opt.value = e.event_name;
    opt.textContent = e.event_name === 'All' ? 'ALL EVENTS' : e.event_name;
    els.eventFilter.appendChild(opt);
  }

  const eventNames = new Set(state.events.map((e) => e.event_name));
  if (previouslySelected && eventNames.has(previouslySelected)) {
    els.eventFilter.value = previouslySelected;
  }

  persistSessionFilters();
  syncEventTagsEditor();
}

function restoreSessionFilters() {
  const savedView = sessionStorage.getItem(SESSION_VIEW_KEY);
  if (savedView && Array.from(els.viewMode.options).some((o) => o.value === savedView)) {
    els.viewMode.value = savedView;
  }
}

function persistSessionFilters() {
  sessionStorage.setItem(SESSION_EVENT_KEY, els.eventFilter.value || '');
  sessionStorage.setItem(SESSION_VIEW_KEY, els.viewMode.value || 'all');
}

function getSelectedEventDefinition() {
  const selected = els.eventFilter.value;
  if (!selected) return null;
  return state.events.find((e) => e.event_name === selected) || null;
}

function clearEventTagsInputError() {
  if (!els.eventTagsEditor) return;
  els.eventTagsEditor.classList.remove('input-invalid');
  els.eventTagsEditor.removeAttribute('title');
}

function setEventTagsInputError(message) {
  if (!els.eventTagsEditor) return;
  els.eventTagsEditor.classList.add('input-invalid');
  els.eventTagsEditor.title = message;
}

function syncEventTagsEditor() {
  if (!els.eventTagsEditor || !els.eventTagsSaveBtn) return;

  clearEventTagsInputError();
  const selectedEvent = getSelectedEventDefinition();
  if (!selectedEvent) {
    els.eventTagsEditor.value = '';
    els.eventTagsEditor.disabled = true;
    els.eventTagsSaveBtn.disabled = true;
    return;
  }

  els.eventTagsEditor.disabled = false;
  els.eventTagsSaveBtn.disabled = false;
  els.eventTagsEditor.value = String(selectedEvent.tags || '');
}

async function validateAndSaveSelectedEventTags() {
  if (!els.eventTagsEditor || !els.eventTagsSaveBtn) return;

  const selectedEvent = getSelectedEventDefinition();
  if (!selectedEvent) {
    setStatus('Select a specific Event before editing tags.', true);
    return;
  }

  clearEventTagsInputError();
  const payload = { tags: els.eventTagsEditor.value };

  const res = await fetch(`/api/events/${encodeURIComponent(selectedEvent.event_name)}/tags`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!res.ok) {
    const message = data.error || 'Event tags update failed.';
    if (data.field === 'tags') {
      setEventTagsInputError(message);
      els.eventTagsEditor.focus();
    }
    setStatus(message, true);
    return;
  }

  els.eventTagsEditor.value = String(data.tags || '');
  const idx = state.events.findIndex((e) => e.event_name === data.event_name);
  if (idx >= 0) {
    state.events[idx] = data;
  }
  clearEventTagsInputError();
  setStatus(`Saved tags for ${data.event_name}.`);
  await loadRows();
}

function applyFilters() {
  const view = els.viewMode.value;
  const box = normalizeBoxValue(els.boxFilter.value);
  const desc = els.searchItem.value.trim().toLowerCase();

  state.filteredRows = state.rows.filter((r) => {
    if (view === 'active' && r.is_active !== 1) return false;
    if (view === 'inactive' && r.is_active !== 0) return false;
    if (view === 'unlinked' && (r.item_id !== null && r.item_id !== '')) return false;
    if (view === 'linked' && (r.item_id === null || r.item_id === '')) return false;
    if (box && normalizeBoxValue(r.box_number) !== box) return false;
    if (desc && !(r.description || '').toLowerCase().includes(desc)) return false;
    return true;
  });
  updateProgress();
  renderRows();
}

function refreshEventTagOptions() {
  if (!els.eventTagOptions) return;

  const tags = Array.from(new Set(
    state.rows.flatMap((r) => String(r.event_tags || '')
      .split('|')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
      .filter((t) => t !== 'ALL')),
  )).sort((a, b) => a.localeCompare(b));

  state.eventTagChoices = tags;

  els.eventTagOptions.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = '|ALL|';
  els.eventTagOptions.appendChild(allOption);

  for (const tag of tags) {
    const opt = document.createElement('option');
    opt.value = `|${tag}|`;
    els.eventTagOptions.appendChild(opt);
  }
}

function refreshBoxOptions() {
  if (!els.boxOptions) return;

  state.knownBoxes = Array.from(new Set(
    state.rows
      .map((r) => normalizeBoxValue(r.box_number))
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  els.boxOptions.innerHTML = '';

  for (const box of state.knownBoxes) {
    const opt = document.createElement('option');
    opt.value = box;
    els.boxOptions.appendChild(opt);
  }

  const addNew = document.createElement('option');
  addNew.value = '__ADD_NEW__';
  addNew.label = 'ADD NEW';
  els.boxOptions.appendChild(addNew);

  if (els.boxFilterOptions) {
    els.boxFilterOptions.innerHTML = '';
    for (const box of state.knownBoxes) {
      const opt = document.createElement('option');
      opt.value = box;
      els.boxFilterOptions.appendChild(opt);
    }
  }
}

function refreshLocationOptions() {
  if (!els.locationOptions) return;

  state.knownLocations = Array.from(new Set(
    state.rows
      .map((r) => String(r.storage_location || '').trim().toUpperCase())
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  els.locationOptions.innerHTML = '';

  for (const location of state.knownLocations) {
    const opt = document.createElement('option');
    opt.value = location;
    els.locationOptions.appendChild(opt);
  }

  const addNew = document.createElement('option');
  addNew.value = '__ADD_NEW__';
  addNew.label = 'ADD NEW';
  els.locationOptions.appendChild(addNew);
}

function renderRows() {
  els.body.innerHTML = '';

  for (const row of state.filteredRows) {
    const tr = els.rowTemplate.content.firstElementChild.cloneNode(true);
    tr.dataset.rowId = row.row_id;

    tr.querySelector('.row-id').textContent = row.row_id ?? 'NEW';

    const linkCell = tr.querySelector('.link-status');
    const isLinked = row.item_id !== null && row.item_id !== '';
    linkCell.innerHTML = isLinked
      ? '<span class="badge badge-linked">&#10003; Linked</span>'
      : '<span class="badge badge-unlinked">&#9679; Unlinked</span>';
    const saveBtn = tr.querySelector('.save-btn');
    saveBtn.disabled = !isLinked;
    saveBtn.title = isLinked ? '' : 'Link item first to unlock Save.';

    const stateBtn = tr.querySelector('.state-toggle');
    syncStateBtn(stateBtn, row.is_active);
    stateBtn.disabled = row.row_id == null;
    stateBtn.title = row.row_id == null ? 'Save row first to enable State toggle.' : '';
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
        if (field === 'qty_flag_limit') {
          row[field] = input.value === '' ? null : Number(input.value);
          return;
        }
        row[field] = input.type === 'number' ? Number(input.value || 0) : input.value;
      });
    }

    // Per-row item_name inline suggestion
    const itemNameInput = tr.querySelector('input[data-field="item_name"]');
    const boxInput = tr.querySelector('input[data-field="box_number"]');
    const locationInput = tr.querySelector('input[data-field="storage_location"]');
    const tagsInput = tr.querySelector('input[data-field="event_tags"]');
    const stockInput = tr.querySelector('input[data-field="stock_on_hand"]');
    const qtyFlagLimitInput = tr.querySelector('input[data-field="qty_flag_limit"]');
    const rowSuggestBox = tr.querySelector('.row-suggestions');

    const applyQtyFlagState = () => {
      const stock = Number(row.stock_on_hand || 0);
      const limit = row.qty_flag_limit === null || row.qty_flag_limit === '' || row.qty_flag_limit === undefined
        ? null
        : Number(row.qty_flag_limit);

      if (limit !== null && !Number.isNaN(limit) && stock < limit) {
        tr.classList.add('row-low-stock');
        tr.title = `Stock ${stock} is below flag limit ${limit}.`;
      } else {
        tr.classList.remove('row-low-stock');
        tr.removeAttribute('title');
      }
    };

    if (stockInput) {
      stockInput.addEventListener('input', applyQtyFlagState);
    }
    if (qtyFlagLimitInput) {
      qtyFlagLimitInput.addEventListener('input', applyQtyFlagState);
    }
    applyQtyFlagState();

    if (boxInput) {
      boxInput.addEventListener('focus', () => {
        boxInput.dataset.prevValue = String(boxInput.value || '');
      });

      boxInput.addEventListener('input', () => {
        const normalized = normalizeBoxValue(boxInput.value);
        boxInput.value = normalized;
        row.box_number = normalized;
      });

      boxInput.addEventListener('change', () => {
        if (String(boxInput.value || '').trim() === '__ADD_NEW__') {
          const allowed = isSeniorAdminSession() || window.confirm('Admin validation required for ADD NEW Box. Continue?');
          if (!allowed) {
            const revert = normalizeBoxValue(boxInput.dataset.prevValue || '');
            boxInput.value = revert;
            row.box_number = revert;
            setStatus('ADD NEW Box cancelled.', true);
            return;
          }

          boxInput.value = '';
          row.box_number = '';
          boxInput.focus();
          setStatus('ADD NEW Box approved. Enter new box value and Save.');
          return;
        }

        const normalized = normalizeBoxValue(boxInput.value);
        boxInput.value = normalized;
        row.box_number = normalized;
      });
    }

    if (locationInput) {
      locationInput.addEventListener('focus', () => {
        locationInput.dataset.prevValue = String(locationInput.value || '');
      });

      locationInput.addEventListener('input', () => {
        const normalized = normalizeLocationValue(locationInput.value);
        locationInput.value = normalized;
        row.storage_location = normalized;
      });

      locationInput.addEventListener('change', () => {
        if (String(locationInput.value || '').trim() === '__ADD_NEW__') {
          const allowed = isSeniorAdminSession() || window.confirm('Admin validation required for ADD NEW Location. Continue?');
          if (!allowed) {
            const revert = normalizeLocationValue(locationInput.dataset.prevValue || '');
            locationInput.value = revert;
            row.storage_location = revert;
            setStatus('ADD NEW Location cancelled.', true);
            return;
          }

          locationInput.value = '';
          row.storage_location = '';
          locationInput.focus();
          setStatus('ADD NEW Location approved. Enter new location in ALL CAPS and Save.');
          return;
        }

        const normalized = normalizeLocationValue(locationInput.value);
        locationInput.value = normalized;
        row.storage_location = normalized;
      });
    }

    if (tagsInput) {
      tagsInput.addEventListener('blur', () => {
        const normalized = normalizeEventTagsValue(tagsInput.value);
        tagsInput.value = normalized;
        row.event_tags = normalized;
      });
    }

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
          if (row.row_id == null) {
            row.item_id = s.item_id;
            row.item_name = s.item_name;
            itemNameInput.value = s.item_name;
            tr.querySelector('input[data-field="item_id"]').value = s.item_id;
            rowSuggestBox.style.display = 'none';
            rowSuggestBox.innerHTML = '';
            const localLinkCell = tr.querySelector('.link-status');
            localLinkCell.innerHTML = '<span class="badge badge-linked">&#10003; Linked</span>';
            saveBtn.disabled = false;
            saveBtn.title = '';
            updateProgress();
            setStatus('New row linked. Complete required fields and Save.');
            return;
          }

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
          saveBtn.disabled = false;
          saveBtn.title = '';
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

    saveBtn.addEventListener('click', async () => {
      const descriptionInput = tr.querySelector('input[data-field="description"]');
      const crewNotesInput = tr.querySelector('input[data-field="crew_notes"]');
      const restockCommentsInput = tr.querySelector('input[data-field="restock_comments"]');

      let descriptionValue = stripBrackets(descriptionInput.value || '');
      let crewNotesValue = stripBrackets(crewNotesInput.value || '');
      let restockCommentsValue = stripBrackets(restockCommentsInput.value || '');

      const shouldPromptCaps =
        hasAllCapsWords(descriptionValue) ||
        hasAllCapsWords(crewNotesValue) ||
        hasAllCapsWords(restockCommentsValue);

      const keepCapsWords = shouldPromptCaps ? await askRequireCaps() : false;

      descriptionValue = normalizeDescriptionCase(descriptionValue, keepCapsWords);
      crewNotesValue = normalizeDescriptionCase(crewNotesValue, keepCapsWords);
      restockCommentsValue = normalizeDescriptionCase(restockCommentsValue, keepCapsWords);

      descriptionInput.value = descriptionValue;
      crewNotesInput.value = crewNotesValue;
      restockCommentsInput.value = restockCommentsValue;

      const payload = {
        item_id: tr.querySelector('input[data-field="item_id"]').value || null,
        item_name: tr.querySelector('input[data-field="item_name"]').value || null,
        box_number: normalizeBoxValue(tr.querySelector('input[data-field="box_number"]').value) || null,
        storage_location: normalizeLocationValue(tr.querySelector('input[data-field="storage_location"]').value) || null,
        event_tags: normalizeEventTagsValue(tr.querySelector('input[data-field="event_tags"]').value) || null,
        description: descriptionValue || null,
        qty_required: tr.querySelector('input[data-field="qty_required"]').value || 0,
        stock_on_hand: tr.querySelector('input[data-field="stock_on_hand"]').value || 0,
        qty_flag_limit: tr.querySelector('input[data-field="qty_flag_limit"]').value || null,
        order_stock_qty: tr.querySelector('input[data-field="order_stock_qty"]').value || null,
        crew_notes: crewNotesValue || null,
        restock_comments: restockCommentsValue || null,
      };

      if (!payload.item_id) {
        tr.classList.add('row-discrepancy');
        saveBtn.disabled = true;
        saveBtn.title = 'Link item first to unlock Save.';
        return setStatus(`Row ${row.row_id}: WARNING unlinked item. SAVE locked until linked.`, true);
      }

      const missing = getMissingRequiredFields(payload);
      if (missing.length > 0) {
        tr.classList.add('row-discrepancy');
        return setStatus(`Row ${row.row_id}: complete row before save. Missing: ${missing.join(', ')}`, true);
      }

      if (!payload.item_id && payload.item_name) {
        tr.classList.add('row-discrepancy');
        return setStatus(`Row ${row.row_id}: item_name cannot be set without item_id.`, true);
      }

      const isNewRow = row.row_id == null;
      const res = await fetch(isNewRow ? '/api/master' : `/api/master/${row.row_id}`, {
        method: isNewRow ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        tr.classList.add('row-discrepancy');
        return setStatus(`Row ${row.row_id}: ${data.error || 'Save failed'}`, true);
      }

      tr.classList.remove('row-discrepancy');

      Object.assign(row, data.row, { is_new: false });
  refreshBoxOptions();
      refreshLocationOptions();
      setStatus(`${isNewRow ? 'Created' : 'Saved'} row ${row.row_id}.`);
      await checkHealth();
      renderRows();
    });

    els.body.appendChild(tr);
  }
}

function normalizeDescriptionCase(value, keepCapsWords) {
  return sharedNormalizeDescriptionCase(value, keepCapsWords);
}

async function hydrateCaseAllowlistInput() {
  if (!els.caseAllowlistInput) return;
  const tokens = await loadCaseAllowlist();
  els.caseAllowlistInput.value = formatAllowlistForInput(tokens);
}

async function saveCaseAllowlistFromInput() {
  if (!els.caseAllowlistInput) return;
  const result = await sharedSaveCaseAllowlist(els.caseAllowlistInput.value);
  if (!result.ok) {
    setStatus(result.error, true);
    return;
  }

  els.caseAllowlistInput.value = formatAllowlistForInput(result.tokens);
  setStatus(`Admin allow list saved (${result.tokens.length} term${result.tokens.length === 1 ? '' : 's'}).`);
}

async function resetCaseAllowlist() {
  const tokens = await sharedResetCaseAllowlist();
  if (els.caseAllowlistInput) {
    els.caseAllowlistInput.value = formatAllowlistForInput(tokens);
  }
  setStatus('Admin allow list reset to defaults.');
}

function stripBrackets(value) {
  return String(value || '')
    .replace(/[\[\](){}]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getMissingRequiredFields(payload) {
  const requiredText = [
    ['item_id', 'Item ID'],
    ['item_name', 'Item Name'],
    ['box_number', 'Box'],
    ['storage_location', 'Location'],
    ['event_tags', 'Event Tags'],
    ['description', 'Description'],
  ];

  const missing = [];
  for (const [field, label] of requiredText) {
    if (!String(payload[field] || '').trim()) missing.push(label);
  }

  if (payload.qty_required === '' || Number.isNaN(Number(payload.qty_required))) missing.push('Qty Req');
  if (payload.stock_on_hand === '' || Number.isNaN(Number(payload.stock_on_hand))) missing.push('Stock');

  return missing;
}

function normalizeEventTagTokens(value) {
  return Array.from(new Set(
    String(value || '')
      .replaceAll(',', '|')
      .split('|')
      .map((part) => part.trim().toUpperCase())
      .filter(Boolean)
      .filter((part) => /^[A-Z0-9_\-]+$/.test(part)),
  ));
}

function normalizeLocationValue(value) {
  return String(value || '').trim().replace(/\s{2,}/g, ' ').toUpperCase();
}

function normalizeBoxValue(value) {
  return String(value || '').trim().replace(/\s{2,}/g, ' ').toUpperCase();
}

function isSeniorAdminSession() {
  const role = String(window.__USER_ROLE__ || window.APP_USER_ROLE || '').trim().toLowerCase();
  return role === 'senior_admin' || role === 'senior-admin' || role === 'senior admin' || role === 'admin';
}

function normalizeEventTagsValue(value) {
  const tokens = normalizeEventTagTokens(value);
  if (!tokens.length) return '';
  if (tokens.includes('ALL')) return '|ALL|';

  return tokens.map((t) => `|${t}|`).join('');
}

function mergeEventTagSelections(beforeValue, afterValue) {
  const selected = normalizeEventTagTokens(afterValue);
  if (selected.includes('ALL')) return '|ALL|';

  const before = normalizeEventTagTokens(beforeValue).filter((t) => t !== 'ALL');
  const merged = Array.from(new Set([...before, ...selected]));

  return merged.map((t) => `|${t}|`).join('');
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
