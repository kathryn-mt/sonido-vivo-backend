
const express = require('express');
const pool = require('./db');

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/saludo', (req, res) => {
  res.status(200).json({
    mensaje: 'Hola desde el backend de Sonido Vivo',
    servicio: 'Amazon EC2 con Node.js y Express'
  });
});
app.get('/api/productos', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, precio, stock, origen, creado_en
       FROM productos
       ORDER BY id`
    );

    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar productos:', error.message);

    res.status(503).json({
      mensaje: 'No fue posible consultar los productos'
    });
  }
});


app.post('/api/productos', async (req, res) => {
  const { nombre, precio, stock } = req.body;

  if (
    typeof nombre !== 'string' ||
    !nombre.trim() ||
    typeof precio !== 'number' ||
    !Number.isFinite(precio) ||
    precio < 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    return res.status(400).json({
      mensaje: 'Debes ingresar nombre, precio y stock válidos'
    });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO productos (nombre, precio, stock, origen)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, precio, stock, origen, creado_en`,
      [nombre.trim(), precio, stock, 'EC2']
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al registrar producto:', error.message);

    res.status(503).json({
      mensaje: 'No fue posible registrar el producto'
    });
  }
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de Sonido Vivo funcionando en el puerto ${PORT}`);
});