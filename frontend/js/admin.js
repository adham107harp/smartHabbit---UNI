/* =========================================================================
   admin.js — admin portal: dashboard / users / badges / challenges / shop /
   broadcast. Tabbed UI; each tab loads from /api/admin/* (server enforces
   the admin gate, frontend just hides the link from non-admins).
   ========================================================================= */
(async function () {
  // We need the user record to gate the page. ui.initLayout() fetches /me
  // and applies it to the topbar; we read from the cached user afterwards.
  await ui.initLayout();
  const me = api.getCachedUser();
  if (!me?.is_admin) {
    ui.toast('Admin access only.', 'error');
    setTimeout(() => location.replace('dashboard.html'), 600);
    return;
  }

  const pane = document.querySelector('[data-admin-pane]');
  let currentTab = 'dashboard';

  document.querySelectorAll('[data-admin-tab]').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('[data-admin-tab]').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      currentTab = t.dataset.adminTab;
      renderTab();
    });
  });

  function renderTab() {
    pane.innerHTML = `<div class="loading-state"><div class="spinner spinner-lg"></div></div>`;
    if (currentTab === 'dashboard')  return renderDashboard();
    if (currentTab === 'users')      return renderUsers();
    if (currentTab === 'badges')     return renderCatalog('badges');
    if (currentTab === 'challenges') return renderCatalog('challenges');
    if (currentTab === 'shop')       return renderCatalog('shop');
    if (currentTab === 'broadcast')  return renderBroadcast();
  }

  /* ---------- Dashboard ---------- */

  async function renderDashboard() {
    try {
      const data = await api.get('/admin/stats');
      const s = data.stats;
      const top = data.top_users || [];
      pane.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi-card"><span>Users</span>           <strong>${s.users.toLocaleString()}</strong></div>
          <div class="kpi-card"><span>Active today</span>     <strong>${s.active_today.toLocaleString()}</strong></div>
          <div class="kpi-card"><span>Habits</span>          <strong>${s.total_habits.toLocaleString()}</strong></div>
          <div class="kpi-card"><span>Total logs</span>      <strong>${s.total_logs.toLocaleString()}</strong></div>
          <div class="kpi-card"><span>New users (7d)</span>  <strong>${s.new_users_week.toLocaleString()}</strong></div>
        </div>

        <section class="card">
          <div class="card-header"><h2 class="card-title">Top 10 by XP</h2></div>
          <table class="admin-table">
            <thead><tr><th>#</th><th>Username</th><th>Level</th><th>XP</th><th>Coins</th><th>Streak</th></tr></thead>
            <tbody>
              ${top.map((u, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${ui.escapeHtml(u.username)}</td>
                  <td>${u.level}</td>
                  <td>${u.xp.toLocaleString()}</td>
                  <td>${u.coins}</td>
                  <td>${u.current_streak}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>
      `;
    } catch (err) {
      pane.innerHTML = `<p class="text-muted">Couldn't load stats: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  /* ---------- Users ---------- */

  async function renderUsers(q = '') {
    pane.innerHTML = `
      <div class="admin-toolbar">
        <input class="admin-search" placeholder="Search by username or email…" value="${ui.escapeHtml(q)}" data-user-search>
      </div>
      <section class="card" data-users-list>
        <div class="loading-state"><div class="spinner"></div></div>
      </section>
    `;
    const search = pane.querySelector('[data-user-search]');
    let timer = null;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => renderUsers(search.value), 250);
    });

    try {
      const data = await api.get('/admin/users?q=' + encodeURIComponent(q));
      const list = data.users || [];
      pane.querySelector('[data-users-list]').innerHTML = `
        <table class="admin-table">
          <thead><tr>
            <th>Username</th><th>Email</th><th>Level</th><th>XP</th>
            <th>Coins</th><th>Streak</th><th>Admin</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${list.map(u => `
              <tr data-user-id="${u.id}">
                <td>${ui.escapeHtml(u.username)}</td>
                <td>${ui.escapeHtml(u.email)}</td>
                <td>${u.level}</td>
                <td>${u.xp.toLocaleString()}</td>
                <td>${u.coins}</td>
                <td>${u.current_streak}</td>
                <td>${u.is_admin ? '<span class="admin-pill is-admin">ADMIN</span>' : '<span class="admin-pill">user</span>'}</td>
                <td>
                  <div class="admin-row-actions">
                    <button data-edit="${u.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button data-notify="${u.id}" title="Send notification"><i class="fa-solid fa-bell"></i></button>
                    <button data-del="${u.id}" class="danger" title="Delete"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p class="text-muted mt-3" style="font-size: 12px;">${data.total} users total.</p>
      `;
      pane.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openEditUser(b.dataset.edit); }));
      pane.querySelectorAll('[data-notify]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openNotify(b.dataset.notify); }));
      pane.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); deleteUser(b.dataset.del); }));
    } catch (err) {
      pane.querySelector('[data-users-list]').innerHTML = `<p class="text-muted">${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function openEditUser(id) {
    ui.openModal(`<div class="loading-state"><div class="spinner"></div></div>`);
    api.get(`/admin/users/${id}`).then(({ user }) => {
      ui.openModal(`
        <div class="modal-header">
          <h3 class="modal-title">Edit ${ui.escapeHtml(user.username)}</h3>
          <button class="modal-close" data-modal-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="edit-user-form">
          <div class="field"><label>Username</label><input id="eu-username" value="${ui.escapeHtml(user.username)}" required></div>
          <div class="field"><label>Level</label>   <input id="eu-level"    type="number" min="1" value="${user.level}"></div>
          <div class="field"><label>XP</label>      <input id="eu-xp"       type="number" min="0" value="${user.xp}"></div>
          <div class="field"><label>Coins</label>   <input id="eu-coins"    type="number" min="0" value="${user.coins}"></div>
          <div class="field"><label>Current streak</label><input id="eu-cs" type="number" min="0" value="${user.current_streak}"></div>
          <div class="field"><label>Max streak</label>    <input id="eu-ms" type="number" min="0" value="${user.max_streak}"></div>
          <div class="field">
            <label class="checkbox"><input type="checkbox" id="eu-admin" ${user.is_admin ? 'checked' : ''}><span>Is admin</span></label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      `);
      document.getElementById('edit-user-form').addEventListener('submit', async e => {
        e.preventDefault();
        const payload = {
          username:       document.getElementById('eu-username').value.trim(),
          level:          +document.getElementById('eu-level').value,
          xp:             +document.getElementById('eu-xp').value,
          coins:          +document.getElementById('eu-coins').value,
          current_streak: +document.getElementById('eu-cs').value,
          max_streak:     +document.getElementById('eu-ms').value,
          is_admin:       document.getElementById('eu-admin').checked
        };
        try {
          await api.put(`/admin/users/${id}`, payload);
          ui.closeModal();
          ui.toast('User updated.', 'success');
          renderUsers();
        } catch (err) {
          ui.toast(err.message || 'Update failed.', 'error');
        }
      });
    }).catch(err => {
      ui.closeModal();
      ui.toast(err.message || 'Could not load user.', 'error');
    });
  }

  function openNotify(id) {
    ui.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Send notification</h3>
        <button class="modal-close" data-modal-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="notify-form">
        <div class="field"><label>Title</label><input id="n-title" maxlength="100" value="Heads up"></div>
        <div class="field"><label>Message</label><textarea id="n-msg" rows="3" required></textarea></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary">Send</button>
        </div>
      </form>
    `);
    document.getElementById('notify-form').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await api.post(`/admin/users/${id}/notify`, {
          title:   document.getElementById('n-title').value,
          message: document.getElementById('n-msg').value
        });
        ui.closeModal();
        ui.toast('Notification sent.', 'success');
      } catch (err) {
        ui.toast(err.message || 'Could not send.', 'error');
      }
    });
  }

  async function deleteUser(id) {
    if (!confirm('Soft-delete this user? They will not be able to log in.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      ui.toast('User deleted.', 'success');
      renderUsers();
    } catch (err) {
      ui.toast(err.message || 'Delete failed.', 'error');
    }
  }

  /* ---------- Catalog (badges / challenges / shop) ---------- */

  const CATALOG_CONFIG = {
    badges: {
      endpoint: '/badges',           // list endpoint (public)
      adminPath: '/admin/badges',    // CUD endpoint
      collection: 'badges',
      columns: ['name', 'criteria_type', 'criteria_value', 'bonus_xp', 'bonus_coins'],
      fields: [
        { key: 'name',           label: 'Name',           required: true },
        { key: 'description',    label: 'Description',    full: true,    textarea: true },
        { key: 'criteria_type',  label: 'Criteria type',  select: ['streak', 'total_xp', 'completions', 'level', 'challenges_completed'] },
        { key: 'criteria_value', label: 'Criteria value', type: 'number' },
        { key: 'bonus_xp',       label: 'Bonus XP',       type: 'number' },
        { key: 'bonus_coins',    label: 'Bonus coins',    type: 'number' }
      ]
    },
    challenges: {
      endpoint: '/challenges',
      adminPath: '/admin/challenges',
      collection: 'challenges',
      columns: ['name', 'target_value', 'reward_xp', 'reward_coins', 'end_date'],
      fields: [
        { key: 'name',         label: 'Name',         required: true },
        { key: 'description',  label: 'Description',  full: true, textarea: true },
        { key: 'start_date',   label: 'Start (ISO)',  required: true },
        { key: 'end_date',     label: 'End (ISO)',    required: true },
        { key: 'target_value', label: 'Target',       type: 'number' },
        { key: 'reward_xp',    label: 'Reward XP',    type: 'number' },
        { key: 'reward_coins', label: 'Reward coins', type: 'number' }
      ]
    },
    shop: {
      endpoint: '/shop/items',
      adminPath: '/admin/shop',
      collection: 'items',
      columns: ['name', 'item_type', 'cost'],
      fields: [
        { key: 'name',        label: 'Name',        required: true },
        { key: 'description', label: 'Description', full: true, textarea: true },
        { key: 'cost',        label: 'Cost (coins)', type: 'number' },
        { key: 'item_type',   label: 'Type',        select: ['theme', 'avatar_item', 'consumable', 'badge'] },
        { key: 'meta_data',   label: 'Meta JSON',   full: true, textarea: true, placeholder: '{"palette":"midnight"}' }
      ]
    }
  };

  async function renderCatalog(name) {
    const cfg = CATALOG_CONFIG[name];
    try {
      const data = await api.get(cfg.endpoint);
      const items = data[cfg.collection] || [];
      pane.innerHTML = `
        <div class="admin-toolbar">
          <button class="btn btn-primary" data-create>
            <i class="fa-solid fa-plus"></i> New ${name.slice(0, -1)}
          </button>
          <span class="text-muted">${items.length} ${name}</span>
        </div>
        <section class="card">
          <table class="admin-table">
            <thead><tr>${cfg.columns.map(c => `<th>${c}</th>`).join('')}<th></th></tr></thead>
            <tbody>
              ${items.map(it => `
                <tr>
                  ${cfg.columns.map(c => `<td>${ui.escapeHtml(String(it[c] ?? ''))}</td>`).join('')}
                  <td>
                    <div class="admin-row-actions">
                      <button data-edit-id="${it.id}"><i class="fa-solid fa-pen"></i></button>
                      <button data-del-id="${it.id}" class="danger"><i class="fa-solid fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>
      `;
      pane.querySelector('[data-create]').addEventListener('click', () => openCatalogForm(name, null));
      pane.querySelectorAll('[data-edit-id]').forEach(b => b.addEventListener('click', () => {
        const item = items.find(x => x.id === b.dataset.editId);
        openCatalogForm(name, item);
      }));
      pane.querySelectorAll('[data-del-id]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`Delete this ${name.slice(0, -1)}?`)) return;
        try {
          await api.delete(`${cfg.adminPath}/${b.dataset.delId}`);
          ui.toast('Deleted.', 'success');
          renderCatalog(name);
        } catch (err) {
          ui.toast(err.message || 'Delete failed.', 'error');
        }
      }));
    } catch (err) {
      pane.innerHTML = `<p class="text-muted">${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function openCatalogForm(name, item) {
    const cfg = CATALOG_CONFIG[name];
    const isEdit = !!item;
    const fields = cfg.fields.map(f => {
      const cur = item?.[f.key];
      let inputHtml;
      if (f.select) {
        inputHtml = `<select id="cf-${f.key}">${f.select.map(o => `<option value="${o}" ${cur === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
      } else if (f.textarea) {
        const val = typeof cur === 'object' ? JSON.stringify(cur || {}, null, 2) : (cur ?? '');
        inputHtml = `<textarea id="cf-${f.key}" rows="3" placeholder="${f.placeholder || ''}">${ui.escapeHtml(String(val))}</textarea>`;
      } else {
        inputHtml = `<input id="cf-${f.key}" type="${f.type || 'text'}" value="${ui.escapeHtml(String(cur ?? ''))}" ${f.required ? 'required' : ''}>`;
      }
      return `<div class="field ${f.full ? 'full' : ''}"><label>${f.label}</label>${inputHtml}</div>`;
    }).join('');

    ui.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Edit' : 'New'} ${name.slice(0, -1)}</h3>
        <button class="modal-close" data-modal-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="catalog-form" class="admin-form" style="margin:0">
        ${fields}
        <div class="admin-form-actions">
          <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    `);

    document.getElementById('catalog-form').addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {};
      for (const f of cfg.fields) {
        const el = document.getElementById('cf-' + f.key);
        let v = el.value;
        if (f.type === 'number') v = v === '' ? null : Number(v);
        if (f.key === 'meta_data') {
          try { v = v ? JSON.parse(v) : {}; }
          catch { ui.toast('Meta JSON is invalid.', 'error'); return; }
        }
        payload[f.key] = v;
      }
      try {
        if (isEdit) await api.put(`${cfg.adminPath}/${item.id}`, payload);
        else        await api.post(cfg.adminPath, payload);
        ui.closeModal();
        ui.toast(isEdit ? 'Saved.' : 'Created.', 'success');
        renderCatalog(name);
      } catch (err) {
        ui.toast(err.message || 'Save failed.', 'error');
      }
    });
  }

  /* ---------- Broadcast ---------- */

  function renderBroadcast() {
    pane.innerHTML = `
      <section class="card">
        <div class="card-header"><h2 class="card-title">Broadcast notification</h2></div>
        <form id="broadcast-form" class="admin-form" style="margin:0">
          <div class="field full"><label>Title</label><input id="bc-title" maxlength="100" value="📣 Announcement"></div>
          <div class="field full"><label>Message</label><textarea id="bc-msg" rows="4" required></textarea></div>
          <div class="admin-form-actions">
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-bullhorn"></i> Send to everyone</button>
          </div>
        </form>
      </section>
    `;
    document.getElementById('broadcast-form').addEventListener('submit', async e => {
      e.preventDefault();
      const title = document.getElementById('bc-title').value.trim();
      const message = document.getElementById('bc-msg').value.trim();
      if (!message) { ui.toast('Write a message first.', 'error'); return; }
      try {
        const r = await api.post('/admin/broadcast', { title, message });
        ui.toast(`Delivered to ${r.delivered} user${r.delivered === 1 ? '' : 's'}.`, 'success');
        document.getElementById('bc-msg').value = '';
      } catch (err) {
        ui.toast(err.message || 'Broadcast failed.', 'error');
      }
    });
  }

  renderTab();
})();
