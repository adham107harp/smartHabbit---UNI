/* Settings page */
(async function () {
  ui.initLayout();

  const PREF_KEY = 'sh_prefs_v1';
  const DEFAULTS = {
    theme: 'dark', sounds: true, reduceMotion: false,
    notifLevel: true, notifBadge: true, notifStreak: true, notifFriends: false
  };

  function getPrefs() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  }
  function savePrefs(p) {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  }

  /* --- Account --- */
  const accountForm = document.getElementById('account-form');
  let user = api.getCachedUser() || {};

  function fillAccount() {
    accountForm.querySelector('#username').value = user.username || '';
    accountForm.querySelector('#email').value = user.email || '';
    accountForm.querySelector('#avatar-url').value = user.avatar_url || '';
  }

  async function loadUser() {
    try {
      const data = await api.get('/users/me');
      user = data.user || data;
      api.setTokens({ user });
      fillAccount();
    } catch (err) {
      ui.toast(err.message || 'Could not load your profile.', 'error');
    }
  }

  accountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      username: accountForm.querySelector('#username').value.trim(),
      avatar_url: accountForm.querySelector('#avatar-url').value.trim() || null
    };
    try {
      const data = await api.put('/users/me', payload);
      Object.assign(user, data.user || data);
      api.setTokens({ user });
      ui.toast('Profile saved.', 'success');
      // Refresh topbar to reflect new username/avatar
      ui.applyUser(document.querySelector('[data-topbar]'), user);
    } catch (err) {
      ui.toast(err.message || 'Could not save profile.', 'error');
    }
  });

  /* --- Preferences --- */
  const prefs = getPrefs();

  /* Theme picker — v2: list user-owned themes + default; equip on click. */
  async function loadThemePicker() {
    const grid = document.querySelector('[data-theme-grid]');
    if (!grid) return;
    try {
      const inv = await api.get('/shop/user/inventory');
      const ownedThemes = (inv.inventory || inv || []).filter(i => i.item_type === 'theme');
      renderThemeGrid(grid, ownedThemes);
    } catch (err) {
      grid.innerHTML = `<p class="text-muted">Couldn't load themes: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function renderThemeGrid(grid, ownedThemes) {
    const activeId = user.active_theme?.id || null;
    const themes = [
      { id: null, name: 'Default', meta_data: { palette: 'default' } },
      ...ownedThemes
    ];
    grid.innerHTML = themes.map(t => {
      const palette = t.meta_data?.palette || 'default';
      const isActive = (t.id || null) === activeId;
      return `
        <button class="theme-tile ${isActive ? 'is-active' : ''}" data-theme-id="${t.id || ''}" data-palette="${palette}">
          <span class="theme-tile-swatch theme-swatch-${palette}"></span>
          <span class="theme-tile-name">${ui.escapeHtml(t.name)}</span>
          ${isActive ? '<i class="fa-solid fa-circle-check theme-tile-check"></i>' : ''}
        </button>
      `;
    }).join('');
    grid.querySelectorAll('[data-theme-id]').forEach(t => {
      t.addEventListener('click', () => equipTheme(t.dataset.themeId || null, t.dataset.palette));
    });
  }

  async function equipTheme(themeId, palette) {
    try {
      if (themeId) {
        await api.post(`/shop/items/${themeId}/equip`);
      } else {
        await api.post('/shop/items/unequip/theme');
      }
      // Refresh /me so the user record reflects the new active_theme
      const me = await api.get('/users/me');
      user = me.user || me;
      api.setTokens({ user });
      ui.applyTheme(user.active_theme);
      ui.applyUser(document.querySelector('[data-topbar]'), user);
      ui.toast(themeId ? 'Theme equipped.' : 'Default theme restored.', 'success');
      loadThemePicker();
    } catch (err) {
      ui.toast(err.message || 'Could not change theme.', 'error');
    }
  }

  const wireToggle = (id, key) => {
    const el = document.getElementById(id);
    el.checked = !!prefs[key];
    el.addEventListener('change', () => {
      prefs[key] = el.checked;
      savePrefs(prefs);
    });
  };
  wireToggle('pref-sounds', 'sounds');
  wireToggle('pref-reduce-motion', 'reduceMotion');
  wireToggle('notif-level', 'notifLevel');
  wireToggle('notif-badge', 'notifBadge');
  wireToggle('notif-streak', 'notifStreak');
  wireToggle('notif-friends', 'notifFriends');

  /* --- Side nav scroll-spy + smooth jump --- */
  document.querySelectorAll('.settings-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(link.dataset.target);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.settings-nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  /* --- Danger zone --- */
  document.getElementById('logout-btn').addEventListener('click', () => {
    api.clearTokens();
    location.replace('login.html');
  });

  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    if (!confirm('Delete your account? This cannot be undone.')) return;
    if (!confirm('Really sure? You\'ll lose all your progress.')) return;
    try {
      await api.delete('/users/me');
      api.clearTokens();
      ui.toast('Your account has been deleted.', 'info');
      setTimeout(() => location.replace('index.html'), 1200);
    } catch (err) {
      ui.toast(err.message || 'Could not delete account.', 'error');
    }
  });

  await loadUser();
  await loadThemePicker();
})();
