/* Notifications page */
(async function () {
  ui.initLayout();
  const list = document.querySelector('[data-notif-list]');

  // Server emits lowercase event types. Map them to icons + colors.
  const KIND_META = {
    level_up:            { cls: 'level',    icon: 'fa-arrow-up',     title: 'Level up' },
    badge_earned:        { cls: 'badge',    icon: 'fa-medal',        title: 'Badge unlocked' },
    streak_milestone:    { cls: 'streak',   icon: 'fa-fire',         title: 'Streak milestone' },
    streak_broken:       { cls: 'streak',   icon: 'fa-heart-crack',  title: 'Streak broken' },
    friend_request:      { cls: 'friend',   icon: 'fa-user-plus',    title: 'Friend request' },
    challenge_completed: { cls: 'challenge',icon: 'fa-trophy',       title: 'Challenge complete' },
    purchase:            { cls: 'shop',     icon: 'fa-bag-shopping', title: 'Purchase' }
  };

  function isUnread(n) {
    if (typeof n.is_read === 'boolean') return !n.is_read;
    return !n.read_at;
  }

  async function load() {
    try {
      const data = await api.get('/notifications');
      const arr = data.notifications || data || [];
      render(arr);
    } catch (err) {
      list.innerHTML = `<p class="text-muted" style="padding: var(--sp-4)">Couldn't load notifications: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function render(notifs) {
    if (!notifs.length) {
      list.innerHTML = `<div class="empty-state">
        <i class="fa-regular fa-bell-slash"></i>
        <h3>You're all caught up</h3>
        <p>Log a habit or join a challenge to see new updates here.</p>
      </div>`;
      return;
    }
    list.innerHTML = notifs.map(n => {
      const meta = KIND_META[(n.type || '').toLowerCase()] || { cls: 'default', icon: 'fa-bell', title: 'Notification' };
      const unread = isUnread(n);
      return `
        <div class="notif-row ${unread ? 'unread' : ''}" data-id="${n.id}">
          <div class="notif-icon ${meta.cls}"><i class="fa-solid ${meta.icon}"></i></div>
          <div class="notif-body">
            <strong>${ui.escapeHtml(n.title || meta.title)}</strong>
            <p>${ui.escapeHtml(n.message || n.body || '')}</p>
            <small>${ui.formatRelativeTime(n.created_at)}</small>
          </div>
          <div class="notif-actions">
            ${unread ? `<button data-read="${n.id}" title="Mark as read"><i class="fa-regular fa-circle-check"></i></button>` : ''}
            <button data-del="${n.id}" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-read]').forEach(b => b.addEventListener('click', () => markRead(b.dataset.read)));
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => del(b.dataset.del)));
  }

  async function markRead(id) {
    try {
      await api.put(`/notifications/${id}/read`);
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not update.', 'error');
    }
  }

  async function del(id) {
    try {
      await api.delete(`/notifications/${id}`);
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not delete.', 'error');
    }
  }

  document.getElementById('mark-all-read').addEventListener('click', async () => {
    try {
      await api.put('/notifications/mark-all/read');
      ui.toast('All notifications marked as read.', 'success');
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not mark all read.', 'error');
    }
  });

  document.getElementById('clear-all').addEventListener('click', async () => {
    if (!confirm('Delete all your notifications?')) return;
    try {
      await api.delete('/notifications');
      ui.toast('Notifications cleared.', 'success');
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not clear.', 'error');
    }
  });

  await load();
})();
