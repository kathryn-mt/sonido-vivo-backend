
const express = require('express');
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const productosRoutes = require('./routes/productos.routes');


const app = express();
const PORT = 3000;

// CONFIGURACIÓN DEL SERVIDOR //


app.use(express.json());


// RUTAS DE AUTENTICACIÓN - NOEMÍ //
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/usuarios', usuariosRoutes);


// RUTAS DE PRODUCTOS - KATY
app.use('/api/v1/productos', productosRoutes);


// RUTA DE SALUDO //

app.get('/api/saludo', (req, res) => {
    return res.status(200).json({
        mensaje: 'Hola desde el backend de Sonido Vivo',
        servicio: 'Amazon EC2 con Node.js y Express'
    });
});


// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(
        `Servidor de Sonido Vivo funcionando en el puerto ${PORT}`
    );
});
