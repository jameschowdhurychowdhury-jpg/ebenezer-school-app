/*
 * Deterrent layer loaded on every page: blocks right-click, view-source, save,
 * print and DevTools shortcuts, image dragging and copying.
 * NOTE: browsers can never fully stop a determined person from inspecting a page;
 * the REAL protection is on the server (sessions, role checks, no secrets in pages).
 */
(function () {
  'use strict';

  function block(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  function isEditable(el) {
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  document.addEventListener('contextmenu', block, true);

  document.addEventListener('dragstart', function (e) {
    if (e.target && e.target.tagName === 'IMG') block(e);
  }, true);

  ['copy', 'cut'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (!isEditable(e.target)) block(e);
    }, true);
  });

  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var ctrl = e.ctrlKey || e.metaKey;
    if (k === 'f12') return block(e);
    if (ctrl && e.shiftKey && ['i', 'j', 'c', 'k', 'e', 'm'].indexOf(k) > -1) return block(e); // DevTools panels
    if (ctrl && e.altKey && ['i', 'j', 'c', 'u'].indexOf(k) > -1) return block(e); // macOS DevTools / source
    if (ctrl && ['u', 's', 'p'].indexOf(k) > -1) return block(e); // view-source, save, print
  }, true);
})();
