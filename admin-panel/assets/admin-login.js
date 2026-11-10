/* =====================================================================
   Separate Admin Panel Controller (Login + Full A-Z Control Panel)
   ===================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  /* =================================================================
     1. ADMIN LOGIN PAGE
     ================================================================= */
  var loginForm = $('admin-form');
  if (loginForm) {
    var card = document.querySelector('.login-card');
    var user = $('username');
    var pass = $('password');
    var btn = $('login-btn');
    var errBox = $('form-error');
    var toggle = $('toggle-password');
    var busy = false;

    function showError(msg) {
      $('form-error-text').textContent = msg;
      errBox.hidden = false;
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
    [user, pass].forEach(function (inp) {
      inp.addEventListener('input', function () { errBox.hidden = true; });
    });

    toggle.addEventListener('click', function () {
      var show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      if (!user.value.trim() || !pass.value) {
        showError('Please enter username and password.');
        return;
      }
      busy = true;
      btn.classList.add('is-loading');
      fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.value.trim(), password: pass.value }),
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (d.ok && d.redirect === '/panel/') {
            window.location.replace('/panel/');
            return;
          }
          busy = false;
          btn.classList.remove('is-loading');
          pass.value = '';
          showError(d.error || 'Login failed.');
        })
        .catch(function () {
          busy = false;
          btn.classList.remove('is-loading');
          showError('Cannot reach the server.');
        });
    });
    return;
  }

  /* =================================================================
     2. ADMIN CONTROL PANEL (/panel/)
     ================================================================= */
  var CLASSES = [
    'KG 1', 'KG 2',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6',
    'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12',
  ];

  function api(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var hasBody = opts.body !== undefined || method === 'POST' || method === 'PUT';
    return fetch(path, {
      method: method,
      credentials: 'same-origin',
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      body: hasBody ? JSON.stringify(opts.body || {}) : undefined,
    }).then(function (r) {
      if (r.status === 401 && path !== '/api/logout') {
        window.location.replace('/');
        throw new Error('Unauthorised');
      }
      return r.json().then(function (d) {
        d._status = r.status;
        return d;
      });
    });
  }

  // Red signal pop-up for duplicate Admission Number or duplicate Teacher Reg No
  var redModal = $('red-signal-modal');
  var redMsg = $('red-signal-msg');
  function showRedSignal(message) {
    redMsg.textContent = message;
    redModal.hidden = false;
  }
  $('red-signal-close').addEventListener('click', function () {
    redModal.hidden = true;
  });

  var mainEl = $('admin-main');
  var subview = $('admin-subview');
  var subTitle = $('admin-subview-title');
  var subContent = $('admin-subview-content');
  var drawer = $('admin-drawer');
  var backdrop = $('admin-drawer-backdrop');

  function toggleDrawer(on) {
    drawer.classList.toggle('is-open', on);
    backdrop.classList.toggle('is-open', on);
  }
  $('admin-menu-open').addEventListener('click', function () { toggleDrawer(true); });
  $('admin-drawer-close').addEventListener('click', function () { toggleDrawer(false); });
  backdrop.addEventListener('click', function () { toggleDrawer(false); });

  function showView(title, builder) {
    toggleDrawer(false);
    mainEl.style.display = 'none';
    subview.classList.add('is-active');
    subTitle.textContent = title;
    subContent.textContent = '';
    builder(subContent);
  }

  function closeView() {
    subview.classList.remove('is-active');
    subContent.textContent = '';
    mainEl.style.display = '';
    refreshNoticeBadge();
  }
  $('admin-subview-back').addEventListener('click', closeView);

  function makeField(labelText, name, opts) {
    opts = opts || {};
    var wrap = el('div', '');
    var lbl = el('label', '', labelText);
    var input;
    if (opts.options) {
      input = document.createElement('select');
      opts.options.forEach(function (v) {
        var o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = opts.type || 'text';
      if (opts.placeholder) input.placeholder = opts.placeholder;
    }
    input.name = name;
    if (opts.required !== false) input.required = true;
    if (opts.value !== undefined) input.value = opts.value;
    lbl.appendChild(input);
    wrap.appendChild(lbl);
    return { wrap: wrap, input: input };
  }

  /* ---------- 1. Add Teacher & 2. Add Class Teacher ---------- */
  function openAddTeacherForm(roleType) {
    var isCT = roleType === 'Class Teacher';
    showView(isCT ? 'Add Class-Teacher' : 'Add Teacher', function (box) {
      var form = el('form', 'app-form');
      form.appendChild(
        el(
          'h4',
          '',
          isCT
            ? 'Register New Class Teacher (Updates Teachers Excel Database Live)'
            : 'Register New Teacher (Updates Teachers Excel Database Live)',
        ),
      );

      var grid = el('div', 'form-grid-2');
      var fName = makeField('Name', 'Name', { placeholder: 'Full Name' });
      var fDob = makeField('D.O.B', 'Date of Birth', { placeholder: 'DD-MM-YYYY' });
      var fEmail = makeField('Email', 'Email', { type: 'email', placeholder: 'teacher@ebenezerschool.in' });
      var fGender = makeField('Gender', 'Gender', { options: ['Male', 'Female', 'Other'] });
      var fAddr = makeField('Residential Address', 'Residential Address', { placeholder: 'Full Residential Address' });
      var fBlood = makeField('Blood Group', 'Blood Group', { options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] });
      var fPhone = makeField('Phone no.', 'Phone No', { placeholder: '10-digit mobile number' });
      var fDoj = makeField('Date of Joining', 'Date of Joining', { placeholder: 'DD-MM-YYYY' });
      var fQual = makeField('Educational Qualifications', 'Educational Qualification', { placeholder: 'e.g. M.Sc, B.Ed' });
      var fSubj = makeField('Subject or Department', 'Subject / Department', { placeholder: 'e.g. Mathematics' });
      var fClassOf = isCT
        ? makeField('Class teacher of', 'Class Teacher Of', {
            options: CLASSES.map(function (c) { return c + ' - A'; }),
          })
        : null;
      var fRegNo = makeField('Register no. for chat-room (Unique Code)', 'Reg No', {
        placeholder: 'e.g. 5',
      });
      var fPin = makeField('PIN Code', 'PIN Code', { placeholder: 'e.g. 799145' });
      var fUser = makeField('Login Username', 'Username', {
        placeholder: isCT ? 'e.g. ct.sharma' : 'e.g. t.sharma',
      });
      var fPass = makeField('Login Password', 'Password', {
        placeholder: 'Set login password',
      });

      [fName, fDob, fEmail, fGender, fAddr, fBlood, fPhone, fDoj, fQual, fSubj]
        .concat(fClassOf ? [fClassOf] : [])
        .concat([fRegNo, fPin, fUser, fPass])
        .forEach(function (f) { grid.appendChild(f.wrap); });

      form.appendChild(grid);

      var btn = el('button', 'btn-primary', isCT ? 'Register as Class Teacher' : 'Register New Teacher');
      btn.type = 'submit';
      form.appendChild(btn);

      var feedback = el('div', '');
      form.appendChild(feedback);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        feedback.textContent = '';
        var payload = {
          roleType: roleType,
          Name: fName.input.value.trim(),
          'Date of Birth': fDob.input.value.trim(),
          Email: fEmail.input.value.trim(),
          Gender: fGender.input.value,
          'Residential Address': fAddr.input.value.trim(),
          'Blood Group': fBlood.input.value,
          'Phone No': fPhone.input.value.trim(),
          'Date of Joining': fDoj.input.value.trim(),
          'Educational Qualification': fQual.input.value.trim(),
          'Subject / Department': fSubj.input.value.trim(),
          'Class Teacher Of': fClassOf ? fClassOf.input.value : '',
          'Reg No': fRegNo.input.value.trim(),
          'PIN Code': fPin.input.value.trim(),
          Username: fUser.input.value.trim(),
          Password: fPass.input.value,
        };
        api('/api/admin/teachers', { method: 'POST', body: payload }).then(function (res) {
          if (!res.ok) {
            showRedSignal(res.error || 'Could not register teacher.');
            return;
          }
          form.reset();
          var banner = el(
            'div',
            'success-banner',
            '✔ Registered ' +
              res.teacher.Name +
              ' (' +
              roleType +
              ') in Excel! Chat-Room Reg No: ' +
              res.credentials.regNo +
              ' · Login Username: ' +
              res.credentials.username,
          );
          feedback.appendChild(banner);
        });
      });

      box.appendChild(form);
    });
  }

  /* ---------- 3. Add Student (Choose Class KG 1 .. Class 12 -> Edit Excel OR Replace Whole Class Excel) ---------- */
  function openAddStudentView() {
    showView('Add Student (KG 1 to Class 12)', function (box) {
      var selectedClass = 'Class 5';
      var mode = 'single'; // 'single' | 'replace'

      box.appendChild(el('label', '', 'Step 1: Choose Classroom (Each class has its own separate Excel file):'));
      var classBar = el('div', 'class-pills');
      box.appendChild(classBar);

      var modeBar = el('div', 'mode-pills');
      var btnSingle = el('button', 'mode-pill is-active', 'Option 1: Edit / Add Student to Class Excel');
      btnSingle.type = 'button';
      var btnReplace = el('button', 'mode-pill', 'Option 2: Replace Whole Class Excel List / Data');
      btnReplace.type = 'button';
      modeBar.appendChild(btnSingle);
      modeBar.appendChild(btnReplace);
      box.appendChild(modeBar);

      var workArea = el('div', '');
      box.appendChild(workArea);

      function renderClassPills() {
        classBar.textContent = '';
        CLASSES.forEach(function (cls) {
          var p = el('button', 'class-pill' + (cls === selectedClass ? ' is-active' : ''), cls);
          p.type = 'button';
          p.addEventListener('click', function () {
            selectedClass = cls;
            renderClassPills();
            renderModeContent();
          });
          classBar.appendChild(p);
        });
      }

      btnSingle.addEventListener('click', function () {
        mode = 'single';
        btnSingle.classList.add('is-active');
        btnReplace.classList.remove('is-active');
        renderModeContent();
      });
      btnReplace.addEventListener('click', function () {
        mode = 'replace';
        btnReplace.classList.add('is-active');
        btnSingle.classList.remove('is-active');
        renderModeContent();
      });

      function renderModeContent() {
        workArea.textContent = '';
        if (mode === 'single') {
          var form = el('form', 'app-form');
          form.appendChild(
            el('h4', '', 'Add Student to ' + selectedClass + '.xlsx (Duplicate Admission Numbers Trigger Red Alert)'),
          );
          var grid = el('div', 'form-grid-2');

          var fName = makeField('Name', 'Name', { placeholder: 'Student Full Name' });
          var fClass = makeField('Class', 'Class', { options: CLASSES, value: selectedClass });
          fClass.input.value = selectedClass;
          var fSec = makeField('Section', 'Section', { placeholder: 'e.g. A', value: 'A' });
          var fRoll = makeField('Roll no.', 'Roll No', { placeholder: 'e.g. 12' });
          var fBlood = makeField('Blood group', 'Blood Group', { options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] });
          var fHouse = makeField('House Group', 'House Group', { options: ['Faith', 'Hope', 'Grace', 'Love'] });
          var fGender = makeField('Gender', 'Gender', { options: ['Male', 'Female', 'Other'] });
          var fAddr = makeField('Residential Address', 'Residential Address', { placeholder: 'Full Address' });
          var fContact = makeField('Contact Number', 'Contact Number', { placeholder: '10-digit phone number' });
          var fMother = makeField("Mother's Name", "Mother's Name", { placeholder: "Mother's Full Name" });
          var fFather = makeField("Father's Name", "Father's Name", { placeholder: "Father's Full Name" });
          var fAdm = makeField('Admission number (Unique Login & Chat ID)', 'Admission No', {
            placeholder: 'e.g. 123 (must be unique)',
          });
          var fDob = makeField('Date of Birth (Student Login Password)', 'Date of Birth', {
            placeholder: 'DD-MM-YYYY',
          });
          var fTrans = makeField('Transport Mode', 'Transport Mode', {
            options: ['School Bus', 'Parent Drop', 'Bicycle', 'Hostel', 'Two Wheeler', 'Walk'],
          });
          var fScholar = makeField('Hosteler or Day Scholar (Optional)', 'Hosteler / Day Scholar', {
            options: ['Day Scholar', 'Hosteler'],
            required: false,
          });
          var fPin = makeField('PIN Code', 'PIN Code', { placeholder: 'e.g. 799145' });

          [
            fName, fClass, fSec, fRoll, fBlood, fHouse, fGender, fAddr,
            fContact, fMother, fFather, fAdm, fDob, fTrans, fScholar, fPin,
          ].forEach(function (f) { grid.appendChild(f.wrap); });

          form.appendChild(grid);
          var submit = el('button', 'btn-primary', 'Save Student to ' + selectedClass + ' Excel');
          submit.type = 'submit';
          form.appendChild(submit);
          var msg = el('div', '');
          form.appendChild(msg);

          form.addEventListener('submit', function (e) {
            e.preventDefault();
            msg.textContent = '';
            api('/api/admin/students', {
              method: 'POST',
              body: {
                Name: fName.input.value.trim(),
                Class: fClass.input.value,
                Section: fSec.input.value.trim(),
                'Roll No': fRoll.input.value.trim(),
                'Blood Group': fBlood.input.value,
                'House Group': fHouse.input.value,
                Gender: fGender.input.value,
                'Residential Address': fAddr.input.value.trim(),
                'Contact Number': fContact.input.value.trim(),
                "Mother's Name": fMother.input.value.trim(),
                "Father's Name": fFather.input.value.trim(),
                'Admission No': fAdm.input.value.trim(),
                'Date of Birth': fDob.input.value.trim(),
                'Transport Mode': fTrans.input.value,
                'Hosteler / Day Scholar': fScholar.input.value,
                'PIN Code': fPin.input.value.trim(),
              },
            }).then(function (res) {
              if (!res.ok) {
                showRedSignal(res.error || 'The Admission number is already existing in data!');
                return;
              }
              form.reset();
              fClass.input.value = selectedClass;
              msg.appendChild(
                el(
                  'div',
                  'success-banner',
                  '✔ Added ' +
                    res.student.Name +
                    ' (Admission No: ' +
                    res.student['Admission No'] +
                    ') to ' +
                    res.student.Class +
                    '.xlsx!',
                ),
              );
            });
          });
          workArea.appendChild(form);
        } else {
          // Option 2: Replace or change the whole class Excel list
          var rForm = el('form', 'app-form');
          rForm.appendChild(
            el('h4', '', 'Replace Whole Excel Data for ' + selectedClass + ' (' + selectedClass + '.xlsx)'),
          );
          rForm.appendChild(
            el(
              'p',
              '',
              'Edit the JSON rows below to replace the entire ' +
                selectedClass +
                ' Excel sheet in one click. Every Admission Number is checked against all other classes.',
            ),
          );
          var ta = document.createElement('textarea');
          ta.style.minHeight = '220px';
          ta.style.fontFamily = 'monospace';
          ta.value = 'Loading current ' + selectedClass + ' Excel rows…';
          rForm.appendChild(ta);

          var rBtn = el('button', 'btn-primary', 'Replace Whole ' + selectedClass + ' Excel List');
          rBtn.type = 'submit';
          rForm.appendChild(rBtn);
          var rMsg = el('div', '');
          rForm.appendChild(rMsg);

          api('/api/admin/students?class=' + encodeURIComponent(selectedClass)).then(function (res) {
            ta.value = JSON.stringify(res.students || [], null, 2);
          });

          rForm.addEventListener('submit', function (e) {
            e.preventDefault();
            rMsg.textContent = '';
            var parsed;
            try {
              parsed = JSON.parse(ta.value);
            } catch (err) {
              showRedSignal('Invalid JSON format: ' + err.message);
              return;
            }
            api('/api/admin/students/replace-class', {
              method: 'POST',
              body: { className: selectedClass, students: parsed },
            }).then(function (res) {
              if (!res.ok) {
                showRedSignal(res.error || 'Duplicate Admission Number detected!');
                return;
              }
              rMsg.appendChild(
                el(
                  'div',
                  'success-banner',
                  '✔ Replaced ' + selectedClass + '.xlsx with ' + res.count + ' student records!',
                ),
              );
            });
          });
          workArea.appendChild(rForm);
        }
      }

      renderClassPills();
      renderModeContent();
    });
  }

  /* ---------- 4. Student Data (Category-wise by Class, live edit & permanent delete) ---------- */
  function openStudentDataView() {
    showView('Student Data (Category-Wise Live Excel Editor)', function (box) {
      var filterClass = 'ALL';
      var pills = el('div', 'class-pills');
      var listWrap = el('div', '');
      box.appendChild(pills);
      box.appendChild(listWrap);

      function renderPills() {
        pills.textContent = '';
        ['ALL'].concat(CLASSES).forEach(function (c) {
          var b = el('button', 'class-pill' + (filterClass === c ? ' is-active' : ''), c === 'ALL' ? 'All Classes' : c);
          b.type = 'button';
          b.addEventListener('click', function () {
            filterClass = c;
            renderPills();
            loadStudents();
          });
          pills.appendChild(b);
        });
      }

      function loadStudents() {
        listWrap.textContent = 'Loading student Excel records…';
        var url =
          filterClass === 'ALL'
            ? '/api/admin/students'
            : '/api/admin/students?class=' + encodeURIComponent(filterClass);
        api(url).then(function (res) {
          listWrap.textContent = '';
          var students = res.students || [];
          if (!students.length) {
            listWrap.appendChild(el('p', '', 'No students in this class category yet.'));
            return;
          }
          students.forEach(function (s) {
            var card = el('div', 'record-card');
            var head = el('div', 'record-head');
            head.appendChild(
              el(
                'strong',
                '',
                s.Name + ' · Admission No: ' + s['Admission No'] + ' (' + s.Class + ' - ' + (s.Section || 'A') + ')',
              ),
            );
            var actions = el('div', 'record-actions');
            var editBtn = el('button', 'btn-secondary', 'Edit Details');
            editBtn.type = 'button';
            var delBtn = el('button', 'btn-danger-sm', 'Delete Permanently');
            delBtn.type = 'button';
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            head.appendChild(actions);
            card.appendChild(head);

            var meta = el('div', 'record-meta');
            Object.keys(s).forEach(function (k) {
              meta.appendChild(el('div', '', k + ': ' + s[k]));
            });
            card.appendChild(meta);

            var editWrap = el('div', '');
            card.appendChild(editWrap);

            editBtn.addEventListener('click', function () {
              if (editWrap.firstChild) {
                editWrap.textContent = '';
                return;
              }
              var ef = el('form', 'app-form');
              ef.style.marginTop = '10px';
              var g = el('div', 'form-grid-2');
              var eName = makeField('Name', 'Name', { value: s.Name });
              var eAdm = makeField('Admission No', 'Admission No', { value: s['Admission No'] });
              var eClass = makeField('Class', 'Class', { options: CLASSES, value: s.Class });
              eClass.input.value = s.Class;
              var eSec = makeField('Section', 'Section', { value: s.Section || 'A' });
              var eRoll = makeField('Roll No', 'Roll No', { value: s['Roll No'] || '' });
              var eDob = makeField('Date of Birth (Login Password)', 'Date of Birth', { value: s['Date of Birth'] || '' });
              var eContact = makeField('Contact Number', 'Contact Number', { value: s['Contact Number'] || '' });
              var eAddr = makeField('Residential Address', 'Residential Address', { value: s['Residential Address'] || '' });
              [eName, eAdm, eClass, eSec, eRoll, eDob, eContact, eAddr].forEach(function (x) { g.appendChild(x.wrap); });
              ef.appendChild(g);
              var saveB = el('button', 'btn-primary', 'Update Student Live in Excel');
              saveB.type = 'submit';
              ef.appendChild(saveB);

              ef.addEventListener('submit', function (ev) {
                ev.preventDefault();
                api('/api/admin/students/' + encodeURIComponent(s['Admission No']), {
                  method: 'PUT',
                  body: {
                    Name: eName.input.value.trim(),
                    'Admission No': eAdm.input.value.trim(),
                    Class: eClass.input.value,
                    Section: eSec.input.value.trim(),
                    'Roll No': eRoll.input.value.trim(),
                    'Date of Birth': eDob.input.value.trim(),
                    'Contact Number': eContact.input.value.trim(),
                    'Residential Address': eAddr.input.value.trim(),
                  },
                }).then(function (r) {
                  if (!r.ok) {
                    showRedSignal(r.error || 'Could not update student.');
                    return;
                  }
                  loadStudents();
                });
              });
              editWrap.appendChild(ef);
            });

            delBtn.addEventListener('click', function () {
              api('/api/admin/students/' + encodeURIComponent(s['Admission No']), { method: 'DELETE' }).then(loadStudents);
            });

            listWrap.appendChild(card);
          });
        });
      }

      renderPills();
      loadStudents();
    });
  }

  /* ---------- 5. Teachers Data (Edit, Delete, Cascading Chat-Room Reg No Update) ---------- */
  function openTeachersDataView() {
    showView('Teachers Data (Teachers & Class Teachers Live Excel Editor)', function (box) {
      var dlBar = el('div', '');
      dlBar.style.display = 'flex';
      dlBar.style.gap = '8px';
      dlBar.style.marginBottom = '12px';
      var dlT = el('a', 'btn-secondary', '⬇ Download teachers.xlsx');
      dlT.href = '/api/admin/export/teachers';
      dlT.style.display = 'inline-flex';
      dlT.style.alignItems = 'center';
      var dlS = el('a', 'btn-secondary', '⬇ Download staff.xlsx (Principal & Admin)');
      dlS.href = '/api/admin/export/staff';
      dlS.style.display = 'inline-flex';
      dlS.style.alignItems = 'center';
      var dlBundle = el('a', 'btn-primary', '📦 Export Full App + Database Publish Bundle (.tar.gz)');
      dlBundle.href = '/api/admin/export/publish-bundle';
      dlBundle.style.display = 'inline-flex';
      dlBundle.style.alignItems = 'center';
      dlBar.style.flexWrap = 'wrap';
      dlBar.appendChild(dlT);
      dlBar.appendChild(dlS);
      dlBar.appendChild(dlBundle);
      box.appendChild(dlBar);

      var listWrap = el('div', '');
      box.appendChild(listWrap);

      function loadTeachers() {
        listWrap.textContent = 'Loading teachers.xlsx…';
        api('/api/admin/teachers').then(function (res) {
          listWrap.textContent = '';
          (res.teachers || []).forEach(function (t) {
            var card = el('div', 'record-card');
            var head = el('div', 'record-head');
            head.appendChild(
              el(
                'strong',
                '',
                t.Name +
                  ' (' +
                  t.Role +
                  ') · Chat-Room Reg No: ' +
                  t['Reg No'] +
                  (t['Class Teacher Of'] ? ' · ' + t['Class Teacher Of'] : ''),
              ),
            );
            var actions = el('div', 'record-actions');
            var editBtn = el('button', 'btn-secondary', 'Edit / Change Reg No');
            editBtn.type = 'button';
            var delBtn = el('button', 'btn-danger-sm', 'Remove Permanently');
            delBtn.type = 'button';
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            head.appendChild(actions);
            card.appendChild(head);

            var meta = el('div', 'record-meta');
            Object.keys(t).forEach(function (k) {
              if (t[k]) meta.appendChild(el('div', '', k + ': ' + t[k]));
            });
            card.appendChild(meta);

            var editWrap = el('div', '');
            card.appendChild(editWrap);

            editBtn.addEventListener('click', function () {
              if (editWrap.firstChild) {
                editWrap.textContent = '';
                return;
              }
              var ef = el('form', 'app-form');
              ef.style.marginTop = '10px';
              var g = el('div', 'form-grid-2');
              var eName = makeField('Name', 'Name', { value: t.Name });
              var eReg = makeField('Chat-Room Registration No. (Cascades Everywhere)', 'Reg No', {
                value: t['Reg No'],
              });
              var eRole = makeField('Role', 'Role', { options: ['Teacher', 'Class Teacher'], value: t.Role });
              eRole.input.value = t.Role;
              var eClassOf = makeField('Class Teacher Of', 'Class Teacher Of', {
                value: t['Class Teacher Of'] || '',
                required: false,
              });
              var eSubj = makeField('Subject / Department', 'Subject / Department', {
                value: t['Subject / Department'] || '',
              });
              var ePhone = makeField('Phone No', 'Phone No', { value: t['Phone No'] || '' });
              var eEmail = makeField('Email', 'Email', { value: t.Email || '' });
              var ePass = makeField('New Password (leave blank to keep current)', 'Password', {
                value: '',
                required: false,
              });
              [eName, eReg, eRole, eClassOf, eSubj, ePhone, eEmail, ePass].forEach(function (x) {
                g.appendChild(x.wrap);
              });
              ef.appendChild(g);
              var saveB = el('button', 'btn-primary', 'Update Teacher & Cascade Chat Code');
              saveB.type = 'submit';
              ef.appendChild(saveB);

              ef.addEventListener('submit', function (ev) {
                ev.preventDefault();
                api('/api/admin/teachers/' + encodeURIComponent(t['Reg No']), {
                  method: 'PUT',
                  body: {
                    Name: eName.input.value.trim(),
                    'Reg No': eReg.input.value.trim(),
                    Role: eRole.input.value,
                    'Class Teacher Of': eClassOf.input.value.trim(),
                    'Subject / Department': eSubj.input.value.trim(),
                    'Phone No': ePhone.input.value.trim(),
                    Email: eEmail.input.value.trim(),
                    Password: ePass.input.value,
                  },
                }).then(function (r) {
                  if (!r.ok) {
                    showRedSignal(r.error || 'Could not update teacher.');
                    return;
                  }
                  loadTeachers();
                });
              });
              editWrap.appendChild(ef);
            });

            delBtn.addEventListener('click', function () {
              api('/api/admin/teachers/' + encodeURIComponent(t['Reg No']), { method: 'DELETE' }).then(loadTeachers);
            });

            listWrap.appendChild(card);
          });
        });
      }

      loadTeachers();
    });
  }

  /* ---------- Notices & Publish Notices ---------- */
  function openAdminNotices(showFormFirst) {
    showView(showFormFirst ? 'Publish Notices' : 'Notices & Announcements', function (box) {
      var form = el('form', 'app-form');
      form.appendChild(el('h4', '', 'Publish Official School Notice (Triggers Red Badge on All Dashboards)'));
      var fTitle = makeField('Notice Title', 'title', { placeholder: 'Announcement Headline' });
      var fPrio = makeField('Priority', 'priority', { options: ['normal', 'important'] });
      var lblBody = el('label', '', 'Notice Message');
      var ta = document.createElement('textarea');
      ta.required = true;
      ta.placeholder = 'Write full announcement…';
      lblBody.appendChild(ta);

      form.appendChild(fTitle.wrap);
      form.appendChild(fPrio.wrap);
      form.appendChild(lblBody);
      var pBtn = el('button', 'btn-primary', 'Broadcast Notice Now');
      pBtn.type = 'submit';
      form.appendChild(pBtn);
      box.appendChild(form);

      var listWrap = el('div', 'notice-list');
      box.appendChild(listWrap);

      function loadList() {
        api('/api/notices').then(function (res) {
          listWrap.textContent = '';
          refreshNoticeBadge();
          (res.notices || []).forEach(function (n) {
            var item = el('article', 'notice-item' + (n.priority === 'important' ? ' important' : ''));
            var head = el('div', 'notice-head');
            head.appendChild(el('h4', '', n.title));
            var del = el('button', 'btn-danger-sm', 'Delete');
            del.type = 'button';
            del.addEventListener('click', function () {
              api('/api/notices/' + encodeURIComponent(n.id), { method: 'DELETE' }).then(loadList);
            });
            head.appendChild(del);
            item.appendChild(head);
            item.appendChild(el('p', 'notice-body', n.body));
            listWrap.appendChild(item);
          });
        });
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        api('/api/notices', {
          method: 'POST',
          body: { title: fTitle.input.value.trim(), priority: fPrio.input.value, body: ta.value.trim() },
        }).then(function () {
          form.reset();
          loadList();
        });
      });

      loadList();
    });
  }

  function refreshNoticeBadge() {
    var badge = $('admin-notice-badge');
    if (!badge) return;
    api('/api/notices/unread')
      .then(function (r) {
        badge.textContent = String(r.unread || 0);
        badge.hidden = !(r.unread > 0);
      })
      .catch(function () {});
  }

  /* ---------- Wire 9 Admin Tiles & Menu ---------- */
  $('admin-grid').addEventListener('click', function (e) {
    var tile = e.target.closest('[data-action]');
    if (!tile) return;
    var act = tile.getAttribute('data-action');
    if (act === 'publish-notices') return openAdminNotices(true);
    if (act === 'notices') return openAdminNotices(false);
    if (act === 'chat') {
      return showView('School Group — Admin ("Unknown") Full Inspection & Chat', function (box) {
        window.EHSChat.mount(box);
      });
    }
    if (act === 'calendar') {
      return showView('Calender', function (box) {
        var c = el('div', 'status-card');
        var img = document.createElement('img');
        img.src = '/media/icons/calendar.svg';
        c.appendChild(img);
        c.appendChild(el('h3', '', 'Not uploaded by Admin yet!'));
        box.appendChild(c);
      });
    }
    if (act === 'add-teacher') return openAddTeacherForm('Teacher');
    if (act === 'add-class-teacher') return openAddTeacherForm('Class Teacher');
    if (act === 'add-student') return openAddStudentView();
    if (act === 'student-data') return openStudentDataView();
    if (act === 'teachers-data') return openTeachersDataView();
  });

  function openAdminProfile() {
    showView('Admin Profile', function (box) {
      var list = el('div', 'profile-list');
      [
        ['Role', 'Super Administrator (Separate Webpage)'],
        ['Chat-Room ID', 'Unknown'],
        ['Database Control', 'Students (KG 1 – Class 12), Teachers, Class Teachers, Notices & School Group'],
      ].forEach(function (pair) {
        var r = el('div', 'profile-row');
        r.appendChild(el('span', '', pair[0]));
        r.appendChild(el('strong', '', pair[1]));
        list.appendChild(r);
      });
      box.appendChild(list);
    });
  }

  $('admin-profile-btn').addEventListener('click', openAdminProfile);
  $('admin-menu-profile').addEventListener('click', openAdminProfile);
  $('admin-menu-setting').addEventListener('click', function () {
    showView('Setting', function (box) {
      var c = el('div', 'status-card');
      var img = document.createElement('img');
      img.src = '/media/icons/coming-soon.svg';
      c.appendChild(img);
      c.appendChild(el('h3', '', 'Coming soon'));
      box.appendChild(c);
    });
  });
  $('admin-menu-privacy').addEventListener('click', function () {
    window.location.href = '/legal/privacy';
  });
  $('admin-menu-terms').addEventListener('click', function () {
    window.location.href = '/legal/terms';
  });
  function performAdminLogout(e) {
    if (e) e.preventDefault();
    api('/api/logout', { method: 'POST', body: {} })
      .catch(function () {})
      .finally(function () {
        window.location.replace('/logout');
      });
  }

  $('admin-logout').addEventListener('click', performAdminLogout);
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#admin-logout, [data-logout]');
    if (btn) performAdminLogout(e);
  });

  api('/api/me')
    .then(function (me) {
      if (me && me.ok) {
        $('admin-name').textContent = me.name + ' · Full A–Z Control';
        $('admin-chat-badge').textContent = 'Chat-Room ID: ' + me.chatId;
      }
      refreshNoticeBadge();
    })
    .catch(function () {});
})();
