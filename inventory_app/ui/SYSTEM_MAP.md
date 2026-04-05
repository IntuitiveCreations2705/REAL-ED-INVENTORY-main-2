# System Map (Backend ↔ Satellites)

Use this file as your **always-on visual reference**.

In VS Code: open this file, then **Markdown: Open Preview**.

---

## 1) Big Picture (how the system is wired)

```mermaid
flowchart LR
    U[Admin User] --> MUI[Admin Master View\nadmin_master_view.html + admin_master_view.js]
    U --> IUI[Item List View\nadmin_item_list_view.html + admin_item_list_view.js]

    MUI -->|HTTP /api/*| FLASK[Flask App\napp.py]
    IUI -->|HTTP /api/*| FLASK

    RUN[run_admin.py\nstartup + schema warning check] --> FLASK

    FLASK --> DBMOD[db.py\nget_conn + WAL + FK ON]
    FLASK --> AUD[audit.py\nappend-only audit writer]

    DBMOD --> SQLITE[(sql_inventory_master.db)]
    AUD --> SQLITE

    MIG[migrate.py] --> MIGSQL[inventory_app/migrations/*.sql]
    MIGSQL --> SQLITE

    SQLITE --> T1[(master_inventory)]
    SQLITE --> T2[(item_id_list)]
    SQLITE --> T3[(event_name)]
    SQLITE --> T4[(audit_log)]
    SQLITE --> T5[(users/roles)]
```

---

## 2) Backend API Surface (mental map)

```mermaid
flowchart TB
    A[/GET /api/health/] --> D[(DB + FK check)]
    B[/GET /api/master/] --> M[(master_inventory)]
    C[/PATCH /api/master/:row_id/] --> M
    E[/POST /api/master/:row_id/toggle-active/] --> M
    F[/POST /api/master/:row_id/link-item/] --> M
    F --> I[(item_id_list)]
    G[/GET /api/suggest?q=/] --> I
    H[/GET /api/events/] --> EV[(event_name)]
    I2[/GET /api/item-list/] --> I
    J[/POST /api/item-list/upsert/] --> I

    C --> L[(audit_log)]
    E --> L
    F --> L
    J --> L
```

---

## 3) Critical Interaction: Save Master Row

```mermaid
sequenceDiagram
    participant UI as Admin Master UI
    participant API as Flask app.py
    participant DB as SQLite
    participant AUD as audit.py

    UI->>API: PATCH /api/master/{row_id} + payload(version, fields)
    API->>DB: Read current row/version
    alt stale version
        API-->>UI: 409 stale_version
    else valid
        opt item_id supplied
            API->>DB: Validate item_id in item_id_list
            alt missing
                API-->>UI: 409 item_id_missing
            end
        end
        API->>DB: UPDATE master_inventory (version + 1, updated_at/by)
        API->>DB: PRAGMA foreign_key_check
        alt FK violation
            API-->>UI: 409 fk_violation
        else clean
            API->>AUD: write_audit(...)
            AUD->>DB: INSERT audit_log row(s)
            API-->>UI: 200 updated row
        end
    end
```

---

## 4) Data Backbone (core relationships)

```mermaid
erDiagram
    ITEM_ID_LIST ||--o{ MASTER_INVENTORY : "item_id"
    EVENT_NAME }o--o{ MASTER_INVENTORY : "event_tags text matching"
    MASTER_INVENTORY ||--o{ AUDIT_LOG : "changes logged"
    ITEM_ID_LIST ||--o{ AUDIT_LOG : "changes logged"
    USERS ||--o{ AUDIT_LOG : "changed_by (phase path)"
    ROLES ||--o{ USERS : "role_id"
```

---

## 5) Satellites and Their Purpose

- **Satellite A:** Master view UI
  - Focus: edit inventory rows, link/unlink items, active/inactive state.
- **Satellite B:** Item list UI
  - Focus: curate canonical `item_id` + `item_name` dictionary.
- **Core backend:** Flask + SQLite integrity rules + audit trail.

Think of it as:

- Satellites = operator screens
- Core = API + DB rules
- Spine = migrations + schema checks + audit log

---

## 6) “Where do I look when…” quick guide

- API behavior: [app.py](app.py)
- DB connection + pragmas: [db.py](db.py)
- Audit writes: [audit.py](audit.py)
- Startup / entrypoint: [run_admin.py](run_admin.py)
- Schema migration runner: [migrate.py](migrate.py)
- Master UI behavior: [static/admin_master_view.js](static/admin_master_view.js)
- Item List UI behavior: [static/admin_item_list_view.js](static/admin_item_list_view.js)

