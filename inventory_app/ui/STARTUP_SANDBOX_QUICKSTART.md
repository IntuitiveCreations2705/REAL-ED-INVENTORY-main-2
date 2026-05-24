# Startup Sandbox Quickstart

Use exactly one launcher script per sandbox. The script name is the truth.

## The rule to memorize

- `./start_sandbox1.sh IMPLEMENT` = SB1 MASTER
- `./start_sandbox2.sh IMPLEMENT` = SB2 TEST
- `./start_sandbox3.sh IMPLEMENT` = SB3 APPLICATION

## What each script does

Each script now sets all three things explicitly before starting the UI:

1. the database path
2. the port
3. the sandbox label shown at startup and in the UI badge

## Ports

- SB1 → `http://127.0.0.1:5050`
- SB2 → `http://127.0.0.1:5051`
- SB3 → `http://127.0.0.1:5052`

## Zero-thought startup ritual

From the project root:

1. Decide the sandbox first.
2. Run the matching script.
3. Check the badge in the header.
4. Confirm `/api/health` reports the DB you expected.

## Example

If you want SB2, do this and nothing else:

`./start_sandbox2.sh IMPLEMENT`

Then verify:

- badge says `SB2`
- browser URL is `http://127.0.0.1:5051`
- `/api/health` shows `sql_inventory_sb2.db`

## Safety check phrase

Before editing data, say this sentence:

> I checked badge, port, and `/api/health` before touching data.

## Fast diagnosis when something feels wrong

If the wrong sandbox appears, stop and check these in order:

1. Did I run the correct `start_sandbox*.sh` script?
2. Does the browser URL match the expected port?
3. Does `/api/health` show the expected DB file?

If any answer is no, stop editing and restart with the correct script.