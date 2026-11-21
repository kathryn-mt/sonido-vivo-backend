
const pool = require('../db');
const bcrypt = require('bcrypt');

const validaciones = require('../utils/auth.validation');
const LIMITE_NOMBRE = validaciones.LIMITE_NOMBRE;
const LIMITE_APELLIDO = validaciones.LIMITE_APELLIDO;
const LIMITE_REGION = validaciones.LIMITE_REGION;
const LIMITE_COMUNA = validaciones.LIMITE_COMUNA;
const LIMITE_DIRECCION = validaciones.LIMITE_DIRECCION;
const validarCorreo = validaciones.validarCorreo;
const validarRun = validaciones.validarRun;
const validarPassword = validaciones.validarPassword;

// ==========================================
// ROLES PERMITIDOS
// ==========================================

const ROLES_PERMITIDOS = [
    'ADMINISTRADOR',
    'VENDEDOR',
    'CLIENTE'
];

// ==========================================
// CREAR VENDEDOR
// SOLO ADMINISTRADOR
// ==========================================

async function crearVendedor(req, res) {
    const datosVendedor = req.body || {};
    const nombre = validaciones.limpiarTexto(datosVendedor.nombre);
    const apellido = validaciones.limpiarTexto(datosVendedor.apellido);
    const correo = validaciones.limpiarTexto(datosVendedor.correo);
    const run = validarRun(datosVendedor.run);
    const password = datosVendedor.password;
    const region = validaciones.limpiarTexto(datosVendedor.region);
    const comuna = validaciones.limpiarTexto(datosVendedor.comuna);
    const direccion = validaciones.limpiarTexto(datosVendedor.direccion);

    if (
        typeof nombre !== 'string' ||
        typeof apellido !== 'string' ||
        typeof correo !== 'string' ||
        typeof password !== 'string'
    ) {
        return res.status(400).json({
            mensaje: 'Los datos del vendedor no son válidos'
        });
    }

    if (
        !nombre ||
        !apellido ||
        !correo ||
        nombre.length > LIMITE_NOMBRE ||
        apellido.length > LIMITE_APELLIDO ||
        (typeof region === 'string' && region.length > LIMITE_REGION) ||
        (typeof comuna === 'string' && comuna.length > LIMITE_COMUNA) ||
        (typeof direccion === 'string' && direccion.length > LIMITE_DIRECCION)
    ) {
        return res.status(400).json({
            mensaje: 'Completa los datos obligatorios del vendedor'
        });
    }

    if (!validarRun(datosVendedor.run)) {
        return res.status(400).json({
            mensaje: 'El RUN ingresado no es válido'
        });
    }

    const correoNormalizado = correo.trim().toLowerCase();

    if (!validarCorreo(correoNormalizado)) {
        return res.status(400).json({
            mensaje: 'El correo electrónico no es válido'
        });
    }

    if (!validarPassword(password)) {
        return res.status(400).json({
            mensaje: 'La contraseña debe tener al menos 8 caracteres'
        });
    }

    let cliente = null;
    let transaccionIniciada = false;

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        cliente = await pool.connect();

        await cliente.query('BEGIN');
        transaccionIniciada = true;

        const conflicto = await cliente.query(
            `SELECT u.id_usuario, u.correo, u.run
             FROM usuarios u
             WHERE LOWER(u.correo) = $1
                OR UPPER(u.run) = $2`,
            [correoNormalizado, run]
        );

        if (conflicto.rows.length > 0) {
            let correoDuplicado = false;

            for (let indice = 0; indice < conflicto.rows.length; indice += 1) {
                const usuarioConflicto = conflicto.rows[indice];

                if (
                    usuarioConflicto.correo &&
                    usuarioConflicto.correo.toLowerCase() === correoNormalizado
                ) {
                    correoDuplicado = true;
                    break;
                }
            }

            await cliente.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(409).json({
                mensaje: correoDuplicado
                    ? 'El correo electrónico ya está registrado'
                    : 'El RUN ya está registrado'
            });
        }

        const consultaRol = await cliente.query(
            `SELECT id_rol
             FROM roles
             WHERE id_rol = 2
               AND nombre = 'VENDEDOR'`
        );

        if (consultaRol.rows.length === 0) {
            throw new Error('No existe el rol VENDEDOR');
        }

        const nuevoVendedor = await cliente.query(
            `INSERT INTO usuarios
             (
                id_rol,
                run,
                nombre,
                apellido,
                correo,
                password_hash,
                activo,
                region,
                comuna,
                direccion
             )
             VALUES
             (
                2, $1, $2, $3, $4,
                $5, 1, $6, $7, $8
             )
             RETURNING
                id_usuario AS id,
                nombre,
                apellido,
                correo AS email,
                run,
                activo,
                region,
                comuna,
                direccion,
                fecha_registro AS creado_en`,
            [
                run,
                nombre,
                apellido,
                correoNormalizado,
                passwordHash,
                typeof region === 'string' ? region : null,
                typeof comuna === 'string' ? comuna : null,
                typeof direccion === 'string' ? direccion : null
            ]
        );

        await cliente.query('COMMIT');
        transaccionIniciada = false;

        const vendedor = nuevoVendedor.rows[0];
        vendedor.rol = 'VENDEDOR';

        return res.status(201).json({
            mensaje: 'Vendedor creado correctamente',
            usuario: vendedor
        });
    } catch (error) {
        if (cliente && transaccionIniciada) {
            try {
                await cliente.query('ROLLBACK');
            } catch (errorRollback) {
                console.error(
                    'Error al revertir la creación del vendedor:',
                    errorRollback.message
                );
            }
        }

        console.error(
            'Error al crear vendedor:',
            error.message
        );

        if (error.code === '23505') {
            return res.status(409).json({
                mensaje: 'El RUN o el correo electrónico ya está registrado'
            });
        }

        return res.status(500).json({
            mensaje: 'No fue posible crear el vendedor'
        });
    } finally {
        if (cliente) {
            cliente.release();
        }
    }
}

// ==========================================
// LISTAR USUARIOS
// SOLO ADMINISTRADOR
// ==========================================

async function listarUsuarios(req, res) {
    try {
        const resultado = await pool.query(
            `SELECT
                u.id_usuario AS id,
                u.nombre,
                u.apellido,
                u.correo AS email,
                r.nombre AS rol,
                u.activo,
                u.fecha_registro AS creado_en,
                u.fecha_actualizacion AS actualizado_en,
                u.run,
                u.region,
                u.comuna,
                u.direccion
             FROM usuarios u
             INNER JOIN roles r
                ON u.id_rol = r.id_rol
             ORDER BY u.id_usuario`
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
                u.id_usuario AS id,
                u.nombre,
                u.apellido,
                u.correo AS email,
                r.nombre AS rol,
                u.activo,
                u.fecha_registro AS creado_en,
                u.fecha_actualizacion AS actualizado_en,
                u.run,
                u.region,
                u.comuna,
                u.direccion
             FROM usuarios u
             INNER JOIN roles r
                ON u.id_rol = r.id_rol
             WHERE u.id_usuario = $1`,
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

    if (esPropietario && !esAdministrador) {
        const camposPermitidos = [
            'nombre',
            'apellido',
            'region',
            'comuna',
            'direccion'
        ];
        const camposEnviados = Object.keys(datosUsuario);

        for (let indice = 0; indice < camposEnviados.length; indice += 1) {
            const campo = camposEnviados[indice];

            if (
                campo === 'run' ||
                campo === 'email' ||
                campo === 'correo'
            ) {
                return res.status(403).json({
                    mensaje: 'No puedes modificar tu RUN ni tu correo electrónico'
                });
            }

            if (!camposPermitidos.includes(campo)) {
                return res.status(403).json({
                    mensaje: 'No tienes permiso para modificar el campo ' + campo
                });
            }
        }
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
                u.id_usuario AS id,
                u.nombre,
                u.apellido,
                u.correo AS email,
                r.nombre AS rol,
                u.activo,
                u.run,
                u.region,
                u.comuna,
                u.direccion
             FROM usuarios u
             INNER JOIN roles r
                ON u.id_rol = r.id_rol
             WHERE u.id_usuario = $1`,
            [idUsuario]
        );

        if (consultaUsuario.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado'
            });
        }

        const usuarioActual = consultaUsuario.rows[0];

        if (Number(usuarioActual.activo) !== 1) {
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

        let idRolFinal = null;

        if (!esPropietario || esAdministrador) {
            const consultaRol = await pool.query(
                `SELECT id_rol
                 FROM roles
                 WHERE nombre = $1`,
                [rolFinal]
            );

            if (consultaRol.rows.length === 0) {
                return res.status(400).json({
                    mensaje: 'El rol ingresado no existe'
                });
            }

            idRolFinal = consultaRol.rows[0].id_rol;
        }

        let resultado = null;

        if (esPropietario && !esAdministrador) {
            resultado = await pool.query(
                `UPDATE usuarios
                 SET nombre = $1,
                     apellido = $2,
                     region = $3,
                     comuna = $4,
                     direccion = $5,
                     fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE id_usuario = $6
                   AND activo = 1`,
                [
                    nombreFinal,
                    apellidoFinal,
                    regionFinal,
                    comunaFinal,
                    direccionFinal,
                    idUsuario
                ]
            );
        } else {
            resultado = await pool.query(
                `UPDATE usuarios
                 SET nombre = $1,
                     apellido = $2,
                     correo = $3,
                     id_rol = $4,
                     run = $5,
                     region = $6,
                     comuna = $7,
                     direccion = $8,
                     fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE id_usuario = $9
                   AND activo = 1`,
                [
                    nombreFinal,
                    apellidoFinal,
                    correo,
                    idRolFinal,
                    run,
                    regionFinal,
                    comunaFinal,
                    direccionFinal,
                    idUsuario
                ]
            );
        }

        if (resultado.rowCount === 0) {
            return res.status(409).json({
                mensaje: 'No fue posible actualizar el usuario'
            });
        }

        const usuarioActualizado = await pool.query(
            `SELECT
                u.id_usuario AS id,
                u.nombre,
                u.apellido,
                u.correo AS email,
                r.nombre AS rol,
                u.activo,
                u.fecha_registro AS creado_en,
                u.fecha_actualizacion AS actualizado_en,
                u.run,
                u.region,
                u.comuna,
                u.direccion
             FROM usuarios u
             INNER JOIN roles r
                ON u.id_rol = r.id_rol
             WHERE u.id_usuario = $1`,
            [idUsuario]
        );

        return res.status(200).json({
            mensaje: 'Usuario actualizado correctamente',
            usuario: usuarioActualizado.rows[0]
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
             SET activo = 0,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id_usuario = $1
               AND activo = 1`,
            [idUsuario]
        );

        if (resultado.rowCount === 0) {
            const consultaUsuario = await pool.query(
                `SELECT id_usuario AS id, activo
                 FROM usuarios
                 WHERE id_usuario = $1`,
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

        const usuarioDesactivado = await pool.query(
            `SELECT
                u.id_usuario AS id,
                u.nombre,
                u.apellido,
                u.correo AS email,
                r.nombre AS rol,
                u.activo,
                u.fecha_registro AS creado_en,
                u.fecha_actualizacion AS actualizado_en,
                u.run,
                u.region,
                u.comuna,
                u.direccion
             FROM usuarios u
             INNER JOIN roles r
                ON u.id_rol = r.id_rol
             WHERE u.id_usuario = $1`,
            [idUsuario]
        );

        return res.status(200).json({
            mensaje: 'Usuario desactivado correctamente',
            usuario: usuarioDesactivado.rows[0]
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
// REACTIVAR USUARIO
// SOLO ADMINISTRADOR
// ==========================================

async function reactivarUsuario(req, res) {
    const idUsuario = req.params.id;

    if (
        !/^[1-9][0-9]*$/.test(idUsuario) ||
        !Number.isSafeInteger(Number(idUsuario))
    ) {
        return res.status(400).json({
            mensaje: 'El ID del usuario no es válido'
        });
    }

    try {
        const consultaUsuario = await pool.query(
            `SELECT id_usuario, activo
             FROM usuarios
             WHERE id_usuario = $1`,
            [idUsuario]
        );

        if (consultaUsuario.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado'
            });
        }

        if (Number(consultaUsuario.rows[0].activo) !== 0) {
            return res.status(409).json({
                mensaje: 'El usuario ya se encuentra activo'
            });
        }

        const resultado = await pool.query(
            `UPDATE usuarios
             SET activo = 1,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id_usuario = $1
               AND activo = 0`,
            [idUsuario]
        );

        if (resultado.rowCount === 0) {
            const estadoActual = await pool.query(
                `SELECT id_usuario, activo
                 FROM usuarios
                 WHERE id_usuario = $1`,
                [idUsuario]
            );

            if (estadoActual.rows.length === 0) {
                return res.status(404).json({
                    mensaje: 'Usuario no encontrado'
                });
            }

            return res.status(409).json({
                mensaje: 'El usuario ya se encuentra activo'
            });
        }

        const usuarioReactivado = await pool.query(
            `SELECT
                u.id_usuario AS id,
                u.nombre,
                u.apellido,
                u.correo AS email,
                r.nombre AS rol,
                u.activo,
                u.fecha_registro AS creado_en,
                u.fecha_actualizacion AS actualizado_en,
                u.run,
                u.region,
                u.comuna,
                u.direccion
             FROM usuarios u
             INNER JOIN roles r
                ON u.id_rol = r.id_rol
             WHERE u.id_usuario = $1`,
            [idUsuario]
        );

        if (usuarioReactivado.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado'
            });
        }

        return res.status(200).json({
            mensaje: 'Usuario reactivado correctamente',
            usuario: usuarioReactivado.rows[0]
        });

    } catch (error) {
        console.error(
            'Error al reactivar usuario:',
            error.message
        );

        return res.status(500).json({
            mensaje: 'No fue posible reactivar el usuario'
        });
    }
}

// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

module.exports = {
    listarUsuarios: listarUsuarios,
    crearVendedor: crearVendedor,
    obtenerUsuarioPorId: obtenerUsuarioPorId,
    actualizarUsuario: actualizarUsuario,
    desactivarUsuario: desactivarUsuario,
    reactivarUsuario: reactivarUsuario
};