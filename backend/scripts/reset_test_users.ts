/**
 * Resets the password of every "test" account to a known string,
 * then writes USERS.md at the project root listing every active user.
 *
 *   npm run reset-test-users
 *
 * Real accounts (anyone whose username doesn't match the test regex below)
 * keep their existing password.
 */

import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { db } from '../src/config/database';

const TEST_PASSWORD = 'Test123!';
const TEST_USERNAME_RE = /^(smoketest|alice_|diag|v2test|debug|full|e2e|streak\d|chat\d)/i;
const USERS_MD = path.resolve(__dirname, '../../USERS.md');

async function main(): Promise<void> {
  await db.connect();

  const users = await db.query(
    `SELECT id, username, email, level, xp, coins, current_streak,
            max_streak, created_at
       FROM users
      WHERE deleted_at IS NULL
      ORDER BY created_at`
  );

  const testHash = await bcrypt.hash(TEST_PASSWORD, 10);

  let resetCount = 0;
  for (const u of users) {
    if (TEST_USERNAME_RE.test(u.username)) {
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [testHash, u.id]
      );
      resetCount++;
    }
  }

  // Write USERS.md
  const lines: string[] = [];
  lines.push('# SmartHabbit — Users');
  lines.push('');
  lines.push(`_Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')}._`);
  lines.push('');
  lines.push(`There are **${users.length}** active accounts in the local database.`);
  lines.push('');
  lines.push('## Login passwords');
  lines.push('');
  lines.push(`Every account whose username starts with one of \`smoketest\`, \`alice_\`, \`diag\`, \`v2test\`, \`debug\`, \`full\`, or \`e2e\` is a test account I created during smoke tests.  Their password has been **reset to \`${TEST_PASSWORD}\`**.  Other accounts (like \`habitMaster\`) keep their original password — they are real users and bcrypt hashes cannot be reversed.`);
  lines.push('');
  lines.push('## Account list');
  lines.push('');
  lines.push('| Username | Email | Level | XP | Coins | Streak | Joined | Password |');
  lines.push('|---|---|---:|---:|---:|---:|---|---|');
  for (const u of users) {
    const isTest = TEST_USERNAME_RE.test(u.username);
    const pw = isTest ? `\`${TEST_PASSWORD}\`` : '_(unchanged — your real password)_';
    const joined = new Date(u.created_at).toISOString().slice(0, 10);
    lines.push(
      `| \`${u.username}\` | ${u.email} | ${u.level} | ${u.xp} | ${u.coins} | ${u.current_streak} | ${joined} | ${pw} |`
    );
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(`- Passwords in the database are stored as bcrypt hashes (one-way). They cannot be read back. The list above shows the passwords I **set** for the test accounts in this script, not what was stored before.`);
  lines.push(`- If you want to add new test accounts whose passwords this script will reset, follow the naming convention above (prefix with \`smoketest\`, \`alice_\`, etc.).`);
  lines.push(`- This script is idempotent: re-running it always sets the test passwords back to \`${TEST_PASSWORD}\` and regenerates this file.`);
  lines.push('');

  fs.writeFileSync(USERS_MD, lines.join('\n'));

  console.log(`✓ Reset ${resetCount} test account(s) to "${TEST_PASSWORD}"`);
  console.log(`✓ USERS.md written → ${USERS_MD}`);

  await db.disconnect();
}

main().catch((e) => {
  console.error('reset_test_users failed:', e);
  process.exit(1);
});
