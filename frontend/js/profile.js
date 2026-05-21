/* Profile page (v2: 3-tab avatar picker, equip frame, equip theme) */
(async function () {
  ui.initLayout();

  const $ = (sel) => document.querySelector(sel);
  let user = null;

  const PRESETS = [
    { id: 'fox',    file: 'img/presets/01-fox.svg',    label: 'Fox' },
    { id: 'cat',    file: 'img/presets/02-cat.svg',    label: 'Cat' },
    { id: 'robot',  file: 'img/presets/03-robot.svg',  label: 'Robot' },
    { id: 'ninja',  file: 'img/presets/04-ninja.svg',  label: 'Ninja' },
    { id: 'panda',  file: 'img/presets/05-panda.svg',  label: 'Panda' },
    { id: 'owl',    file: 'img/presets/06-owl.svg',    label: 'Owl' },
    { id: 'dragon', file: 'img/presets/07-dragon.svg', label: 'Dragon' },
    { id: 'wizard', file: 'img/presets/08-wizard.svg', label: 'Wizard' }
  ];

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
    if (user.avatar_url) {
      av.innerHTML = `<img src="${ui.absoluteMediaUrl(user.avatar_url)}" alt="">`;
    } else {
      av.innerHTML = `<span>${(user.username || '?').charAt(0).toUpperCase()}</span>`;
    }
    av.classList.add('profile-avatar');
    ui.applyFrameTo(av, user.active_avatar_frame);
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

  /* ------------------- Avatar picker (3 tabs) ------------------- */

  function openAvatarPicker() {
    const currentTab = 'upload';
    ui.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Choose your avatar</h3>
        <button class="modal-close" data-modal-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="tabs avatar-picker-tabs">
        <button class="tab active" data-pick-tab="upload"><i class="fa-solid fa-cloud-arrow-up"></i> Upload</button>
        <button class="tab" data-pick-tab="frames"><i class="fa-solid fa-circle-nodes"></i> Frames</button>
        <button class="tab" data-pick-tab="presets"><i class="fa-solid fa-images"></i> Presets</button>
      </div>
      <div data-pick-body></div>
    `);

    const body = document.querySelector('[data-pick-body]');
    function selectTab(tab) {
      document.querySelectorAll('[data-pick-tab]').forEach(t => {
        t.classList.toggle('active', t.dataset.pickTab === tab);
      });
      if (tab === 'upload') renderUploadTab(body);
      else if (tab === 'frames') renderFramesTab(body);
      else renderPresetsTab(body);
    }
    document.querySelectorAll('[data-pick-tab]').forEach(t => {
      t.addEventListener('click', () => selectTab(t.dataset.pickTab));
    });
    selectTab(currentTab);
  }

  function renderUploadTab(body) {
    const previewSrc = user.avatar_url ? ui.absoluteMediaUrl(user.avatar_url) : null;
    body.innerHTML = `
      <div class="upload-zone" id="upload-zone">
        ${previewSrc ? `<img src="${previewSrc}" class="upload-preview" alt="">` : `
          <i class="fa-solid fa-cloud-arrow-up upload-zone-icon"></i>
          <p>Drop an image here, or click to choose one.</p>
          <p class="text-muted">PNG, JPG, or WebP. Up to 2 MB.</p>
        `}
        <input type="file" accept="image/png,image/jpeg,image/webp" id="upload-input" hidden>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary" id="upload-trigger">
          <i class="fa-solid fa-upload"></i> Choose image
        </button>
      </div>
    `;
    const input = document.getElementById('upload-input');
    const zone = document.getElementById('upload-zone');
    document.getElementById('upload-trigger').addEventListener('click', () => input.click());
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragging'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragging');
      if (e.dataTransfer?.files?.[0]) doUpload(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', (e) => {
      if (e.target.files?.[0]) doUpload(e.target.files[0]);
    });
  }

  async function doUpload(file) {
    if (file.size > 2 * 1024 * 1024) {
      ui.toast('Image is too big. Max 2 MB.', 'error');
      return;
    }
    // Client-side MIME pre-check — multer rejects anything not PNG/JPG/WebP,
    // and the server then magic-byte verifies the actual content. Bail early
    // with a clearer message if the user picked something obviously wrong.
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (file.type && !allowed.includes(file.type)) {
      ui.toast(`That file type (${file.type}) isn't supported. Use a PNG, JPG, or WebP.`, 'error');
      return;
    }
    try {
      const data = await api.upload('/users/me/avatar', file, 'avatar');
      user = data.user || user;
      api.setTokens({ user });
      renderHero();
      ui.applyUser(document.querySelector('[data-topbar]'), user);
      ui.closeModal();
      ui.toast('Avatar updated.', 'success');
    } catch (err) {
      console.warn('avatar upload failed:', err);
      // Server-side errors come back with their own message (e.g. the
      // magic-byte verifier's "File is not a recognised PNG/JPEG/WebP image").
      // We forward it verbatim and add a size hint for the common 413 case.
      const msg = err?.status === 413
        ? 'Image is too big. The server limit is 2 MB.'
        : (err?.message || 'Could not upload that image. Try a PNG or JPG under 2 MB.');
      ui.toast(msg, 'error');
    }
  }

  async function renderFramesTab(body) {
    body.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    try {
      const inv = await api.get('/shop/user/inventory');
      const items = (inv.inventory || inv || []).filter(i => i.item_type === 'avatar_item');
      const activeId = user.active_avatar_frame?.id;
      const tiles = [
        { id: null, name: 'None', meta_data: {}, isOwned: true }
      ].concat(items.map(i => ({ ...i, isOwned: true })));

      if (items.length === 0) {
        body.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-circle-nodes"></i>
            <h3>No frames in your inventory yet</h3>
            <p>Buy a frame in the <a href="shop.html">shop</a> to equip it here.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-modal-close>Close</button>
          </div>`;
        return;
      }

      body.innerHTML = `
        <div class="picker-grid">
          ${tiles.map(t => `
            <button class="picker-tile ${t.id === activeId ? 'is-active' : ''}" data-frame-id="${t.id || ''}">
              <div class="picker-tile-ring" style="--frame-color: ${ui.cssColorFor(t.meta_data?.color || '')}"></div>
              <span>${ui.escapeHtml(t.name)}</span>
            </button>
          `).join('')}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal-close>Done</button>
        </div>
      `;
      body.querySelectorAll('[data-frame-id]').forEach(t => {
        t.addEventListener('click', () => equipFrame(t.dataset.frameId || null));
      });
    } catch (err) {
      body.innerHTML = `<p class="text-muted">Couldn't load frames: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  async function equipFrame(frameId) {
    try {
      if (frameId) {
        await api.post(`/shop/items/${frameId}/equip`);
      } else {
        await api.post('/shop/items/unequip/avatar_item');
      }
      const me = await api.get('/users/me');
      user = me.user || me;
      api.setTokens({ user });
      renderHero();
      ui.applyUser(document.querySelector('[data-topbar]'), user);
      ui.toast(frameId ? 'Frame equipped.' : 'Frame removed.', 'success');
      // Refresh the modal contents
      renderFramesTab(document.querySelector('[data-pick-body]'));
    } catch (err) {
      ui.toast(err.message || 'Could not equip frame.', 'error');
    }
  }

  function renderPresetsTab(body) {
    const currentPath = user.avatar_url || '';
    body.innerHTML = `
      <p class="text-muted mb-3">Free, built-in avatars. Pick one and you're done.</p>
      <div class="picker-grid">
        ${PRESETS.map(p => `
          <button class="picker-tile ${currentPath.endsWith(p.file) ? 'is-active' : ''}" data-preset="${p.file}">
            <img src="${p.file}" alt="${p.label}">
            <span>${p.label}</span>
          </button>
        `).join('')}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-modal-close>Done</button>
      </div>
    `;
    body.querySelectorAll('[data-preset]').forEach(t => {
      t.addEventListener('click', () => choosePreset(t.dataset.preset));
    });
  }

  async function choosePreset(path) {
    try {
      const data = await api.put('/users/me', { avatar_url: path });
      user = data.user || data;
      api.setTokens({ user });
      renderHero();
      ui.applyUser(document.querySelector('[data-topbar]'), user);
      ui.toast('Avatar updated.', 'success');
      renderPresetsTab(document.querySelector('[data-pick-body]'));
    } catch (err) {
      ui.toast(err.message || 'Could not set avatar.', 'error');
    }
  }

  /* ------------------- Edit username modal ------------------- */

  function openEditModal() {
    ui.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Edit username</h3>
        <button class="modal-close" data-modal-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="profile-form">
        <div class="field">
          <label for="p-username">Username</label>
          <input id="p-username" value="${ui.escapeHtml(user.username || '')}" minlength="3" maxlength="50" required>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('p-username').value.trim();
      try {
        const data = await api.put('/users/me', { username });
        user = data.user || data;
        api.setTokens({ user });
        ui.closeModal();
        renderHero();
        ui.toast('Profile updated.', 'success');
        ui.applyUser(document.querySelector('[data-topbar]'), user);
      } catch (err) {
        ui.toast(err.message || 'Could not update profile.', 'error');
      }
    });
  }

  document.getElementById('edit-profile-btn').addEventListener('click', openEditModal);

  // The hero avatar is now a clickable button that opens the picker.
  // Wire it up after first render.
  document.querySelector('[data-avatar]').addEventListener('click', openAvatarPicker);
  document.querySelector('[data-avatar]').style.cursor = 'pointer';
  document.querySelector('[data-avatar]').title = 'Change avatar';

  // Add a dedicated "Change avatar" button alongside Edit profile
  const editBtn = document.getElementById('edit-profile-btn');
  if (editBtn) {
    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn btn-primary';
    changeBtn.style.marginRight = '8px';
    changeBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Change avatar';
    changeBtn.addEventListener('click', openAvatarPicker);
    editBtn.parentElement.insertBefore(changeBtn, editBtn);
  }

  await load();
})();
