/* Profile page */
(async function () {
  ui.initLayout();

  const $ = (sel) => document.querySelector(sel);
  let user = null;

  async function load() {
    try {
      const [meRes, badgesRes] = await Promise.all([
        api.get('/users/me'),
        api.get('/badges/user/earned')
      ]);
      user = meRes.user || meRes;
      api.setTokens({ user });
      const badges = badgesRes.badges || badgesRes || [];
      renderHero();
      renderBadges(badges);

      // Stats (this endpoint is public, takes user id)
      try {
        const statsRes = await api.get(`/users/${user.id}/stats`);
        renderStats(statsRes.stats || statsRes, badges.length);
      } catch {
        renderStats({}, badges.length);
      }
    } catch (err) {
      ui.toast(err.message || 'Could not load profile.', 'error');
    }
  }

  function renderHero() {
    $('[data-username]').textContent = user.username || '...';
    $('[data-email]').textContent = user.email || '';
    $('[data-level]').textContent = user.level || 1;
    $('[data-streak]').textContent = user.current_streak || 0;
    $('[data-coins]').textContent = user.coins || 0;
    $('[data-joined]').textContent = user.created_at
      ? 'Joined ' + ui.formatDate(user.created_at)
      : '';
    $('[data-initial]').textContent = (user.username || '?').charAt(0).toUpperCase();
    const av = $('[data-avatar]');
    if (user.avatar_url) av.innerHTML = `<img src="${user.avatar_url}" alt="">`;
  }

  function renderStats(stats, badgeCount) {
    $('[data-stats]').innerHTML = `
      <div class="profile-stat">
        <strong>${(stats.total_xp ?? user.xp ?? 0).toLocaleString()}</strong>
        <span>Total XP earned</span>
      </div>
      <div class="profile-stat">
        <strong>${stats.total_habits_logged ?? '-'}</strong>
        <span>Habits logged</span>
      </div>
      <div class="profile-stat">
        <strong>${user.max_streak ?? 0}</strong>
        <span>Best streak (days)</span>
      </div>
      <div class="profile-stat">
        <strong>${badgeCount}</strong>
        <span>Badges earned</span>
      </div>
    `;
  }

  function renderBadges(badges) {
    const container = document.querySelector('[data-badges]');
    if (!badges.length) {
      container.innerHTML = `<p class="text-muted">No badges yet. Keep logging habits.</p>`;
      return;
    }
    container.innerHTML = badges.slice(0, 6).map(b => `
      <div class="recent-badge">
        <div class="icon"><i class="fa-solid fa-medal"></i></div>
        <div>
          <h5>${ui.escapeHtml(b.name || b.badgeName)}</h5>
          <p>${ui.escapeHtml(b.description || '')}</p>
        </div>
      </div>
    `).join('');
  }

  function openEditModal() {
    ui.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Edit profile</h3>
        <button class="modal-close" data-modal-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="profile-form">
        <div class="field">
          <label for="p-username">Username</label>
          <input id="p-username" value="${ui.escapeHtml(user.username || '')}" minlength="3" maxlength="50" required>
        </div>
        <div class="field">
          <label for="p-avatar">Avatar URL (optional)</label>
          <input id="p-avatar" value="${ui.escapeHtml(user.avatar_url || '')}" placeholder="https://...">
          <span class="field-hint">Paste a link to any image of you.</span>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary">Save changes</button>
        </div>
      </form>
    `);
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('p-username').value.trim();
      const avatar_url = document.getElementById('p-avatar').value.trim() || null;
      try {
        const data = await api.put('/users/me', { username, avatar_url });
        Object.assign(user, data.user || data);
        api.setTokens({ user });
        ui.closeModal();
        renderHero();
        ui.toast('Profile updated.', 'success');
        // Refresh the topbar with the new username + avatar
        ui.renderTopbar({ skipFetch: true });
        ui.applyUser(document.querySelector('[data-topbar]'), user);
      } catch (err) {
        ui.toast(err.message || 'Could not update profile.', 'error');
      }
    });
  }

  document.getElementById('edit-profile-btn').addEventListener('click', openEditModal);
  await load();
})();
