const state = {
  rows: [],
  filteredRows: [],
  knownBoxes: [],
  knownLocations: [],
  events: [],
  themes: [],
};

const dirtyState = {
  rowId: null,
  edits: {},
};

const MAX_NOTE_LENGTH = 200;
const PREVIEW_NOTE_LENGTH = 50;

const els = {
  body: document.getElementById('rows-body'),
  statusBar: document.getElementById('status-bar'),
  refreshBtn: document.getElementById('refresh-btn'),
  searchDescription: document.getElementById('search-description'),
  boxFilter: document.getElementById('box-filter'),
  boxFilterOptions: document.getElementById('box-filter-options'),
  locationFilter: document.getElementById('location-filter'),
  locationFilterOptions: document.getElementById('location-filter-options'),
  eventFilter: document.getElementById('event-filter'),
  themeFilter: document.getElementById('theme-filter'),
  progressCounter: document.getElementById('progress-counter'),
  teamAdminNotesInput: document.getElementById('team-admin-notes-input'),
};

init();

async function init() {
  wireEvents();
  await loadEvents();
  await loadThemes();
  await loadRows();
  await loadTeamAdminNotes();
}

function wireEvents() {
  els.refreshBtn.addEventListener('click', async () => {
    if (guardDirtyRow('refreshing')) return;
    setStatus('Refreshing Event Stock Count…');
    resetFilters();
    resetNotesPanel();
    await loadEvents();
    await loadThemes();
    await loadRows();
    await loadTeamAdminNotes();
  });

  els.boxFilter.addEventListener('change', () => {
    if (guardDirtyRow('changing filters')) return;
    applyFilters();
  });
  els.boxFilter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (guardDirtyRow('changing filters')) return;
      applyFilters();
    }
  });

  els.locationFilter.addEventListener('change', () => {
    if (guardDirtyRow('changing filters')) return;
    applyFilters();
  });
  els.locationFilter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (guardDirtyRow('changing filters')) return;
      applyFilters();
    }
  });

  els.searchDescription.addEventListener('input', () => {
    if (guardDirtyRow('changing filters')) return;
    applyFilters();
  });
  els.eventFilter.addEventListener('change', () => {
    if (guardDirtyRow('changing filters')) return;
    applyFilters();
  });
  els.themeFilter.addEventListener('change', () => {
    if (guardDirtyRow('changing filters')) return;
    applyFilters();
  });

  if (els.body) {
    els.body.addEventListener('click', handleNoteAccordionClick);
    els.body.addEventListener('input', handleRowFieldInput);
    els.body.addEventListener('click', handleRowSaveClick);
  }

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);

  if (els.teamAdminNotesInput) {
    els.teamAdminNotesInput.addEventListener('input', debounce((e) => {
      saveTeamAdminNotesGlobal(e.target.value);
    }, 1000));
  }
}

async function loadRows() {
  setTableState('loading', 'Loading stock count data…');
  setStatus('Loading stock count data…');

  try {
    const res = await fetch('/api/event-stock-count');
    const data = await res.json();
    if (!res.ok) {
      setTableState('error', data.error || 'Failed to load stock count data. Try again.');
      setStatus(data.error || 'Load failed. Use Refresh to retry.', true);
      return;
    }
    state.rows = Array.isArray(data) ? data : [];
    refreshBoxOptions();
    refreshLocationOptions();
    applyFilters();
    setStatus(`Loaded ${state.rows.length} active rows.`);
  } catch (err) {
    setTableState('error', `Unable to reach server: ${err.message}. Check app is running and Refresh.`);
    setStatus('Load failed. Use Refresh to retry.', true);
  }
}

function resetFilters() {
  if (els.searchDescription) els.searchDescription.value = '';
  if (els.boxFilter) els.boxFilter.value = '';
  if (els.locationFilter) els.locationFilter.value = '';
  // eventFilter and themeFilter are intentionally preserved on refresh
}

function resetNotesPanel() {
  closeAllExpandedNotes();
}

async function loadEvents() {
  try {
    const res = await fetch('/api/events');
    state.events = (await res.json()) || [];
    populateEventFilter();
  } catch (err) {
    console.error('Error loading events:', err);
  }
}

async function loadThemes() {
  try {
    const res = await fetch('/api/themes');
    if (res.ok) {
      state.themes = (await res.json()) || [];
      populateThemeFilter();
    }
  } catch (err) {
    // Themes endpoint not available yet
    console.warn('Themes endpoint not available:', err);
  }
}

function populateEventFilter() {
  if (!els.eventFilter) return;
  const previous = els.eventFilter.value;

  const options = state.events.map((e) => {
    const opt = document.createElement('option');
    opt.value = e.event_name;
    opt.textContent = e.event_name;
    return opt;
  });

  const existing = els.eventFilter.querySelectorAll('option:not([value=""])');
  existing.forEach((opt) => opt.remove());

  options.forEach((opt) => els.eventFilter.appendChild(opt));

  // Restore previous selection if it still exists in the refreshed list
  if (previous && state.events.some((e) => e.event_name === previous)) {
    els.eventFilter.value = previous;
  }
}

function populateThemeFilter() {
  if (!els.themeFilter) return;
  const previous = els.themeFilter.value;

  const options = state.themes.map((t) => {
    const opt = document.createElement('option');
    opt.value = t.theme_name;
    opt.textContent = t.theme_name;
    return opt;
  });

  const existing = els.themeFilter.querySelectorAll('option:not([value=""])');
  existing.forEach((opt) => opt.remove());

  options.forEach((opt) => els.themeFilter.appendChild(opt));

  // Restore previous selection if it still exists in the refreshed list
  if (previous && state.themes.some((t) => t.theme_name === previous)) {
    els.themeFilter.value = previous;
  }
}

function refreshBoxOptions() {
  if (!els.boxFilterOptions) return;

  state.knownBoxes = Array.from(new Set(
    state.rows
      .map((r) => normalizeBoxValue(r.box_number))
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  els.boxFilterOptions.innerHTML = '';

  for (const box of state.knownBoxes) {
    const opt = document.createElement('option');
    opt.value = box;
    els.boxFilterOptions.appendChild(opt);
  }
}

function refreshLocationOptions() {
  if (!els.locationFilterOptions) return;

  state.knownLocations = Array.from(new Set(
    state.rows
      .map((r) => (r.storage_location || '').trim().toUpperCase())
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  els.locationFilterOptions.innerHTML = '';

  for (const location of state.knownLocations) {
    const opt = document.createElement('option');
    opt.value = location;
    els.locationFilterOptions.appendChild(opt);
  }
}

function applyFilters() {
  const desc = els.searchDescription.value.trim().toLowerCase();
  const box = normalizeBoxValue(els.boxFilter.value || '');
  const boxKey = canonicalBoxKey(box);
  const location = (els.locationFilter.value || '').trim().toUpperCase();
  const event = els.eventFilter.value;
  const theme = els.themeFilter.value;
  const selectedEvent = state.events.find((entry) => entry.event_name === event);
  const selectedEventTags = selectedEvent ? parsePipeTags(selectedEvent.tags) : [];

  state.filteredRows = state.rows.filter((r) => {
    if (desc && !(r.description || '').toLowerCase().includes(desc)) return false;
    if (boxKey && canonicalBoxKey(r.box_number) !== boxKey) return false;
    if (location && (r.storage_location || '').trim().toUpperCase() !== location) return false;
    if (event && event !== 'All') {
      const rowTags = parsePipeTags(r.event_tags);
      const matchesEvent = selectedEventTags.length
        ? selectedEventTags.some((tag) => rowTags.includes(tag))
        : false;
      if (!matchesEvent) return false;
    }
    if (theme && r.theme_name !== theme) return false;
    return true;
  });

  updateProgress();
  renderRows();
}

function renderRows() {
  els.body.innerHTML = '';

  for (const row of state.filteredRows) {
    const tr = document.createElement('tr');
    tr.dataset.rowId = String(row.row_id || '');
    const crewNotes = normalizeLegacyNoteValue(row.crew_notes);
    const restockComments = normalizeLegacyNoteValue(row.restock_comments);

    const dirtyEdits = dirtyState.rowId === Number(row.row_id) ? dirtyState.edits : {};
    const qtyRequired = dirtyEdits.qty_required ?? row.qty_required ?? 0;
    const stockOnHand = dirtyEdits.stock_on_hand ?? row.stock_on_hand ?? 0;
    const qtyFlagLimit = dirtyEdits.qty_flag_limit ?? row.qty_flag_limit;
    const orderStockQty = dirtyEdits.order_stock_qty ?? row.order_stock_qty ?? 0;

    tr.innerHTML = `
      <td class="mono">${escapeHtml(formatBoxDisplay(row))}</td>
      <td class="mono">${escapeHtml((row.storage_location || '').toUpperCase())}</td>
      <td class="col-description">${escapeHtml(row.description || '')}</td>
      <td class="mono"><input class="row-edit-input" data-row-id="${row.row_id}" data-field="qty_required" type="number" step="1" min="0" value="${escapeHtml(String(qtyRequired))}" /></td>
      <td class="mono"><input class="row-edit-input" data-row-id="${row.row_id}" data-field="stock_on_hand" type="number" step="1" min="0" value="${escapeHtml(String(stockOnHand))}" /></td>
      <td class="mono"><input class="row-edit-input" data-row-id="${row.row_id}" data-field="qty_flag_limit" type="number" step="1" min="0" value="${qtyFlagLimit == null ? '' : escapeHtml(String(qtyFlagLimit))}" /></td>
      <td class="mono"><input class="row-edit-input" data-row-id="${row.row_id}" data-field="order_stock_qty" type="number" step="1" min="0" value="${escapeHtml(String(orderStockQty))}" /></td>
      <td class="note-cell">${renderExpandableNoteCell('Crew Notes', crewNotes)}</td>
      <td class="note-cell">${renderExpandableNoteCell('Restock Comments', restockComments)}</td>
      <td>
        <button class="btn save-row-btn" type="button" data-row-id="${row.row_id}">Save</button>
      </td>
    `;

    els.body.appendChild(tr);
  }

  if (!state.filteredRows.length) {
    const hasFilters = [
      els.searchDescription?.value,
      els.boxFilter?.value,
      els.locationFilter?.value,
      els.eventFilter?.value,
      els.themeFilter?.value,
    ].some((v) => (v || '').trim());
    const msg = hasFilters
      ? 'No active rows match the current filters. Try clearing filters or selecting a different event.'
      : 'No active inventory rows found.';
    setTableState('empty', msg);
  }

  syncDirtyUi();
}

function guardDirtyRow(actionLabel = 'continuing') {
  if (dirtyState.rowId === null) return false;
  flashDirtyRow();
  setStatus(`Save row ${dirtyState.rowId} before ${actionLabel}.`, true);
  return true;
}

function flashDirtyRow() {
  if (!els.body || dirtyState.rowId === null) return;
  const tr = els.body.querySelector(`tr[data-row-id="${dirtyState.rowId}"]`);
  if (!tr) return;
  tr.classList.remove('row-dirty-flash');
  void tr.offsetWidth;
  tr.classList.add('row-dirty-flash');
}

function handleRowFieldInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (!input.classList.contains('row-edit-input')) return;

  const rowId = Number(input.dataset.rowId || 0);
  if (!rowId) return;

  if (dirtyState.rowId !== null && dirtyState.rowId !== rowId) {
    guardDirtyRow('editing another row');
    return;
  }

  const field = input.dataset.field;
  if (!field) return;

  if (dirtyState.rowId === null) {
    dirtyState.rowId = rowId;
    dirtyState.edits = {};
  }

  if (field === 'qty_flag_limit') {
    const raw = String(input.value || '').trim();
    dirtyState.edits[field] = raw === '' ? null : Number(raw);
  } else {
    dirtyState.edits[field] = Number(input.value || 0);
  }

  syncDirtyUi();
  setStatus(`Row ${rowId} has unsaved changes. Click Save.`);
}

function handleRowSaveClick(event) {
  const button = event.target.closest('.save-row-btn');
  if (!button || !els.body?.contains(button)) return;

  const rowId = Number(button.dataset.rowId || 0);
  if (!rowId) return;

  if (dirtyState.rowId !== null && dirtyState.rowId !== rowId) {
    guardDirtyRow('saving another row');
    return;
  }

  saveRow(rowId);
}

async function saveRow(rowId) {
  const row = state.rows.find((r) => Number(r.row_id) === rowId);
  if (!row) {
    setStatus(`Row ${rowId} not found. Refresh and retry.`, true);
    return;
  }

  const edits = dirtyState.rowId === rowId ? { ...dirtyState.edits } : {};
  if (!Object.keys(edits).length) {
    setStatus(`Row ${rowId}: no changes to save.`);
    return;
  }

  const payload = {
    version: row.version,
    ...edits,
  };

  if (Object.prototype.hasOwnProperty.call(edits, 'order_stock_qty')) {
    payload.order_stock_qty_manual_override = true;
  }

  try {
    const res = await fetch(`/api/master/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const idx = state.rows.findIndex((r) => Number(r.row_id) === rowId);
    if (idx >= 0) {
      state.rows[idx] = { ...state.rows[idx], ...data.row };
    }

    dirtyState.rowId = null;
    dirtyState.edits = {};
    setStatus(`Row ${rowId} saved.`);
    applyFilters();
  } catch (err) {
    setStatus(`Save failed for row ${rowId}: ${err.message}`, true);
  }
}

function syncDirtyUi() {
  if (!els.body) return;
  const rows = els.body.querySelectorAll('tr[data-row-id]');
  rows.forEach((tr) => {
    const rowId = Number(tr.dataset.rowId || 0);
    const isDirtyRow = dirtyState.rowId !== null && rowId === dirtyState.rowId;
    const isBlockedRow = dirtyState.rowId !== null && rowId !== dirtyState.rowId;

    tr.classList.toggle('row-dirty', isDirtyRow);
    tr.querySelectorAll('.row-edit-input, .save-row-btn').forEach((el) => {
      el.disabled = isBlockedRow;
    });
  });
}

function updateProgress() {
  if (!els.progressCounter) return;
  els.progressCounter.textContent = `Showing ${state.filteredRows.length} of ${state.rows.length}`;
}

function setStatus(message, isError = false) {
  if (els.statusBar) {
    els.statusBar.textContent = message;
    if (isError) {
      els.statusBar.classList.add('error');
    } else {
      els.statusBar.classList.remove('error');
    }
  }
}

/**
 * Render a shared table placeholder row for loading, error, or empty states.
 * @param {'loading'|'error'|'empty'} type
 * @param {string} message
 */
function setTableState(type, message) {
  if (!els.body) return;
  const colSpan = 10;
  els.body.innerHTML = `<tr><td colspan="${colSpan}" class="table-state table-state--${type}">
    <span class="table-state-icon">${type === 'loading' ? '⏳' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span class="table-state-msg">${escapeHtml(String(message))}</span>
    ${type === 'error' ? '<button class="btn secondary table-state-retry" type="button">Retry</button>' : ''}
  </td></tr>`;

  if (type === 'error') {
    els.body.querySelector('.table-state-retry')?.addEventListener('click', () => {
      loadRows();
    });
  }
}

function formatPreview(value) {
  const text = limitNoteText(value, PREVIEW_NOTE_LENGTH);
  if (!text) return '';
  return text;
}

function normalizeLegacyNoteValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const upper = text.toUpperCase();
  if (upper === 'NONE' || upper === '0') return '';
  return text;
}

function parsePipeTags(value) {
  return String(value || '')
    .split('|')
    .map((tag) => tag.trim().toUpperCase())
    .filter(Boolean);
}

function normalizeBoxValue(value) {
  return String(value || '').trim().replace(/\s{2,}/g, ' ').toUpperCase();
}

function canonicalBoxKey(value) {
  return normalizeBoxValue(value).replace(/[^A-Z0-9]/g, '');
}

function formatBoxDisplay(row) {
  const box = normalizeBoxValue(row.box_number || '');
  const rawLabel = String(row.box_label || '').trim();
  const label = rawLabel && rawLabel !== 'LABEL_PENDING' ? rawLabel : '';
  return label ? `${box} - ${label}` : box;
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function limitNoteText(value, maxLength = MAX_NOTE_LENGTH) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function renderExpandableNoteCell(kind, value) {
  const preview = formatPreview(value);
  const fullText = limitNoteText(value, MAX_NOTE_LENGTH);
  const isEmpty = fullText === '';
  const bubbleBody = escapeHtml(fullText).replace(/\n/g, '<br />');
  return `
    <button
      type="button"
      class="note-accordion${isEmpty ? ' is-empty' : ''}"
      data-note-kind="${escapeHtml(kind)}"
      aria-expanded="false"
    >
      <span class="note-accordion-preview">${escapeHtml(preview)}</span>
      <span class="note-accordion-bubble" hidden>
        <span class="note-accordion-title">${escapeHtml(kind)}</span>
        <span class="note-accordion-body">${bubbleBody}</span>
      </span>
    </button>
  `;
}

function handleNoteAccordionClick(event) {
  const button = event.target.closest('.note-accordion');
  if (!button || !els.body?.contains(button)) return;

  event.preventDefault();
  event.stopPropagation();

  const isExpanded = button.classList.contains('is-expanded');
  closeAllExpandedNotes();

  if (!isExpanded) {
    button.classList.add('is-expanded');
    button.setAttribute('aria-expanded', 'true');
    const bubble = button.querySelector('.note-accordion-bubble');
    if (bubble) bubble.hidden = false;
  }
}

function handleDocumentClick(event) {
  if (event.target.closest('.note-accordion')) return;
  closeAllExpandedNotes();
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closeAllExpandedNotes();
  }
}

function closeAllExpandedNotes() {
  document.querySelectorAll('.note-accordion.is-expanded').forEach((button) => {
    button.classList.remove('is-expanded');
    button.setAttribute('aria-expanded', 'false');
    const bubble = button.querySelector('.note-accordion-bubble');
    if (bubble) bubble.hidden = true;
  });
}

async function saveTeamAdminNotesGlobal(notes) {
  try {
    const res = await fetch('/api/ui-rules/team-admin-notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    setStatus('Team / Admin Notes saved.');
  } catch (err) {
    console.error('Error saving team admin notes:', err);
    setStatus('Error saving Team / Admin Notes.', true);
  }
}

async function loadTeamAdminNotes() {
  if (!els.teamAdminNotesInput) return;

  try {
    const res = await fetch('/api/ui-rules/team-admin-notes');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    els.teamAdminNotesInput.value = payload.notes || '';
  } catch (err) {
    console.error('Error loading team admin notes:', err);
    els.teamAdminNotesInput.value = '';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
