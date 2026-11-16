
const express = require('express');
const router = express.Router();

const usuariosController = require('../controllers/usuarios.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// ==========================================
// LISTAR USUARIOS
// SOLO ADMINISTRADOR
// ==========================================

router.get(
    '/',
    authMiddleware.verificarToken,
    authMiddleware.verificarRol(['ADMINISTRADOR']),
    usuariosController.listarUsuarios
);

// ==========================================
// CONSULTAR USUARIO POR ID
// ADMINISTRADOR O PROPIETARIO
// ==========================================

router.get(
    '/:id',
    authMiddleware.verificarToken,
    usuariosController.obtenerUsuarioPorId
);

// ==========================================
// MODIFICAR USUARIO
// ADMINISTRADOR O PROPIETARIO
// ==========================================

router.put(
    '/:id',
    authMiddleware.verificarToken,
    usuariosController.actualizarUsuario
);

// ==========================================
// DESACTIVAR USUARIO
// SOLO ADMINISTRADOR
// ==========================================

router.delete(
    '/:id',
    authMiddleware.verificarToken,
    authMiddleware.verificarRol(['ADMINISTRADOR']),
    usuariosController.desactivarUsuario
);

// ==========================================
// EXPORTAR RUTAS
// ==========================================

module.exports = router;
