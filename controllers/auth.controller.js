const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const validaciones = require('../utils/auth.validation');

const LIMITE_NOMBRE = validaciones.LIMITE_NOMBRE;
const LIMITE_APELLIDO = validaciones.LIMITE_APELLIDO;
const LIMITE_REGION = validaciones.LIMITE_REGION;
const LIMITE_COMUNA = validaciones.LIMITE_COMUNA;
const LIMITE_DIRECCION = validaciones.LIMITE_DIRECCION;

const limpiarTexto = validaciones.limpiarTexto;
const validarCorreo = validaciones.validarCorreo;
const validarRun = validaciones.validarRun;
const validarPassword = validaciones.validarPassword;

// GENERAR TOKEN JWT


function generarToken(usuario) {

    if (!process.env.JWT_SECRET) {
        throw new Error('Falta configurar JWT_SECRET');
    }

    return jwt.sign(
        {
            sub: String(usuario.id),
            rol: usuario.rol
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
    );
}



// PREPARAR RESPUESTA DEL USUARIO


function prepararUsuario(usuario) {

    return {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol
    };
}



// REGISTRAR USUARIO


async function registrarUsuario(req, res) {

    const datosUsuario = req.body || {};

    const nombre = limpiarTexto(datosUsuario.nombre);
    const apellido = limpiarTexto(datosUsuario.apellido);
    const email = limpiarTexto(datosUsuario.email);
    const run = validarRun(datosUsuario.run);
    const region = limpiarTexto(datosUsuario.region);
    const comuna = limpiarTexto(datosUsuario.comuna);
    const direccion = limpiarTexto(datosUsuario.direccion);
    const password = datosUsuario.password;

    if (
        typeof nombre !== 'string' ||
        typeof apellido !== 'string' ||
        typeof email !== 'string' ||
        typeof region !== 'string' ||
        typeof comuna !== 'string' ||
        typeof direccion !== 'string' ||
        typeof password !== 'string'
    ) {
        return res.status(400).json({
            mensaje: 'Los datos ingresados no son válidos'
        });
    }

    if (
        !nombre.trim() ||
        !apellido.trim() ||
        !email.trim() ||
        !region.trim() ||
        !comuna.trim() ||
        !direccion.trim()
    ) {
        return res.status(400).json({
            mensaje: 'Completa todos los campos obligatorios'
        });
    }

    if (
        nombre.length > LIMITE_NOMBRE ||
        apellido.length > LIMITE_APELLIDO ||
        region.length > LIMITE_REGION ||
        comuna.length > LIMITE_COMUNA ||
        direccion.length > LIMITE_DIRECCION
    ) {
        return res.status(400).json({
            mensaje: 'Uno o más datos exceden la longitud permitida'
        });
    }

    if (!validarPassword(password)) {
        return res.status(400).json({
            mensaje: 'La contraseña debe tener al menos 8 caracteres'
        });
    }

    const correo = email.trim().toLowerCase();

    if (!validarCorreo(correo)) {
        return res.status(400).json({
            mensaje: 'El correo electrónico no es válido'
        });
    }

    if (!run) {
        return res.status(400).json({
            mensaje: 'El RUN ingresado no es válido'
        });
    }

    let cliente = null;
    let transaccionIniciada = false;

    try {

        const passwordHash = await bcrypt.hash(password, 12);

        cliente = await pool.connect();

        await cliente.query('BEGIN');

        transaccionIniciada = true;

        // Evitar que dos registros de esta API
        // calculen el mismo identificador simultáneamente.
        await cliente.query(
            'SELECT pg_advisory_xact_lock(20261120, 1)'
        );

        // COMPROBAR CORREO Y RUN

        const conflictos = await cliente.query(
            `SELECT
                id_usuario AS id,
                correo AS email,
                run
             FROM usuarios
             WHERE LOWER(correo) = $1
                OR UPPER(run) = $2`,
            [correo, run]
        );

        if (conflictos.rows.length > 0) {

            const correoDuplicado = conflictos.rows.some(
                function (usuario) {
                    return usuario.email &&
                        usuario.email.toLowerCase() === correo;
                }
            );

            await cliente.query('ROLLBACK');
            transaccionIniciada = false;

            if (correoDuplicado) {
                return res.status(409).json({
                    mensaje: 'El correo ya está registrado'
                });
            }

            return res.status(409).json({
                mensaje: 'El RUN ya está registrado'
            });
        }

        // OBTENER ROL CLIENTE

        const consultaRol = await cliente.query(
            `SELECT id_rol
             FROM roles
             WHERE nombre = 'CLIENTE'`
        );

        if (consultaRol.rows.length === 0) {
            throw new Error('No existe el rol CLIENTE');
        }

        const idRolCliente = consultaRol.rows[0].id_rol;

        // GENERAR IDENTIFICADOR
        // La tabla actual no tiene un valor automático.
        // Este cálculo es provisional hasta configurar
        // una secuencia de PostgreSQL compartida.

        const consultaId = await cliente.query(
            `SELECT COALESCE(MAX(id_usuario), 0) + 1
                    AS siguiente_id
             FROM usuarios`
        );

        const nuevoId = consultaId.rows[0].siguiente_id;

        // REGISTRAR USUARIO

        const nuevoUsuario = await cliente.query(
            `INSERT INTO usuarios
            (
                id_usuario,
                id_rol,
                run,
                nombre,
                apellido,
                correo,
                region,
                comuna,
                direccion,
                password_hash
            )
            VALUES
            (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10
            )
            RETURNING
                id_usuario AS id,
                nombre,
                apellido,
                correo AS email,
                run,
                region,
                comuna,
                direccion,
                activo,
                fecha_registro AS creado_en`,
            [
                nuevoId,
                idRolCliente,
                run,
                nombre.trim(),
                apellido.trim(),
                correo,
                region,
                comuna,
                direccion,
                passwordHash
            ]
        );

        await cliente.query('COMMIT');
        transaccionIniciada = false;

        const usuario = nuevoUsuario.rows[0];

        usuario.rol = 'CLIENTE';

        return res.status(201).json({
            mensaje: 'Usuario registrado correctamente',
            usuario: usuario
        });

    } catch (error) {

        if (cliente && transaccionIniciada) {
            try {
                await cliente.query('ROLLBACK');
            } catch (errorRollback) {
                console.error(
                    'Error al revertir registro:',
                    errorRollback.message
                );
            }
        }

        console.error(
            'Error al registrar usuario:',
            error.message
        );

        if (error.code === '23505') {
            return res.status(409).json({
                mensaje: 'El correo o RUN ya está registrado'
            });
        }

        return res.status(500).json({
            mensaje: 'Error interno al registrar usuario'
        });

    } finally {

        if (cliente) {
            cliente.release();
        }
    }
}



// INICIAR SESIÓN DE CLIENTES


async function iniciarSesion(req, res) {

    try {

        const datosLogin = req.body || {};

        const email = datosLogin.email;
        const password = datosLogin.password;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                mensaje: 'Debes ingresar correo y contraseña'
            });
        }

        const correo = email.trim().toLowerCase();

        // CONSULTAR USUARIO Y SU ROL

        const consultaUsuario = await pool.query(
            `SELECT
                u.id_usuario AS id,
                u.nombre,
                u.apellido,
                u.correo AS email,
                u.run,
                u.password_hash,
                r.nombre AS rol,
                u.activo
             FROM usuarios u
             INNER JOIN roles r
                ON u.id_rol = r.id_rol
             WHERE LOWER(u.correo) = $1`,
            [correo]
        );

        if (consultaUsuario.rows.length === 0) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        const usuario = consultaUsuario.rows[0];

        // COMPROBAR CUENTA ACTIVA

        if (!usuario.activo) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        // COMPROBAR CONTRASEÑA

        const passwordValida = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!passwordValida) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        // LOS CLIENTES INGRESAN POR CORREO

        if (usuario.rol !== 'CLIENTE') {
            return res.status(401).json({
                mensaje: 'Utiliza el acceso para personal'
            });
        }

        // GENERAR JWT

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                mensaje: 'Error de configuración del servidor'
            });
        }

        const token = generarToken(usuario);

        return res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            token: token,
            usuario: prepararUsuario(usuario)
        });

    } catch (error) {

        console.error(
            'Error al iniciar sesión:',
            error.message
        );

        return res.status(500).json({
            mensaje: 'Error interno al iniciar sesión'
        });
    }
}



// INICIAR SESIÓN PERSONAL MEDIANTE RUN


async function iniciarSesionPersonal(req, res) {

    try {

        const datosLogin = req.body || {};

        const run = validarRun(datosLogin.run);
        const password = datosLogin.password;

        if (
            !run ||
            typeof password !== 'string' ||
            !password
        ) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        // CONSULTAR PERSONAL Y SU ROL

        const consultaUsuario = await pool.query(
            `SELECT
                u.id_usuario AS id,
                u.nombre,
                u.apellido,
                u.correo AS email,
                u.run,
                u.password_hash,
                r.nombre AS rol,
                u.activo
             FROM usuarios u
             INNER JOIN roles r
                ON u.id_rol = r.id_rol
             WHERE UPPER(u.run) = $1`,
            [run]
        );

        if (consultaUsuario.rows.length === 0) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        const usuario = consultaUsuario.rows[0];

        // COMPROBAR QUE SEA PERSONAL AUTORIZADO

        if (
            !usuario.activo ||
            !['VENDEDOR', 'ADMINISTRADOR'].includes(usuario.rol)
        ) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        // COMPROBAR CONTRASEÑA

        const passwordValida = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!passwordValida) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        // GENERAR JWT

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                mensaje: 'Error de configuración del servidor'
            });
        }

        const token = generarToken(usuario);

        return res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            token: token,
            usuario: prepararUsuario(usuario)
        });

    } catch (error) {

        console.error(
            'Error al iniciar sesión personal:',
            error.message
        );

        return res.status(500).json({
            mensaje: 'Error interno al iniciar sesión'
        });
    }
}


// CAMBIAR CONTRASEÑA


async function cambiarPassword(req, res) {

    try {

        const datosPassword = req.body || {};

        const passwordActual = datosPassword.passwordActual;
        const passwordNueva = datosPassword.passwordNueva;

        if (
            typeof passwordActual !== 'string' ||
            typeof passwordNueva !== 'string'
        ) {
            return res.status(400).json({
                mensaje: 'Debes ingresar la contraseña actual y la nueva'
            });
        }

        if (!validarPassword(passwordNueva)) {
            return res.status(400).json({
                mensaje: 'La contraseña nueva debe tener al menos 8 caracteres'
            });
        }

        const idUsuario = req.usuario && req.usuario.id;

        if (!idUsuario) {
            return res.status(401).json({
                mensaje: 'Token inválido'
            });
        }

        // CONSULTAR USUARIO

        const consultaUsuario = await pool.query(
            `SELECT
                id_usuario AS id,
                password_hash,
                activo
             FROM usuarios
             WHERE id_usuario = $1`,
            [idUsuario]
        );

        if (consultaUsuario.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado'
            });
        }

        const usuario = consultaUsuario.rows[0];

        if (!usuario.activo) {
            return res.status(401).json({
                mensaje: 'La cuenta se encuentra desactivada'
            });
        }

        // COMPROBAR CONTRASEÑA ACTUAL

        const passwordValida = await bcrypt.compare(
            passwordActual,
            usuario.password_hash
        );

        if (!passwordValida) {
            return res.status(401).json({
                mensaje: 'La contraseña actual no es correcta'
            });
        }

        if (passwordActual === passwordNueva) {
            return res.status(400).json({
                mensaje: 'La contraseña nueva debe ser diferente'
            });
        }

        // CIFRAR NUEVA CONTRASEÑA

        const passwordHash = await bcrypt.hash(
            passwordNueva,
            12
        );

        // ACTUALIZAR CONTRASEÑA

        await pool.query(
            `UPDATE usuarios
             SET password_hash = $1
             WHERE id_usuario = $2
               AND activo = 1`,
            [passwordHash, idUsuario]
        );

        return res.status(200).json({
            mensaje: 'Contraseña cambiada correctamente'
        });

    } catch (error) {

        console.error(
            'Error al cambiar contraseña:',
            error.message
        );

        return res.status(500).json({
            mensaje: 'No fue posible cambiar la contraseña'
        });
    }
}



// EXPORTAR FUNCIONES


module.exports = {
    registrarUsuario: registrarUsuario,
    iniciarSesion: iniciarSesion,
    iniciarSesionPersonal: iniciarSesionPersonal,
    cambiarPassword: cambiarPassword
};