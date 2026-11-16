
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// ==========================================
// REGISTRAR USUARIO
// ==========================================

async function registrarUsuario(req, res) {
    try {
        const datosUsuario = req.body || {};

        const nombre = datosUsuario.nombre;
        const apellido = datosUsuario.apellido;
        const email = datosUsuario.email;
        const password = datosUsuario.password;

        if (
            typeof nombre !== 'string' ||
            typeof apellido !== 'string' ||
            typeof email !== 'string' ||
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
            password.length < 8
        ) {
            return res.status(400).json({
                mensaje: 'Completa todos los campos. La contraseña debe tener al menos 8 caracteres'
            });
        }

        const correo = email.trim().toLowerCase();

        const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

        if (!correoValido) {
            return res.status(400).json({
                mensaje: 'El correo electrónico no es válido'
            });
        }

        const consultaUsuario = await pool.query(
            'SELECT id FROM usuarios WHERE LOWER(email) = $1',
            [correo]
        );

        if (consultaUsuario.rows.length > 0) {
            return res.status(409).json({
                mensaje: 'El correo ya está registrado'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const nuevoUsuario = await pool.query(
            `INSERT INTO usuarios
            (nombre, apellido, email, password_hash, rol)
            VALUES ($1, $2, $3, $4, 'CLIENTE')
            RETURNING id, nombre, apellido, email, rol, activo, creado_en`,
            [
                nombre.trim(),
                apellido.trim(),
                correo,
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
                    password_hash, rol, activo
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
// EXPORTAR FUNCIONES
// ==========================================

module.exports = {
    registrarUsuario: registrarUsuario,
    iniciarSesion: iniciarSesion
};
