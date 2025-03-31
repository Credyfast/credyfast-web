document.getElementById('login-form').addEventListener('submit', function (e) {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  // Ejemplo de usuarios (esto se debe conectar con tu base de datos en un futuro)
  const users = [
    { username: 'admin', password: 'adminpass', role: 'superadmin' },
    { username: 'vendedor', password: 'vendedorpass', role: 'vendedor' },
    { username: 'cobrador', password: 'cobradorpass', role: 'cobrador' }
  ];

  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    // Mostrar dashboard
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('dashboard-container').style.display = 'block';

    // Mostrar el rol del usuario
    document.getElementById('user-role').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);

    // Configurar acceso al menú según el rol
    setupMenu(user.role);
  } else {
    alert('Usuario o contraseña incorrectos');
  }
});

// Configuración de los botones según el rol
function setupMenu(role) {
  const btnCelulares = document.getElementById('btn-celulares');
  const btnClientes = document.getElementById('btn-clientes');
  const btnPagos = document.getElementById('btn-pagos');
  const btnMorosidad = document.getElementById('btn-morosidad');

  if (role === 'superadmin') {
    btnCelulares.style.display = 'block';
    btnClientes.style.display = 'block';
    btnPagos.style.display = 'block';
    btnMorosidad.style.display = 'block';
  } else if (role === 'vendedor') {
    btnCelulares.style.display = 'none';
    btnClientes.style.display = 'block';
    btnPagos.style.display = 'block';
    btnMorosidad.style.display = 'none';
  } else if (role === 'cobrador') {
    btnCelulares.style.display = 'none';
    btnClientes.style.display = 'none';
    btnPagos.style.display = 'block';
    btnMorosidad.style.display = 'block';
  }
}
