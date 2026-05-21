# SmartHabbit — Users

_Generated 2026-05-19 17:37:06._

There are **9** active accounts in the local database.

## Login passwords

Every account whose username starts with one of `smoketest`, `alice_`, `diag`, `v2test`, `debug`, `full`, or `e2e` is a test account I created during smoke tests.  Their password has been **reset to `Test123!`**.  Other accounts (like `habitMaster`) keep their original password — they are real users and bcrypt hashes cannot be reversed.

## Account list

| Username | Email | Level | XP | Coins | Streak | Joined | Password |
|---|---|---:|---:|---:|---:|---|---|
| `smoketest` | smoke@test.com | 1 | 30 | 12 | 1 | 2026-05-14 | `Test123!` |
| `alice_1778784776` | alice+1778784776@test.com | 1 | 35 | 2 | 0 | 2026-05-14 | `Test123!` |
| `habitMaster` | habitMaster@gmail.com | 7 | 3602 | 46 | 15 | 2026-05-14 | _(unchanged — your real password)_ |
| `diag1778786231` | diag1778786231@test.com | 1 | 0 | 0 | 0 | 2026-05-14 | `Test123!` |
| `v2test1778835591` | v2test1778835591@test.com | 1 | 30 | 1001 | 0 | 2026-05-15 | `Test123!` |
| `debug1778835642` | debug1778835642@test.com | 1 | 0 | 1000 | 0 | 2026-05-15 | `Test123!` |
| `full1778835825` | full1778835825@test.com | 1 | 10 | 1230 | 0 | 2026-05-15 | `Test123!` |
| `e2e1778837116` | e2e1778837116@test.com | 1 | 0 | 1450 | 0 | 2026-05-15 | `Test123!` |
| `streak1778875098` | streak1778875098@test.com | 1 | 45 | 12 | 5 | 2026-05-15 | `Test123!` |

## Notes

- Passwords in the database are stored as bcrypt hashes (one-way). They cannot be read back. The list above shows the passwords I **set** for the test accounts in this script, not what was stored before.
- If you want to add new test accounts whose passwords this script will reset, follow the naming convention above (prefix with `smoketest`, `alice_`, etc.).
- This script is idempotent: re-running it always sets the test passwords back to `Test123!` and regenerates this file.
