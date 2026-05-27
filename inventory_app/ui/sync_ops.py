"""
Sync Operations Module
─────────────────────────────────────────────────────────────────
Core git sync logic with fixed delay scheduling, conflict detection,
state tracking, and audit logging.

Phase 1: Fixed short delay (5-10s configurable), manual override always allowed,
audit trail for all operations. Adaptive delay deferred to Phase 2.
"""

from __future__ import annotations

import os
import re
import subprocess
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Any, Optional
from threading import Lock


def _log_sync_audit(event: dict[str, Any]) -> None:
    """
    Log sync operation to audit trail.
    Phase 1: Print to stderr for now; Phase 2 will wire to audit_log table.
    """
    record = {
        **event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    print(f"SYNC_AUDIT: {record}", file=__import__("sys").stderr)


@dataclass
class GitSyncState:
    """Represents current sync state for GET /api/sync/status."""

    last_pull_at: Optional[float] = None
    last_push_at: Optional[float] = None
    last_success_at: Optional[float] = None
    pull_queue_count: int = 0
    push_queue_count: int = 0
    delay_ms_remaining: int = 0
    trust_state: str = "waiting"  # waiting|syncing|success|delayed|failed|conflict
    conflict_detected: bool = False
    last_error: Optional[str] = None
    pending_pulls: list[str] = field(default_factory=list)
    pending_pushes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to JSON-serializable dict."""
        return asdict(self)


class GitSyncScheduler:
    """
    Fixed delay scheduler for git operations.

    Features:
    - Respects fixed delay between syncs (INVENTORY_SYNC_DELAY_MS, default 5000ms)
    - Allows unlimited manual override with force_now_bypass flag
    - Tracks queued operations (max INVENTORY_SYNC_MAX_QUEUED, default 3)
    - Detects conflicts during pull attempts
    - Provides state snapshots for UI rendering
    """

    def __init__(
        self,
        repo_path: str,
        delay_ms: int = 5000,
        max_queued: int = 3,
    ):
        """
        Initialize scheduler.

        Args:
            repo_path: Absolute path to git repository (repo-main)
            delay_ms: Minimum milliseconds between automatic syncs (manual always allowed)
            max_queued: Maximum pending operations before rejection
        """
        self.repo_path = repo_path
        self.delay_ms = delay_ms
        self.max_queued = max_queued
        self.state = GitSyncState()
        self._lock = Lock()

    def get_state(self) -> GitSyncState:
        """Get current sync state snapshot."""
        with self._lock:
            state_copy = GitSyncState(
                last_pull_at=self.state.last_pull_at,
                last_push_at=self.state.last_push_at,
                last_success_at=self.state.last_success_at,
                pull_queue_count=self.state.pull_queue_count,
                push_queue_count=self.state.push_queue_count,
                delay_ms_remaining=max(
                    0,
                    self.delay_ms - int((time.time() * 1000 - (self.state.last_success_at or 0)) * 1000)
                    if self.state.last_success_at
                    else 0,
                ),
                trust_state=self.state.trust_state,
                conflict_detected=self.state.conflict_detected,
                last_error=self.state.last_error,
                pending_pulls=self.state.pending_pulls.copy(),
                pending_pushes=self.state.pending_pushes.copy(),
            )
            return state_copy

    def _can_proceed_immediately(self, force_now_bypass: bool = False) -> bool:
        """Check if sync can proceed without waiting."""
        if force_now_bypass:
            return True
        if not self.state.last_success_at:
            return True
        elapsed_ms = (time.time() * 1000) - (self.state.last_success_at * 1000)
        return elapsed_ms >= self.delay_ms

    def _run_git_command(self, cmd: list[str], user_id: str = "system") -> dict[str, Any]:
        """
        Execute git command in repo with error capture.

        Returns:
            {"returncode": int, "stdout": str, "stderr": str}
        """
        try:
            result = subprocess.run(
                cmd,
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return {
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
            }
        except subprocess.TimeoutExpired:
            return {
                "returncode": -1,
                "stdout": "",
                "stderr": "Command timeout (30s exceeded)",
            }
        except Exception as exc:
            return {
                "returncode": -1,
                "stdout": "",
                "stderr": str(exc),
            }

    def _detect_conflicts(self, git_output: str) -> bool:
        """Check git output for conflict indicators."""
        conflict_patterns = [
            r"CONFLICT",
            r"merge conflict",
            r"both added",
            r"both modified",
            r"deleted by us",
            r"deleted by them",
        ]
        return any(re.search(pat, git_output, re.IGNORECASE) for pat in conflict_patterns)

    def pull(
        self,
        force_now_bypass: bool = False,
        respect_conflict_check: bool = True,
        user_id: str = "system",
    ) -> dict[str, Any]:
        """
        Execute git pull with delay respect and conflict detection.

        Args:
            force_now_bypass: If True, ignore delay (manual override always allowed)
            respect_conflict_check: If True, return 409 on conflict detection
            user_id: Audit trail user ID

        Returns:
            {
                "status": "success|conflict|error|queued",
                "message": str,
                "git_returncode": int,
                "git_output": str,
                "conflict_detected": bool,
                "delay_respected": bool,
                "queue_position": int,
            }
        """
        with self._lock:
            now_ms = time.time() * 1000

            # Check queue limits
            if self.state.pull_queue_count >= self.max_queued:
                self.state.pull_queue_count += 1
                self.state.pending_pulls.append(f"pull_{int(now_ms)}")
                _log_sync_audit(
                    {
                        "action": "sync_pull_rejected",
                        "reason": "queue_full",
                        "user_id": user_id,
                    }
                )
                return {
                    "status": "queued",
                    "message": f"Pull queue full ({self.max_queued}). Rejecting.",
                    "queue_position": self.state.pull_queue_count,
                }

            # Check delay
            can_proceed = self._can_proceed_immediately(force_now_bypass)
            delay_respected = not force_now_bypass

            if not can_proceed:
                self.state.pull_queue_count += 1
                self.state.pending_pulls.append(f"pull_{int(now_ms)}")
                self.state.trust_state = "delayed"
                _log_sync_audit(
                    {
                        "action": "sync_pull_delayed",
                        "reason": "waiting_for_delay",
                        "delay_ms": self.delay_ms,
                        "user_id": user_id,
                    }
                )
                return {
                    "status": "delayed",
                    "message": f"Pull delayed. Waiting {self.delay_ms}ms before next sync.",
                    "delay_ms": self.delay_ms,
                    "queue_position": self.state.pull_queue_count,
                }

            # Proceed with pull
            self.state.trust_state = "syncing"
            self.state.pull_queue_count = max(0, self.state.pull_queue_count - 1)

        # Execute outside lock to avoid blocking
        result = self._run_git_command(
            ["git", "pull", "--ff-only", "origin", "main"],
            user_id=user_id,
        )

        with self._lock:
            self.state.last_pull_at = now_ms / 1000

            # Check for conflicts
            combined_output = result["stdout"] + result["stderr"]
            conflict_detected = self._detect_conflicts(combined_output)

            if result["returncode"] == 0:
                self.state.trust_state = "success"
                self.state.last_success_at = now_ms / 1000
                self.state.conflict_detected = False
                status = "success"
                message = "Pull completed successfully."
            elif conflict_detected and respect_conflict_check:
                self.state.trust_state = "conflict"
                self.state.conflict_detected = True
                status = "conflict"
                message = "Merge conflict detected. Manual resolution required."
            else:
                self.state.trust_state = "failed"
                self.state.last_error = result["stderr"]
                status = "error"
                message = f"Pull failed: {result['stderr'][:200]}"

            _log_sync_audit(
                {
                    "action": "sync_pull",
                    "status": status,
                    "trigger_mode": "override" if force_now_bypass else "manual",
                    "conflict_detected": conflict_detected,
                    "git_returncode": result["returncode"],
                    "user_id": user_id,
                }
            )

            return {
                "status": status,
                "message": message,
                "git_returncode": result["returncode"],
                "git_output": combined_output,
                "conflict_detected": conflict_detected,
                "delay_respected": delay_respected,
                "queue_position": self.state.pull_queue_count,
            }

    def push(
        self,
        force_now_bypass: bool = False,
        user_id: str = "system",
    ) -> dict[str, Any]:
        """
        Execute git push with delay respect.

        Args:
            force_now_bypass: If True, ignore delay
            user_id: Audit trail user ID

        Returns:
            {
                "status": "success|error|queued",
                "message": str,
                "git_returncode": int,
                "git_output": str,
                "delay_respected": bool,
                "queue_position": int,
            }
        """
        with self._lock:
            now_ms = time.time() * 1000

            # Check queue limits
            if self.state.push_queue_count >= self.max_queued:
                self.state.push_queue_count += 1
                self.state.pending_pushes.append(f"push_{int(now_ms)}")
                _log_sync_audit(
                    {
                        "action": "sync_push_rejected",
                        "reason": "queue_full",
                        "user_id": user_id,
                    }
                )
                return {
                    "status": "queued",
                    "message": f"Push queue full ({self.max_queued}). Rejecting.",
                    "queue_position": self.state.push_queue_count,
                }

            # Check delay
            can_proceed = self._can_proceed_immediately(force_now_bypass)
            delay_respected = not force_now_bypass

            if not can_proceed:
                self.state.push_queue_count += 1
                self.state.pending_pushes.append(f"push_{int(now_ms)}")
                self.state.trust_state = "delayed"
                _log_sync_audit(
                    {
                        "action": "sync_push_delayed",
                        "reason": "waiting_for_delay",
                        "delay_ms": self.delay_ms,
                        "user_id": user_id,
                    }
                )
                return {
                    "status": "delayed",
                    "message": f"Push delayed. Waiting {self.delay_ms}ms before next sync.",
                    "delay_ms": self.delay_ms,
                    "queue_position": self.state.push_queue_count,
                }

            # Proceed with push
            self.state.trust_state = "syncing"
            self.state.push_queue_count = max(0, self.state.push_queue_count - 1)

        # Execute outside lock to avoid blocking
        result = self._run_git_command(
            ["git", "push", "origin", "main"],
            user_id=user_id,
        )

        with self._lock:
            self.state.last_push_at = now_ms / 1000

            if result["returncode"] == 0:
                self.state.trust_state = "success"
                self.state.last_success_at = now_ms / 1000
                self.state.conflict_detected = False
                status = "success"
                message = "Push completed successfully."
            else:
                self.state.trust_state = "failed"
                self.state.last_error = result["stderr"]
                status = "error"
                message = f"Push failed: {result['stderr'][:200]}"

            combined_output = result["stdout"] + result["stderr"]
            _log_sync_audit(
                {
                    "action": "sync_push",
                    "status": status,
                    "trigger_mode": "override" if force_now_bypass else "manual",
                    "git_returncode": result["returncode"],
                    "user_id": user_id,
                }
            )

            return {
                "status": status,
                "message": message,
                "git_returncode": result["returncode"],
                "git_output": combined_output,
                "delay_respected": delay_respected,
                "queue_position": self.state.push_queue_count,
            }


def create_scheduler(runtime_root: str) -> GitSyncScheduler:
    """
    Factory to create scheduler with config from environment.

    Reads:
    - INVENTORY_SYNC_DELAY_MS: milliseconds between syncs (default 5000)
    - INVENTORY_SYNC_MAX_QUEUED: max pending ops before rejection (default 3)
    - INVENTORY_RUNTIME_ROOT: path to repo-main (if not passed)
    """
    repo_path = runtime_root or os.getenv(
        "INVENTORY_RUNTIME_ROOT",
        "/Volumes/2000 MASTER/MASTER INVENTORY FOLDER/GITHUB REPOSITORY/repo-main",
    )
    delay_ms = int(os.getenv("INVENTORY_SYNC_DELAY_MS", "5000"))
    max_queued = int(os.getenv("INVENTORY_SYNC_MAX_QUEUED", "3"))

    return GitSyncScheduler(
        repo_path=repo_path,
        delay_ms=delay_ms,
        max_queued=max_queued,
    )
