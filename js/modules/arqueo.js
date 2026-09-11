/* ============================================================
   CredyFast — arqueo.js  |  Modal de Arqueo de Caja
   Denominaciones MXN: 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50
   Flujo: abrir → contar → enviar → resultado → (retry si no coincide)
   ============================================================ */

const ArqueoModal = (() => {

  // ── Denominaciones en orden descendente ─────────────────────
  const DENOMS = [
    { key: 'billetes1000', valor: 1000,  label: '$1,000',  tipo: 'Billete' },
    { key: 'billetes500',  valor: 500,   label: '$500',    tipo: 'Billete' },
    { key: 'billetes200',  valor: 200,   label: '$200',    tipo: 'Billete' },
    { key: 'billetes100',  valor: 100,   label: '$100',    tipo: 'Billete' },
    { key: 'billetes50',   valor: 50,    label: '$50',     tipo: 'Billete' },
    { key: 'monedas20',    valor: 20,    label: '$20',     tipo: 'Moneda'  },
    { key: 'monedas10',    valor: 10,    label: '$10',     tipo: 'Moneda'  },
    { key: 'monedas5',     valor: 5,     label: '$5',      tipo: 'Moneda'  },
    { key: 'monedas2',     valor: 2,     label: '$2',      tipo: 'Moneda'  },
    { key: 'monedas1',     valor: 1,     label: '$1',      tipo: 'Moneda'  },
    { key: 'monedas050',   valor: 0.5,   label: '$0.50',   tipo: 'Moneda'  },
  ];

  const fmt = (n) => '$' + parseFloat(n).toLocaleString('es-MX', { minimumFractionDigits: 2 });

  // Estado: si ya se realizó un arqueo en esta sesión
  let _arqueoHechoEnSesion = false;

  // ── Abrir modal ────────────────────────────────────────────
  // context: 'login' | 'logout' | 'espontaneo'
  // onComplete(result): llamado cuando el usuario termina
  function open(context, onComplete) {
    context    = context    || 'espontaneo';
    onComplete = onComplete || function() {};
    _removeOverlay();

    const overlay = document.createElement('div');
    overlay.className = 'arqueo-overlay';
    overlay.id = 'arqueo-overlay';

    const subtitles = {
      login:      'Arqueo de apertura — verifica el efectivo antes de iniciar.',
      logout:     'Arqueo de cierre — verifica el efectivo antes de salir.',
      espontaneo: 'Arqueo espontáneo — conteo de verificación.',
    };
    const subtitle = subtitles[context] || subtitles.espontaneo;

    const cancelBtn = (context !== 'login' && context !== 'logout')
      ? '<button class="btn btn-ghost btn-sm" id="arqueo-btn-cancelar">Cancelar</button>'
      : '';

    overlay.innerHTML =
      '<div class="arqueo-card" id="arqueo-card">' +
        '<div class="arqueo-header">' +
          '<div class="arqueo-header-icon">\uD83C\uDFE6</div>' +
          '<div class="arqueo-header-text">' +
            '<h2>Arqueo de Caja</h2>' +
            '<p>' + subtitle + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="arqueo-body">' +
          '<div class="arqueo-section-title">Ingresa las piezas por denominación</div>' +
          '<div class="arqueo-denom-grid" id="arqueo-denom-grid">' +
            DENOMS.map(function(d) {
              return '<div class="arqueo-denom-row">' +
                '<div class="arqueo-denom-label">' + d.label + '<small>' + d.tipo + '</small></div>' +
                '<input type="number" min="0" step="1" id="arq-' + d.key + '" value="0" inputmode="numeric" placeholder="0" aria-label="' + d.label + '">' +
              '</div>';
            }).join('') +
          '</div>' +
          '<div class="arqueo-total-bar">' +
            '<span class="lbl">TOTAL CONTADO</span>' +
            '<span class="val" id="arqueo-total-display">$0.00</span>' +
          '</div>' +
          '<div id="arqueo-result-area"></div>' +
        '</div>' +
        '<div class="arqueo-footer" id="arqueo-footer">' +
          cancelBtn +
          '<button class="btn btn-primary" id="arqueo-btn-enviar">' +
            '<span id="arqueo-btn-text">Realizar Arqueo</span>' +
            '<span id="arqueo-btn-loader" class="hidden">Verificando\u2026</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Live total
    DENOMS.forEach(function(d) {
      var inp = document.getElementById('arq-' + d.key);
      if (inp) inp.addEventListener('input', _recalcTotal);
    });

    // Botón cancelar
    var btnCancelar = document.getElementById('arqueo-btn-cancelar');
    if (btnCancelar) {
      btnCancelar.addEventListener('click', function() {
        _removeOverlay();
        onComplete(null);
      });
    }

    // Botón enviar
    document.getElementById('arqueo-btn-enviar')
      .addEventListener('click', function() { _enviar(context, onComplete, false); });

    // Focus primer campo
    setTimeout(function() {
      var first = document.getElementById('arq-' + DENOMS[0].key);
      if (first) first.focus();
    }, 100);
  }

  // ── Recalcular total en vivo ──────────────────────────────
  function _recalcTotal() {
    var total = 0;
    DENOMS.forEach(function(d) {
      var inp = document.getElementById('arq-' + d.key);
      var val = inp ? (parseFloat(inp.value) || 0) : 0;
      total += val * d.valor;
    });
    total = Math.round(total * 100) / 100;
    var el = document.getElementById('arqueo-total-display');
    if (el) el.textContent = fmt(total);
  }

  // ── Enviar al backend ─────────────────────────────────────
  function _enviar(context, onComplete, esReintento) {
    var btnText   = document.getElementById('arqueo-btn-text');
    var btnLoader = document.getElementById('arqueo-btn-loader');
    var btnEnviar = document.getElementById('arqueo-btn-enviar');

    if (btnText)   btnText.classList.add('hidden');
    if (btnLoader) btnLoader.classList.remove('hidden');
    if (btnEnviar) btnEnviar.disabled = true;

    var payload = {};
    DENOMS.forEach(function(d) {
      var inp = document.getElementById('arq-' + d.key);
      payload[d.key] = parseInt(inp ? inp.value : 0) || 0;
    });

    API.arqueoRealizar(payload).then(function(res) {
      if (btnText)   btnText.classList.remove('hidden');
      if (btnLoader) btnLoader.classList.add('hidden');
      if (btnEnviar) btnEnviar.disabled = false;

      if (!res.ok) {
        _showError(res.message || 'Error al realizar el arqueo.');
        return;
      }
      _showResultado(res.resultado, res.totalFisico, context, onComplete, esReintento);
    }).catch(function() {
      if (btnText)   btnText.classList.remove('hidden');
      if (btnLoader) btnLoader.classList.add('hidden');
      if (btnEnviar) btnEnviar.disabled = false;
      _showError('Error de conexión. Intenta de nuevo.');
    });
  }

  // ── Mostrar resultado ─────────────────────────────────────
  function _showResultado(resultado, totalFisico, context, onComplete, esReintento) {
    var resultArea = document.getElementById('arqueo-result-area');
    var footer     = document.getElementById('arqueo-footer');

    var configs = {
      CORRECTO: { cls: 'correcto', icon: '✅', title: '¡ARQUEO CORRECTO!',    msg: 'El efectivo físico coincide con el sistema (' + fmt(totalFisico) + ').' },
      SOBRANTE: { cls: 'sobrante', icon: '⚠️', title: 'SOBRANTE detectado',   msg: 'Tu conteo (' + fmt(totalFisico) + ') es mayor al saldo del sistema.' },
      FALTANTE: { cls: 'faltante', icon: '❌', title: 'FALTANTE detectado',   msg: 'Tu conteo (' + fmt(totalFisico) + ') es menor al saldo del sistema.' },
    };
    var cfg = configs[resultado] || configs.FALTANTE;

    if (resultArea) {
      resultArea.innerHTML =
        '<div class="arqueo-result ' + cfg.cls + '">' +
          '<div class="arqueo-result-icon">' + cfg.icon + '</div>' +
          '<div class="arqueo-result-text">' +
            '<h3>' + cfg.title + '</h3>' +
            '<p>' + cfg.msg + '</p>' +
          '</div>' +
        '</div>';
    }

    if (resultado === 'CORRECTO') {
      _arqueoHechoEnSesion = true;
      updateArqueoBtn();

      var continuarLabel = (context === 'logout') ? '⏻ Cerrar Sesión ahora' : '✓ Continuar';
      if (footer) {
        footer.innerHTML = '<button class="btn btn-success btn-lg" id="arqueo-btn-ok">' + continuarLabel + '</button>';
        document.getElementById('arqueo-btn-ok').addEventListener('click', function() {
          _removeOverlay();
          onComplete('CORRECTO');
        });
      }

    } else {
      // No coincide
      if (!esReintento) {
        // Primera vez: ofrecer reintento
        var forzarLabel = (context === 'logout') ? 'Cerrar Sesión de todas formas' : 'Continuar de todas formas';
        var forzarBtn   = (context === 'login' || context === 'logout')
          ? '<button class="btn btn-warning" id="arqueo-btn-forzar">' + forzarLabel + '</button>'
          : '<button class="btn btn-danger btn-sm" id="arqueo-btn-cerrar-inc">Cerrar</button>';

        if (footer) {
          footer.innerHTML =
            '<button class="btn btn-ghost btn-sm" id="arqueo-btn-reintentar">🔄 Volver a contar</button>' +
            forzarBtn;
        }

        // Reintento: limpiar campos
        var btnReintentar = document.getElementById('arqueo-btn-reintentar');
        if (btnReintentar) {
          btnReintentar.addEventListener('click', function() {
            DENOMS.forEach(function(d) {
              var inp = document.getElementById('arq-' + d.key);
              if (inp) inp.value = 0;
            });
            _recalcTotal();
            if (resultArea) resultArea.innerHTML = '';

            var cancelBtn2 = (context !== 'login' && context !== 'logout')
              ? '<button class="btn btn-ghost btn-sm" id="arqueo-btn-cancelar2">Cancelar</button>'
              : '';
            if (footer) {
              footer.innerHTML =
                cancelBtn2 +
                '<button class="btn btn-primary" id="arqueo-btn-enviar">' +
                  '<span id="arqueo-btn-text">Confirmar Arqueo</span>' +
                  '<span id="arqueo-btn-loader" class="hidden">Verificando\u2026</span>' +
                '</button>';
              var c2 = document.getElementById('arqueo-btn-cancelar2');
              if (c2) c2.addEventListener('click', function() { _removeOverlay(); onComplete(null); });
              document.getElementById('arqueo-btn-enviar')
                .addEventListener('click', function() { _enviar(context, onComplete, true); });
            }
            setTimeout(function() {
              var first = document.getElementById('arq-' + DENOMS[0].key);
              if (first) first.focus();
            }, 50);
          });
        }

        // Forzar acceso
        var btnForzar = document.getElementById('arqueo-btn-forzar');
        if (btnForzar) {
          btnForzar.addEventListener('click', function() {
            _removeOverlay();
            toast('⚠️ Arqueo ' + resultado + ': diferencia registrada. Notifica a tu supervisor.', 'warning', 6000);
            onComplete(resultado);
          });
        }

        // Cerrar espontáneo con diferencia
        var btnCerrarInc = document.getElementById('arqueo-btn-cerrar-inc');
        if (btnCerrarInc) {
          btnCerrarInc.addEventListener('click', function() {
            _removeOverlay();
            toast('⚠️ Arqueo con ' + resultado + '. Notifica a tu supervisor.', 'warning', 5000);
            onComplete(resultado);
          });
        }

      } else {
        // Segundo intento también falló
        var forzarLabel2 = (context === 'logout') ? '⏻ Cerrar Sesión de todas formas' : 'Continuar de todas formas';
        if (footer) {
          footer.innerHTML = '<button class="btn btn-warning" id="arqueo-btn-forzar2">' + forzarLabel2 + '</button>';
          document.getElementById('arqueo-btn-forzar2').addEventListener('click', function() {
            _removeOverlay();
            toast('⚠️ Arqueo con ' + resultado + ' (2do intento). Notifica a tu supervisor.', 'warning', 6000);
            onComplete(resultado);
          });
        }
      }
    }
  }

  // ── Error inline ──────────────────────────────────────────
  function _showError(msg) {
    var area = document.getElementById('arqueo-result-area');
    if (area) area.innerHTML = '<div class="alert alert-danger" style="margin-bottom:12px">⚠️ ' + msg + '</div>';
  }

  // ── Remover overlay ───────────────────────────────────────
  function _removeOverlay() {
    var old = document.getElementById('arqueo-overlay');
    if (old) old.remove();
  }

  // ── Actualizar botón de arqueo en sidebar ─────────────────
  function updateArqueoBtn() {
    var btn = document.getElementById('btn-arqueo-sidebar');
    if (!btn) return;
    if (_arqueoHechoEnSesion) {
      btn.className = 'btn-arqueo arqueo-done';
      btn.innerHTML = '✓&nbsp; Arqueo hecho · Cerrar Sesión';
    } else {
      btn.className = 'btn-arqueo';
      btn.innerHTML = '🏦&nbsp; Arqueo de Caja';
    }
  }

  // ── Resetear estado al iniciar sesión nueva ───────────────
  function resetSesion() {
    _arqueoHechoEnSesion = false;
  }

  return { open: open, updateArqueoBtn: updateArqueoBtn, resetSesion: resetSesion };

})();
