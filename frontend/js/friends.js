/* Friends */
(async function () {
  ui.initLayout();

  const section = document.querySelector('[data-friends-section]');
  let tab = 'friends';
  let friends = [], requests = [];

  async function load() {
    section.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    try {
      const [f, r] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/requests/pending')
      ]);
      friends = f.friends || f || [];
      requests = r.requests || r || [];
      const c = document.querySelector('[data-req-count]');
      if (c) c.textContent = requests.length ? String(requests.length) : '';
      render();
    } catch (err) {
      section.innerHTML = `<p class="text-muted">Couldn't load friends: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function render() {
    if (tab === 'friends') renderFriends();
    else renderRequests();
  }

  function renderFriends() {
    if (!friends.length) {
      section.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-user-group"></i>
        <h3>No friends yet</h3>
        <p>Use "Add friend" to find people by username.</p>
      </div>`;
      return;
    }
    section.innerHTML = `<div class="friend-grid">${friends.map(f => `
      <div class="friend-card">
        <div class="friend-avatar">${(f.username || '?').charAt(0).toUpperCase()}</div>
        <div class="friend-info">
          <strong>${ui.escapeHtml(f.username || 'Friend')}</strong>
          <small>Level ${f.level || 1} · ${f.xp || 0} XP · streak ${f.current_streak || 0}</small>
        </div>
        <div class="friend-actions">
          <button class="btn btn-ghost btn-sm" data-remove="${f.id}" title="Remove">
            <i class="fa-solid fa-user-xmark"></i>
          </button>
        </div>
      </div>
    `).join('')}</div>`;
    section.querySelectorAll('[data-remove]').forEach(b =>
      b.addEventListener('click', () => removeFriend(b.dataset.remove))
    );
  }

  function renderRequests() {
    if (!requests.length) {
      section.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-envelope-open"></i>
        <h3>No pending requests</h3>
        <p>Nobody's waiting for an answer.</p>
      </div>`;
      return;
    }
    section.innerHTML = requests.map(r => `
      <div class="request-row">
        <div class="friend-avatar">${(r.username || '?').charAt(0).toUpperCase()}</div>
        <div class="friend-info">
          <strong>${ui.escapeHtml(r.username || 'Someone')}</strong>
          <small>Wants to be your friend</small>
        </div>
        <div class="request-actions">
          <button class="btn btn-primary btn-sm" data-accept="${r.id}">Accept</button>
          <button class="btn btn-ghost btn-sm" data-decline="${r.id}">Decline</button>
        </div>
      </div>
    `).join('');
    section.querySelectorAll('[data-accept]').forEach(b => b.addEventListener('click', () => respond(b.dataset.accept, 'accept')));
    section.querySelectorAll('[data-decline]').forEach(b => b.addEventListener('click', () => respond(b.dataset.decline, 'decline')));
  }

  async function respond(id, action) {
    try {
      await api.put(`/friends/${id}/${action}`);
      ui.toast(action === 'accept' ? 'Friend request accepted.' : 'Request declined.', 'success');
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not update request.', 'error');
    }
  }

  async function removeFriend(id) {
    if (!confirm('Remove this friend?')) return;
    try {
      await api.delete(`/friends/${id}`);
      ui.toast('Friend removed.', 'info');
      await load();
    } catch (err) {
      ui.toast(err.message || 'Could not remove friend.', 'error');
    }
  }

  function openAddFriendModal() {
    ui.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Add a friend</h3>
        <button class="modal-close" data-modal-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="field">
        <label for="search-q">Search by username</label>
        <input id="search-q" type="text" placeholder="Type at least 2 letters…" autocomplete="off">
      </div>
      <div id="search-results"></div>
    `);
    const input = document.getElementById('search-q');
    const results = document.getElementById('search-results');
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => searchUsers(input.value.trim(), results), 250);
    });
    setTimeout(() => input.focus(), 50);
  }

  async function searchUsers(q, container) {
    if (q.length < 2) {
      container.innerHTML = '<p class="text-muted">Type at least 2 letters to search.</p>';
      return;
    }
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    try {
      const data = await api.get('/users/search?q=' + encodeURIComponent(q));
      const users = data.users || data || [];
      if (!users.length) {
        container.innerHTML = '<p class="text-muted">No one found by that name.</p>';
        return;
      }
      container.innerHTML = users.map(u => `
        <div class="request-row">
          <div class="friend-avatar">${(u.username || '?').charAt(0).toUpperCase()}</div>
          <div class="friend-info">
            <strong>${ui.escapeHtml(u.username)}</strong>
            <small>Level ${u.level || 1} · ${u.xp || 0} XP</small>
          </div>
          <button class="btn btn-primary btn-sm" data-add="${u.id}">
            <i class="fa-solid fa-user-plus"></i> Add
          </button>
        </div>
      `).join('');
      container.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          await api.post('/friends/request/' + b.dataset.add);
          ui.toast('Friend request sent.', 'success');
          b.innerHTML = '<i class="fa-solid fa-check"></i> Sent';
        } catch (err) {
          b.disabled = false;
          ui.toast(err.message || 'Could not send request.', 'error');
        }
      }));
    } catch (err) {
      container.innerHTML = `<p class="text-muted">Search failed: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  document.getElementById('add-friend-btn').addEventListener('click', openAddFriendModal);
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      tab = t.dataset.tab;
      render();
    });
  });

  await load();
})();
