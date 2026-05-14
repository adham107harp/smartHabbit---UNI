/* Challenge detail */
(async function () {
  ui.initLayout();
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const hero = document.querySelector('[data-hero]');
  const lb = document.querySelector('[data-leaderboard]');

  if (!id) {
    hero.innerHTML = `<p class="text-muted">No challenge selected. <a href="challenges.html">Back to challenges</a>.</p>`;
    return;
  }

  async function load() {
    let challenge = null;
    let leaderboard = [];
    let myActive = [];

    try {
      const all = await api.get('/challenges');
      const arr = all.challenges || all || [];
      challenge = arr.find(c => c.id === id);
    } catch (err) {
      hero.innerHTML = `<p class="text-muted">Couldn't load challenge: ${ui.escapeHtml(err.message)}</p>`;
      return;
    }
    if (!challenge) {
      hero.innerHTML = `<p class="text-muted">Challenge not found.</p>`;
      return;
    }

    try {
      const lbRes = await api.get(`/challenges/${id}/leaderboard`);
      leaderboard = lbRes.leaderboard || lbRes || [];
    } catch { /* empty leaderboard is fine */ }

    try {
      const j = await api.get('/challenges/user/active');
      myActive = j.challenges || j || [];
    } catch { /* ignore */ }

    const myEntry = myActive.find(c => (c.challenge_id || c.id) === id);
    renderHero(challenge, myEntry);
    renderLeaderboard(leaderboard);
  }

  function renderHero(c, myEntry) {
    const me = api.getCachedUser();
    const ended = new Date(c.end_date) < new Date();
    const daysLeft = Math.max(0, Math.ceil((new Date(c.end_date) - new Date()) / 86400000));
    const pct = myEntry ? Math.min(100, Math.round((myEntry.progress / Math.max(1, c.target_value)) * 100)) : 0;

    hero.innerHTML = `
      <h1>${ui.escapeHtml(c.name)}</h1>
      <p>${ui.escapeHtml(c.description || '')}</p>

      <div class="challenge-hero-stats">
        <div class="detail-stat">
          <strong>${c.target_value}</strong>
          <span>Habits to complete</span>
        </div>
        <div class="detail-stat">
          <strong>+${c.reward_xp}</strong>
          <span>XP reward</span>
        </div>
        <div class="detail-stat">
          <strong>+${c.reward_coins}</strong>
          <span>Coin reward</span>
        </div>
        <div class="detail-stat">
          <strong>${ended ? 'Ended' : daysLeft + ' days'}</strong>
          <span>${ended ? '' : 'left to finish'}</span>
        </div>
      </div>

      ${myEntry ? `
        <div>
          <div class="dash-level-info">
            <strong>Your progress</strong>
            <span class="text-muted">· ${myEntry.progress || 0} / ${c.target_value}</span>
          </div>
          <div class="progress mt-2"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
      ` : ''}

      <div class="detail-actions mt-4">
        ${myEntry
          ? `<button class="btn btn-secondary" id="leave-btn"><i class="fa-solid fa-right-from-bracket"></i> Leave</button>`
          : `<button class="btn btn-primary" id="join-btn" ${ended ? 'disabled' : ''}>
              <i class="fa-solid fa-plus"></i> Join challenge
            </button>`}
      </div>
    `;
    const joinBtn = document.getElementById('join-btn');
    const leaveBtn = document.getElementById('leave-btn');
    if (joinBtn) joinBtn.addEventListener('click', join);
    if (leaveBtn) leaveBtn.addEventListener('click', leave);
  }

  async function join() {
    try {
      await api.post(`/challenges/${id}/join`);
      ui.toast('You joined the challenge.', 'success');
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not join.', 'error');
    }
  }

  async function leave() {
    if (!confirm('Leave this challenge? Your progress will be lost.')) return;
    try {
      await api.delete(`/challenges/${id}/leave`);
      ui.toast('You left the challenge.', 'info');
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not leave.', 'error');
    }
  }

  function renderLeaderboard(rows) {
    const me = api.getCachedUser();
    if (!rows.length) {
      lb.innerHTML = `<p class="text-muted">No participants yet. Be the first.</p>`;
      return;
    }
    lb.innerHTML = rows.slice(0, 20).map((r, i) => {
      const rank = i + 1;
      const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      const isMe = me && (r.user_id === me.id || r.id === me.id);
      return `
        <div class="lb-row ${isMe ? 'me' : ''}">
          <div class="lb-rank ${rankClass}">${rank}</div>
          <div>
            <strong>${ui.escapeHtml(r.username || r.name || 'Player')}</strong>
            ${isMe ? '<small class="text-muted"> · you</small>' : ''}
          </div>
          <div><strong>${r.progress ?? 0}</strong> / ${(rows[0].target_value ?? '')}</div>
        </div>
      `;
    }).join('');
  }

  await load();
})();
