/* =========================================================================
   welcome.js — 3-step onboarding for fresh accounts.
   Step 1: feature intro
   Step 2: pick interests
   Step 3: pick recommended habits → create them in one call
   ========================================================================= */
(async function () {
  const stepEl = document.querySelector('[data-step]');
  const dots = document.querySelectorAll('.welcome-progress-dot');

  // Skip the whole flow if the user already onboarded.
  try {
    const s = await api.get('/onboarding/status');
    if (s?.onboarded) {
      location.replace('dashboard.html');
      return;
    }
  } catch {
    // Stale token? auth-guard will already have redirected to login.
  }

  let step = 1;
  let selectedInterests = new Set();
  let interestList = [];
  let recommendations = [];
  let selectedTemplates = new Set();

  function setDot(n) {
    dots.forEach((d, i) => d.classList.toggle('is-active', i + 1 <= n));
  }

  async function loadInterests() {
    try {
      const data = await api.get('/onboarding/interests');
      interestList = data.interests || [];
    } catch (err) {
      ui.toast(err.message || 'Could not load interests.', 'error');
    }
  }

  async function loadRecommendations() {
    const qs = encodeURIComponent([...selectedInterests].join(','));
    try {
      const data = await api.get('/onboarding/recommend?interests=' + qs);
      recommendations = data.templates || [];
      // Pre-check all by default — the user can untick ones they don't want.
      selectedTemplates = new Set(recommendations.map(t => t.id));
    } catch (err) {
      ui.toast(err.message || 'Could not load recommendations.', 'error');
      recommendations = [];
    }
  }

  function render() {
    setDot(step);
    if (step === 1) renderStep1();
    else if (step === 2) renderStep2();
    else if (step === 3) renderStep3();
    else if (step === 4) renderDone();
  }

  function renderStep1() {
    const cached = api.getCachedUser();
    const hello = cached?.username ? `, ${ui.escapeHtml(cached.username)}` : '';
    stepEl.innerHTML = `
      <h1>Welcome${hello} 👋</h1>
      <p>SmartHabbit turns daily habits into a game. Earn XP, level up, climb the leaderboard. Here's the gist:</p>
      <div class="welcome-features">
        <div class="welcome-feature">
          <i class="fa-solid fa-list-check"></i>
          <strong>Log every day</strong>
          <p>Tap once when you do the thing. Every log earns XP + coins.</p>
        </div>
        <div class="welcome-feature">
          <i class="fa-solid fa-fire"></i>
          <strong>Build a streak</strong>
          <p>Hit ALL your daily habits and your streak ticks up. Don't break the chain.</p>
        </div>
        <div class="welcome-feature">
          <i class="fa-solid fa-medal"></i>
          <strong>Unlock badges</strong>
          <p>50 badges to earn. Spend coins in the shop to customize your profile.</p>
        </div>
      </div>
      <div class="welcome-actions">
        <button class="btn btn-primary btn-lg" id="welcome-next">
          Let's pick what matters to you <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    `;
    document.getElementById('welcome-next').addEventListener('click', async () => {
      step = 2;
      await loadInterests();
      render();
    });
  }

  function renderStep2() {
    stepEl.innerHTML = `
      <h1>Pick what interests you</h1>
      <p>We'll suggest habits based on what you select. Pick at least one — you can mix and match.</p>
      <div class="welcome-grid" data-interests-grid></div>
      <div class="welcome-actions">
        <button class="btn btn-ghost" id="welcome-back">Back</button>
        <button class="btn btn-primary" id="welcome-next" disabled>
          See my recommendations <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    `;
    const grid = stepEl.querySelector('[data-interests-grid]');
    grid.innerHTML = interestList.map(i => `
      <button class="welcome-pick ${selectedInterests.has(i.id) ? 'is-selected' : ''}" data-int="${i.id}">
        <i class="fa-solid ${i.icon}"></i>
        <strong>${ui.escapeHtml(i.label)}</strong>
      </button>
    `).join('');
    grid.querySelectorAll('[data-int]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.int;
        if (selectedInterests.has(id)) selectedInterests.delete(id);
        else selectedInterests.add(id);
        b.classList.toggle('is-selected');
        document.getElementById('welcome-next').disabled = selectedInterests.size === 0;
      });
    });
    document.getElementById('welcome-back').addEventListener('click', () => { step = 1; render(); });
    document.getElementById('welcome-next').addEventListener('click', async () => {
      step = 3;
      await loadRecommendations();
      render();
    });
  }

  function renderStep3() {
    stepEl.innerHTML = `
      <h1>Here's a starter pack</h1>
      <p>Pre-checked habits we recommend based on your picks. Uncheck any you don't want — you can also add more later.</p>
      <div data-recs></div>
      <div class="welcome-actions">
        <button class="btn btn-ghost" id="welcome-back">Back</button>
        <button class="btn btn-primary" id="welcome-create">
          <i class="fa-solid fa-check"></i> Create my habits
        </button>
      </div>
    `;
    const recsEl = stepEl.querySelector('[data-recs]');
    recsEl.innerHTML = recommendations.map(t => `
      <label class="welcome-rec">
        <input type="checkbox" data-tpl="${t.id}" ${selectedTemplates.has(t.id) ? 'checked' : ''}>
        <div>
          <strong>${ui.escapeHtml(t.name)}</strong>
          <small>${ui.escapeHtml(t.description)}</small>
        </div>
        ${ui.difficultyBadge(t.difficulty)}
      </label>
    `).join('');
    recsEl.querySelectorAll('[data-tpl]').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.tpl;
        if (cb.checked) selectedTemplates.add(id);
        else selectedTemplates.delete(id);
      });
    });
    document.getElementById('welcome-back').addEventListener('click', () => { step = 2; render(); });
    document.getElementById('welcome-create').addEventListener('click', complete);
  }

  function renderDone() {
    stepEl.innerHTML = `
      <h1>All set! 🎉</h1>
      <p>Your habits are ready. Off you go.</p>
      <div class="welcome-actions">
        <a class="btn btn-primary btn-lg" href="dashboard.html">
          Open my dashboard <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    `;
  }

  async function complete() {
    const btn = document.getElementById('welcome-create');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await api.post('/onboarding/complete', {
        interests:    [...selectedInterests],
        template_ids: [...selectedTemplates]
      });
      window.sound && sound.play('badge');
      step = 4;
      render();
      setTimeout(() => location.replace('dashboard.html'), 1800);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Create my habits';
      ui.toast(err.message || 'Could not finish setup.', 'error');
    }
  }

  render();
})();
