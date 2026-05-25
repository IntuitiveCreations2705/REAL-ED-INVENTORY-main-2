# TODO Questions & Future Considerations

This file captures questions, ideas, and Phase 2+ features that are **not yet approved or implemented**.  
Anything listed here is a **question to consider**, not an action item for the current build.

## From admin_master_view.html

### Q: Role specialization selector?
- **Where:** Header, Tier 2.2 area (after event scope)
- **Why:** Multi-role users may need to specialize their view or actions per role
- **Decision needed:** Is this required? What roles? When to implement?
- **Status:** QUESTION — document decision in `docs/DECISIONS.md` if approved

### Q: Device/BOX scope display badge?
- **Where:** Header role selector area
- **Why:** Make it explicit which device or BOX the user is currently scoped to
- **Decision needed:** Is this required? How to display? When to implement?
- **Status:** QUESTION — document decision in `docs/DECISIONS.md` if approved

### Q: Satellite sync conflict warning panel?
- **Where:** Controls section, below location filter
- **Why:** Alert users to edit conflicts or device sync issues
- **Decision needed:** Is this required? What conflicts are critical? When to implement?
- **Status:** QUESTION — document decision in `docs/DECISIONS.md` if approved

### Q: Device edit overlap warnings?
- **Where:** Conflict panel area
- **Why:** Warn if multiple devices are editing the same row simultaneously
- **Decision needed:** Is this required? What UI pattern? When to implement?
   - **Status:** QUESTION — document decision in `docs/DECISIONS.md` if approved

---

## From event_stock_count.html

### Q: Satellite device scope indicator?
- **Where:** Controls section header
- **Why:** Show which device/BOX the count is currently scoped to
- **Decision needed:** Is this required? What device prefix badge? When to implement?
- **Status:** QUESTION — document decision in `docs/DECISIONS.md` if approved

### Q: Last sync timestamp display?
- **Where:** Device scope indicator area
- **Why:** Inform users when the device last synced with the cloud/main DB
- **Decision needed:** Is this required? How to display? What timezone? When to implement?
- **Status:** QUESTION — document decision in `docs/DECISIONS.md` if approved

---

## From admin_item_list_view.html

### Q: Item catalog scope filter?
- **Where:** Header controls area
- **Why:** Allow team/role-specific visibility of items (not all teams need all items)
- **Decision needed:** Is this required? What role-item matrix? When to implement?
- **Status:** QUESTION — document decision in `docs/DECISIONS.md` if approved

### Q: Team/role-specific item visibility controls?
- **Where:** Item catalog filter area
- **Why:** Different teams may only need to work with certain item categories
- **Decision needed:** Is this required? What visibility rules? When to implement?
- **Status:** QUESTION — document decision in `docs/DECISIONS.md` if approved

---

## Notes

- Questions here are **not** code references; they are stored separately from implementation
- Move a question to `docs/DECISIONS.md` only after decision and approval
- Implement only after decision is recorded and sandbox2 testing is complete
- Do not reference these items in application code
