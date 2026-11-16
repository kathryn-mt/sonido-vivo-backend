
const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// ==========================================
// REGISTRO DE USUARIOS
// ==========================================

router.post(
    '/registro',
    authController.registrarUsuario
);

// ==========================================
// INICIO DE SESIÓN
// ==========================================

router.post(
    '/login',
    authController.iniciarSesion
);

// ==========================================
// CONSULTAR PERFIL
// ==========================================

router.get(
    '/perfil',
    authMiddleware.verificarToken,
    (req, res) => {
        return res.status(200).json({
            mensaje: 'Acceso autorizado',
            usuario: {
                id: req.usuario.id,
                rol: req.usuario.rol
            }
        });
    }
);

// ==========================================
// ACCESO ADMINISTRADOR
// ==========================================

router.get(
    '/administracion',
    authMiddleware.verificarToken,
    authMiddleware.verificarRol(['ADMINISTRADOR']),
    (req, res) => {
        return res.status(200).json({
            mensaje: 'Bienvenido al panel de administración',
            usuario: req.usuario
        });
    }
);

// ==========================================
// EXPORTAR RUTAS
// ==========================================

module.exports = router;

