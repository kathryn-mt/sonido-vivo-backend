
const pool = require('../db');
const {
    LIMITE_NOMBRE,
    LIMITE_APELLIDO,
    LIMITE_REGION,
    LIMITE_COMUNA,
    LIMITE_DIRECCION,
    validarCorreo,
    validarRun
} = require('../utils/auth.validation');

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
                actualizado_en,
                run,
                region,
                comuna,
                direccion
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
                actualizado_en,
                run,
                region,
                comuna,
                direccion
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
                nombre,
                apellido,
                email,
                rol,
                activo,
                run,
                region,
                comuna,
                direccion
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

        const nombre = datosUsuario.nombre !== undefined
            ? datosUsuario.nombre
            : usuarioActual.nombre;
        const apellido = datosUsuario.apellido !== undefined
            ? datosUsuario.apellido
            : usuarioActual.apellido;
        const email = datosUsuario.email !== undefined
            ? datosUsuario.email
            : usuarioActual.email;
        const run = datosUsuario.run !== undefined
            ? validarRun(datosUsuario.run)
            : usuarioActual.run;
        const region = datosUsuario.region !== undefined
            ? datosUsuario.region
            : usuarioActual.region;
        const comuna = datosUsuario.comuna !== undefined
            ? datosUsuario.comuna
            : usuarioActual.comuna;
        const direccion = datosUsuario.direccion !== undefined
            ? datosUsuario.direccion
            : usuarioActual.direccion;

        if (
            typeof nombre !== 'string' ||
            typeof apellido !== 'string' ||
            typeof email !== 'string' ||
            (datosUsuario.region !== undefined && typeof region !== 'string') ||
            (datosUsuario.comuna !== undefined && typeof comuna !== 'string') ||
            (datosUsuario.direccion !== undefined && typeof direccion !== 'string') ||
            (datosUsuario.run !== undefined && !run)
        ) {
            return res.status(400).json({
                mensaje: 'Los datos ingresados no son válidos'
            });
        }

        const nombreFinal = nombre.trim();
        const apellidoFinal = apellido.trim();
        const correo = email.trim().toLowerCase();
        const regionFinal = typeof region === 'string' ? region.trim() : region;
        const comunaFinal = typeof comuna === 'string' ? comuna.trim() : comuna;
        const direccionFinal = typeof direccion === 'string'
            ? direccion.trim()
            : direccion;

        if (
            !nombreFinal ||
            !apellidoFinal ||
            !correo ||
            nombreFinal.length > LIMITE_NOMBRE ||
            apellidoFinal.length > LIMITE_APELLIDO ||
            (typeof regionFinal === 'string' && regionFinal.length > LIMITE_REGION) ||
            (typeof comunaFinal === 'string' && comunaFinal.length > LIMITE_COMUNA) ||
            (typeof direccionFinal === 'string' && direccionFinal.length > LIMITE_DIRECCION) ||
            !validarCorreo(correo)
        ) {
            return res.status(400).json({
                mensaje: 'Los datos ingresados no son válidos'
            });
        }

        if (
            (datosUsuario.region !== undefined && !regionFinal) ||
            (datosUsuario.comuna !== undefined && !comunaFinal) ||
            (datosUsuario.direccion !== undefined && !direccionFinal)
        ) {
            return res.status(400).json({
                mensaje: 'Los datos ingresados no son válidos'
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
                 run = $5,
                 region = $6,
                 comuna = $7,
                 direccion = $8,
                 actualizado_en = CURRENT_TIMESTAMP
             WHERE id = $9
               AND activo = TRUE
             RETURNING
                id,
                nombre,
                apellido,
                email,
                rol,
                activo,
                creado_en,
                actualizado_en,
                run,
                region,
                comuna,
                direccion`,
            [
                nombreFinal,
                apellidoFinal,
                correo,
                rolFinal,
                run,
                regionFinal,
                comunaFinal,
                direccionFinal,
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
            if (error.constraint === 'usuarios_run_unique_idx') {
                return res.status(409).json({
                    mensaje: 'El RUN ya está registrado'
                });
            }
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
                actualizado_en,
                run,
                region,
                comuna,
                direccion`,
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
