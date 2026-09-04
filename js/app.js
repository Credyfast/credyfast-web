/* ============================================================
   CredyFast — app.js  |  Punto de entrada de la aplicación
   Bootstrapping, sesión, logout y poll de notificaciones cada 60s.
   (Los helpers globales: utils.js | Estado: state.js) vs2.3
   ============================================================ */

const App = (() => {

  let _pollTimer = null;

  function init() {
    // ── Fecha en header ──────────────────────────────────────
    const hd = $('header-date');
    if (hd) hd.textContent = new Date().toLocaleDateString('es-MX',
      { weekday: 'short', day: 'numeric', month: 'short' });

    // ── Inicializar router ───────────────────────────────────
    Router.init();

    // ── Sidebar toggle (mobile) ──────────────────────────────
    const menuBtn = $('btn-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('active');
      });
    }
    if (overlay && sidebar) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    }

    // ── Evento de sesión expirada (desde api.js) ──────────────
    window.addEventListener('credyfast:sessionExpired', () => {
      clearInterval(_pollTimer);
      _pollTimer = null;
      _showLogin();
    });

    // ── Logout ───────────────────────────────────────────────
    on('btn-logout', 'click', _logout);

    // ── Verificar sesión persistida ──────────────────────────
    const saved = localStorage.getItem('credyfast_session');
    if (saved) {
      try {
        const sess = JSON.parse(saved);
        if (sess?.token && sess?.user) {
          // Poner token temporalmente para poder llamar al backend
          State.set('token', sess.token);
          State.set('user',  sess.user);
          // Validar que el token siga activo en el backend (puede haber expirado tras 8h)
          _validateAndRestoreSession(sess);
          return;
        }
      } catch (_) { }
    }

    // Sin sesión → mostrar login
    _showLogin();
  }

  // ── Validar token con el backend antes de restaurar ──────
  async function _validateAndRestoreSession(sess) {
    try {
      const res = await fetch(
        // Usamos la URL del API directamente para no pasar por el módulo API (evitar loops)
        typeof API_URL !== 'undefined' ? API_URL : '',
        {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'auth_ping', token: sess.token }),
        }
      ).then(r => r.json()).catch(() => ({ ok: false }));

      // Si el backend responde ok o acción desconocida (pero sin SESION_INVALIDA), el token es válido
      if (res.error !== 'SESION_INVALIDA' && res.error !== 'TOKEN_INVALIDO') {
        _onLogin(sess.user);
      } else {
        // Token expirado: limpiar y mostrar login sin bucle
        localStorage.removeItem('credyfast_session');
        State.clearSession();
        _showLogin();
      }
    } catch (_) {
      // Sin red: mostrar login limpio
      localStorage.removeItem('credyfast_session');
      State.clearSession();
      _showLogin();
    }
  }

  // ── Pantalla de Login ────────────────────────────────────
  function _showLogin() {
    $('login-screen').classList.remove('hidden');
    $('login-screen').style.display = 'flex';
    $('app-shell').classList.add('hidden');

    const form = $('login-form');
    if (!form) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const username = $('login-username').value.trim();
      const password = $('login-password').value;
      const errEl = $('login-error');
      const btnText = $('login-btn-text');
      const btnLoader = $('login-btn-loader');
      const loginBtn = $('login-btn');

      errEl.classList.add('hidden');
      btnText.classList.add('hidden');
      btnLoader.classList.remove('hidden');
      loginBtn.disabled = true;

      try {
        const passwordHash = await Auth.sha256(password);
        const res = await API.login({ username, passwordHash });
        if (res.ok && res.token) {
          State.set('token', res.token);
          State.set('user', res.user);
          localStorage.setItem('credyfast_session', JSON.stringify({ token: res.token, user: res.user }));
          _onLogin(res.user);
        } else {
          errEl.textContent = res.message || 'Usuario o contraseña incorrectos.';
          errEl.classList.remove('hidden');
        }
      } catch (err) {
        console.error('🔴 LOGIN CATCH ERROR:', err);
        errEl.textContent = 'Error de conexión. Verifica tu internet.';
        errEl.classList.remove('hidden');
      } finally {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        loginBtn.disabled = false;
      }
    };

    setTimeout(() => { const u = $('login-username'); if (u) u.focus(); }, 50);
  }

  // ── Post-login ───────────────────────────────────────────
  function _onLogin(user) {
    $('login-screen').classList.add('hidden');
    $('app-shell').classList.remove('hidden');
    $('app-shell').style.display = '';

    setHTML('sidebar-username', user.username || user.Nombre_Completo || '—');
    setHTML('sidebar-role', user.rol || '');

    Router.buildNav(user);

    // Navegar a ruta default o hash actual
    const currentHash = window.location.hash;
    if (currentHash && currentHash !== '#' && currentHash !== '#/') {
      Router.navigate(currentHash);
    } else {
      const defaultHash = Router.defaultRoute(user.rol);
      window.location.hash = defaultHash;
    }

    // Poll de notificaciones: solo Supervisor+ cada 60s
    const ROLE_LEVEL = { SuperUsuario: 5, Supervisor: 4, Vendedor: 3, Cajero: 2, Cobranza: 1 };
    if ((ROLE_LEVEL[user.rol] || 0) >= ROLE_LEVEL.Supervisor) {
      _startNotifPoll();
    }
  }

  // ── Poll de notificaciones (créditos pendientes) ─────────
  function _startNotifPoll() {
    _pollPendientes();                             // inmediato al login
    _pollTimer = setInterval(_pollPendientes, 60000);
  }

  async function _pollPendientes() {
    try {
      const res = await API.creditPendientes();
      if (res.ok) Router.updateBadge(res.count || 0);
    } catch (_) { }
  }

  // ── Logout ───────────────────────────────────────────────
  function _logout() {
    clearInterval(_pollTimer);
    _pollTimer = null;
    State.clearSession();
    localStorage.removeItem('credyfast_session');
    window.location.hash = '';
    _showLogin();
  }

  return { init };
})();

// ── Arranque cuando el DOM esté listo ──────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
