  /* ---------- Protected dashboards – each role can open ONLY its own folder ---------- */
  const dashboards = {
    student: 'student',
    teacher: 'teacher',
    classteacher: 'class-teacher',
    principal: 'principal',
    administrative: 'administrative',
  };
  for (const [role, folder] of Object.entries(dashboards)) {
    app.use(
      `/${folder}`,
      mw.requirePageRole([role]),
      express.static(path.join(paths.appDir, folder), { dotfiles: 'deny', extensions: ['html'] }),
    );
  }
  // assets shared by all dashboards (only for logged-in users)
  app.use(
    '/app-shared',
    mw.requirePageRole('*'),
    mw.noStore,
    express.static(path.join(paths.appDir, 'shared'), { dotfiles: 'deny', index: false }),
  );
  /* ---------- 404 + error handler (never leaks stack traces) ---------- */
  app.use((_req, res) => res.status(404).sendFile(path.join(paths.publicDir, '404.html')));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[main] error:', err && err.message);
    if (res.headersSent) return;
    res.status(err.status && err.status < 500 ? err.status : 500).json({ ok: false, error: 'Something went wrong.' });
  });
  return app;
}
module.exports = { createMainApp };