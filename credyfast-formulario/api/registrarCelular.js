import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const {
    marca_id,
    modelo,
    modelo_comercial,
    imei,
    ram,
    almacenamiento,
    color,
    precio_compra_real
  } = req.body;

  try {
    const connection = await mysql.createConnection({
      host: 'credyfastdb.chok4o2koiff.us-east-2.rds.amazonaws.com',
      user: 'admin',
      password: process.env.DB_PASSWORD,
      database: 'Credyfast'
    });

    const query = `
      INSERT INTO Celulares (
        marca_id, modelo, modelo_comercial, imei,
        ram, almacenamiento, color, precio_compra_real
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      marca_id,
      modelo,
      modelo_comercial,
      imei,
      ram,
      almacenamiento,
      color,
      precio_compra_real
    ];

    await connection.execute(query, values);
    await connection.end();

    res.status(200).json({ message: 'Celular guardado exitosamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al guardar en la base de datos' });
  }
}