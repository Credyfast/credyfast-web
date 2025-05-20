import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send({ mensaje: 'Método no permitido' });
  }

  const {
    marca, modelo, precio_compra,
    precio_venta, color, almacenamiento, ram
  } = req.body;

  try {
    const connection = await mysql.createConnection({
      host: 'credyfastdb.chok4o2koiff.us-east-2.rds.amazonaws.com',
      user: 'admin',
      password: process.env.DB_PASSWORD, // ⚠️ Veremos cómo agregar esto
      database: 'Credyfast',
    });

    await connection.execute(
      `INSERT INTO Celulares (marca, modelo, precio_compra, precio_venta, color, almacenamiento, ram)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [marca, modelo, precio_compra, precio_venta, color, almacenamiento, ram]
    );

    await connection.end();

    res.status(200).json({ mensaje: 'Celular registrado con éxito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al registrar el celular' });
  }
}
