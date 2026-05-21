/* Habit detail page */
(async function () {
  ui.initLayout();

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const content = document.querySelector('[data-detail-content]');
  const heatmap = document.querySelector('[data-heatmap]');
  const recent = document.querySelector('[data-recent-logs]');
  const summary30 = document.querySelector('[data-30d-summary]');

  if (!id) {
    content.innerHTML = `<p class="text-muted">No habit was selected. <a href="habits.html">Go back to your habits</a>.</p>`;
    return;
  }

  let habit = null;
  let logs = [];

  async function load() {
    try {
      const [hRes, lRes] = await Promise.all([
        api.get(`/habits/${id}`),
        api.get(`/habits/${id}/history`)
      ]);
      habit = hRes.habit || hRes;
      logs = (lRes.logs || lRes || []).map(l => ({
        ...l,
        logged_date: typeof l.logged_date === 'string' ? l.logged_date : new Date(l.logged_date).toISOString()
      }));
      renderHero();
      renderHeatmap();
      renderRecent();
    } catch (err) {
      content.innerHTML = `<p class="text-muted">Couldn't load this habit: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function renderHero() {
    const totalXp = logs.reduce((sum, l) => sum + (l.xp_earned || 0), 0);
    const totalLogs = logs.length;
    content.innerHTML = `
      <div class="detail-hero-head">
        <div>
          <h1>${ui.escapeHtml(habit.name)}</h1>
          <div class="habit-info-sub mt-2">
            ${ui.difficultyBadge(habit.difficulty)}
            <span class="dot"></span>
            <span>${habit.goal_type === 'weekly' ? 'Weekly' : 'Daily'}</span>
            <span class="dot"></span>
            <span>Target ${habit.target_value}</span>
          </div>
          ${habit.description ? `<p class="mt-3">${ui.escapeHtml(habit.description)}</p>` : ''}
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary" id="log-now"><i class="fa-solid fa-check"></i> Log today</button>
        </div>
      </div>
      <div class="detail-hero-stats">
        <div class="detail-stat">
          <strong>${totalLogs}</strong>
          <span>Total completions</span>
        </div>
        <div class="detail-stat">
          <strong>${totalXp}</strong>
          <span>XP from this habit</span>
        </div>
        <div class="detail-stat">
          <strong>${currentStreakForLogs(logs)}</strong>
          <span>Current streak (days)</span>
        </div>
        <div class="detail-stat">
          <strong>${ui.formatDate(habit.created_at)}</strong>
          <span>Started</span>
        </div>
      </div>
    `;
    document.getElementById('log-now').addEventListener('click', logToday);
  }

  function currentStreakForLogs(logs) {
    if (!logs.length) return 0;
    const dates = new Set(logs.map(l => new Date(l.logged_date).toISOString().slice(0, 10)));
    let count = 0;
    let d = new Date();
    // Allow streak to continue if today not yet logged but yesterday is
    if (!dates.has(d.toISOString().slice(0, 10))) {
      d.setDate(d.getDate() - 1);
    }
    while (dates.has(d.toISOString().slice(0, 10))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  function renderHeatmap() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cells = [];
    const dateSet = new Set(logs.map(l => new Date(l.logged_date).toISOString().slice(0, 10)));
    let done = 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const hit = dateSet.has(iso);
      if (hit) done++;
      const cls = hit ? 'l3' : '';
      cells.push(`<div class="heatmap-cell ${cls}" title="${ui.formatDate(d)}${hit ? ' · done' : ''}"></div>`);
    }
    heatmap.innerHTML = cells.join('');
    summary30.textContent = `${done}/30 days complete`;
  }

  function renderRecent() {
    if (!logs.length) {
      recent.innerHTML = `<p class="text-muted">No logs yet. Hit "Log today" to make this real.</p>`;
      return;
    }
    recent.innerHTML = logs.slice(0, 10).map(l => `
      <div class="log-row">
        <span>${ui.formatDate(l.logged_date)}</span>
        <span><strong>+${l.xp_earned || 0} XP</strong></span>
      </div>
    `).join('');
  }

  async function refreshTopbar() {
    try {
      const me = await api.get('/users/me');
      const user = me.user || me;
      api.setTokens({ user });
      ui.applyUser(document.querySelector('[data-topbar]'), user);
    } catch { /* ignore */ }
  }

  async function logToday() {
    const btn = document.getElementById('log-now');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const data = await api.post(`/habits/${id}/log`, { value: 1 });
      const xp = data.habitCompletion?.xpEarned ?? 0;
      const coins = data.habitCompletion?.coinsEarned ?? 0;
      const leveledUp = data.habitCompletion?.leveledUp;
      const mysteryBoxId = data.habitCompletion?.mysteryBoxId;
      window.sound && sound.play(leveledUp ? 'levelup' : 'log');
      await load();
      await refreshTopbar();
      if (mysteryBoxId && window.mystery) mystery.refresh();

      ui.actionToast(
        `+${xp} XP, +${coins} coins`,
        'Undo',
        async () => {
          try {
            await api.delete(`/habits/${id}/log/last`);
            window.sound && sound.play('undo');
            ui.toast('Log undone.', 'info');
            await load();
            await refreshTopbar();
          } catch (err) {
            if (err.code === 'UNDO_WINDOW_EXPIRED') {
              ui.toast('Too late — that log is locked in.', 'info');
            } else {
              ui.toast(err.message || 'Could not undo.', 'error');
            }
          }
        },
        'success',
        60000
      );

      (data.badgesEarned || []).forEach(b => {
        window.sound && sound.play('badge');
        ui.toast(`Badge unlocked: ${b.badgeName}`, 'success', 5000);
      });
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Log today';
      window.sound && sound.play('error');
      if (err.code === 'HABIT_ALREADY_AT_TARGET' || err.code === 'HABIT_ALREADY_LOGGED') {
        ui.toast("You've already hit today's target for this habit!", 'info');
        await load();
      } else {
        ui.toast(err.message || 'Could not log this habit.', 'error');
      }
    }
  }

  await load();
})();
