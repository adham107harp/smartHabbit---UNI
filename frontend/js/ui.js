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

  /* ---------- Sidebar ---------- */
  const NAV_ITEMS = [
    { href: 'dashboard.html',     icon: 'fa-house',           label: 'Dashboard' },
    { href: 'habits.html',        icon: 'fa-list-check',      label: 'My Habits' },
    { href: 'badges.html',        icon: 'fa-medal',           label: 'Badges' },
    { href: 'challenges.html',    icon: 'fa-trophy',          label: 'Challenges' },
    { href: 'shop.html',          icon: 'fa-bag-shopping',    label: 'Shop' },
    { href: 'leaderboard.html',   icon: 'fa-ranking-star',    label: 'Leaderboard' },
    { href: 'friends.html',       icon: 'fa-user-group',      label: 'Friends' },
    { href: 'notifications.html', icon: 'fa-bell',            label: 'Notifications' },
    { href: 'profile.html',       icon: 'fa-user',            label: 'Profile' },
    { href: 'settings.html',      icon: 'fa-gear',            label: 'Settings' }
  ];

  function renderSidebar() {
    const el = document.querySelector('[data-sidebar]');
    if (!el) return;
    const currentPage = location.pathname.split('/').pop() || 'index.html';
    el.classList.add('sidebar');
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
        // Persist refreshed user
        api.setTokens({ user });
      } catch (err) {
        // Token might be stale — auth-guard handles redirect
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
      } catch { /* ignore */ }
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
    if (av && user.avatar_url) {
      av.innerHTML = `<img src="${user.avatar_url}" alt="">`;
    }
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
    toast, openModal, closeModal,
    initLayout, renderSidebar, renderTopbar, applyUser,
    escapeHtml, formatDate, formatRelativeTime,
    difficultyBadge, xpForLevel, levelFromXp, progressToNextLevel
  };
})(window);
