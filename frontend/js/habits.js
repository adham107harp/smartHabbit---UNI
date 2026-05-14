/* Habits list page */
(async function () {
  ui.initLayout();

  const grid = document.querySelector('[data-habit-grid]');
  let allHabits = [];
  let filter = 'all';

  async function load() {
    try {
      const data = await api.get('/habits');
      allHabits = data.habits || data || [];
      render();
    } catch (err) {
      grid.innerHTML = `<p class="text-muted">Couldn't load your habits: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function render() {
    const list = filter === 'all' ? allHabits : allHabits.filter(h => h.goal_type === filter);
    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fa-solid fa-leaf"></i>
          <h3>No habits in this view</h3>
          <p>Add a new habit to get started.</p>
        </div>`;
      return;
    }
    grid.innerHTML = list.map(h => `
      <article class="habit-card" data-id="${h.id}">
        <div class="habit-card-head">
          <div>
            <h4>${ui.escapeHtml(h.name)}</h4>
            <div class="habit-info-sub mt-2">
              ${ui.difficultyBadge(h.difficulty)}
              <span class="dot"></span>
              <span>${h.goal_type === 'weekly' ? 'Weekly' : 'Daily'}</span>
              <span class="dot"></span>
              <span>Target ${h.target_value}</span>
            </div>
          </div>
          <div class="habit-card-menu" data-menu>
            <button class="habit-card-menu-btn" type="button" aria-label="Habit options">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
            <div class="habit-card-menu-list">
              <button data-edit="${h.id}"><i class="fa-solid fa-pen"></i> Edit</button>
              <button data-pause="${h.id}">
                <i class="fa-solid fa-${h.is_active ? 'pause' : 'play'}"></i>
                ${h.is_active ? 'Pause' : 'Resume'}
              </button>
              <button class="danger" data-delete="${h.id}"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
          </div>
        </div>
        <p>${ui.escapeHtml(h.description || 'No description.')}</p>
        <div class="habit-card-actions">
          <a class="btn btn-secondary btn-sm" href="habit-detail.html?id=${h.id}">
            <i class="fa-solid fa-chart-line"></i> Details
          </a>
          <button class="btn btn-primary btn-sm" data-log="${h.id}">
            <i class="fa-solid fa-check"></i> Log today
          </button>
        </div>
      </article>
    `).join('');
    bindCards();
  }

  function bindCards() {
    grid.querySelectorAll('[data-menu]').forEach(menu => {
      menu.querySelector('.habit-card-menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('[data-menu].open').forEach(o => o !== menu && o.classList.remove('open'));
        menu.classList.toggle('open');
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('[data-menu].open').forEach(m => m.classList.remove('open'));
    });

    grid.querySelectorAll('[data-log]').forEach(b => b.addEventListener('click', () => logHabit(b.dataset.log, b)));
    grid.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEditModal(b.dataset.edit)));
    grid.querySelectorAll('[data-pause]').forEach(b => b.addEventListener('click', () => togglePause(b.dataset.pause)));
    grid.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteHabit(b.dataset.delete)));
  }

  async function logHabit(id, btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const data = await api.post(`/habits/${id}/log`, { value: 1 });
      const xp = data.habitCompletion?.xpEarned ?? 0;
      const coins = data.habitCompletion?.coinsEarned ?? 0;
      btn.closest('.habit-card').classList.add('is-done');
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Logged';
      ui.toast(`+${xp} XP, +${coins} coins`, 'success');
      (data.badgesEarned || []).forEach(b => ui.toast(`Badge unlocked: ${b.badgeName}`, 'success', 5000));
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Log today';
      const msg = /already/i.test(err.message) ? 'You already logged this today.' : err.message;
      ui.toast(msg, 'error');
    }
  }

  async function togglePause(id) {
    const h = allHabits.find(x => x.id === id);
    if (!h) return;
    try {
      await api.put(`/habits/${id}`, { is_active: !h.is_active });
      h.is_active = !h.is_active;
      ui.toast(h.is_active ? 'Habit resumed.' : 'Habit paused.', 'success');
      render();
    } catch (err) {
      ui.toast(err.message || 'Could not update habit.', 'error');
    }
  }

  async function deleteHabit(id) {
    if (!confirm('Delete this habit? Your logs will be kept but it will be hidden from your list.')) return;
    try {
      await api.delete(`/habits/${id}`);
      allHabits = allHabits.filter(h => h.id !== id);
      render();
      ui.toast('Habit deleted.', 'success');
    } catch (err) {
      ui.toast(err.message || 'Could not delete habit.', 'error');
    }
  }

  function openCreateModal() {
    ui.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">New habit</h3>
        <button class="modal-close" data-modal-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="habit-form">
        <div class="field">
          <label for="h-name">Name</label>
          <input id="h-name" required maxlength="100" placeholder="e.g. Read 20 minutes">
        </div>
        <div class="field">
          <label for="h-description">Description (optional)</label>
          <textarea id="h-description" rows="2" placeholder="What does success look like?"></textarea>
        </div>
        <div class="field">
          <label for="h-goal">Frequency</label>
          <select id="h-goal">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div class="field">
          <label for="h-diff">Difficulty</label>
          <select id="h-diff">
            <option value="easy">Easy (+10 XP)</option>
            <option value="medium">Medium (+20 XP)</option>
            <option value="hard">Hard (+30 XP)</option>
          </select>
        </div>
        <div class="field">
          <label for="h-target">Target (how many times to count as done)</label>
          <input id="h-target" type="number" min="1" max="10000" value="1">
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary">Create habit</button>
        </div>
      </form>
    `);
    document.getElementById('habit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('h-name').value.trim(),
        description: document.getElementById('h-description').value.trim() || undefined,
        goal_type: document.getElementById('h-goal').value,
        difficulty: document.getElementById('h-diff').value,
        target_value: parseInt(document.getElementById('h-target').value, 10) || 1
      };
      if (!payload.name) { ui.toast('Please give your habit a name.', 'error'); return; }
      try {
        const data = await api.post('/habits', payload);
        allHabits.unshift(data.habit);
        ui.closeModal();
        render();
        ui.toast('Habit created.', 'success');
      } catch (err) {
        ui.toast(err.message || 'Could not create habit.', 'error');
      }
    });
  }

  function openEditModal(id) {
    const h = allHabits.find(x => x.id === id);
    if (!h) return;
    ui.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Edit habit</h3>
        <button class="modal-close" data-modal-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="edit-form">
        <div class="field">
          <label for="e-name">Name</label>
          <input id="e-name" value="${ui.escapeHtml(h.name)}" maxlength="100" required>
        </div>
        <div class="field">
          <label for="e-target">Target</label>
          <input id="e-target" type="number" min="1" max="10000" value="${h.target_value}">
        </div>
        <p class="text-muted">Difficulty is locked once a habit is created to keep your XP fair.</p>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById('edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await api.put(`/habits/${id}`, {
          name: document.getElementById('e-name').value.trim(),
          target_value: parseInt(document.getElementById('e-target').value, 10) || 1
        });
        Object.assign(h, data.habit);
        ui.closeModal();
        render();
        ui.toast('Habit updated.', 'success');
      } catch (err) {
        ui.toast(err.message || 'Could not update habit.', 'error');
      }
    });
  }

  document.getElementById('open-create-habit').addEventListener('click', openCreateModal);
  document.querySelectorAll('.habit-filters .tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.habit-filters .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      filter = t.dataset.filter;
      render();
    });
  });

  await load();
})();
