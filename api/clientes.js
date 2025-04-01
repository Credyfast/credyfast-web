const connection = require('./db'); // Importa la conexión a la base de datos

module.exports = (req, res) => {
  // Hacemos una consulta para obtener los clientes
  connection.query('SELECT * FROM Clientes', (err, results) => {
    if (err) {
      console.error('Error al obtener los clientes: ', err);
      res.status(500).send('Error al obtener los clientes');
      return;
    }
    res.status(200).json(results); // Devuelve los resultados como JSON
  });
};
