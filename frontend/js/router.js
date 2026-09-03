/* ============================================================
   CredyFast — router.js  |  SPA Router basado en hash + menús por rol
   ============================================================ */

const Router = (() => {

  // ── Roles y niveles ────────────────────────────────────────
  const ROLE_LEVEL = {
    'SuperUsuario': 5, 'Supervisor': 4,
    'Vendedor': 3, 'Cajero': 2, 'Cobranza': 1,
  };

  // ── Definición de rutas ────────────────────────────────────
  const ROUTES = {
    '#/dashboard': { module: () => Dashboard, title: 'Dashboard',              minRole: 'Cajero'     },
    '#/pos':       { module: () => POS,       title: 'Registrar Pago',         minRole: 'Cajero'     },
    '#/caja':      { module: () => Caja,      title: 'Caja',                   minRole: 'Cajero'     },
    '#/clientes':  { module: () => Clientes,  title: 'Clientes',               minRole: 'Vendedor'   },
    '#/creditos':  { module: () => Creditos,  title: 'Créditos',               minRole: 'Vendedor'   },
    '#/cobranza':  { module: () => Cobranza,  title: 'Cobranza en Campo',      minRole: 'Cobranza'   },
    '#/productos': { module: () => Productos, title: 'Productos',              minRole: 'Supervisor' },
    '#/usuarios':  { module: () => Usuarios,  title: 'Usuarios del Sistema',   minRole: 'Supervisor' },
  };

  // ── Menú de navegación por rol ─────────────────────────────
  // Todos los roles ven su subconjunto; el nav se filtra por minRole
  const NAV_ITEMS = [
    { hash: '#/dashboard', icon: '📊', label: 'Dashboard',      minRole: 'Cajero',     showBadge: false },
    { hash: '#/pos',       icon: '💳', label: 'Registrar Pago', minRole: 'Cajero',     showBadge: false },
    { hash: '#/caja',      icon: '🏦', label: 'Caja',           minRole: 'Cajero',     showBadge: false },
    { hash: '#/clientes',  icon: '👥', label: 'Clientes',       minRole: 'Vendedor',   showBadge: false },
    { hash: '#/creditos',  icon: '📋', label: 'Créditos',       minRole: 'Vendedor',   showBadge: true  }, // Badge pendientes
    { hash: '#/cobranza',  icon: '🏠', label: 'Cobranza',       minRole: 'Cobranza',   showBadge: false },
    { hash: '#/productos', icon: '📦', label: 'Productos',      minRole: 'Supervisor', showBadge: false },
    { hash: '#/usuarios',  icon: '👤', label: 'Usuarios',       minRole: 'Supervisor', showBadge: false },
  ];

  function _hasAccess(userRol, minRole) {
    return (ROLE_LEVEL[userRol] || 0) >= (ROLE_LEVEL[minRole] || 99);
  }

  // ── Construir nav según rol ────────────────────────────────
  function buildNav(user) {
    const nav = $('sidebar-nav');
    if (!nav) return;
    const items = NAV_ITEMS.filter(n => _hasAccess(user.rol, n.minRole));
    nav.innerHTML = items.map(n => `
      <div class="nav-item" data-hash="${n.hash}" id="nav-${n.hash.replace('#/','')}" role="button" tabindex="0">
        <span class="nav-icon">${n.icon}</span>
        <span>${n.label}</span>
        ${n.showBadge ? `<span class="nav-badge hidden" id="badge-${n.hash.replace('#/','')}">0</span>` : ''}
      </div>
    `).join('');

    nav.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.hash));
      el.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(el.dataset.hash); });
    });
  }

  // ── Actualizar badge de pendientes ─────────────────────────
  function updateBadge(count) {
    const navBadge    = $('badge-creditos');
    const headerBadge = $('notif-badge');

    if (navBadge) {
      navBadge.textContent = count;
      navBadge.classList.toggle('hidden', count === 0);
    }
    if (headerBadge) {
      headerBadge.textContent = count;
      headerBadge.classList.toggle('hidden', count === 0);
    }
  }

  // ── Navegar a ruta ─────────────────────────────────────────
  function navigate(hash) {
    const route = ROUTES[hash];
    if (!route) { navigate('#/dashboard'); return; }

    const user = State.get('user');
    if (!user || !_hasAccess(user.rol, route.minRole)) {
      toast('No tienes permiso para acceder a esta sección.', 'warning');
      return;
    }

    if (window.location.hash !== hash) {
      window.location.hash = hash;
      return; // hashchange event lo maneja
    }
    _loadRoute(hash, route);
  }

  function _loadRoute(hash, route) {
    const container = $('view-container');
    if (!container) return;

    setHTML('header-title', route.title);

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.hash === hash);
    });

    State.set('currentRoute', hash);

    try {
      const mod = route.module();
      container.innerHTML = mod.render();
      if (typeof mod.init === 'function') {
        setTimeout(() => mod.init(), 10);
      }
    } catch(err) {
      container.innerHTML = `<div class="alert alert-danger">Error cargando módulo: ${err.message}</div>`;
      console.error(err);
    }

    // Cerrar sidebar en mobile
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    }
  }

  // ── Inicializar router ─────────────────────────────────────
  function init() {
    window.addEventListener('hashchange', () => {
      const hash  = window.location.hash || '#/dashboard';
      const route = ROUTES[hash];
      if (!route) return;

      const user = State.get('user');
      if (!user) { window.location.hash = '#/login'; return; }
      if (!_hasAccess(user.rol, route.minRole)) return;

      _loadRoute(hash, route);
    });
  }

  // ── Redirect inteligente según rol ─────────────────────────
  function defaultRoute(rol) {
    if (rol === 'Cobranza')                           return '#/cobranza';
    if (rol === 'Vendedor')                           return '#/clientes';
    if (rol === 'Cajero')                             return '#/pos';
    if (ROLE_LEVEL[rol] >= ROLE_LEVEL['Supervisor'])  return '#/dashboard';
    return '#/dashboard';
  }

  return { init, navigate, buildNav, defaultRoute, updateBadge };
})();
