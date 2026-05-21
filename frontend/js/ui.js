/* =========================================================================
   ui.js — shared UI helpers: toast, modal, sidebar, topbar, formatting.
   Builds the sidebar/topbar markup so every protected page reuses the
   exact same structure (and styling from base.css).
   ========================================================================= */

(function (global) {
  /* ---------- Toast ---------- */
  function ensureToastContainer() {
    let c = document.querySelector('.toast-container');
    if (!c) {
      c = document.createElement('div');
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(message, type = 'info', timeout = 3500) {
    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check'
              : type === 'error'   ? 'fa-circle-exclamation'
              :                      'fa-circle-info';
    el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      el.style.transition = 'opacity 0.25s, transform 0.25s';
      setTimeout(() => el.remove(), 250);
    }, timeout);
  }

  /**
   * actionToast — a sticky toast with a clickable button (e.g. "Undo").
   * Returns a handle: { dismiss() } so callers can close it after the action.
   * Auto-dismisses after `timeout` ms (default 60s for log undo).
   */
  function actionToast(message, actionLabel, onAction, type = 'success', timeout = 60000) {
    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type} toast-actionable`;
    const icon = type === 'success' ? 'fa-circle-check'
              : type === 'error'   ? 'fa-circle-exclamation'
              :                      'fa-circle-info';
    el.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${escapeHtml(message)}</span>
      <button type="button" class="toast-action">${escapeHtml(actionLabel)}</button>
    `;
    container.appendChild(el);

    const dismiss = () => {
      if (!el.parentElement) return;
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      el.style.transition = 'opacity 0.25s, transform 0.25s';
      setTimeout(() => el.remove(), 250);
    };

    el.querySelector('.toast-action').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await onAction();
      } finally {
        dismiss();
      }
    });

    setTimeout(dismiss, timeout);
    return { dismiss };
  }

  /* ---------- Modal ---------- */
  function ensureModalBackdrop() {
    let b = document.querySelector('.modal-backdrop');
    if (!b) {
      b = document.createElement('div');
      b.className = 'modal-backdrop';
      b.addEventListener('click', (e) => {
        if (e.target === b) closeModal();
      });
      document.body.appendChild(b);
    }
    return b;
  }

  function openModal(html) {
    const backdrop = ensureModalBackdrop();
    backdrop.innerHTML = `<div class="modal">${html}</div>`;
    backdrop.classList.add('open');
    const closeBtn = backdrop.querySelector('[data-modal-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    return backdrop.querySelector('.modal');
  }

  function closeModal() {
    const b = document.querySelector('.modal-backdrop');
    if (b) {
      b.classList.remove('open');
      b.innerHTML = '';
    }
  }

  /* ---------- Unread-count poll (v5: notification sound) ----------
     Polls /notifications/unread/count every 30s. If the count rises
     between two polls, plays sound.play('notification') and updates the
     bell badge. We don't fire on the FIRST poll because we don't know
     whether the count was already that high before the user looked.
     Only one poller per page; cleared on page unload.
  */
  let _unreadPoll = null;
  let _lastUnread = 0;
  function startUnreadPoll(initialCount) {
    if (_unreadPoll) return; // already polling
    _lastUnread = initialCount;
    _unreadPoll = setInterval(async () => {
      try {
        const counts = await api.get('/notifications/unread/count');
        const c = counts.count ?? counts.unreadCount ?? counts;
        if (typeof c !== 'number') return;
        const el = document.querySelector('[data-topbar]');
        const dot = el?.querySelector('[data-tb-unread]');
        if (dot) {
          if (c > 0) {
            dot.textContent = c > 99 ? '99+' : String(c);
            dot.classList.add('visible');
          } else {
            dot.classList.remove('visible');
          }
        }
        if (c > _lastUnread && window.sound) sound.play('notification');
        _lastUnread = c;
      } catch { /* ignore network blips */ }
    }, 30_000);
    window.addEventListener('beforeunload', () => {
      if (_unreadPoll) clearInterval(_unreadPoll);
    }, { once: true });
  }

  /* ---------- Sidebar ---------- */
  const NAV_ITEMS = [
    { href: 'dashboard.html',     icon: 'fa-house',           label: 'Dashboard' },
    { href: 'habits.html',        icon: 'fa-list-check',      label: 'My Habits' },
    { href: 'badges.html',        icon: 'fa-medal',           label: 'Badges' },
    { href: 'challenges.html',    icon: 'fa-trophy',          label: 'Challenges' },
    { href: 'shop.html',          icon: 'fa-bag-shopping',    label: 'Shop' },
    { href: 'leaderboard.html',   icon: 'fa-ranking-star',    label: 'Leaderboard' },
    { href: 'friends.html',       icon: 'fa-user-group',      label: 'Friends' },
    { href: 'chat.html',          icon: 'fa-comments',        label: 'Chat' },
    { href: 'notifications.html', icon: 'fa-bell',            label: 'Notifications' },
    { href: 'profile.html',       icon: 'fa-user',            label: 'Profile' },
    { href: 'settings.html',      icon: 'fa-gear',            label: 'Settings' }
  ];

  function renderSidebar() {
    const el = document.querySelector('[data-sidebar]');
    if (!el) return;
    const currentPage = location.pathname.split('/').pop() || 'index.html';
    el.classList.add('sidebar');
    // Admin link only renders for users whose cached /me has is_admin=true.
    // We check both api.getCachedUser() now AND re-render after the topbar
    // fetches a fresh /me so the link appears on first login too.
    const cached = api.getCachedUser();
    const adminLink = cached?.is_admin
      ? `<a class="sidebar-link ${currentPage === 'admin.html' ? 'active' : ''}" href="admin.html">
           <i class="fa-solid fa-shield-halved"></i>
           <span class="label">Admin</span>
         </a>`
      : '';
    el.innerHTML = `
      <a class="sidebar-brand" href="dashboard.html">
        <span class="logo"><i class="fa-solid fa-bolt"></i></span>
        <span class="brand-name">SmartHabbit</span>
      </a>
      <nav class="sidebar-nav">
        ${NAV_ITEMS.map(item => `
          <a class="sidebar-link ${currentPage === item.href ? 'active' : ''}" href="${item.href}">
            <i class="fa-solid ${item.icon}"></i>
            <span class="label">${item.label}</span>
          </a>
        `).join('')}
        ${adminLink}
      </nav>
      <div class="sidebar-footer">
        <a class="sidebar-link" href="#" id="sidebar-logout">
          <i class="fa-solid fa-right-from-bracket"></i>
          <span class="label">Log out</span>
        </a>
      </div>
    `;
    el.querySelector('#sidebar-logout').addEventListener('click', (e) => {
      e.preventDefault();
      api.clearTokens();
      location.replace('login.html');
    });
  }

  /* ---------- Topbar ---------- */
  async function renderTopbar(opts = {}) {
    const el = document.querySelector('[data-topbar]');
    if (!el) return;
    el.classList.add('topbar');
    el.innerHTML = `
      <div class="topbar-left">
        <div class="topbar-greeting">Hi, <strong data-tb-username>there</strong> 👋</div>
      </div>
      <div class="topbar-right">
        <span class="chip chip-level"><i class="fa-solid fa-star"></i> Lv <span data-tb-level>1</span></span>
        <span class="chip chip-coins"><i class="fa-solid fa-coins"></i> <span data-tb-coins>0</span></span>
        <span class="chip chip-streak"><i class="fa-solid fa-fire"></i> <span data-tb-streak>0</span></span>
        <a class="bell" href="chat.html" title="Chat with friends">
          <i class="fa-solid fa-comments"></i>
          <span class="badge-dot" data-tb-chat-unread>0</span>
        </a>
        <a class="bell" href="notifications.html" title="Notifications">
          <i class="fa-solid fa-bell"></i>
          <span class="badge-dot" data-tb-unread>0</span>
        </a>
        <a class="avatar" href="profile.html" title="Profile" data-tb-avatar>
          <span data-tb-initial>?</span>
        </a>
      </div>
    `;

    // Prefer cached user for instant render, then refresh from network
    const cached = api.getCachedUser();
    if (cached) applyUser(el, cached);

    if (!opts.skipFetch) {
      try {
        const data = await api.get('/users/me');
        const user = data.user || data;
        applyUser(el, user);
        api.setTokens({ user });
        // Re-render the sidebar if the cached user lacked is_admin but the
        // fresh /me has it (first login after upgrade).
        if (user.is_admin && !document.querySelector('[data-sidebar] a[href="admin.html"]')) {
          renderSidebar();
        }
      } catch (err) {
        console.warn('topbar /users/me failed', err);
      }
      try {
        const counts = await api.get('/notifications/unread/count');
        const c = counts.count ?? counts.unreadCount ?? counts;
        const dot = el.querySelector('[data-tb-unread]');
        if (dot && typeof c === 'number' && c > 0) {
          dot.textContent = c > 99 ? '99+' : String(c);
          dot.classList.add('visible');
        }
        startUnreadPoll(typeof c === 'number' ? c : 0);
      } catch { /* ignore */ }

      try {
        const chat = await api.get('/chat/unread/count');
        const c = chat.count ?? chat;
        const dot = el.querySelector('[data-tb-chat-unread]');
        if (dot && typeof c === 'number' && c > 0) {
          dot.textContent = c > 99 ? '99+' : String(c);
          dot.classList.add('visible');
        }
      } catch { /* ignore — endpoint not yet ready or no friends */ }
    }
  }

  function applyUser(root, user) {
    if (!user) return;
    const set = (sel, val) => {
      const n = root.querySelector(sel);
      if (n) n.textContent = val;
    };
    set('[data-tb-username]', user.username || 'there');
    set('[data-tb-level]',    user.level ?? 1);
    set('[data-tb-coins]',    user.coins ?? 0);
    set('[data-tb-streak]',   user.current_streak ?? 0);
    const initial = (user.username || '?').charAt(0).toUpperCase();
    set('[data-tb-initial]',  initial);
    const av = root.querySelector('[data-tb-avatar]');
    if (av) {
      if (user.avatar_url) {
        const src = absoluteMediaUrl(user.avatar_url);
        av.innerHTML = `<img src="${src}" alt="">`;
      } else {
        av.innerHTML = `<span>${initial}</span>`;
      }
      applyFrameTo(av, user.active_avatar_frame);
    }
    applyTheme(user.active_theme);
  }

  /**
   * Apply the user's equipped theme (or "default") to the document root.
   * Reading from <html data-theme> means every page that loads base.css
   * picks up the palette automatically, no JS-per-component needed.
   */
  function applyTheme(themeRecord) {
    const palette = themeRecord?.meta_data?.palette;
    if (palette) {
      document.documentElement.setAttribute('data-theme', palette);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  /**
   * Apply (or clear) the equipped avatar frame ring on an .avatar element.
   * The frame colour comes from the shop item's meta_data.color.
   */
  function applyFrameTo(el, frameRecord) {
    if (!el) return;
    if (frameRecord) {
      const color = frameRecord.meta_data?.color || 'gold';
      el.classList.add('has-frame');
      el.style.setProperty('--frame-color', cssColorFor(color));
    } else {
      el.classList.remove('has-frame');
      el.style.removeProperty('--frame-color');
    }
  }

  /**
   * Map shop-item `meta_data.color` keys to actual CSS colors.
   * Add more entries here as new frames are seeded.
   */
  function cssColorFor(name) {
    const map = {
      'purple-gold': '#ffd700',
      'cosmic': '#a78bfa',
      'gold': '#ffd700',
      'crown': '#fcd34d',
      'silver': '#c0c0c0',
      'fire': '#ff6b6b',
      'ocean': '#38f9d7'
    };
    return map[name] || name || '#ffd700';
  }

  /**
   * Backend uploaded media is served at /uploads/... on the same host as the API.
   * Convert relative paths so the frontend (different origin) can load them.
   */
  function absoluteMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const apiBase = (window.SMARTHABBIT_API_URL || 'http://localhost:3000');
    if (url.startsWith('/')) return apiBase + url;
    return url; // relative file (e.g. img/presets/01-fox.svg) — leave alone
  }

  /* ---------- Page init ---------- */
  function initLayout(opts = {}) {
    renderSidebar();
    renderTopbar(opts);
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatRelativeTime(date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60)        return 'just now';
    if (diffSec < 3600)      return Math.floor(diffSec / 60) + 'm ago';
    if (diffSec < 86400)     return Math.floor(diffSec / 3600) + 'h ago';
    if (diffSec < 604800)    return Math.floor(diffSec / 86400) + 'd ago';
    return formatDate(d);
  }

  function difficultyBadge(level) {
    const cls = level === 'hard' ? 'diff-hard' : level === 'medium' ? 'diff-medium' : 'diff-easy';
    return `<span class="diff-badge ${cls}">${escapeHtml(level)}</span>`;
  }

  function xpForLevel(level)   { return Math.pow(level - 1, 2) * 100; }
  function levelFromXp(xp)     { return Math.floor(Math.sqrt(xp / 100)) + 1; }

  function progressToNextLevel(xp) {
    const level = levelFromXp(xp);
    const cur = xpForLevel(level);
    const next = xpForLevel(level + 1);
    const total = Math.max(1, next - cur);
    return {
      level,
      currentLevelXp: xp - cur,
      neededForNext: total,
      percent: Math.min(100, Math.round(((xp - cur) / total) * 100))
    };
  }

  global.ui = {
    toast, actionToast, openModal, closeModal,
    initLayout, renderSidebar, renderTopbar, applyUser,
    applyTheme, applyFrameTo, cssColorFor, absoluteMediaUrl,
    escapeHtml, formatDate, formatRelativeTime,
    difficultyBadge, xpForLevel, levelFromXp, progressToNextLevel
  };
})(window);
