/* ============================================================
   CredyFast — clientes.js  |  Registro de Clientes (Fase B)
   Wizard 4 pasos: Datos → Dirección+Mapa → Fotos → Referencias
   ============================================================ */

const Clientes = (() => {

  // ⚙ MODO PRUEBA — cambiar a false para producción (fuerza cámara y fotos obligatorias)
  const MODO_PRUEBA = false;

  let _selectedCliente = null;
  let _wizardStep = 1;
  let _wizardData = {};
  let _lastResults = [];
  let _leafletMap  = null;
  let _leafletMarker = null;

  // ── Render principal ───────────────────────────────────────
  function render() {
    return `
    <div>
      <div class="section-header">
        <h2>Clientes</h2>
        <button class="btn btn-primary btn-sm" id="btn-nuevo-cliente">+ Nuevo Cliente</button>
      </div>

      <div class="split-layout">
        <div class="card" style="overflow:hidden">
          <div class="card-header"><h3>Buscar</h3></div>
          <div style="padding:12px;border-bottom:1px solid var(--cf-border)">
            <div class="form-row">
              <div class="form-group" style="margin-bottom:0">
                <input type="text" id="cl-search-input" placeholder="Nombre, CURP o ID…">
              </div>
              <button class="btn btn-teal btn-sm" id="cl-search-btn">Buscar</button>
            </div>
          </div>
          <div id="cl-list" style="max-height:500px;overflow-y:auto">
            <div class="empty-state"><div class="empty-icon">👥</div><p>Busca un cliente</p></div>
          </div>
        </div>

        <div id="cl-detail" class="card card-body">
          <div class="empty-state" style="padding:40px 0">
            <div class="empty-icon">📋</div>
            <p>Selecciona un cliente para ver su detalle.</p>
          </div>
        </div>
      </div>

      <!-- Modal Nuevo Cliente -->
      <div id="modal-nuevo-cliente" class="hidden" style="
        position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;
        display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:560px;max-height:92vh;overflow-y:auto">
          <div class="card-header">
            <h3>Nuevo Cliente</h3>
            <button class="btn btn-ghost btn-sm" id="modal-cl-close">✕</button>
          </div>
          <div class="card-body">
            <div class="wizard-steps">
              <div class="wizard-step active" id="step-lbl-1">1. Datos</div>
              <div class="wizard-step" id="step-lbl-2">2. Dirección</div>
              <div class="wizard-step" id="step-lbl-3">3. Fotos</div>
              <div class="wizard-step" id="step-lbl-4">4. Referencias</div>
            </div>
            <div id="wizard-content"></div>
            <div style="display:flex;gap:8px;margin-top:16px">
              <button class="btn btn-ghost" id="wizard-back" style="flex:1;display:none">← Atrás</button>
              <button class="btn btn-primary" id="wizard-next" style="flex:2">Siguiente →</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Pasos del wizard ───────────────────────────────────────
  const STEPS = {
    1: () => `
      <div class="form-row">
        <div class="form-group"><label>Nombre(s) *</label><input type="text" id="wiz-nombres" placeholder="Ej: María Guadalupe"></div>
        <div class="form-group"><label>Apellido Paterno *</label><input type="text" id="wiz-apat"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Apellido Materno</label><input type="text" id="wiz-amat"></div>
        <div class="form-group"><label>Número INE (IDMEX)</label><input type="text" id="wiz-idmex" maxlength="18"></div>
      </div>
      <div class="form-group">
        <label>CURP * (18 caracteres)</label>
        <input type="text" id="wiz-curp" maxlength="18" placeholder="XXXX######XXXXXX##" style="text-transform:uppercase">
        <div id="curp-auto-info" class="text-sm text-muted" style="margin-top:4px"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>A qué se dedica</label><input type="text" id="wiz-ocup"></div>
        <div class="form-group"><label>Ingreso semanal ($)</label><input type="number" id="wiz-ingreso" min="0" step="0.01"></div>
      </div>
      <div class="form-group"><label>Gastos semanales ($)</label><input type="number" id="wiz-gastos" min="0" step="0.01"></div>`,

    2: () => `
      <div class="form-group">
        <label>Dirección completa *</label>
        <input type="text" id="wiz-direccion" placeholder="Calle, número, colonia, ciudad…">
      </div>
      <div class="form-group">
        <label>Ubicación GPS — haz clic en el mapa para marcar la posición exacta</label>
        <div id="leaflet-map"></div>
        <div class="map-coords-display" id="map-coords-txt">Sin coordenadas — haz clic en el mapa</div>
        <button class="btn btn-outline btn-sm" id="btn-mi-ubicacion" type="button">📍 Usar mi ubicación</button>
      </div>`,

    3: () => `
      <div class="alert ${MODO_PRUEBA ? 'alert-info' : 'alert-warning'}" style="margin-bottom:14px">
        ${MODO_PRUEBA
          ? '🧪 <strong>Modo prueba:</strong> Puedes subir cualquier imagen desde galería. Las fotos no son obligatorias.'
          : '⚠ Las 3 fotos son <strong>obligatorias</strong>. Deben tomarse con la cámara (no galería).'}
      </div>
      <div class="foto-grid">
        ${_fotoBox('ine-frente', '🪪', 'INE Frente')}
        ${_fotoBox('ine-reverso', '🪪', 'INE Reverso')}
        ${_fotoBox('comprobante', '📄', 'Comprobante Domicilio')}
      </div>
      <input type="file" id="file-ine-frente"   accept="image/*" ${MODO_PRUEBA ? '' : 'capture="environment"'} class="hidden">
      <input type="file" id="file-ine-reverso"  accept="image/*" ${MODO_PRUEBA ? '' : 'capture="environment"'} class="hidden">
      <input type="file" id="file-comprobante"  accept="image/*" ${MODO_PRUEBA ? '' : 'capture="environment"'} class="hidden">
      <div id="fotos-upload-status" style="font-size:.82rem;margin-top:8px"></div>`,

    4: () => `
      <div class="form-row">
        <div class="form-group"><label>Referencia 1 — Nombre *</label><input type="text" id="wiz-ref1n"></div>
        <div class="form-group"><label>Teléfono Ref. 1 *</label><input type="tel" id="wiz-ref1t"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Referencia 2 — Nombre</label><input type="text" id="wiz-ref2n"></div>
        <div class="form-group"><label>Teléfono Ref. 2</label><input type="tel" id="wiz-ref2t"></div>
      </div>`,
  };

  function _fotoBox(id, icon, label) {
    return `
      <div class="foto-capture-box" id="box-${id}" onclick="document.getElementById('file-${id}').click()">
        <span class="foto-icon">${icon}</span>
        <div class="foto-label">${label}</div>
        <div class="foto-req">OBLIGATORIO</div>
        <div class="foto-ok hidden" id="ok-${id}">✔ Subida</div>
        <img class="foto-preview" id="prev-${id}" alt="${label}">
      </div>`;
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    _selectedCliente = null;
    on('cl-search-input', 'keydown', e => { if (e.key === 'Enter') _search(); });
    on('cl-search-btn',   'click',   _search);
    on('btn-nuevo-cliente', 'click', _openWizard);
    on('modal-cl-close',    'click', _closeWizard);
    on('wizard-next',       'click', _wizardNext);
    on('wizard-back',       'click', _wizardBack);
  }

  // ── Búsqueda ───────────────────────────────────────────────
  async function _search() {
    const q = $('cl-search-input')?.value.trim();
    if (!q) return;
    showLoading(true);
    try {
      const res = await API.clientSearch({ query: q });
      if (!res.ok) { toast(res.message, 'error'); return; }
      _lastResults = res.data || [];
      _renderList(_lastResults);
    } catch(_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  function _renderList(clientes) {
    const list = $('cl-list');
    if (!list) return;
    if (!clientes.length) {
      list.innerHTML = '<div class="table-empty">No se encontraron clientes.</div>';
      return;
    }
    list.innerHTML = clientes.map(cl => `
      <div class="list-item" data-id="${cl['IDCliente']}">
        <div class="list-item-title">${cl['Nombre_completo'] || cl['IDCliente']}</div>
        <div class="list-item-sub">${cl['IDCliente']} · CURP: ${cl['CURP'] || '—'}</div>
      </div>
    `).join('');
    list.querySelectorAll('.list-item').forEach(el => {
      el.addEventListener('click', () => {
        list.querySelectorAll('.list-item').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        const cl = _lastResults.find(c => c['IDCliente'] === el.dataset.id);
        if (cl) { _selectedCliente = cl; _renderDetail(cl); }
      });
    });
  }

  function _renderDetail(cl) {
    const fotosOk = cl['INE_Frente_ID'] && cl['INE_Reverso_ID'] && cl['Comprobante_ID'];
    setHTML('cl-detail', `
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px">${cl['Nombre_completo']}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <span class="badge badge-info">${cl['IDCliente']}</span>
        <span class="badge ${fotosOk ? 'badge-success' : 'badge-danger'}">${fotosOk ? '📎 Docs OK' : '⚠ Docs pendientes'}</span>
        ${cl['Sexo'] ? `<span class="badge badge-muted">${cl['Sexo']}</span>` : ''}
      </div>
      <hr class="divider">
      <div class="grid-2" style="gap:10px;font-size:.85rem;margin-bottom:14px">
        <div><div class="text-muted text-sm">CURP</div><div class="fw-600 td-mono" style="word-break:break-all">${cl['CURP'] || '—'}</div></div>
        <div><div class="text-muted text-sm">INE (IDMEX)</div><div>${cl['IDMEX'] || '—'}</div></div>
        <div><div class="text-muted text-sm">Fecha nacimiento</div><div>${cl['Fecha_de_nacimiento'] || '—'}</div></div>
        <div><div class="text-muted text-sm">Edad</div><div>${cl['Edad'] || '—'} años</div></div>
        <div style="grid-column:1/-1"><div class="text-muted text-sm">Dirección</div><div>${cl['Direccion'] || '—'}</div></div>
        <div><div class="text-muted text-sm">Ocupación</div><div>${cl['A_que_se_dedica'] || '—'}</div></div>
        <div><div class="text-muted text-sm">Ingreso semanal</div><div>${fmt.currency(cl['Ingreso_semanal'])}</div></div>
        <div><div class="text-muted text-sm">Registrado</div><div>${fmt.date(cl['Marca_temporal'])}</div></div>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-solicitar-cl">+ Solicitar Crédito</button>
    `);
    on('btn-solicitar-cl', 'click', () => {
      Router.navigate('#/creditos');
      setTimeout(() => { if (Creditos.initRequestFor) Creditos.initRequestFor(cl); }, 150);
    });
  }

  // ── Wizard ─────────────────────────────────────────────────
  function _openWizard() {
    _wizardStep = 1; _wizardData = {};
    const modal = $('modal-nuevo-cliente');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    _renderStep();
  }

  function _closeWizard() {
    $('modal-nuevo-cliente').classList.add('hidden');
    if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; _leafletMarker = null; }
  }

  function _renderStep() {
    setHTML('wizard-content', STEPS[_wizardStep]());
    for (let i = 1; i <= 4; i++) {
      const el = $(`step-lbl-${i}`);
      if (el) el.className = 'wizard-step' +
        (_wizardStep === i ? ' active' : '') + (_wizardStep > i ? ' done' : '');
    }
    const back = $('wizard-back'), next = $('wizard-next');
    if (back) back.style.display = _wizardStep === 1 ? 'none' : '';
    if (next) next.textContent = _wizardStep < 4 ? 'Siguiente →' : '✔ Crear Cliente';

    if (_wizardStep === 1) _initStep1();
    if (_wizardStep === 2) _initLeaflet();
    if (_wizardStep === 3) _initFotos();
    _prefill();
  }

  function _initStep1() {
    const curpInput = $('wiz-curp');
    if (curpInput) {
      curpInput.addEventListener('input', () => {
        const curp = curpInput.value.toUpperCase();
        curpInput.value = curp;
        const info = $('curp-auto-info');
        if (curp.length === 18) {
          const fn = _fechaFromCURP(curp);
          const sx = _sexoFromCURP(curp);
          if (fn) {
            info.innerHTML = `<span style="color:var(--cf-accent)">✔ FN: ${fn} · ${sx}</span>`;
            _wizardData.fechaNac = fn;
            _wizardData.sexo     = sx;
          } else {
            info.innerHTML = '<span style="color:var(--cf-danger)">CURP inválida</span>';
          }
        } else {
          info.textContent = `${curp.length}/18 caracteres`;
        }
      });
    }
  }

  function _initLeaflet() {
    setTimeout(() => {
      if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
      const mapEl = document.getElementById('leaflet-map');
      if (!mapEl || typeof L === 'undefined') return;

      // Centro default: CDMX
      const lat0 = parseFloat(_wizardData.lat) || 19.4326;
      const lng0 = parseFloat(_wizardData.lng) || -99.1332;

      _leafletMap = L.map('leaflet-map').setView([lat0, lng0], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
      }).addTo(_leafletMap);

      if (_wizardData.lat && _wizardData.lng) {
        _leafletMarker = L.marker([lat0, lng0]).addTo(_leafletMap);
        _updateCoordsDisplay(lat0, lng0);
      }

      _leafletMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        _wizardData.lat = lat.toFixed(6);
        _wizardData.lng = lng.toFixed(6);
        if (_leafletMarker) { _leafletMarker.setLatLng(e.latlng); }
        else { _leafletMarker = L.marker(e.latlng).addTo(_leafletMap); }
        _updateCoordsDisplay(lat, lng);
      });

      on('btn-mi-ubicacion', 'click', () => {
        if (!navigator.geolocation) { toast('Geolocalización no disponible.', 'warning'); return; }
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          _wizardData.lat = lat.toFixed(6);
          _wizardData.lng = lng.toFixed(6);
          _leafletMap.setView([lat, lng], 17);
          if (_leafletMarker) { _leafletMarker.setLatLng([lat, lng]); }
          else { _leafletMarker = L.marker([lat, lng]).addTo(_leafletMap); }
          _updateCoordsDisplay(lat, lng);
        }, () => toast('No se pudo obtener la ubicación.', 'warning'));
      });
    }, 50);
  }

  function _updateCoordsDisplay(lat, lng) {
    const el = $('map-coords-txt');
    if (el) el.textContent = `Lat: ${parseFloat(lat).toFixed(6)}, Lng: ${parseFloat(lng).toFixed(6)}`;
  }

  function _initFotos() {
    ['ine-frente', 'ine-reverso', 'comprobante'].forEach(id => {
      const input = $(`file-${id}`);
      if (!input) return;
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        const box = $(`box-${id}`);
        if (box) box.classList.add('uploaded');
        // Preview local
        const reader = new FileReader();
        reader.onload = (e) => {
          const prev = $(`prev-${id}`);
          if (prev) { prev.src = e.target.result; prev.classList.add('visible'); }
        };
        reader.readAsDataURL(file);
        // Comprimir y subir
        setHTML('fotos-upload-status', `⏳ Subiendo ${id}…`);
        try {
          const base64 = await _compressAndEncode(file);
          const res = await API.fileUpload({ base64, filename: `${id}_${Date.now()}.jpg`, folder: 'clientes' });
          if (res.ok) {
            const keyMap = { 'ine-frente': 'INE_Frente_ID', 'ine-reverso': 'INE_Reverso_ID', 'comprobante': 'Comprobante_ID' };
            _wizardData[keyMap[id]] = res.fileId;
            const ok = $(`ok-${id}`);
            if (ok) ok.classList.remove('hidden');
            setHTML('fotos-upload-status', `✔ ${id} subida correctamente`);
          } else {
            toast(`Error subiendo ${id}: ${res.message}`, 'error');
            setHTML('fotos-upload-status', `✖ Error en ${id}`);
          }
        } catch(_) {
          toast(`Error de conexión al subir ${id}.`, 'error');
          setHTML('fotos-upload-status', '');
        }
      });
    });
  }

  async function _compressAndEncode(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX_W = 1280;
        let w = img.width, h = img.height;
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
        resolve(dataUrl.split(',')[1]); // base64 sin prefijo
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // ── Recolectar datos del paso actual ──────────────────────
  function _collect() {
    const map = {
      1: { 'wiz-nombres':'Nombre_s','wiz-apat':'Apellido_paterno','wiz-amat':'Apellido_materno',
           'wiz-idmex':'IDMEX','wiz-curp':'CURP','wiz-ocup':'A_que_se_dedica',
           'wiz-ingreso':'Ingreso_semanal','wiz-gastos':'Gastos_semanales' },
      2: { 'wiz-direccion':'Direccion' },
      4: { 'wiz-ref1n':'Nombre_referencia_1','wiz-ref1t':'Numero_referencia_1',
           'wiz-ref2n':'Nombre_referencia_2','wiz-ref2t':'Numero_referencia_2' },
    };
    const m = map[_wizardStep] || {};
    Object.entries(m).forEach(([id, key]) => { const el=$(id); if(el) _wizardData[key]=el.value; });
    // Coordenadas del mapa (paso 2)
    if (_wizardStep === 2) {
      _wizardData.Ubicacion = (_wizardData.lat && _wizardData.lng)
        ? `${_wizardData.lat},${_wizardData.lng}` : '';
    }
    if (_wizardStep === 1 && $('wiz-curp')) {
      _wizardData.CURP = $('wiz-curp').value.toUpperCase();
    }
  }

  function _prefill() {
    const map = {
      1: { 'wiz-nombres':'Nombre_s','wiz-apat':'Apellido_paterno','wiz-amat':'Apellido_materno',
           'wiz-idmex':'IDMEX','wiz-curp':'CURP','wiz-ocup':'A_que_se_dedica',
           'wiz-ingreso':'Ingreso_semanal','wiz-gastos':'Gastos_semanales' },
      2: { 'wiz-direccion':'Direccion' },
      4: { 'wiz-ref1n':'Nombre_referencia_1','wiz-ref1t':'Numero_referencia_1',
           'wiz-ref2n':'Nombre_referencia_2','wiz-ref2t':'Numero_referencia_2' },
    };
    const m = map[_wizardStep] || {};
    Object.entries(m).forEach(([id, key]) => { const el=$(id); if(el && _wizardData[key]) el.value=_wizardData[key]; });
  }

  function _wizardBack() { _collect(); _wizardStep--; _renderStep(); }

  async function _wizardNext() {
    _collect();
    // Validaciones por paso
    if (_wizardStep === 1) {
      if (!_wizardData.Nombre_s || !_wizardData.Apellido_paterno) {
        toast('Nombre y Apellido paterno son obligatorios.', 'warning'); return;
      }
      if (!_wizardData.CURP || _wizardData.CURP.length !== 18) {
        toast('CURP debe tener exactamente 18 caracteres.', 'warning'); return;
      }
    }
    if (_wizardStep === 3 && !MODO_PRUEBA) {
      if (!_wizardData.INE_Frente_ID || !_wizardData.INE_Reverso_ID || !_wizardData.Comprobante_ID) {
        toast('Debes subir las 3 fotos obligatorias antes de continuar.', 'warning'); return;
      }
    }
    if (_wizardStep < 4) { _wizardStep++; _renderStep(); return; }

    // Paso 4 → Crear cliente
    if (!_wizardData.Nombre_referencia_1 || !_wizardData.Numero_referencia_1) {
      toast('Referencia 1 (nombre y teléfono) es obligatoria.', 'warning'); return;
    }
    showLoading(true);
    try {
      const res = await API.clientCreate({
        Nombre_s:           _wizardData.Nombre_s || '',
        Apellido_paterno:   _wizardData.Apellido_paterno || '',
        Apellido_materno:   _wizardData.Apellido_materno || '',
        IDMEX:              _wizardData.IDMEX || '',
        Direccion:          _wizardData.Direccion || '',
        Ubicacion:          _wizardData.Ubicacion || '',
        CURP:               _wizardData.CURP || '',
        A_que_se_dedica:    _wizardData.A_que_se_dedica || '',
        Ingreso_semanal:    parseFloat(_wizardData.Ingreso_semanal) || 0,
        Gastos_semanales:   parseFloat(_wizardData.Gastos_semanales) || 0,
        INE_Frente_ID:      _wizardData.INE_Frente_ID || '',
        INE_Reverso_ID:     _wizardData.INE_Reverso_ID || '',
        Comprobante_ID:     _wizardData.Comprobante_ID || '',
        // Las referencias se envían pero el backend las necesita mapeadas
        // (el backend 06_Clientes no las tiene — son del crédito, no del cliente)
        // Las guardamos en wizardData para pre-llenar el form de crédito
      });
      if (res.ok) {
        toast(`✔ Cliente ${res.id} registrado: ${res.nombreCompleto}`, 'success', 5000);
        _closeWizard();
        $('cl-search-input').value = _wizardData.Nombre_s + ' ' + _wizardData.Apellido_paterno;
        _search();
      } else {
        toast(res.message || 'Error al crear cliente.', 'error');
      }
    } catch(_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  // ── Helpers CURP ──────────────────────────────────────────
  function _fechaFromCURP(curp) {
    if (!curp || curp.length < 10) return '';
    try {
      const yy = parseInt(curp.substring(4,6), 10);
      const mm = parseInt(curp.substring(6,8), 10);
      const dd = parseInt(curp.substring(8,10), 10);
      if (mm < 1||mm > 12||dd < 1||dd > 31) return '';
      const currentYY = new Date().getFullYear() % 100;
      const yyyy = yy <= currentYY ? 2000 + yy : 1900 + yy;
      return `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${yyyy}`;
    } catch(_) { return ''; }
  }

  function _sexoFromCURP(curp) {
    if (!curp || curp.length < 11) return '';
    const c = curp.charAt(10).toUpperCase();
    return c === 'H' ? 'HOMBRE' : c === 'M' ? 'MUJER' : '';
  }

  return { render, init };
})();
