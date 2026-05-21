/* Shop page (v2: Equip / Equipped state for themes & frames) */
(async function () {
  ui.initLayout();
  const grid = document.querySelector('[data-shop-grid]');
  const balance = document.querySelector('[data-shop-coins]');

  let items = [], inventory = [];
  let typeFilter = 'all';
  let user = null;

  const ICON_MAP = {
    theme: 'fa-palette',
    avatar_item: 'fa-user-astronaut',
    consumable: 'fa-flask',
    badge: 'fa-medal'
  };

  async function load() {
    try {
      const me = await api.get('/users/me');
      user = me.user || me;
      balance.textContent = user.coins ?? 0;
      api.setTokens({ user });

      const [itemsRes, invRes] = await Promise.all([
        api.get('/shop/items'),
        api.get('/shop/user/inventory')
      ]);
      items = itemsRes.items || itemsRes || [];
      inventory = invRes.inventory || invRes.items || invRes || [];
      render();
    } catch (err) {
      grid.innerHTML = `<p class="text-muted">Couldn't load the shop: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function render() {
    const ownedIds = new Set(inventory.map(i => i.item_id || i.id));
    const activeThemeId = user?.active_theme?.id;
    const activeFrameId = user?.active_avatar_frame?.id;

    let list = items.map(i => ({
      ...i,
      owned: ownedIds.has(i.id),
      isEquipped: i.id === activeThemeId || i.id === activeFrameId,
      isEquippable: i.item_type === 'theme' || i.item_type === 'avatar_item'
    }));

    if (typeFilter === 'owned') {
      list = list.filter(i => i.owned);
    } else if (typeFilter !== 'all') {
      list = list.filter(i => i.item_type === typeFilter);
    }

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-box"></i>
        <h3>${typeFilter === 'owned' ? 'You don\'t own anything yet' : 'No items in this category'}</h3>
        <p>${typeFilter === 'owned' ? 'Earn coins by logging habits, then come back to spend them.' : 'Check back later.'}</p>
      </div>`;
      return;
    }

    const myCoins = user?.coins ?? 0;

    grid.innerHTML = list.map(i => {
      const canAfford = myCoins >= i.cost;
      const actionBtn = (() => {
        if (i.isEquipped) return `<button class="btn btn-success" disabled><i class="fa-solid fa-check"></i> Equipped</button>`;
        if (i.owned && i.isEquippable) return `<button class="btn btn-secondary" data-equip="${i.id}">Equip</button>`;
        if (i.owned) return `<button class="btn btn-secondary" disabled>Owned</button>`;
        return `<button class="btn btn-primary" data-buy="${i.id}" ${canAfford ? '' : 'disabled'}>
                  ${canAfford ? 'Buy' : 'Not enough coins'}
                </button>`;
      })();

      return `
        <article class="shop-item type-${i.item_type} ${i.owned ? 'owned' : ''} ${i.isEquipped ? 'equipped' : ''}">
          <div class="shop-item-icon">
            <i class="fa-solid ${ICON_MAP[i.item_type] || 'fa-gift'}"></i>
          </div>
          <h4>${ui.escapeHtml(i.name)}</h4>
          <p>${ui.escapeHtml(i.description || '')}</p>
          <div class="shop-item-price">
            <i class="fa-solid fa-coins"></i> ${i.cost}
          </div>
          <div class="shop-item-action">${actionBtn}</div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-buy]').forEach(btn => {
      btn.addEventListener('click', () => buy(btn.dataset.buy, btn));
    });
    grid.querySelectorAll('[data-equip]').forEach(btn => {
      btn.addEventListener('click', () => equip(btn.dataset.equip, btn));
    });
  }

  async function buy(itemId, btn) {
    const item = items.find(x => x.id === itemId);
    if (!item) return;
    if (!confirm(`Buy "${item.name}" for ${item.cost} coins?`)) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await api.post('/shop/purchase', { itemId });
      ui.toast(`Purchased ${item.name}.`, 'success');
      await load();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = 'Buy';
      const msg = err.status === 402 || err.code === 'INSUFFICIENT_COINS' || /insufficient/i.test(err.message)
        ? 'You don\'t have enough coins for that.'
        : (err.message || 'Could not complete the purchase.');
      ui.toast(msg, 'error');
    }
  }

  async function equip(itemId, btn) {
    const item = items.find(x => x.id === itemId);
    if (!item) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await api.post(`/shop/items/${itemId}/equip`);
      // Re-fetch the user so active_theme / active_avatar_frame are fresh,
      // then apply theme + frame to the live DOM immediately.
      const me = await api.get('/users/me');
      user = me.user || me;
      api.setTokens({ user });
      ui.applyTheme(user.active_theme);
      ui.applyUser(document.querySelector('[data-topbar]'), user);
      ui.toast(`${item.name} equipped.`, 'success');
      render();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = 'Equip';
      ui.toast(err.message || 'Could not equip.', 'error');
    }
  }

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      typeFilter = t.dataset.type;
      render();
    });
  });

  await load();
})();
