/* Leaderboard */
(async function () {
  ui.initLayout();
  const podium = document.querySelector('[data-podium]');
  const list = document.querySelector('[data-list]');
  let currentBoard = 'global';

  async function load() {
    list.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    podium.innerHTML = '';
    let rows = [];
    try {
      const path = currentBoard === 'global' ? '/leaderboards/global'
                 : currentBoard === 'weekly' ? '/leaderboards/weekly'
                 : '/leaderboards/friends';
      const data = await api.get(path);
      rows = data.leaderboard || data || [];
    } catch (err) {
      list.innerHTML = `<p class="text-muted">Couldn't load this board: ${ui.escapeHtml(err.message)}</p>`;
      return;
    }
    render(rows);
  }

  function render(rows) {
    const me = api.getCachedUser();
    if (!rows.length) {
      list.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-ranking-star"></i>
        <h3>Nobody on the board yet</h3>
        <p>${currentBoard === 'friends' ? 'Add some friends to compete with.' : 'Log a habit to appear.'}</p>
      </div>`;
      return;
    }

    const top3 = rows.slice(0, 3);
    podium.innerHTML = top3.map((r, i) => {
      const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : 'bronze';
      const icon = i === 0 ? 'fa-crown' : i === 1 ? 'fa-medal' : 'fa-award';
      return `
        <div class="podium-card ${cls}">
          <div class="pod-medal"><i class="fa-solid ${icon}"></i></div>
          <h3>${ui.escapeHtml(r.username || 'Player')}</h3>
          <p>Level ${r.level || 1}</p>
          <div class="pod-xp">${(r.xp || 0).toLocaleString()} XP</div>
        </div>
      `;
    }).join('');

    list.innerHTML = rows.map((r, i) => {
      const rank = i + 1;
      const isMe = me && (r.id === me.id || r.user_id === me.id);
      return `
        <div class="lb-row ${isMe ? 'me' : ''}">
          <div class="lb-rank-cell">#${rank}</div>
          <div class="lb-user">
            <div class="lb-avatar">${(r.username || '?').charAt(0).toUpperCase()}</div>
            <div>
              <div class="lb-username">${ui.escapeHtml(r.username || 'Player')}${isMe ? ' <span class="lb-username-sub">· you</span>' : ''}</div>
              <div class="lb-username-sub">Level ${r.level || 1} · Streak ${r.current_streak ?? 0}</div>
            </div>
          </div>
          <div class="lb-xp">${(r.xp || 0).toLocaleString()} XP</div>
        </div>
      `;
    }).join('');
  }

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      currentBoard = t.dataset.board;
      load();
    });
  });

  await load();
})();
