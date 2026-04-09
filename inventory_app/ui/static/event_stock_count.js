const state = {
  rows: [],
  filteredRows: [],
  knownBoxes: [],
  knownLocations: [],
  events: [],
  themes: [],
};

const MAX_NOTE_LENGTH = 200;

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
    setStatus('Refreshing Event Stock Count…');
    resetFilters();
    resetNotesPanel();
    await loadEvents();
    await loadThemes();
    await loadRows();
    await loadTeamAdminNotes();
  });

  els.boxFilter.addEventListener('change', () => applyFilters());
  els.boxFilter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyFilters();
    }
  });

  els.locationFilter.addEventListener('change', () => applyFilters());
  els.locationFilter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyFilters();
    }
  });

  els.searchDescription.addEventListener('input', () => applyFilters());
  els.eventFilter.addEventListener('change', () => applyFilters());
  els.themeFilter.addEventListener('change', () => applyFilters());

  if (els.body) {
    els.body.addEventListener('click', handleNoteAccordionClick);
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
  try {
    const res = await fetch('/api/event-stock-count');
    state.rows = await res.json();
    refreshBoxOptions();
    refreshLocationOptions();
    applyFilters();
    setStatus(`Loaded ${state.rows.length} active rows.`);
  } catch (err) {
    setStatus(`Error loading rows: ${err.message}`, true);
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
      .map((r) => (r.box_number || '').trim())
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
  const box = (els.boxFilter.value || '').trim();
  const location = (els.locationFilter.value || '').trim().toUpperCase();
  const event = els.eventFilter.value;
  const theme = els.themeFilter.value;
  const selectedEvent = state.events.find((entry) => entry.event_name === event);
  const selectedEventTags = selectedEvent ? parsePipeTags(selectedEvent.tags) : [];

  state.filteredRows = state.rows.filter((r) => {
    if (desc && !(r.description || '').toLowerCase().includes(desc)) return false;
    if (box && (r.box_number || '').trim() !== box) return false;
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
    const viewHref = row.row_id ? `/?row=${encodeURIComponent(row.row_id)}` : '/';
    tr.innerHTML = `
      <td class="mono">${escapeHtml(row.box_number || '')}</td>
      <td class="mono">${escapeHtml((row.storage_location || '').toUpperCase())}</td>
      <td class="col-description">${escapeHtml(row.description || '')}</td>
      <td class="mono">${row.qty_required || 0}</td>
      <td class="mono">${row.stock_on_hand || 0}</td>
      <td class="mono">${row.qty_flag_limit || '-'}</td>
      <td class="mono">${row.order_stock_qty || 0}</td>
      <td class="note-cell">${renderExpandableNoteCell('Crew Notes', row.crew_notes)}</td>
      <td class="note-cell">${renderExpandableNoteCell('Restock Comments', row.restock_comments)}</td>
      <td>
        <a class="btn secondary small" href="${viewHref}">View</a>
      </td>
    `;

    els.body.appendChild(tr);
  }

  if (!state.filteredRows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="10" class="stock-count-empty">No active rows match the current filters.</td>';
    els.body.appendChild(tr);
  }
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

function formatPreview(value) {
  const text = limitNoteText(value);
  if (!text) return 'No notes';
  return text;
}

function parsePipeTags(value) {
  return String(value || '')
    .split('|')
    .map((tag) => tag.trim().toUpperCase())
    .filter(Boolean);
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function limitNoteText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= MAX_NOTE_LENGTH) return text;
  return `${text.slice(0, MAX_NOTE_LENGTH - 1)}…`;
}

function renderExpandableNoteCell(kind, value) {
  const text = formatPreview(value);
  const isEmpty = text === 'No notes';
  const bubbleBody = escapeHtml(text).replace(/\n/g, '<br />');
  return `
    <button
      type="button"
      class="note-accordion${isEmpty ? ' is-empty' : ''}"
      data-note-kind="${escapeHtml(kind)}"
      aria-expanded="false"
    >
      <span class="note-accordion-preview">${escapeHtml(text)}</span>
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
