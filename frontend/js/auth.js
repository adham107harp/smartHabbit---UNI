/* Login / register / forgot / reset form handlers. Exposes `auth` global. */
(function (global) {
  const USERNAME_RE = /^[a-zA-Z0-9_]{3,50}$/;
  const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  function showError(form, field, msg) {
    const el = form.querySelector(`[data-error-for="${field}"]`);
    if (el) el.textContent = msg || '';
  }

  function clearErrors(form) {
    form.querySelectorAll('[data-error-for]').forEach(n => n.textContent = '');
    const ge = form.querySelector('#form-error');
    if (ge) { ge.hidden = true; ge.textContent = ''; }
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    const spinner = btn.querySelector('[data-spinner]');
    const text = btn.querySelector('.btn-text');
    btn.disabled = loading;
    if (spinner) spinner.classList.toggle('hidden', !loading);
    if (text) text.style.opacity = loading ? '0.5' : '1';
  }

  function showFormError(form, msg) {
    const el = form.querySelector('#form-error');
    if (el) { el.hidden = false; el.textContent = msg; }
  }

  function showFormSuccess(form) {
    const el = form.querySelector('#form-success');
    if (el) el.hidden = false;
  }

  function wirePasswordToggle(form) {
    form.querySelectorAll('.password-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        btn.innerHTML = isPw
          ? '<i class="fa-solid fa-eye-slash"></i>'
          : '<i class="fa-solid fa-eye"></i>';
      });
    });
  }

  function wirePasswordMeter(form) {
    const input = form.querySelector('#password');
    const bar = form.querySelector('[data-pw-strength]');
    const label = form.querySelector('[data-pw-label]');
    if (!input || !bar) return;
    input.addEventListener('input', () => {
      const v = input.value;
      let score = 0;
      if (v.length >= 8) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[a-z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      const widths = ['10%', '25%', '50%', '70%', '90%', '100%'];
      const colors = ['#f5576c', '#f5576c', '#ffc300', '#ffc300', '#43e97b', '#43e97b'];
      const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong', 'Excellent'];
      bar.style.width = widths[score];
      bar.style.background = colors[score];
      if (label) label.textContent = v ? labels[score] : 'At least 8 characters with upper, lower, and a number.';
    });
  }

  function validateEmail(form) {
    const v = form.querySelector('#email').value.trim();
    if (!v) { showError(form, 'email', 'Please enter your email.'); return null; }
    if (!EMAIL_RE.test(v)) { showError(form, 'email', 'That doesn\'t look like a valid email.'); return null; }
    return v;
  }

  function validatePassword(form, fieldName = 'password') {
    const v = form.querySelector('#' + fieldName).value;
    if (!v) { showError(form, fieldName, 'Please enter a password.'); return null; }
    if (v.length < 8) { showError(form, fieldName, 'Use at least 8 characters.'); return null; }
    return v;
  }

  function validateStrongPassword(form) {
    const v = form.querySelector('#password').value;
    if (!v) { showError(form, 'password', 'Please choose a password.'); return null; }
    const errs = [];
    if (v.length < 8) errs.push('at least 8 characters');
    if (!/[A-Z]/.test(v)) errs.push('an uppercase letter');
    if (!/[a-z]/.test(v)) errs.push('a lowercase letter');
    if (!/[0-9]/.test(v)) errs.push('a number');
    if (errs.length) {
      showError(form, 'password', 'Password needs ' + errs.join(', ') + '.');
      return null;
    }
    return v;
  }

  function validateUsername(form) {
    const v = form.querySelector('#username').value.trim();
    if (!v) { showError(form, 'username', 'Pick a username.'); return null; }
    if (!USERNAME_RE.test(v)) {
      showError(form, 'username', '3–50 letters, numbers, or underscores. No spaces.');
      return null;
    }
    return v;
  }

  /* ---------- Login ---------- */
  function initLogin() {
    if (api.isAuthed()) {
      location.replace('dashboard.html');
      return;
    }
    const form = document.getElementById('login-form');
    wirePasswordToggle(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      const email = validateEmail(form);
      const password = validatePassword(form);
      if (!email || !password) return;

      const btn = document.getElementById('login-submit');
      setLoading(btn, true);
      try {
        const data = await api.post('/auth/login', { email, password });
        api.setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user
        });
        location.replace('dashboard.html');
      } catch (err) {
        showFormError(form, err.message || 'Could not log you in. Please check your details.');
        setLoading(btn, false);
      }
    });
  }

  /* ---------- Register ---------- */
  function initRegister() {
    if (api.isAuthed()) {
      location.replace('dashboard.html');
      return;
    }
    const form = document.getElementById('register-form');
    wirePasswordToggle(form);
    wirePasswordMeter(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      const username = validateUsername(form);
      const email = validateEmail(form);
      const password = validateStrongPassword(form);
      const terms = form.querySelector('#terms').checked;
      if (!terms) showError(form, 'terms', 'You need to accept to continue.');
      if (!username || !email || !password || !terms) return;

      const btn = document.getElementById('register-submit');
      setLoading(btn, true);
      try {
        const data = await api.post('/auth/register', { username, email, password });
        api.setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user
        });
        location.replace('dashboard.html');
      } catch (err) {
        const msg = err.status === 409
          ? 'That username or email is already taken.'
          : (err.message || 'Could not create your account.');
        showFormError(form, msg);
        setLoading(btn, false);
      }
    });
  }

  /* ---------- Forgot password ---------- */
  function initForgot() {
    const form = document.getElementById('forgot-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      const email = validateEmail(form);
      if (!email) return;
      const btn = document.getElementById('forgot-submit');
      setLoading(btn, true);

      // The backend doesn't expose a forgot-password endpoint yet.
      // Show a success message regardless (don't leak whether an account exists)
      // and gently note this on screen so users aren't confused.
      try {
        await api.post('/auth/forgot-password', { email });
      } catch (err) {
        if (err.status !== 404) {
          // Real server error — show it
          showFormError(form, err.message || 'Something went wrong. Please try again later.');
          setLoading(btn, false);
          return;
        }
      }
      showFormSuccess(form);
      setLoading(btn, false);
    });
  }

  /* ---------- Reset password ---------- */
  function initReset() {
    const form = document.getElementById('reset-form');
    wirePasswordToggle(form);
    wirePasswordMeter(form);
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      const password = validateStrongPassword(form);
      const confirm = form.querySelector('#confirm').value;
      if (password && confirm !== password) {
        showError(form, 'confirm', 'Passwords don\'t match.');
        return;
      }
      if (!password) return;

      const btn = document.getElementById('reset-submit');
      setLoading(btn, true);
      try {
        await api.post('/auth/reset-password', { token, password });
        showFormSuccess(form);
        setTimeout(() => location.replace('login.html'), 1500);
      } catch (err) {
        const msg = err.status === 404
          ? 'Password reset is not enabled yet on this server.'
          : (err.message || 'Could not update your password.');
        showFormError(form, msg);
        setLoading(btn, false);
      }
    });
  }

  global.auth = { initLogin, initRegister, initForgot, initReset };
})(window);
