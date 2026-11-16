
const jwt = require('jsonwebtoken');

// ==========================================
// VERIFICAR TOKEN JWT
// ==========================================

function verificarToken(req, res, next) {
    const authorizationHeader = req.headers.authorization;

    if (typeof authorizationHeader !== 'string') {
        return res.status(401).json({
            mensaje: 'Debes proporcionar un token de autenticación'
        });
    }

    const partesToken = authorizationHeader.split(' ');

    if (
        partesToken.length !== 2 ||
        partesToken[0] !== 'Bearer' ||
        !partesToken[1]
    ) {
        return res.status(401).json({
            mensaje: 'Formato de token inválido'
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET no está configurada');

        return res.status(500).json({
            mensaje: 'Error de configuración del servidor'
        });
    }

    try {
        const datosToken = jwt.verify(
            partesToken[1],
            process.env.JWT_SECRET
        );

        req.usuario = {
            id: datosToken.sub,
            rol: datosToken.rol
        };

        return next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                mensaje: 'El token ha expirado'
            });
        }

        return res.status(401).json({
            mensaje: 'Token inválido'
        });
    }
}

// ==========================================
// VERIFICAR ROL DEL USUARIO
// ==========================================

function verificarRol(rolesPermitidos) {
    return function(req, res, next) {

        if (!req.usuario) {
            return res.status(401).json({
                mensaje: 'Debes autenticarte primero'
            });
        }

        if (
            !Array.isArray(rolesPermitidos) ||
            !rolesPermitidos.includes(req.usuario.rol)
        ) {
            return res.status(403).json({
                mensaje: 'No tienes permisos para acceder a este recurso'
            });
        }

        return next();
    };
}

// ==========================================
// EXPORTAR MIDDLEWARES
// ==========================================

module.exports = {
    verificarToken: verificarToken,
    verificarRol: verificarRol
};
