const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

const pool = require('../db');
const usuariosRoutes = require('../routes/usuarios.routes');

const JWT_SECRET = 'secreto-ficticio-para-pruebas';
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(express.json());
app.use('/api/v1/usuarios', usuariosRoutes);

let server;
let baseUrl;

test.before(async function() {
    server = http.createServer(app);

    await new Promise(function(resolve, reject) {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    baseUrl = 'http://127.0.0.1:' + address.port;
});

test.after(async function() {
    if (!server) {
        return;
    }

    await new Promise(function(resolve, reject) {
        server.close(function(error) {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
});

function crearToken(rol, opciones) {
    return jwt.sign(
        { rol: rol },
        JWT_SECRET,
        Object.assign({ subject: '1' }, opciones)
    );
}

async function solicitarReactivacion(id, token, body) {
    const headers = {};

    if (token) {
        headers.authorization = 'Bearer ' + token;
    }

    if (body !== undefined) {
        headers['content-type'] = 'application/json';
    }

    return fetch(baseUrl + '/api/v1/usuarios/' + id + '/reactivar', {
        method: 'PATCH',
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

function reemplazarConsulta(handler) {
    const queryOriginal = pool.query;
    pool.query = handler;

    return function() {
        pool.query = queryOriginal;
    };
}

test('reactiva una cuenta inactiva sin cambiar otros datos ni exponer hashes', async function() {
    const consultas = [];
    const usuarioReactivado = {
        id: 42,
        nombre: 'Cliente',
        apellido: 'Prueba',
        email: 'cliente@example.com',
        rol: 'CLIENTE',
        activo: 1,
        creado_en: '2026-01-15T12:00:00.000Z',
        actualizado_en: '2026-01-16T12:00:00.000Z',
        run: '123456785',
        region: 'Metropolitana',
        comuna: 'Santiago',
        direccion: 'Calle de ejemplo 123'
    };
    const restaurarConsulta = reemplazarConsulta(async function(sql, valores) {
        consultas.push({ sql: sql, valores: valores });

        if (sql.includes('SELECT id_usuario, activo')) {
            return { rows: [{ id_usuario: 42, activo: 0 }] };
        }

        if (sql.includes('UPDATE usuarios')) {
            return { rowCount: 1 };
        }

        if (sql.includes('FROM usuarios u')) {
            return { rows: [usuarioReactivado] };
        }

        assert.fail('Consulta inesperada: ' + sql);
    });

    try {
        const respuesta = await solicitarReactivacion(
            '42',
            crearToken('ADMINISTRADOR'),
            {
                activo: 0,
                rol: 'ADMINISTRADOR',
                nombre: 'Nombre alterado',
                password_hash: 'hash-no-permitido'
            }
        );
        const cuerpo = await respuesta.json();
        const actualizacion = consultas.find(function(consulta) {
            return consulta.sql.includes('UPDATE usuarios');
        });

        assert.equal(respuesta.status, 200);
        assert.equal(cuerpo.mensaje, 'Usuario reactivado correctamente');
        assert.deepEqual(cuerpo.usuario, usuarioReactivado);
        assert.equal(JSON.stringify(cuerpo).includes('password'), false);
        assert.equal(actualizacion.valores.length, 1);
        assert.deepEqual(actualizacion.valores, ['42']);
        assert.equal(
            actualizacion.sql.replace(/\s+/g, ' ').trim(),
            'UPDATE usuarios SET activo = 1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_usuario = $1 AND activo = 0'
        );
    } finally {
        restaurarConsulta();
    }
});

test('rechaza reactivar una cuenta que ya está activa', async function() {
    let huboActualizacion = false;
    const restaurarConsulta = reemplazarConsulta(async function(sql) {
        if (sql.includes('SELECT id_usuario, activo')) {
            return { rows: [{ id_usuario: 42, activo: 1 }] };
        }

        if (sql.includes('UPDATE usuarios')) {
            huboActualizacion = true;
        }

        assert.fail('No se esperaba otra consulta: ' + sql);
    });

    try {
        const respuesta = await solicitarReactivacion(
            '42',
            crearToken('ADMINISTRADOR')
        );

        assert.equal(respuesta.status, 409);
        assert.equal(huboActualizacion, false);
    } finally {
        restaurarConsulta();
    }
});

test('rechaza un ID que no es un entero positivo', async function() {
    let consultas = 0;
    const restaurarConsulta = reemplazarConsulta(async function() {
        consultas += 1;
        return { rows: [] };
    });

    try {
        const respuesta = await solicitarReactivacion(
            '0',
            crearToken('ADMINISTRADOR')
        );

        assert.equal(respuesta.status, 400);
        assert.equal(consultas, 0);
    } finally {
        restaurarConsulta();
    }
});

test('responde 404 si el usuario no existe', async function() {
    const restaurarConsulta = reemplazarConsulta(async function() {
        return { rows: [] };
    });

    try {
        const respuesta = await solicitarReactivacion(
            '42',
            crearToken('ADMINISTRADOR')
        );

        assert.equal(respuesta.status, 404);
    } finally {
        restaurarConsulta();
    }
});

test('responde 401 sin JWT, con JWT inválido o vencido', async function() {
    let consultas = 0;
    const restaurarConsulta = reemplazarConsulta(async function() {
        consultas += 1;
        return { rows: [] };
    });

    try {
        const sinToken = await solicitarReactivacion('42');
        const invalido = await solicitarReactivacion('42', 'token-invalido');
        const vencido = await solicitarReactivacion(
            '42',
            crearToken('ADMINISTRADOR', { expiresIn: -1 })
        );

        assert.equal(sinToken.status, 401);
        assert.equal(invalido.status, 401);
        assert.equal(vencido.status, 401);
        assert.equal(consultas, 0);
    } finally {
        restaurarConsulta();
    }
});

test('responde 403 a CLIENTE y VENDEDOR', async function() {
    let consultas = 0;
    const restaurarConsulta = reemplazarConsulta(async function() {
        consultas += 1;
        return { rows: [] };
    });

    try {
        for (const rol of ['CLIENTE', 'VENDEDOR']) {
            const respuesta = await solicitarReactivacion(
                '42',
                crearToken(rol)
            );
            assert.equal(respuesta.status, 403);
        }

        assert.equal(consultas, 0);
    } finally {
        restaurarConsulta();
    }
});
