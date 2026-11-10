/* =====================================================================
   Shared Dashboard Controller for Student, Class Teacher, Teacher,
   Principal & Administrative Dashboards.
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
      if (r.status === 401 && path !== '/api/auth/logout') {
        window.location.replace('/');
        throw new Error('Session expired');
      }
      return r.json();
    });
  }

  var me = null;
  var unreadBadgeEl = null;

  var gridWrap = $('bp-main');
  var gridEl = $('bp-grid');
  var subview = $('subview');
  var subTitle = $('subview-title');
  var subContent = $('subview-content');
  var drawer = $('drawer');
  var backdrop = $('drawer-backdrop');

  function openDrawer(on) {
    drawer.classList.toggle('is-open', on);
    backdrop.classList.toggle('is-open', on);
    drawer.setAttribute('aria-hidden', String(!on));
  }

  function showSubview(title, builder) {
    openDrawer(false);
    gridWrap.style.display = 'none';
    subview.classList.add('is-active');
    subTitle.textContent = title;
    subContent.textContent = '';
    builder(subContent);
  }

  function closeSubview() {
    subview.classList.remove('is-active');
    subContent.textContent = '';
    gridWrap.style.display = '';
    refreshUnreadBadge();
  }

  $('subview-back').addEventListener('click', closeSubview);
  $('menu-open').addEventListener('click', function () { openDrawer(true); });
  $('drawer-close').addEventListener('click', function () { openDrawer(false); });
  backdrop.addEventListener('click', function () { openDrawer(false); });

  /* ---------- Views ---------- */

  function openStatusView(label, iconUrl, message) {
    showSubview(label, function (box) {
      var card = el('div', 'status-card');
      var img = document.createElement('img');
      img.src = iconUrl || '/media/icons/coming-soon.svg';
      img.alt = label;
      card.appendChild(img);
      card.appendChild(el('h3', '', message));
      card.appendChild(
        el('p', '', 'Ebenezer Higher Secondary School · Connected to live school database'),
      );
      box.appendChild(card);
    });
  }

  function openProfileView() {
    showSubview('My Profile', function (box) {
      box.appendChild(el('p', '', 'Loading profile from Excel database…'));
      api('/api/profile/me').then(function (res) {
        box.textContent = '';
        if (!res.ok) {
          box.appendChild(el('p', '', res.error || 'Could not load profile.'));
          return;
        }
        var p = res.profile || {};
        var hero = el('div', 'profile-hero');
        var av = document.createElement('img');
        av.src = '/media/me/photo?t=' + Date.now();
        av.alt = 'Profile photo';
        var hText = el('div', '');
        hText.appendChild(el('h3', '', p.Name || me.name));
        var idLabel =
          res.role === 'student'
            ? 'Admission No (Chat ID): ' + (p['Admission No'] || me.id)
            : res.role === 'teacher' || res.role === 'classteacher'
              ? 'Teacher Chat-Room Registration No: ' + (p['Reg No'] || me.id)
              : 'Chat-Room ID: ' + (p['Chat ID'] || me.id);
        hText.appendChild(el('p', '', idLabel));
        hero.appendChild(av);
        hero.appendChild(hText);
        box.appendChild(hero);

        var list = el('div', 'profile-list');
        Object.keys(p).forEach(function (k) {
          if (!p[k]) return;
          var row = el('div', 'profile-row');
          var label = k === 'Reg No' ? 'Chat-Room Registration No.' : k;
          row.appendChild(el('span', '', label));
          row.appendChild(el('strong', '', String(p[k])));
          list.appendChild(row);
        });
        box.appendChild(list);
      });
    });
  }

  function openNoticesView() {
    showSubview('Notices & Announcements', function (box) {
      box.appendChild(el('p', '', 'Loading official notices…'));
      api('/api/notices').then(function (res) {
        box.textContent = '';
        refreshUnreadBadge();
        var list = res.notices || [];
        if (!list.length) {
          var empty = el('div', 'status-card');
          var img = document.createElement('img');
          img.src = '/media/icons/notices.svg';
          empty.appendChild(img);
          empty.appendChild(el('h3', '', 'No notices or announcements yet'));
          box.appendChild(empty);
          return;
        }
        var wrap = el('div', 'notice-list');
        list.forEach(function (n) {
          var item = el('article', 'notice-item' + (n.priority === 'important' ? ' important' : ''));
          var head = el('div', 'notice-head');
          head.appendChild(el('h4', '', n.title));
          head.appendChild(el('span', 'notice-tag', n.authorRole || 'School Notice'));
          item.appendChild(head);
          item.appendChild(el('p', 'notice-body', n.body));

          var meta = el('div', 'notice-meta');
          var dt = new Date(n.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          });
          meta.appendChild(el('span', '', 'By ' + n.authorName + ' · ' + dt));
          if (me && (me.role === 'principal' || me.role === 'administrative')) {
            var del = el('button', 'btn-danger-sm', 'Delete');
            del.type = 'button';
            del.addEventListener('click', function () {
              api('/api/notices/' + encodeURIComponent(n.id), { method: 'DELETE' }).then(openNoticesView);
            });
            meta.appendChild(del);
          }
          item.appendChild(meta);
          wrap.appendChild(item);
        });
        box.appendChild(wrap);
      });
    });
  }

  function openPublishNoticeView() {
    showSubview('Publish Notices', function (box) {
      // Blueprint specifies "Coming soon" preview on Principal's Publish Notices button,
      // plus Notices are controlled by Admin panel or Principal dashboard!
      var statusBanner = el('div', 'status-card');
      statusBanner.style.padding = '18px';
      statusBanner.style.marginBottom = '16px';
      var img = document.createElement('img');
      img.src = '/media/icons/publish-notices.svg';
      img.style.width = '58px';
      img.style.height = '58px';
      statusBanner.appendChild(img);
      statusBanner.appendChild(el('h3', '', 'Coming soon'));
      statusBanner.appendChild(
        el('p', '', 'Live Notice Broadcast is also enabled below for Principal & Administrative control:'),
      );
      box.appendChild(statusBanner);

      var form = el('form', 'app-form');
      form.appendChild(el('h4', '', 'Broadcast Official Notice / Announcement'));

      var l1 = el('label', '', 'Notice Title');
      var inTitle = document.createElement('input');
      inTitle.required = true;
      inTitle.placeholder = 'e.g. Half-Yearly Exam Routine Published';
      l1.appendChild(inTitle);

      var l2 = el('label', '', 'Priority');
      var sel = document.createElement('select');
      [['normal', 'Normal Announcement'], ['important', 'Important / Urgent (Red Highlight)']].forEach(function (o) {
        var opt = document.createElement('option');
        opt.value = o[0];
        opt.textContent = o[1];
        sel.appendChild(opt);
      });
      l2.appendChild(sel);

      var l3 = el('label', '', 'Announcement Details');
      var inBody = document.createElement('textarea');
      inBody.required = true;
      inBody.placeholder = 'Write the full notice for students and teachers…';
      l3.appendChild(inBody);

      var btn = el('button', 'btn-primary', 'Publish Notice to All Dashboards');
      btn.type = 'submit';

      form.appendChild(l1);
      form.appendChild(l2);
      form.appendChild(l3);
      form.appendChild(btn);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        api('/api/notices', {
          method: 'POST',
          body: { title: inTitle.value, body: inBody.value, priority: sel.value },
        }).then(function (res) {
          if (res.ok) openNoticesView();
        });
      });
      box.appendChild(form);
    });
  }

  function openLegalInline(kind) {
    var isPrivacy = kind === 'privacy';
    showSubview(isPrivacy ? 'Privacy & Policy' : 'Terms & Conditions', function (box) {
      var card = el('div', 'notice-item');
      if (isPrivacy) {
        card.appendChild(el('h4', '', 'Ebenezer Higher Secondary School — Privacy & Policy'));
        card.appendChild(
          el(
            'p',
            'notice-body',
            '1. Student & Teacher Records: All profile details are loaded securely from the School Excel Database. Only you and authorised school authorities can view your profile.\n\n' +
              '2. Encrypted 60-Day School Group Chat: Every text, image and video sent in the School Group is encrypted and automatically purged at 12:00 AM midnight after 60 days from its specific send date (e.g., a message sent on 01/10/2026 is deleted on 30/11/2026 at 12:00 AM).\n\n' +
              '3. Child Safety: Students only see Principal at first until added to a group by their Class Teacher. Admin can review created group messages for student safety.\n\n' +
              '4. Zero Third-Party Tracking: Only an HttpOnly security cookie is used to keep your session protected.',
          ),
        );
      } else {
        card.appendChild(el('h4', '', 'Ebenezer Higher Secondary School — Terms & Conditions'));
        card.appendChild(
          el(
            'p',
            'notice-body',
            '1. Account Usage: Students log in using their unique Admission Number and Date of Birth. Teachers & Class Teachers log in with their assigned credentials and unique Chat Registration Number.\n\n' +
              '2. School Group Conduct: Only Admin, Principal, and Class Teachers may create groups or add students. Respectful communication is mandatory.\n\n' +
              '3. Security Policy: Code inspection, unauthorised shortcuts, and sharing credentials are strictly prohibited. 5 failed login attempts lock the account for 15 minutes.',
          ),
        );
      }
      var fullLink = el('a', 'btn-secondary', 'Open Full Printable Document →');
      fullLink.href = isPrivacy ? '/legal/privacy' : '/legal/terms';
      fullLink.style.display = 'inline-flex';
      fullLink.style.alignItems = 'center';
      fullLink.style.marginTop = '8px';
      card.appendChild(fullLink);
      box.appendChild(card);
    });
  }

  function handleFeatureClick(f) {
    if (f.key === 'notices') return openNoticesView();
    if (f.key === 'chat') {
      return showSubview('School Group (60-Day Encrypted Chat)', function (box) {
        window.EHSChat.mount(box);
      });
    }
    if (f.key === 'publish-notices') return openPublishNoticeView();
    return openStatusView(f.label, f.icon, f.message);
  }

  function refreshUnreadBadge() {
    if (!unreadBadgeEl) return;
    api('/api/notices/unread')
      .then(function (r) {
        var count = (r && r.unread) || 0;
        unreadBadgeEl.textContent = String(count);
        unreadBadgeEl.hidden = count <= 0;
      })
      .catch(function () {});
  }

  function on(id, ev, fn) {
    var elem = $(id);
    if (elem) elem.addEventListener(ev, fn);
  }

  function performLogout(e) {
    if (e) e.preventDefault();
    api('/api/auth/logout', { method: 'POST', body: {} })
      .catch(function () {})
      .finally(function () {
        window.location.replace('/logout');
      });
  }

  /* ---------- Drawer Menu & Header Logout Buttons ---------- */
  on('OpenProfileBtn', 'click', openProfileView);
  on('drawer-profile', 'click', openProfileView);
  on('drawer-setting', 'click', function () {
    openStatusView('Setting', '/media/icons/coming-soon.svg', 'Coming soon');
  });
  on('drawer-privacy', 'click', function () { openLegalInline('privacy'); });
  on('drawer-terms', 'click', function () { openLegalInline('terms'); });
  on('drawer-logout', 'click', performLogout);
  on('header-logout', 'click', performLogout);
  on('logout', 'click', performLogout);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#drawer-logout, #header-logout, #logout, [data-logout]');
    if (btn) performLogout(e);
  });

  /* ---------- Initial Bootstrap ---------- */
  Promise.all([api('/api/auth/me'), api('/api/features')])
    .then(function (results) {
      me = results[0];
      var featRes = results[1];

      $('user-name').textContent = me.name;
      $('chat-id-badge').textContent =
        me.role === 'student'
          ? 'Admission / Chat ID: ' + me.id
          : me.role === 'teacher' || me.role === 'classteacher'
            ? 'Chat Reg No: ' + me.id
            : 'Chat ID: ' + me.id;
      $('drawer-name').textContent = me.name;
      $('drawer-role').textContent = me.roleLabel + ' · ID: ' + me.id;

      var photoUrl = '/media/me/photo';
      $('avatar').src = photoUrl;
      $('drawer-avatar').src = photoUrl;

      gridEl.textContent = '';
      (featRes.features || []).forEach(function (f) {
        var btn = el('button', 'bp-tile');
        btn.type = 'button';
        btn.id = 'tile-' + f.key;

        var iconBox = el('div', 'bp-icon-box');
        var img = document.createElement('img');
        img.src = f.icon;
        img.alt = f.label;
        iconBox.appendChild(img);

        if (f.key === 'notices') {
          unreadBadgeEl = el('span', 'bp-badge', String(featRes.unreadNotices || 0));
          unreadBadgeEl.hidden = !(featRes.unreadNotices > 0);
          iconBox.appendChild(unreadBadgeEl);
        }

        btn.appendChild(iconBox);
        btn.appendChild(el('span', 'bp-tile-label', f.label));
        btn.addEventListener('click', function () { handleFeatureClick(f); });
        gridEl.appendChild(btn);
      });
    })
    .catch(function () {});
})();
