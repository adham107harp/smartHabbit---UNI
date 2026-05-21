/* =========================================================================
   reminders.js — in-page browser notifications for habit reminders.
   Uses the Notification API + a setTimeout per habit.

   Limitation: fires only while the tab is open. Real push notifications
   would require a service worker + Web Push endpoint, which is out of
   scope for v3 (documented in DEPLOY.md).
   ========================================================================= */
(function (global) {
  const FIRED_KEY_PREFIX = 'sh_reminder_fired_';

  /** Has Notification permission been granted? */
  function permission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  async function requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted')   return 'granted';
    if (Notification.permission === 'denied')    return 'denied';
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  /**
   * Returns ms from now until the next occurrence of HH:MM today.
   * If the time has already passed today, returns null (we don't roll over
   * to tomorrow — the next page load on the next day will pick it up).
   */
  function msUntil(hhmmss) {
    if (!hhmmss) return null;
    const [hStr, mStr] = String(hhmmss).split(':');
    const h = parseInt(hStr, 10), m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return null;
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const diff = target.getTime() - now.getTime();
    return diff > 0 ? diff : null;
  }

  /** Marks today's reminder as fired so we don't re-fire on every page load. */
  function todayKey(habitId) {
    return FIRED_KEY_PREFIX + habitId + '_' + new Date().toISOString().slice(0, 10);
  }
  function alreadyFiredToday(habitId) {
    return localStorage.getItem(todayKey(habitId)) === '1';
  }
  function markFired(habitId) {
    localStorage.setItem(todayKey(habitId), '1');
    // Garbage-collect old keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(FIRED_KEY_PREFIX) && !k.endsWith(new Date().toISOString().slice(0, 10))) {
        // keep one extra day buffer just in case of timezone weirdness
        const dateChunk = k.slice(-10);
        const age = (Date.now() - new Date(dateChunk).getTime()) / 86400000;
        if (age > 2) localStorage.removeItem(k);
      }
    }
  }

  const timers = new Map(); // habitId -> setTimeout id

  function cancelAll() {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
  }

  /**
   * Schedule today's reminder for every habit that has `reminder_enabled`
   * and a `remind_at` time still in the future. Safe to re-call — cancels
   * existing timers first.
   */
  function scheduleAll(habits) {
    cancelAll();
    if (!Array.isArray(habits)) return;
    for (const h of habits) {
      if (!h.reminder_enabled || !h.remind_at) continue;
      if (alreadyFiredToday(h.id)) continue;
      const ms = msUntil(h.remind_at);
      if (ms === null) continue;
      const t = setTimeout(() => fire(h), ms);
      timers.set(h.id, t);
    }
  }

  function fire(habit) {
    markFired(habit.id);
    if (window.sound) sound.play('message');
    if (permission() === 'granted') {
      try {
        new Notification(`⏰ Time for: ${habit.name}`, {
          body: 'Log it now to keep your streak going.',
          icon: '/img/presets/01-fox.svg',
          tag: 'habit-' + habit.id,
          renotify: false
        });
      } catch { /* ignore */ }
    }
    // Also drop a toast in case the user is looking at the app
    if (window.ui) {
      ui.toast(`⏰ Reminder: ${habit.name}`, 'info', 7000);
    }
  }

  global.reminders = {
    permission,
    requestPermission,
    scheduleAll,
    cancelAll
  };
})(window);
