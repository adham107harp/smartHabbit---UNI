/* Badges page */
(async function () {
  ui.initLayout();

  const grid = document.querySelector('[data-badge-grid]');
  let all = [], earned = [];
  let filter = 'all';

  const ICON_FOR_TYPE = {
    streak: 'fa-fire',
    completions: 'fa-check-double',
    total_xp: 'fa-bolt',
    level: 'fa-star',
    challenge: 'fa-trophy'
  };

  async function load() {
    try {
      const [allRes, earnedRes] = await Promise.all([
        api.get('/badges'),
        api.get('/badges/user/earned')
      ]);
      all = allRes.badges || allRes || [];
      earned = earnedRes.badges || earnedRes || [];
      document.querySelector('[data-earned-count]').textContent = earned.length;
      document.querySelector('[data-total-count]').textContent = all.length;
      render();
    } catch (err) {
      grid.innerHTML = `<p class="text-muted">Couldn't load badges: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function progressFor(badge, user) {
    const v = user ?
      (badge.criteria_type === 'streak'      ? user.current_streak :
       badge.criteria_type === 'total_xp'    ? user.xp :
       badge.criteria_type === 'level'       ? user.level :
       0) : 0;
    return {
      current: v,
      pct: Math.min(100, Math.round((v / Math.max(1, badge.criteria_value)) * 100))
    };
  }

  function render() {
    const earnedIds = new Set(earned.map(b => b.badge_id || b.id));
    let list = all.map(b => ({ ...b, isEarned: earnedIds.has(b.id) }));
    if (filter === 'earned') list = list.filter(b => b.isEarned);
    if (filter === 'locked') list = list.filter(b => !b.isEarned);

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-medal"></i>
        <h3>No badges here</h3>
        <p>${filter === 'earned' ? 'Log some habits to start earning badges.' : 'You\'ve unlocked them all. Legend.'}</p>
      </div>`;
      return;
    }

    const user = api.getCachedUser();
    grid.innerHTML = list.map(b => {
      const p = progressFor(b, user);
      return `
        <article class="badge-card ${b.isEarned ? 'earned' : ''}">
          ${b.isEarned ? '<span class="badge-earned-stamp">Earned</span>' : ''}
          <div class="badge-icon">
            <i class="fa-solid ${ICON_FOR_TYPE[b.criteria_type] || 'fa-medal'}"></i>
          </div>
          <h4>${ui.escapeHtml(b.name)}</h4>
          <p>${ui.escapeHtml(b.description || '')}</p>
          ${b.isEarned ? '' : `
            <div class="badge-progress">
              <div class="progress"><div class="progress-fill" style="width:${p.pct}%"></div></div>
              <small>${p.current} / ${b.criteria_value}</small>
            </div>
          `}
        </article>
      `;
    }).join('');
  }

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      filter = t.dataset.tab;
      render();
    });
  });

  await load();
})();
