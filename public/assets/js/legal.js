/* Back button: return to wherever the user came from (login or their dashboard) */
(function () {
  'use strict';
  var back = document.getElementById('back-btn');
  if (!back) return;
  back.addEventListener('click', function (e) {
    if (window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    }
  });
})();
