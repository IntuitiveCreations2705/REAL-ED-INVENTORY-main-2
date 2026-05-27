#!/usr/bin/env python3
"""Test sync_ops module functionality"""

from sync_ops import create_scheduler

sched = create_scheduler('/Volumes/2000 MASTER/MASTER INVENTORY FOLDER/GITHUB REPOSITORY/repo-main')

# Test 1: Pull (should succeed)
print("=== Test 1: Pull ===")
result1 = sched.pull(user_id="test@example.com")
print(f"Status: {result1['status']}")
print(f"Message: {result1['message']}")
print(f"Returncode: {result1['git_returncode']}")

# Test 2: Pull again immediately (should be delayed)
print("\n=== Test 2: Pull again (should be delayed) ===")
result2 = sched.pull(user_id="test@example.com")
print(f"Status: {result2['status']}")
print(f"Message: {result2['message']}")
print(f"Queue position: {result2.get('queue_position', 'N/A')}")

# Test 3: Pull with force_now_bypass (should succeed, respect override)
print("\n=== Test 3: Pull with force_now_bypass=True ===")
result3 = sched.pull(force_now_bypass=True, user_id="test@example.com")
print(f"Status: {result3['status']}")
print(f"Message: {result3['message']}")
print(f"Delay respected: {result3['delay_respected']}")

# Test 4: Check state
print("\n=== Current State ===")
state = sched.get_state()
print(f"Trust state: {state.trust_state}")
print(f"Last pull at: {state.last_pull_at}")
print(f"Last success at: {state.last_success_at}")
print(f"Pending pulls: {len(state.pending_pulls)}")

# Test 5: Push
print("\n=== Test 4: Push ===")
result_push = sched.push(force_now_bypass=True, user_id="test@example.com")
print(f"Status: {result_push['status']}")
print(f"Message: {result_push['message']}")

print("\n✓ All tests completed successfully")
