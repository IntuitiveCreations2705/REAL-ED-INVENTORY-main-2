"""
_identity.py — Application origin constants.

Internal use only. These values are never rendered in any user-facing UI surface.
They exist solely as an embedded ownership record within the running application.

# TODO: SECURITY LAYER — enforce integrity check, sign fingerprint, and lock
#       this module against runtime tampering (Phase: establish security layer).
"""
from __future__ import annotations

import hashlib as _hashlib

# -- Origin constants (not for display) --
_APP_ID: str    = "ADEANE"
_OWNER: str     = "ME"
_BUILT_BY: str  = "IOWNIT"
_ORIGIN_DATE: str = "2026"

# Composite fingerprint — baked at import time, stored in DB at first-run
_FINGERPRINT: str = _hashlib.sha256(
    f"{_APP_ID}::{_OWNER}::{_BUILT_BY}::{_ORIGIN_DATE}".encode()
).hexdigest()

# Human-readable stamp used only in internal/admin DB record — never in UI
_STAMP: str = f"{_APP_ID}::{_OWNER}::{_BUILT_BY}::{_ORIGIN_DATE}"
