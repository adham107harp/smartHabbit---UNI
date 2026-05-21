/**
 * Manual trigger for the punishment sweep. Useful for tests + admin tasks.
 *
 *   npm run punish-now
 */
import { db } from '../src/config/database';
import { runPunishmentNow } from '../src/jobs/punishmentJob';

(async () => {
  await db.connect();
  try {
    await runPunishmentNow();
    console.log('Done.');
  } catch (e) {
    console.error('Punish-now failed:', e);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
})();
