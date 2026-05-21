/* =========================================================================
   mystery.js — pops a celebratory modal when the user has unopened
   mystery boxes (one per 10 levels), then unwraps them one at a time.
   ========================================================================= */
(function (global) {
  let openInProgress = false;

  /**
   * Check the server for unopened boxes; if any, show the modal for the
   * first one. Returns silently if there's nothing to do or the page
   * doesn't have a topbar (e.g. login screen).
   */
  async function refresh() {
    if (openInProgress) return;
    if (!window.api || !api.isAuthed()) return;
    try {
      const data = await api.get('/mystery/pending');
      const boxes = data.boxes || data || [];
      if (boxes.length === 0) return;
      showBox(boxes[0]);
    } catch (err) {
      console.warn('mystery refresh failed:', err);
    }
  }

  function showBox(box) {
    openInProgress = true;
    if (window.sound) sound.play('mystery');
    ui.openModal(`
      <div class="mystery-modal" data-mystery-modal>
        <div class="mystery-chest" id="mystery-chest">
          <i class="fa-solid fa-gift"></i>
        </div>
        <h2 class="mystery-title">Level ${box.level_awarded} reward!</h2>
        <p class="mystery-subtitle">You hit a milestone. Open the box to claim what's inside.</p>
        <div class="mystery-actions">
          <button class="btn btn-ghost" data-modal-close>Save for later</button>
          <button class="btn btn-primary" id="mystery-open-btn">
            <i class="fa-solid fa-key"></i> Open the box
          </button>
        </div>
      </div>
    `);

    document.getElementById('mystery-open-btn').addEventListener('click', () => openBox(box));

    // Reset openInProgress when modal closes via Save for later
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      const observer = new MutationObserver(() => {
        if (!backdrop.classList.contains('open')) {
          openInProgress = false;
          observer.disconnect();
        }
      });
      observer.observe(backdrop, { attributes: true, attributeFilter: ['class'] });
    }
  }

  async function openBox(box) {
    const btn = document.getElementById('mystery-open-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const data = await api.post(`/mystery/${box.id}/open`);
      const r = data.reward || data;
      revealReward(r);
    } catch (err) {
      ui.toast(err.message || 'Could not open the box.', 'error');
      ui.closeModal();
      openInProgress = false;
    }
  }

  function revealReward(reward) {
    const chest = document.getElementById('mystery-chest');
    if (chest) chest.classList.add('opened');
    let bodyHtml = '';
    if (reward.kind === 'coins') {
      bodyHtml = `
        <div class="mystery-reward">
          <i class="fa-solid fa-coins"></i>
          <strong>+${reward.value.coins}</strong>
          <p>coins added to your balance!</p>
        </div>`;
    } else if (reward.kind === 'theme') {
      const palette = reward.value.meta_data?.palette || '';
      bodyHtml = `
        <div class="mystery-reward">
          <i class="fa-solid fa-palette"></i>
          <strong>${ui.escapeHtml(reward.value.name)}</strong>
          <p>You unlocked a theme — equip it in Settings!</p>
        </div>`;
    } else if (reward.kind === 'frame') {
      bodyHtml = `
        <div class="mystery-reward">
          <i class="fa-solid fa-circle-nodes"></i>
          <strong>${ui.escapeHtml(reward.value.name)}</strong>
          <p>You unlocked an avatar frame — equip it on your profile!</p>
        </div>`;
    } else {
      bodyHtml = `<div class="mystery-reward"><p>Reward claimed!</p></div>`;
    }

    const modal = document.querySelector('[data-mystery-modal]');
    if (modal) {
      modal.innerHTML = `
        <div class="mystery-chest opened" id="mystery-chest"><i class="fa-solid fa-gift"></i></div>
        <h2 class="mystery-title">🎉 You got it!</h2>
        ${bodyHtml}
        <div class="mystery-actions">
          <button class="btn btn-primary btn-block" id="mystery-done-btn">Awesome</button>
        </div>
      `;
      document.getElementById('mystery-done-btn').addEventListener('click', async () => {
        ui.closeModal();
        openInProgress = false;
        // There might be more pending boxes; if so, queue the next one.
        await refresh();
      });
    }

    if (window.sound) sound.play('purchase'); // light celebratory chime
  }

  global.mystery = { refresh };
})(window);
