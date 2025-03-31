const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(express.json()); // Para recibir JSON
app.use(cors()); // Para permitir peticiones desde el frontend

// Configurar conexión con MySQL en AWS
const db = mysql.createConnection({
    host: "tu-host-en-aws",  
    user: "tu-usuario",  
    password: "tu-contraseña",  
    database: "credyfast"
});

db.connect(err => {
    if (err) {
        console.error("Error al conectar a MySQL:", err);
    } else {
        console.log("Conectado a MySQL en AWS");
    }
});

// Ruta para registrar clientes
app.post("/clientes", (req, res) => {
    const { nombre, telefono, direccion, referencia1, telefono_ref1, referencia2, telefono_ref2 } = req.body;
    const query = "INSERT INTO Clientes (nombre, telefono, direccion, referencia1, telefono_ref1, referencia2, telefono_ref2) VALUES (?, ?, ?, ?, ?, ?, ?)";
    
    db.query(query, [nombre, telefono, direccion, referencia1, telefono_ref1, referencia2, telefono_ref2], (err, result) => {
        if (err) {
            console.error("Error al insertar cliente:", err);
            res.status(500).send("Error en el servidor");
        } else {
            res.status(201).send("Cliente registrado");
        }
    });
});

// Iniciar el servidor en el puerto 3000
app.listen(3000, () => {
    console.log("Servidor corriendo en http://localhost:3000");
});
