
const express = require('express');
const pool = require('./db');
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();
const PORT = 3000;

// ==========================================
// CONFIGURACIÓN DEL SERVIDOR
// ==========================================

app.use(express.json());

// ==========================================
// RUTAS DE AUTENTICACIÓN - NOEMÍ
// ==========================================

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/usuarios', usuariosRoutes);

// ==========================================
// RUTA DE SALUDO
// ==========================================

app.get('/api/saludo', (req, res) => {
    return res.status(200).json({
        mensaje: 'Hola desde el backend de Sonido Vivo',
        servicio: 'Amazon EC2 con Node.js y Express'
    });
});

// ==========================================
// CONSULTAR PRODUCTOS - KATY
// ==========================================

app.get('/api/productos', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id, nombre, precio, stock, origen, creado_en
             FROM productos
             ORDER BY id`
        );

        return res.status(200).json(resultado.rows);

    } catch (error) {
        console.error(
            'Error al consultar productos:',
            error.message
        );

        return res.status(503).json({
            mensaje: 'No fue posible consultar los productos'
        });
    }
});

// ==========================================
// REGISTRAR PRODUCTOS - KATY
// ==========================================

app.post('/api/productos', async (req, res) => {
    const datosProducto = req.body || {};

    const nombre = datosProducto.nombre;
    const precio = datosProducto.precio;
    const stock = datosProducto.stock;

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
            [
                nombre.trim(),
                precio,
                stock,
                'EC2'
            ]
        );

        return res.status(201).json(resultado.rows[0]);

    } catch (error) {
        console.error(
            'Error al registrar producto:',
            error.message
        );

        return res.status(503).json({
            mensaje: 'No fue posible registrar el producto'
        });
    }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(
        `Servidor de Sonido Vivo funcionando en el puerto ${PORT}`
    );
});
