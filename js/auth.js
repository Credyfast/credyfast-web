/* ============================================================
   CredyFast — auth.js  |  Autenticación y sesión
   ============================================================ */

const Auth = (() => {

  // ── SHA-256 (funciona en HTTPS y en file://) ───────────────
  async function sha256(text) {
    // crypto.subtle solo está disponible en contextos seguros (https / localhost).
    // Si está disponible, úsalo (más rápido y nativo).
    if (window.crypto && window.crypto.subtle) {
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback puro en JS para file:// u otros contextos no-seguros
    return _sha256Fallback(text);
  }

  // ── SHA-256 puro en JavaScript (RFC 6234) ─────────────────
  function _sha256Fallback(str) {
    function rightRotate(v, a) { return (v >>> a) | (v << (32 - a)); }
    const K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
    ];
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const msg = unescape(encodeURIComponent(str));
    const bytes = Array.from(msg).map(c => c.charCodeAt(0));
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const bitLen = (str.length * 8);
    for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(256, i)) & 0xff);
    for (let c = 0; c < bytes.length; c += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) {
        w[i] = (bytes[c+i*4]<<24)|(bytes[c+i*4+1]<<16)|(bytes[c+i*4+2]<<8)|bytes[c+i*4+3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rightRotate(w[i-15],7)^rightRotate(w[i-15],18)^(w[i-15]>>>3);
        const s1 = rightRotate(w[i-2],17)^rightRotate(w[i-2],19)^(w[i-2]>>>10);
        w[i] = (w[i-16]+s0+w[i-7]+s1) >>> 0;
      }
      let [a,b,c2,d,e,f,g,hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25);
        const ch = (e&f)^(~e&g);
        const temp1 = (hh+S1+ch+K[i]+w[i]) >>> 0;
        const S0 = rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22);
        const maj = (a&b)^(a&c2)^(b&c2);
        const temp2 = (S0+maj) >>> 0;
        hh=g; g=f; f=e; e=(d+temp1)>>>0; d=c2; c2=b; b=a; a=(temp1+temp2)>>>0;
      }
      h = [(h[0]+a)>>>0,(h[1]+b)>>>0,(h[2]+c2)>>>0,(h[3]+d)>>>0,
           (h[4]+e)>>>0,(h[5]+f)>>>0,(h[6]+g)>>>0,(h[7]+hh)>>>0];
    }
    return h.map(v => v.toString(16).padStart(8,'0')).join('');
  }

  // ── Login ──────────────────────────────────────────────────
  async function login(username, password) {
    const passwordHash = await sha256(password);
    // ── DEBUG TEMPORAL (borrar después de solucionar) ──
    console.log('🔑 LOGIN DEBUG:');
    console.log('  username:', username);
    console.log('  passwordHash:', passwordHash);
    // ──────────────────────────────────────────────────
    const res = await API.login({ username, passwordHash });
    // ── DEBUG TEMPORAL ──
    console.log('  respuesta backend:', JSON.stringify(res));
    // ───────────────────
    if (res.ok) {
      State.saveSession(res.token, res.user);
      return { ok: true, user: res.user };
    }
    return { ok: false, message: res.message || 'Credenciales incorrectas.' };
  }

  // ── Logout ─────────────────────────────────────────────────
  async function logout(callBackend = true) {
    if (callBackend) {
      try { await API.logout(); } catch(_) {}
    }
    State.clearSession();
    window.location.hash = '#/login';
    _showLoginScreen();
  }

  // ── Check sesión al arrancar ───────────────────────────────
  function checkSession() {
    return State.loadSession();
  }

  // ── Mostrar / ocultar pantallas ───────────────────────────
  function _showLoginScreen() {
    const loginEl = $('login-screen');
    const appEl   = $('app-shell');
    if (loginEl) loginEl.classList.remove('hidden');
    if (appEl)   appEl.classList.add('hidden');
  }

  function showApp() {
    const loginEl = $('login-screen');
    const appEl   = $('app-shell');
    if (loginEl) loginEl.classList.add('hidden');
    if (appEl)   appEl.classList.remove('hidden');
  }

  // ── Inicializar form de login ──────────────────────────────
  function initLoginForm() {
    const form    = $('login-form');
    const errBox  = $('login-error');
    const btnText = $('login-btn-text');
    const btnLoad = $('login-btn-loader');
    const btn     = $('login-btn');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const username = $('login-username').value.trim();
      const password = $('login-password').value;

      if (!username || !password) {
        errBox.textContent = 'Ingresa usuario y contraseña.';
        errBox.classList.remove('hidden');
        return;
      }

      btn.disabled = true;
      btnText.classList.add('hidden');
      btnLoad.classList.remove('hidden');
      errBox.classList.add('hidden');

      try {
        const res = await login(username, password);
        if (res.ok) {
          showApp();
          Router.navigate('#/dashboard');
          Router.buildNav(res.user);
          _fillUserInfo(res.user);
        } else {
          errBox.textContent = res.message;
          errBox.classList.remove('hidden');
          $('login-password').value = '';
          $('login-password').focus();
        }
      } catch(err) {
        errBox.textContent = 'Error de conexión. Verifica tu red.';
        errBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoad.classList.add('hidden');
      }
    });
  }

  function _fillUserInfo(user) {
    setHTML('sidebar-username', user.nombre || user.username);
    setHTML('sidebar-role', user.rol || '');
    const roleEl = $('sidebar-role');
    if (roleEl) roleEl.className = 'sidebar-role-badge';
  }

  return { login, logout, checkSession, initLoginForm, showApp, _fillUserInfo, sha256 };
})();
