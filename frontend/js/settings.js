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
  const themeSel = document.getElementById('pref-theme');
  themeSel.value = prefs.theme;
  themeSel.addEventListener('change', () => {
    prefs.theme = themeSel.value;
    savePrefs(prefs);
    ui.toast('Theme saved.', 'success');
  });

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
})();
