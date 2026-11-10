/* Login screen behaviour */
(function () {
  'use strict';

  var ROLE_UI = {
    student: {
      label: 'Student',
      user: 'Admission Number', userPh: 'e.g. 123', userMode: 'text',
      pass: 'Date of Birth', passPh: 'DD-MM-YYYY',
      hint: 'Your date of birth is your password (e.g. 05-08-2015).',
    },
    teacher: {
      label: 'Teacher', user: 'Username', userPh: 'Enter your username',
      pass: 'Password', passPh: 'Enter your password',
      hint: 'Forgot your password? Please contact the school office.',
    },
    classteacher: {
      label: 'Class Teacher', user: 'Class Teacher Username', userPh: 'Enter your username',
      pass: 'Password', passPh: 'Enter your password',
      hint: 'Forgot your password? Please contact the school office.',
    },
    principal: {
      label: 'Principal', user: 'Username', userPh: 'Enter your username',
      pass: 'Password', passPh: 'Enter your password',
      hint: 'Forgot your password? Please contact the administrator.',
    },
    administrative: {
      label: 'Administrative', user: 'Username', userPh: 'Enter your username',
      pass: 'Password', passPh: 'Enter your password',
      hint: 'Forgot your password? Please contact the administrator.',
    },
  };

  var $ = function (id) { return document.getElementById(id); };
  var form = $('login-form');
  var card = document.querySelector('.login-card');
  var user = $('username');
  var pass = $('password');
  var btn = $('login-btn');
  var btnText = $('login-btn-text');
  var errBox = $('form-error');
  var errText = $('form-error-text');
  var toggle = $('toggle-password');
  var currentRole = 'student';
  var busy = false;

  $('year').textContent = String(new Date().getFullYear());

  function showError(msg) {
    errText.textContent = msg;
    errBox.hidden = false;
    card.classList.remove('shake');
    void card.offsetWidth; // restart animation
    card.classList.add('shake');
  }
  function clearError() { errBox.hidden = true; errText.textContent = ''; }

  function applyRole(role) {
    var ui = ROLE_UI[role];
    if (!ui) return;
    var changed = role !== currentRole;
    currentRole = role;
    $('username-label').textContent = ui.user;
    $('password-label').textContent = ui.pass;
    $('password-hint').textContent = ui.hint;
    user.placeholder = ui.userPh;
    pass.placeholder = ui.passPh;
    pass.inputMode = role === 'student' ? 'numeric' : 'text';
    pass.maxLength = role === 'student' ? 10 : 128;
    btnText.textContent = 'Login as ' + ui.label;
    if (changed) { pass.value = ''; clearError(); }
  }

  // Auto-format DOB as DD-MM-YYYY while a student types
  pass.addEventListener('input', function () {
    if (currentRole !== 'student') return;
    var d = pass.value.replace(/\D/g, '').slice(0, 8);
    var out = d.slice(0, 2);
    if (d.length > 2) out += '-' + d.slice(2, 4);
    if (d.length > 4) out += '-' + d.slice(4, 8);
    pass.value = out;
  });

  form.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'role') applyRole(e.target.value);
  });
  [user, pass].forEach(function (el) { el.addEventListener('input', clearError); });

  toggle.addEventListener('click', function () {
    var show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    pass.focus();
  });

  function setBusy(on) {
    busy = on;
    btn.classList.toggle('is-loading', on);
    btn.setAttribute('aria-busy', String(on));
    btnText.textContent = on ? 'Signing in…' : 'Login as ' + ROLE_UI[currentRole].label;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    clearError();

    var u = user.value.trim();
    var p = pass.value;
    if (!u) { showError('Please enter your ' + ROLE_UI[currentRole].user.toLowerCase() + '.'); user.focus(); return; }
    if (!p) { showError('Please enter your ' + ROLE_UI[currentRole].pass.toLowerCase() + '.'); pass.focus(); return; }
    if (currentRole === 'student' && !/^\d{2}-\d{2}-\d{4}$/.test(p)) {
      showError('Enter your date of birth as DD-MM-YYYY.'); pass.focus(); return;
    }

    setBusy(true);
    fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: currentRole, username: u, password: p }),
    })
      .then(function (res) {
        return res.json().catch(function () { return { ok: false }; }).then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (r) {
        var dest = r.data && r.data.redirect;
        if (r.data && r.data.ok && typeof dest === 'string' && /^\/[a-z-]+\/$/.test(dest)) {
          btnText.textContent = 'Welcome!';
          window.location.replace(dest);
          return;
        }
        setBusy(false);
        pass.value = '';
        showError((r.data && r.data.error) || 'Login failed. Please try again.');
        pass.focus();
      })
      .catch(function () {
        setBusy(false);
        showError('Cannot reach the server. Check your internet connection.');
      });
  });

  applyRole('student');
})();
