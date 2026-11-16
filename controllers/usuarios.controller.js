
const pool = require('../db');

// ==========================================
// ROLES PERMITIDOS
// ==========================================

const ROLES_PERMITIDOS = [
    'ADMINISTRADOR',
    'VENDEDOR',
    'CLIENTE'
];

// ==========================================
// LISTAR USUARIOS
// SOLO ADMINISTRADOR
// ==========================================

async function listarUsuarios(req, res) {
    try {
        const resultado = await pool.query(
            `SELECT
                id,
                nombre,
                apellido,
                email,
                rol,
                activo,
                creado_en,
                actualizado_en
             FROM usuarios
             ORDER BY id`
        );

        return res.status(200).json({
            mensaje: 'Usuarios consultados correctamente',
            total: resultado.rows.length,
            usuarios: resultado.rows
        });

    } catch (error) {
        console.error(
            'Error al listar usuarios:',
            error.message
        );

        return res.status(500).json({
            mensaje: 'No fue posible consultar los usuarios'
        });
    }
}

// ==========================================
// CONSULTAR USUARIO POR ID
// ADMINISTRADOR O PROPIETARIO
// ==========================================

async function obtenerUsuarioPorId(req, res) {
    const idUsuario = req.params.id;

    if (!/^[1-9][0-9]*$/.test(idUsuario)) {
        return res.status(400).json({
            mensaje: 'El ID del usuario no es válido'
        });
    }

    const esAdministrador =
        req.usuario.rol === 'ADMINISTRADOR';

    const esPropietario =
        String(req.usuario.id) === String(idUsuario);

    if (!esAdministrador && !esPropietario) {
        return res.status(403).json({
            mensaje: 'No tienes permiso para consultar este usuario'
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT
                id,
                nombre,
                apellido,
                email,
                rol,
                activo,
                creado_en,
                actualizado_en
             FROM usuarios
             WHERE id = $1`,
            [idUsuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado'
            });
        }

        return res.status(200).json({
            mensaje: 'Usuario consultado correctamente',
            usuario: resultado.rows[0]
        });

    } catch (error) {
        console.error(
            'Error al consultar usuario:',
            error.message
        );

        return res.status(500).json({
            mensaje: 'No fue posible consultar el usuario'
        });
    }
}

// ==========================================
// MODIFICAR USUARIO
// ADMINISTRADOR O PROPIETARIO
// ==========================================

async function actualizarUsuario(req, res) {
    const idUsuario = req.params.id;
    const datosUsuario = req.body || {};

    if (!/^[1-9][0-9]*$/.test(idUsuario)) {
        return res.status(400).json({
            mensaje: 'El ID del usuario no es válido'
        });
    }

    const esAdministrador =
        req.usuario.rol === 'ADMINISTRADOR';

    const esPropietario =
        String(req.usuario.id) === String(idUsuario);

    if (!esAdministrador && !esPropietario) {
        return res.status(403).json({
            mensaje: 'No tienes permiso para modificar este usuario'
        });
    }

    const nombre = datosUsuario.nombre;
    const apellido = datosUsuario.apellido;
    const email = datosUsuario.email;

    if (
        typeof nombre !== 'string' ||
        typeof apellido !== 'string' ||
        typeof email !== 'string'
    ) {
        return res.status(400).json({
            mensaje: 'Debes ingresar nombre, apellido y correo válidos'
        });
    }

    if (
        !nombre.trim() ||
        !apellido.trim() ||
        !email.trim() ||
        nombre.trim().length > 100 ||
        apellido.trim().length > 100 ||
        email.trim().length > 255
    ) {
        return res.status(400).json({
            mensaje: 'Los datos ingresados no son válidos'
        });
    }

    const correo = email.trim().toLowerCase();

    const correoValido =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

    if (!correoValido) {
        return res.status(400).json({
            mensaje: 'El correo electrónico no es válido'
        });
    }

    if (
        datosUsuario.rol !== undefined &&
        !esAdministrador
    ) {
        return res.status(403).json({
            mensaje: 'Solo un administrador puede modificar roles'
        });
    }

    if (
        datosUsuario.rol !== undefined &&
        !ROLES_PERMITIDOS.includes(datosUsuario.rol)
    ) {
        return res.status(400).json({
            mensaje: 'El rol ingresado no es válido'
        });
    }

    try {
        const consultaUsuario = await pool.query(
            `SELECT
                id,
                rol,
                activo
             FROM usuarios
             WHERE id = $1`,
            [idUsuario]
        );

        if (consultaUsuario.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado'
            });
        }

        const usuarioActual = consultaUsuario.rows[0];

        if (usuarioActual.activo === false) {
            return res.status(409).json({
                mensaje: 'No se puede modificar un usuario desactivado'
            });
        }

        const rolFinal = datosUsuario.rol !== undefined
            ? datosUsuario.rol
            : usuarioActual.rol;

        if (
            datosUsuario.rol !== undefined &&
            String(req.usuario.id) === String(idUsuario) &&
            datosUsuario.rol !== usuarioActual.rol
        ) {
            return res.status(400).json({
                mensaje: 'No puedes modificar tu propio rol'
            });
        }

        const resultado = await pool.query(
            `UPDATE usuarios
             SET nombre = $1,
                 apellido = $2,
                 email = $3,
                 rol = $4,
                 actualizado_en = CURRENT_TIMESTAMP
             WHERE id = $5
               AND activo = TRUE
             RETURNING
                id,
                nombre,
                apellido,
                email,
                rol,
                activo,
                creado_en,
                actualizado_en`,
            [
                nombre.trim(),
                apellido.trim(),
                correo,
                rolFinal,
                idUsuario
            ]
        );

        if (resultado.rows.length === 0) {
            return res.status(409).json({
                mensaje: 'No fue posible actualizar el usuario'
            });
        }

        return res.status(200).json({
            mensaje: 'Usuario actualizado correctamente',
            usuario: resultado.rows[0]
        });

    } catch (error) {
        console.error(
            'Error al actualizar usuario:',
            error.message
        );

        if (error.code === '23505') {
            return res.status(409).json({
                mensaje: 'El correo electrónico ya está registrado'
            });
        }

        return res.status(500).json({
            mensaje: 'No fue posible actualizar el usuario'
        });
    }
}

// ==========================================
// DESACTIVAR USUARIO
// SOLO ADMINISTRADOR
// ==========================================

async function desactivarUsuario(req, res) {
    const idUsuario = req.params.id;

    if (!/^[1-9][0-9]*$/.test(idUsuario)) {
        return res.status(400).json({
            mensaje: 'El ID del usuario no es válido'
        });
    }

    if (String(req.usuario.id) === String(idUsuario)) {
        return res.status(400).json({
            mensaje: 'No puedes desactivar tu propia cuenta'
        });
    }

    try {
        const resultado = await pool.query(
            `UPDATE usuarios
             SET activo = FALSE,
                 actualizado_en = CURRENT_TIMESTAMP
             WHERE id = $1
               AND activo = TRUE
             RETURNING
                id,
                nombre,
                apellido,
                email,
                rol,
                activo,
                creado_en,
                actualizado_en`,
            [idUsuario]
        );

        if (resultado.rows.length === 0) {
            const consultaUsuario = await pool.query(
                `SELECT id, activo
                 FROM usuarios
                 WHERE id = $1`,
                [idUsuario]
            );

            if (consultaUsuario.rows.length === 0) {
                return res.status(404).json({
                    mensaje: 'Usuario no encontrado'
                });
            }

            return res.status(409).json({
                mensaje: 'El usuario ya se encuentra desactivado'
            });
        }

        return res.status(200).json({
            mensaje: 'Usuario desactivado correctamente',
            usuario: resultado.rows[0]
        });

    } catch (error) {
        console.error(
            'Error al desactivar usuario:',
            error.message
        );

        return res.status(500).json({
            mensaje: 'No fue posible desactivar el usuario'
        });
    }
}

// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

module.exports = {
    listarUsuarios: listarUsuarios,
    obtenerUsuarioPorId: obtenerUsuarioPorId,
    actualizarUsuario: actualizarUsuario,
    desactivarUsuario: desactivarUsuario
};
