const mysql = require('mysql2');

// Configuración de la conexión a la base de datos
const connection = mysql.createConnection({
  host: 'credyfastdb.chok4o2koiff.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Credyfast2025.',
  database: 'credyfastdb',
  port: 3306,
});

connection.connect((err) => {
  if (err) {
    console.error('Error al conectar a la base de datos: ', err);
    return;
  }
  console.log('Conexión exitosa a la base de datos.');
});

module.exports = connection;
