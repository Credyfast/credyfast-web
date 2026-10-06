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
    '#/dashboard': { module: () => Dashboard,   title: 'Dashboard',              minRole: 'Cajero'       },
    '#/pos':       { module: () => POS,          title: 'Registrar Pago',         minRole: 'Cajero'       },
    '#/caja':      { module: () => Caja,         title: 'Caja',                   minRole: 'Cajero'       },
    '#/clientes':  { module: () => Clientes,     title: 'Clientes',               minRole: 'Vendedor'     },
    '#/creditos':  { module: () => Creditos,     title: 'Créditos',               minRole: 'Vendedor'     },
    '#/simulador': { module: () => Simulador,    title: 'Simulador de Crédito',   minRole: 'Vendedor'     },
    '#/cobranza':  { module: () => Cobranza,     title: 'Cobranza en Campo',      minRole: 'Cobranza'     },
    '#/productos':     { module: () => Productos,          title: 'Productos',              minRole: 'Supervisor'   },
    '#/usuarios':      { module: () => Usuarios,           title: 'Usuarios del Sistema',   minRole: 'Supervisor'   },
    '#/autorizaciones':{ module: () => AutorizacionesView, title: 'Códigos de Autorización', minRole: 'Supervisor'   },
    '#/sucursales':    { module: () => Sucursales,         title: 'Sucursales',             minRole: 'SuperUsuario' },
  };

  // ── Menú de navegación por rol ─────────────────────────────
  // minRole: nivel mínimo para ver el item (jerárquico)
  // ── Menú de navegación por rol ─────────────────────────────
  // minRole: nivel mínimo para ver el item (jerárquico)
  // allowedRoles: lista exacta de roles permitidos (sobreescribe minRole si está presente)
  const SVG_ICONS = {
    dashboard: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>',
    pos: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>',
    caja: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
    clientes: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    creditos: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    cotizador: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/></svg>',
    cobranza: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
    inventario: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    usuarios: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>',
    autorizaciones: '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
  };

  const NAV_ITEMS = [
    { hash: '#/dashboard',     icon: SVG_ICONS.dashboard, label: 'Dashboard',      allowedRoles: ['SuperUsuario','Supervisor','Cajero','Cobranza'], showBadge: false },
    { hash: '#/pos',           icon: SVG_ICONS.pos,       label: 'POS Caja',        allowedRoles: ['SuperUsuario','Supervisor','Cajero'],             showBadge: false },
    { hash: '#/caja',          icon: SVG_ICONS.caja,      label: 'Caja',           allowedRoles: ['SuperUsuario','Supervisor','Cajero'],             showBadge: false },
    { hash: '#/clientes',      icon: SVG_ICONS.clientes,  label: 'Clientes',       minRole: 'Vendedor',   showBadge: false },
    { hash: '#/creditos',      icon: SVG_ICONS.creditos,  label: 'Solicitudes',    minRole: 'Vendedor',   showBadge: true  },
    { hash: '#/simulador',     icon: SVG_ICONS.cotizador, label: 'Cotizador',      allowedRoles: ['SuperUsuario','Supervisor','Vendedor'],          showBadge: false },
    { hash: '#/cobranza',      icon: SVG_ICONS.cobranza,  label: 'Cobranza',       allowedRoles: ['SuperUsuario','Supervisor','Cobranza'],          showBadge: false },
    { hash: '#/productos',     icon: SVG_ICONS.inventario,label: 'Inventario',     minRole: 'Supervisor', showBadge: false },
    { hash: '#/usuarios',      icon: SVG_ICONS.usuarios,  label: 'Usuarios',       minRole: 'Supervisor', showBadge: false },
    { hash: '#/autorizaciones',icon: SVG_ICONS.autorizaciones, label: 'Autorizaciones', allowedRoles: ['SuperUsuario','Supervisor'],                  showBadge: false },
    { hash: '#/sucursales',    icon: '🏢',                label: 'Sucursales',     allowedRoles: ['SuperUsuario'],                                 showBadge: false },
  ];


  function _hasAccess(userRol, item) {
    // Acepta string (minRole directo) o un objeto { minRole, allowedRoles }
    if (typeof item === 'string') {
      return (ROLE_LEVEL[userRol] || 0) >= (ROLE_LEVEL[item] || 99);
    }
    if (item && item.allowedRoles) return item.allowedRoles.includes(userRol);
    return (ROLE_LEVEL[userRol] || 0) >= (ROLE_LEVEL[item && item.minRole] || 99);
  }

  // ── Construir nav según rol ────────────────────────────────
  function buildNav(user) {
    const nav = $('sidebar-nav');
    if (!nav) return;
    const items = NAV_ITEMS.filter(n => _hasAccess(user.rol, n));
    nav.innerHTML = `
      <div class="nav-section-label">Menú Operativo</div>
      ${items.map(n => `
        <div class="nav-item" data-hash="${n.hash}" id="nav-${n.hash.replace('#/','')}" role="button" tabindex="0">
          <span class="nav-icon">${n.icon}</span>
          <span class="nav-label">${n.label}</span>
          ${n.showBadge ? `<span class="nav-badge hidden" id="badge-${n.hash.replace('#/','')}">0</span>` : ''}
        </div>
      `).join('')}
    `;

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
