/* Challenges list */
(async function () {
  ui.initLayout();
  const grid = document.querySelector('[data-challenge-grid]');
  let all = [], joined = [];
  let filter = 'all';

  async function load() {
    try {
      const [allRes, joinedRes] = await Promise.all([
        api.get('/challenges'),
        api.get('/challenges/user/active')
      ]);
      all = allRes.challenges || allRes || [];
      joined = joinedRes.challenges || joinedRes || [];
      render();
    } catch (err) {
      grid.innerHTML = `<p class="text-muted">Couldn't load challenges: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function isEnded(c) {
    return new Date(c.end_date) < new Date();
  }

  function daysLeft(c) {
    const diff = new Date(c.end_date) - new Date();
    const days = Math.ceil(diff / 86400000);
    return Math.max(0, days);
  }

  function render() {
    const joinedById = new Map(joined.map(c => [c.challenge_id || c.id, c]));
    let list = all.map(c => {
      const myProgress = joinedById.get(c.id);
      return {
        ...c,
        isJoined: !!myProgress,
        myProgress: myProgress?.progress ?? 0
      };
    });
    if (filter === 'joined') list = list.filter(c => c.isJoined);

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-trophy"></i>
        <h3>No challenges right now</h3>
        <p>${filter === 'joined' ? 'You haven\'t joined any yet.' : 'Check back later.'}</p>
      </div>`;
      return;
    }

    grid.innerHTML = list.map(c => {
      const ended = isEnded(c);
      const pct = Math.min(100, Math.round(((c.myProgress || 0) / Math.max(1, c.target_value)) * 100));
      return `
        <article class="challenge-card">
          <div class="challenge-card-head">
            <div>
              <h3>${ui.escapeHtml(c.name)}</h3>
              <p>${ui.escapeHtml(c.description || '')}</p>
            </div>
            ${c.isJoined ? '<span class="challenge-status joined">Joined</span>' : ''}
            ${ended && !c.isJoined ? '<span class="challenge-status ended">Ended</span>' : ''}
          </div>

          <div class="challenge-meta">
            <span><i class="fa-solid fa-bullseye"></i> ${c.myProgress || 0} / ${c.target_value}</span>
            <span><i class="fa-regular fa-clock"></i> ${ended ? 'Ended' : daysLeft(c) + ' days left'}</span>
          </div>

          ${c.isJoined ? `<div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>` : ''}

          <div class="challenge-reward">
            <span class="xp"><i class="fa-solid fa-bolt"></i> +${c.reward_xp} XP</span>
            <span class="coins"><i class="fa-solid fa-coins"></i> +${c.reward_coins} coins</span>
          </div>

          <div class="challenge-actions">
            <a class="btn btn-secondary btn-sm" href="challenge-detail.html?id=${c.id}">
              <i class="fa-solid fa-eye"></i> Details
            </a>
            ${c.isJoined
              ? `<button class="btn btn-ghost btn-sm" data-leave="${c.id}">Leave</button>`
              : `<button class="btn btn-primary btn-sm" data-join="${c.id}" ${ended ? 'disabled' : ''}>
                  <i class="fa-solid fa-plus"></i> Join
                </button>`}
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-join]').forEach(b => b.addEventListener('click', () => join(b.dataset.join)));
    grid.querySelectorAll('[data-leave]').forEach(b => b.addEventListener('click', () => leave(b.dataset.leave)));
  }

  async function join(id) {
    try {
      await api.post(`/challenges/${id}/join`);
      ui.toast('You joined the challenge.', 'success');
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not join.', 'error');
    }
  }

  async function leave(id) {
    if (!confirm('Leave this challenge? Your progress will be lost.')) return;
    try {
      await api.delete(`/challenges/${id}/leave`);
      ui.toast('You left the challenge.', 'info');
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not leave.', 'error');
    }
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
