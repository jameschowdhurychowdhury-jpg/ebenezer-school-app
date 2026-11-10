/* =====================================================================
   School Group — WhatsApp-Identical Encrypted 60-Day Chat Widget
   Used by Student, Teacher, Class Teacher, Principal, Administrative & Admin Panel.
   ===================================================================== */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function mountSchoolGroup(container) {
    container.textContent = '';
    var shell = el('div', 'wa-shell');

    // Top bar
    var top = el('div', 'wa-top');
    var topInfo = el('div', 'wa-top-info');
    var topTitle = el('h4', '', 'School Group');
    var topSub = el('small', '', 'Loading encrypted chat-room…');
    topInfo.appendChild(topTitle);
    topInfo.appendChild(topSub);

    var topActions = el('div', 'wa-top-actions');
    var newGroupBtn = el('button', 'wa-btn', '+ New Group');
    newGroupBtn.type = 'button';
    newGroupBtn.hidden = true;
    topActions.appendChild(newGroupBtn);
    top.appendChild(topInfo);
    top.appendChild(topActions);
    shell.appendChild(top);

    var encBanner = el(
      'div',
      'wa-enc-banner',
      '🔒 End-to-End School Encrypted · Every message & media auto-deletes at 12:00 AM midnight after 60 days',
    );
    shell.appendChild(encBanner);

    // Category filter tabs (especially useful for Admin "Unknown" & Staff)
    var tabsBar = el('div', 'wa-tabs');
    tabsBar.hidden = true;
    shell.appendChild(tabsBar);

    // Body: Room list + Active thread + Inline Create-Group / Add-Member panel
    var body = el('div', 'wa-body');
    var roomList = el('div', 'wa-room-list');
    var thread = el('div', 'wa-thread');
    body.appendChild(roomList);
    body.appendChild(thread);
    shell.appendChild(body);
    container.appendChild(shell);

    var state = {
      me: null,
      rooms: [],
      directory: [],
      filter: 'all',
      activeRoom: null,
    };

    function fetchJson(url, opts) {
      opts = opts || {};
      return fetch(url, {
        method: opts.method || 'GET',
        credentials: 'same-origin',
        headers: opts.body ? { 'Content-Type': 'application/json' } : {},
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok || !d.ok) throw new Error((d && d.error) || 'Request failed');
          return d;
        });
      });
    }

    function renderTabs() {
      tabsBar.textContent = '';
      if (!state.me || state.me.role === 'student') {
        tabsBar.hidden = true;
        return;
      }
      tabsBar.hidden = false;
      var defs = [
        ['all', 'All Chats'],
        ['group', 'Groups'],
        ['student', 'Students'],
        ['teacher', 'Teachers & Staff'],
      ];
      defs.forEach(function (pair) {
        var b = el('button', 'wa-tab' + (state.filter === pair[0] ? ' is-active' : ''), pair[1]);
        b.type = 'button';
        b.addEventListener('click', function () {
          state.filter = pair[0];
          renderTabs();
          renderRoomList();
        });
        tabsBar.appendChild(b);
      });
    }

    function renderRoomList() {
      roomList.textContent = '';
      var filtered = state.rooms.filter(function (r) {
        if (state.filter === 'all') return true;
        if (state.filter === 'group') return r.type === 'group';
        return r.category === state.filter;
      });

      if (!filtered.length) {
        var empty = el('div', 'status-card');
        empty.style.margin = '16px';
        empty.appendChild(el('p', '', 'No chats in this category yet.'));
        roomList.appendChild(empty);
        return;
      }

      filtered.forEach(function (r) {
        var item = el('button', 'wa-room-item');
        item.type = 'button';
        var av = el(
          'div',
          'wa-room-avatar' + (r.type === 'group' ? ' group' : ''),
          r.type === 'group' ? 'GRP' : String(r.peerChatId || r.name).slice(0, 3).toUpperCase(),
        );
        var main = el('div', 'wa-room-main');
        main.appendChild(el('strong', '', r.name));
        var preview = r.lastMessage
          ? r.lastMessage.senderName + ': ' + (r.lastMessage.text || '[' + r.lastMessage.kind + ']')
          : r.subtitle || 'Tap to open encrypted chat';
        main.appendChild(el('small', '', preview));
        item.appendChild(av);
        item.appendChild(main);
        item.addEventListener('click', function () {
          openRoom(r);
        });
        roomList.appendChild(item);
      });
    }

    function openRoom(room) {
      state.activeRoom = room;
      roomList.style.display = 'none';
      tabsBar.hidden = true;
      thread.className = 'wa-thread is-open';
      thread.textContent = '';

      var bar = el('div', 'wa-thread-bar');
      var backBtn = el('button', 'btn-secondary', '← Chats');
      backBtn.type = 'button';
      backBtn.addEventListener('click', function () {
        state.activeRoom = null;
        thread.className = 'wa-thread';
        roomList.style.display = '';
        renderTabs();
        loadOverview();
      });

      var titleBox = el('div', 'wa-thread-title');
      titleBox.appendChild(el('strong', '', room.name));
      titleBox.appendChild(el('small', '', room.subtitle || 'Encrypted 60-day room'));

      bar.appendChild(backBtn);
      bar.appendChild(titleBox);

      // If group & user can manage groups -> "+ Add Student / Member" button
      if (room.type === 'group' && state.me && state.me.canManageGroups) {
        var addMemBtn = el('button', 'btn-secondary', '+ Add by ID');
        addMemBtn.type = 'button';
        addMemBtn.addEventListener('click', function () {
          showAddMemberForm(room);
        });
        bar.appendChild(addMemBtn);
      }

      thread.appendChild(bar);

      var msgBox = el('div', 'wa-messages');
      thread.appendChild(msgBox);

      var comp = el('form', 'wa-composer');
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*,video/*';
      fileInput.hidden = true;

      var attachBtn = el('button', 'wa-attach', '📎');
      attachBtn.type = 'button';
      attachBtn.title = 'Send Picture or Video (60-day auto-clear)';
      attachBtn.addEventListener('click', function () {
        fileInput.click();
      });

      var textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.placeholder = 'Type an encrypted message…';
      textInput.maxLength = 2000;

      var sendBtn = el('button', 'wa-send', 'Send');
      sendBtn.type = 'submit';

      comp.appendChild(fileInput);
      comp.appendChild(attachBtn);
      comp.appendChild(textInput);
      comp.appendChild(sendBtn);
      thread.appendChild(comp);

      function renderMessages(list) {
        msgBox.textContent = '';
        if (!list.length) {
          var hint = el(
            'div',
            'wa-enc-banner',
            'No messages yet. Say hi! Every message sent today will automatically disappear at 12:00 AM midnight after 60 days.',
          );
          hint.style.borderRadius = '10px';
          msgBox.appendChild(hint);
          return;
        }
        list.forEach(function (m) {
          var mine = state.me && m.senderKey === state.me.key;
          var b = el('div', 'wa-bubble' + (mine ? ' mine' : ''));
          b.appendChild(
            el('div', 'wa-sender', m.senderName + ' (ID: ' + m.senderChatId + ') · ' + m.senderRole),
          );
          if (m.mediaUrl) {
            var mediaWrap = el('div', 'wa-media');
            if (m.kind === 'video') {
              var v = document.createElement('video');
              v.src = m.mediaUrl;
              v.controls = true;
              mediaWrap.appendChild(v);
            } else {
              var img = document.createElement('img');
              img.src = m.mediaUrl;
              img.alt = 'Shared attachment';
              mediaWrap.appendChild(img);
            }
            b.appendChild(mediaWrap);
          }
          if (m.text) b.appendChild(el('div', 'wa-text', m.text));

          var foot = el('div', 'wa-foot');
          foot.appendChild(el('span', '', 'Sent ' + m.sentDate));
          foot.appendChild(el('span', 'wa-exp-pill', '⏳ Clears ' + m.expiresDate));
          b.appendChild(foot);
          msgBox.appendChild(b);
        });
        msgBox.scrollTop = msgBox.scrollHeight;
      }

      function refreshMessages() {
        fetchJson('/api/chat/rooms/' + encodeURIComponent(room.id) + '/messages')
          .then(function (d) {
            renderMessages(d.messages || []);
          })
          .catch(function (err) {
            msgBox.textContent = err.message;
          });
      }

      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        if (f.size > 240 * 1024) {
          alert('For fast encrypted storage, please choose an image or short clip under 240 KB.');
          fileInput.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var kind = f.type.indexOf('video') === 0 ? 'video' : 'image';
          fetchJson('/api/chat/messages', {
            method: 'POST',
            body: {
              roomId: room.id,
              kind: kind,
              mediaUrl: String(reader.result),
              text: textInput.value.trim() || ('Shared ' + kind),
            },
          }).then(function () {
            textInput.value = '';
            fileInput.value = '';
            refreshMessages();
          }).catch(function (e) { alert(e.message); });
        };
        reader.readAsDataURL(f);
      });

      comp.addEventListener('submit', function (e) {
        e.preventDefault();
        var t = textInput.value.trim();
        if (!t) return;
        textInput.value = '';
        fetchJson('/api/chat/messages', {
          method: 'POST',
          body: { roomId: room.id, kind: 'text', text: t },
        })
          .then(refreshMessages)
          .catch(function (err) { alert(err.message); });
      });

      refreshMessages();
    }

    function showCreateGroupForm() {
      roomList.style.display = 'none';
      tabsBar.hidden = true;
      thread.className = 'wa-thread is-open';
      thread.textContent = '';

      var wrap = el('div', 'subview-content');
      var form = el('form', 'app-form');
      form.appendChild(el('h4', '', 'Create Encrypted School / Class Group'));

      var l1 = el('label', '', 'Group Name');
      var inName = document.createElement('input');
      inName.required = true;
      inName.placeholder = 'e.g. Class 5 - A Official Group';
      l1.appendChild(inName);
      form.appendChild(l1);

      var l2 = el('label', '', 'Add Members (Students by Admission No / Teachers by Reg No)');
      var selectBox = el('div', '');
      selectBox.style.maxHeight = '190px';
      selectBox.style.overflowY = 'auto';
      selectBox.style.background = '#fff';
      selectBox.style.padding = '8px';
      selectBox.style.borderRadius = '8px';
      selectBox.style.border = '1px solid var(--line)';

      state.directory.forEach(function (d) {
        var row = el('label', '');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.padding = '4px 2px';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = d.key;
        cb.style.width = 'auto';
        row.appendChild(cb);
        row.appendChild(el('span', '', d.name + ' — ' + d.subtitle));
        selectBox.appendChild(row);
      });
      l2.appendChild(selectBox);
      form.appendChild(l2);

      var actions = el('div', '');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      var submit = el('button', 'btn-primary', 'Create Encrypted Group');
      submit.type = 'submit';
      var cancel = el('button', 'btn-secondary', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', function () {
        thread.className = 'wa-thread';
        roomList.style.display = '';
        renderTabs();
      });
      actions.appendChild(submit);
      actions.appendChild(cancel);
      form.appendChild(actions);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var checked = Array.prototype.slice
          .call(selectBox.querySelectorAll('input[type="checkbox"]:checked'))
          .map(function (c) { return c.value; });
        fetchJson('/api/chat/groups', {
          method: 'POST',
          body: { name: inName.value.trim(), memberKeys: checked },
        })
          .then(function () {
            thread.className = 'wa-thread';
            roomList.style.display = '';
            loadOverview();
          })
          .catch(function (err) { alert(err.message); });
      });

      wrap.appendChild(form);
      thread.appendChild(wrap);
    }

    function showAddMemberForm(room) {
      var code = window.prompt(
        'Enter Student Admission Number (e.g. 123, 546) or Teacher Reg No (e.g. 1, 2) to add to "' +
          room.name +
          '":',
      );
      if (!code || !code.trim()) return;
      var trimmed = code.trim().toUpperCase();
      // Check directory for matching student or teacher
      var found = state.directory.find(function (d) {
        return String(d.chatId).toUpperCase() === trimmed;
      });
      fetchJson('/api/chat/groups/' + encodeURIComponent(room.id) + '/members', {
        method: 'POST',
        body: found
          ? { memberKey: found.key }
          : { admissionOrRegNo: trimmed, memberType: 'student' },
      })
        .then(function (res) {
          alert('Added ' + (res.added ? res.added.name + ' (ID ' + res.added.chatId + ')' : trimmed) + ' to ' + room.name + '!');
          loadOverview();
        })
        .catch(function (err) {
          alert(err.message);
        });
    }

    newGroupBtn.addEventListener('click', showCreateGroupForm);

    function loadOverview() {
      fetchJson('/api/chat/overview')
        .then(function (d) {
          state.me = d.me;
          state.rooms = d.rooms || [];
          state.directory = d.directory || [];
          topSub.textContent =
            'Your Chat Register ID: ' +
            d.me.chatId +
            (d.me.role === 'student'
              ? ' · Students can text Principal directly until a Class Teacher adds them to a group'
              : '');
          newGroupBtn.hidden = !d.me.canManageGroups;
          renderTabs();
          renderRoomList();
        })
        .catch(function (err) {
          topSub.textContent = err.message;
        });
    }

    loadOverview();
  }

  window.EHSChat = { mount: mountSchoolGroup };
})();
