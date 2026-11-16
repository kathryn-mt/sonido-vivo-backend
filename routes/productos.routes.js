const express = require('express');
const router = express.Router();

// Importar las funciones del controlador
const productosController = require('../controllers/productos.controller');

const authMiddleware = require('../middlewares/auth.middleware');
// LISTAR TODOS LOS PRODUCTOS//


router.get(
    '/',
    productosController.listarProductos
);


// CONSULTAR PRODUCTO POR ID//

router.get(
    '/:id',
    productosController.obtenerProductoPorId
);

// REGISTRAR PRODUCTO - KATY //


router.post(
    '/',
    authMiddleware.verificarToken,
    authMiddleware.verificarRol(['VENDEDOR', 'ADMINISTRADOR']),
    productosController.registrarProducto
);

// MODIFICAR PRODUCTO - KATY //


router.put(
    '/:id',
    authMiddleware.verificarToken,
    authMiddleware.verificarRol(['VENDEDOR', 'ADMINISTRADOR']),
    productosController.modificarProducto
);
router.delete(
    '/:id',
    authMiddleware.verificarToken,
    authMiddleware.verificarRol(['ADMINISTRADOR']),
    productosController.eliminarProducto
);
// EXPORTAR RUTAS//

module.exports = router;