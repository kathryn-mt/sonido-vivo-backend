
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const {
    LIMITE_NOMBRE,
    LIMITE_APELLIDO,
    LIMITE_REGION,
    LIMITE_COMUNA,
    LIMITE_DIRECCION,
    limpiarTexto,
    validarCorreo,
    validarRun,
    validarPassword
} = require('../utils/auth.validation');

// ==========================================
// REGISTRAR USUARIO
// ==========================================

async function registrarUsuario(req, res) {
    try {
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
            !region ||
            !comuna ||
            !direccion
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
                mensaje: 'Uno o mas datos exceden la longitud permitida'
            });
        }

        if (!validarPassword(password)) {
            return res.status(400).json({
                mensaje: 'La contraseña debe tener al menos 8 caracteres'
            });
        }

        const correo = email.toLowerCase();

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

        const conflictos = await pool.query(
            `SELECT id, email, run
             FROM usuarios
             WHERE LOWER(email) = $1
                OR UPPER(run) = $2`,
            [correo, run]
        );

        if (conflictos.rows.length > 0) {
            const correoDuplicado = conflictos.rows.some(
                usuario => usuario.email
                    && usuario.email.toLowerCase() === correo
            );

            if (correoDuplicado) {
                return res.status(409).json({
                    mensaje: 'El correo ya está registrado'
                });
            }

            const runDuplicado = conflictos.rows.some(
                usuario => usuario.run
                    && usuario.run.toUpperCase() === run
            );

            if (runDuplicado) {
                return res.status(409).json({
                    mensaje: 'El RUN ya está registrado'
                });
            }
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const nuevoUsuario = await pool.query(
            `INSERT INTO usuarios
            (run, nombre, apellido, email, region, comuna, direccion,
             password_hash, rol)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CLIENTE')
            RETURNING id, nombre, apellido, email, rol, activo, creado_en,
                      run, region, comuna, direccion`,
            [
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

        return res.status(201).json({
            mensaje: 'Usuario registrado correctamente',
            usuario: nuevoUsuario.rows[0]
        });

    } catch (error) {
        console.error('Error al registrar usuario:', error.message);

        if (error.code === '23505') {
            if (error.constraint === 'usuarios_run_unique_idx') {
                return res.status(409).json({
                    mensaje: 'El RUN ya está registrado'
                });
            }
            return res.status(409).json({
                mensaje: 'El correo ya está registrado'
            });
        }

        return res.status(500).json({
            mensaje: 'Error interno al registrar usuario'
        });
    }
}


// ==========================================
// INICIAR SESIÓN
// ==========================================

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

        const consultaUsuario = await pool.query(
            `SELECT id, nombre, apellido, email,
                    run, password_hash, rol, activo
             FROM usuarios
             WHERE LOWER(email) = $1`,
            [correo]
        );

        if (consultaUsuario.rows.length === 0) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        const usuario = consultaUsuario.rows[0];

        if (!usuario.activo) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        const passwordValida = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!passwordValida) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        if (usuario.rol !== 'CLIENTE') {
            if (usuario.run !== null) {
                return res.status(401).json({
                    mensaje: 'Credenciales incorrectas'
                });
            }
        }

        if (!process.env.JWT_SECRET) {
            console.error('Falta configurar JWT_SECRET');

            return res.status(500).json({
                mensaje: 'Error de configuración del servidor'
            });
        }

        const token = jwt.sign(
            {
                sub: String(usuario.id),
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '1h'
            }
        );

        return res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            token: token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error al iniciar sesión:', error.message);

        return res.status(500).json({
            mensaje: 'Error interno al iniciar sesión'
        });
    }
}

// ==========================================
// INICIAR SESIÓN PERSONAL MEDIANTE RUN
// ==========================================

async function iniciarSesionPersonal(req, res) {
    try {
        const datosLogin = req.body || {};
        const run = validarRun(datosLogin.run);
        const password = datosLogin.password;

        if (!run || typeof password !== 'string' || !password) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        const consultaUsuario = await pool.query(
            `SELECT id, nombre, apellido, email, run,
                    password_hash, rol, activo
             FROM usuarios
             WHERE UPPER(run) = $1`,
            [run]
        );

        if (consultaUsuario.rows.length === 0) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        const usuario = consultaUsuario.rows[0];

        if (
            !usuario.activo ||
            !['VENDEDOR', 'ADMINISTRADOR'].includes(usuario.rol)
        ) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        const passwordValida = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!passwordValida) {
            return res.status(401).json({
                mensaje: 'Credenciales incorrectas'
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error('Falta configurar JWT_SECRET');

            return res.status(500).json({
                mensaje: 'Error de configuración del servidor'
            });
        }

        const token = jwt.sign(
            {
                sub: String(usuario.id),
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '1h'
            }
        );

        return res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            token: token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error('Error al iniciar sesión personal:', error.message);

        return res.status(500).json({
            mensaje: 'Error interno al iniciar sesión'
        });
    }
}

// ==========================================
// CAMBIAR CONTRASEÑA
// ==========================================

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

        const consultaUsuario = await pool.query(
            `SELECT id, password_hash, activo
             FROM usuarios
             WHERE id = $1`,
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

        const passwordHash = await bcrypt.hash(passwordNueva, 12);

        await pool.query(
            `UPDATE usuarios
             SET password_hash = $1,
                 actualizado_en = CURRENT_TIMESTAMP
             WHERE id = $2
               AND activo = TRUE`,
            [passwordHash, idUsuario]
        );

        return res.status(200).json({
            mensaje: 'Contraseña cambiada correctamente'
        });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error.message);

        return res.status(500).json({
            mensaje: 'No fue posible cambiar la contraseña'
        });
    }
}


// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

module.exports = {
    registrarUsuario: registrarUsuario,
    iniciarSesion: iniciarSesion,
    iniciarSesionPersonal: iniciarSesionPersonal,
    cambiarPassword: cambiarPassword
};
