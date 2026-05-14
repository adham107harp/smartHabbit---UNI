/* Dashboard page */
(async function () {
  ui.initLayout();

  const $ = (sel) => document.querySelector(sel);
  const habitList = $('[data-habits-list]');
  const recentBadges = $('[data-recent-badges]');
  const activeChallenges = $('[data-active-challenges]');

  /**
   * Load and render the hero metrics + habit list. We pull /users/me,
   * /habits, /badges/user/earned, /challenges/user/active in parallel.
   */
  // Run the four loads independently — if one 500s, the rest still render.
  async function load() {
    const safe = (p, fallback) => p.catch(err => {
      console.warn('Dashboard load failed for one section:', err);
      return fallback;
    });

    const [me, habits, earnedBadges, activeCh] = await Promise.all([
      safe(api.get('/users/me'),               { user: api.getCachedUser() || {} }),
      safe(api.get('/habits'),                 { habits: [] }),
      safe(api.get('/badges/user/earned'),     { badges: [] }),
      safe(api.get('/challenges/user/active'), { challenges: [] })
    ]);

    const user = me.user || me;
    const habitArr = habits.habits || habits || [];
    const badgeArr = earnedBadges.badges || earnedBadges || [];
    const chArr = activeCh.challenges || activeCh || [];

    renderHero(user, badgeArr.length);
    renderHabits(habitArr);
    renderBadges(badgeArr);
    renderChallenges(chArr);
  }

  function renderHero(user, badgeCount) {
    $('[data-username]').textContent = user.username || '...';
    const prog = ui.progressToNextLevel(user.xp || 0);
    $('[data-level]').textContent = prog.level;
    $('[data-xp-current]').textContent = prog.currentLevelXp;
    $('[data-xp-next]').textContent = prog.neededForNext;
    $('[data-xp-bar]').style.width = prog.percent + '%';
    $('[data-xp-toggo]').textContent = (prog.neededForNext - prog.currentLevelXp) + ' XP to next level';
    $('[data-streak]').textContent = user.current_streak || 0;
    $('[data-coins]').textContent = user.coins || 0;
    $('[data-badge-count]').textContent = badgeCount;
  }

  function renderHabits(habits) {
    if (!habits.length) {
      habitList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-seedling"></i>
          <h3>No habits yet</h3>
          <p>Start with something small. One habit, today.</p>
          <a class="btn btn-primary mt-3" href="habits.html">Add your first habit</a>
        </div>`;
      return;
    }
    habitList.innerHTML = habits.map(h => `
      <div class="habit-row" data-id="${h.id}">
        <div class="habit-meta">
          <div class="habit-icon">${pickIcon(h.difficulty)}</div>
          <div class="habit-info">
            <h4>${ui.escapeHtml(h.name)}</h4>
            <div class="habit-info-sub">
              ${ui.difficultyBadge(h.difficulty)}
              <span class="dot"></span>
              <span>${h.goal_type === 'weekly' ? 'Weekly' : 'Daily'}</span>
              <span class="dot"></span>
              <span>Target: ${h.target_value}</span>
            </div>
          </div>
        </div>
        <div class="habit-actions">
          <a class="btn btn-ghost btn-sm" href="habit-detail.html?id=${h.id}">
            <i class="fa-solid fa-chart-line"></i> Details
          </a>
          <button class="btn btn-primary btn-sm" data-log="${h.id}">
            <i class="fa-solid fa-check"></i> Log
          </button>
        </div>
      </div>
    `).join('');
    habitList.querySelectorAll('[data-log]').forEach(btn => {
      btn.addEventListener('click', () => logHabit(btn.dataset.log, btn));
    });
  }

  function pickIcon(difficulty) {
    const map = { easy: 'fa-leaf', medium: 'fa-mug-hot', hard: 'fa-fire' };
    return `<i class="fa-solid ${map[difficulty] || 'fa-circle'}"></i>`;
  }

  async function logHabit(habitId, btn) {
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const data = await api.post(`/habits/${habitId}/log`, { value: 1 });
      const xp = data.habitCompletion?.xpEarned ?? 0;
      const coins = data.habitCompletion?.coinsEarned ?? 0;
      const newBadges = data.badgesEarned || [];

      const row = btn.closest('.habit-row');
      if (row) row.classList.add('is-done');
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Done';

      ui.toast(`+${xp} XP, +${coins} coins`, 'success');
      newBadges.forEach(b => {
        ui.toast(`Badge unlocked: ${b.badgeName}`, 'success', 5000);
      });

      // Refresh hero numbers
      const me = await api.get('/users/me');
      const earned = await api.get('/badges/user/earned');
      renderHero(me.user || me, (earned.badges || earned || []).length);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = original;
      const msg = err.code === 'HABIT_ALREADY_LOGGED' || /already/i.test(err.message)
        ? 'You already logged this one today.'
        : (err.message || 'Could not log this habit.');
      ui.toast(msg, 'error');
    }
  }

  function renderBadges(badges) {
    if (!badges.length) {
      recentBadges.innerHTML = `<p class="text-muted">No badges yet. Keep going!</p>`;
      return;
    }
    const recent = badges.slice(0, 3);
    recentBadges.innerHTML = recent.map(b => `
      <div class="recent-badge">
        <div class="icon"><i class="fa-solid fa-medal"></i></div>
        <div>
          <h5>${ui.escapeHtml(b.name || b.badgeName)}</h5>
          <p>${ui.escapeHtml(b.description || '')}</p>
        </div>
      </div>
    `).join('');
  }

  function renderChallenges(challenges) {
    if (!challenges.length) {
      activeChallenges.innerHTML = `<p class="text-muted">No active challenges. <a href="challenges.html">Join one →</a></p>`;
      return;
    }
    activeChallenges.innerHTML = challenges.slice(0, 3).map(c => {
      const progress = Math.min(100, Math.round((c.progress / Math.max(1, c.target_value)) * 100));
      return `
        <div class="dash-challenge">
          <h5>${ui.escapeHtml(c.name)}</h5>
          <p>${c.progress || 0} / ${c.target_value} complete</p>
          <div class="progress"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>
      `;
    }).join('');
  }

  await load();
})();
