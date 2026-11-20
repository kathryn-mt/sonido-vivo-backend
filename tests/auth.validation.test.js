const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const validaciones = require('../utils/auth.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const usuariosController = require('../controllers/usuarios.controller');
const authController = require('../controllers/auth.controller');
const pool = require('../db');

function crearRespuesta() {
    return {
        codigo: null,
        cuerpo: null,
        status(codigo) {
            this.codigo = codigo;
            return this;
        },
        json(cuerpo) {
            this.cuerpo = cuerpo;
            return this;
        }
    };
}

test('normaliza y valida RUN', () => {
    assert.equal(validaciones.validarRun('12.345.678-5'), '123456785');
});

test('rechaza RUN con digito verificador incorrecto', () => {
    assert.equal(validaciones.validarRun('123456788'), null);
});

test('rechaza RUN sin formato valido', () => {
    assert.equal(validaciones.validarRun('RUN_FICTICIO_VALIDO'), null);
});

test('valida correo y longitud basica', () => {
    assert.equal(validaciones.validarCorreo('cliente@example.com'), true);
    assert.equal(validaciones.validarCorreo('correo-invalido'), false);
});

test('exige una longitud valida para password', () => {
    assert.equal(validaciones.validarPassword('12345678'), true);
    assert.equal(validaciones.validarPassword('1234567'), false);
    assert.equal(validaciones.validarPassword('        '), false);
});

test('rechaza creacion de vendedores sin autenticacion', () => {
    const req = {
        headers: {}
    };
    const res = crearRespuesta();

    authMiddleware.verificarToken(req, res, function() {
        assert.fail('No debio continuar sin token');
    });

    assert.equal(res.codigo, 401);
});

test('rechaza creacion de vendedores por clientes', () => {
    const req = {
        usuario: {
            id: '10',
            rol: 'CLIENTE'
        }
    };
    const res = crearRespuesta();
    const verificarAdministrador = authMiddleware.verificarRol(['ADMINISTRADOR']);

    verificarAdministrador(req, res, function() {
        assert.fail('No debio continuar con rol cliente');
    });

    assert.equal(res.codigo, 403);
});

test('permite crear vendedores a administradores', async () => {
    const consultas = [];
    const cliente = {
        liberado: false,
        async query(sql, valores) {
            consultas.push({
                sql: sql,
                valores: valores
            });
            if (sql === 'BEGIN') {
                return { rows: [] };
            }
            if (sql.includes('LOWER(u.correo)')) {
                return { rows: [] };
            }
            if (sql.includes('FROM roles')) {
                return { rows: [{ id_rol: 2 }] };
            }
            if (sql.includes('INSERT INTO usuarios')) {
                return {
                    rows: [{
                        id: 99,
                        nombre: 'Vendedora',
                        apellido: 'Prueba',
                        correo: 'vendedora@example.com',
                        run: '123456785',
                        activo: 1
                    }]
                };
            }
            if (sql === 'COMMIT') {
                return { rows: [] };
            }
            if (sql === 'ROLLBACK') {
                return { rows: [] };
            }
            return { rows: [] };
        },
        release() {
            this.liberado = true;
        }
    };

    const connectOriginal = pool.connect;
    pool.connect = async function() {
        return cliente;
    };

    try {
        const req = {
            usuario: {
                id: '1',
                rol: 'ADMINISTRADOR'
            },
            body: {
                nombre: 'Vendedora',
                apellido: 'Prueba',
                correo: 'vendedora@example.com',
                run: '12.345.678-5',
                password: 'Inicial123'
            }
        };
        const res = crearRespuesta();

        await usuariosController.crearVendedor(req, res);

        assert.equal(res.codigo, 201);
        assert.equal(res.cuerpo.usuario.rol, 'VENDEDOR');
        assert.equal(res.cuerpo.usuario.id, 99);
        assert.equal('password' in res.cuerpo.usuario, false);
        assert.equal('password_hash' in res.cuerpo.usuario, false);
        const consultaInsert = consultas.find(function(consulta) {
            return consulta.sql.includes('INSERT INTO usuarios');
        });
        const columnasInsert = consultaInsert.sql.split('VALUES')[0];

        assert.equal(consultaInsert.sql.includes('RETURNING'), true);
        assert.equal(/id_usuario/i.test(columnasInsert), false);
        assert.equal(
            consultas.some(function(consulta) {
                return consulta.sql.includes('MAX(id_usuario)');
            }),
            false
        );
    } finally {
        pool.connect = connectOriginal;
    }
});

test('registra clientes sin calcular el ID y recibe el ID de PostgreSQL', async () => {
    const consultas = [];
    const cliente = {
        async query(sql, valores) {
            consultas.push({
                sql: sql,
                valores: valores
            });
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
                return { rows: [] };
            }
            if (sql.includes('LOWER(correo)')) {
                return { rows: [] };
            }
            if (sql.includes('FROM roles')) {
                return { rows: [{ id_rol: 3 }] };
            }
            if (sql.includes('INSERT INTO usuarios')) {
                return {
                    rows: [{
                        id: 321,
                        nombre: 'Cliente',
                        apellido: 'Prueba',
                        email: 'cliente@example.com',
                        run: '123456785',
                        activo: 1
                    }]
                };
            }
            return { rows: [] };
        },
        release() {}
    };

    const connectOriginal = pool.connect;
    pool.connect = async function() {
        return cliente;
    };

    try {
        const req = {
            body: {
                nombre: 'Cliente',
                apellido: 'Prueba',
                email: 'cliente@example.com',
                run: '12.345.678-5',
                region: 'Metropolitana',
                comuna: 'Santiago',
                direccion: 'Calle Ficticia 123',
                password: 'Inicial123'
            }
        };
        const res = crearRespuesta();

        await authController.registrarUsuario(req, res);

        assert.equal(res.codigo, 201);
        assert.equal(res.cuerpo.usuario.id, 321);

        const consultaInsert = consultas.find(function(consulta) {
            return consulta.sql.includes('INSERT INTO usuarios');
        });
        const columnasInsert = consultaInsert.sql.split('VALUES')[0];

        assert.equal(consultaInsert.sql.includes('RETURNING'), true);
        assert.equal(/id_usuario/i.test(columnasInsert), false);
        assert.equal(
            consultas.some(function(consulta) {
                return consulta.sql.includes('MAX(id_usuario)');
            }),
            false
        );
    } finally {
        pool.connect = connectOriginal;
    }
});

test('rechaza RUN duplicado al crear vendedor', async () => {
    const cliente = {
        async query(sql) {
            if (sql === 'BEGIN') {
                return { rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
                return { rows: [] };
            }
            if (sql.includes('LOWER(u.correo)')) {
                return {
                    rows: [{
                        id_usuario: 20,
                        correo: 'otro@example.com',
                        run: '123456785'
                    }]
                };
            }
            return { rows: [] };
        },
        release() {}
    };

    const connectOriginal = pool.connect;
    pool.connect = async function() {
        return cliente;
    };

    try {
        const req = {
            body: {
                nombre: 'Vendedora',
                apellido: 'Duplicada',
                correo: 'otra@example.com',
                run: '12.345.678-5',
                password: 'Inicial123'
            }
        };
        const res = crearRespuesta();

        await usuariosController.crearVendedor(req, res);

        assert.equal(res.codigo, 409);
        assert.equal(res.cuerpo.mensaje, 'El RUN ya está registrado');
    } finally {
        pool.connect = connectOriginal;
    }
});

test('rechaza correo duplicado al crear vendedor', async () => {
    const cliente = {
        async query(sql) {
            if (sql === 'BEGIN') {
                return { rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
                return { rows: [] };
            }
            if (sql.includes('LOWER(u.correo)')) {
                return {
                    rows: [{
                        id_usuario: 20,
                        correo: 'duplicado@example.com',
                        run: '111111111'
                    }]
                };
            }
            return { rows: [] };
        },
        release() {}
    };

    const connectOriginal = pool.connect;
    pool.connect = async function() {
        return cliente;
    };

    try {
        const req = {
            body: {
                nombre: 'Vendedora',
                apellido: 'Duplicada',
                correo: 'duplicado@example.com',
                run: '12.345.678-5',
                password: 'Inicial123'
            }
        };
        const res = crearRespuesta();

        await usuariosController.crearVendedor(req, res);

        assert.equal(res.codigo, 409);
        assert.equal(res.cuerpo.mensaje, 'El correo electrónico ya está registrado');
    } finally {
        pool.connect = connectOriginal;
    }
});

test('rechaza contraseña inicial corta', async () => {
    const req = {
        body: {
            nombre: 'Vendedora',
            apellido: 'Prueba',
            correo: 'vendedora@example.com',
            run: '12.345.678-5',
            password: '1234567'
        }
    };
    const res = crearRespuesta();

    await usuariosController.crearVendedor(req, res);

    assert.equal(res.codigo, 400);
});

test('actualizar usuario utiliza fecha_actualizacion', async () => {
    const consultas = [];
    const queryOriginal = pool.query;

    pool.query = async function(sql) {
        consultas.push(sql);

        if (sql.includes('FROM usuarios u')) {
            return {
                rows: [{
                    id: 42,
                    nombre: 'Cliente',
                    apellido: 'Prueba',
                    email: 'cliente@example.com',
                    rol: 'CLIENTE',
                    activo: 1,
                    run: '123456785',
                    region: 'Metropolitana',
                    comuna: 'Santiago',
                    direccion: 'Calle Ficticia 123'
                }]
            };
        }

        if (sql.includes('FROM roles')) {
            return { rows: [{ id_rol: 3 }] };
        }

        if (sql.includes('UPDATE usuarios')) {
            return { rowCount: 1 };
        }

        return { rows: [] };
    };

    try {
        const req = {
            params: {
                id: '42'
            },
            usuario: {
                id: '42',
                rol: 'CLIENTE'
            },
            body: {}
        };
        const res = crearRespuesta();

        await usuariosController.actualizarUsuario(req, res);

        assert.equal(res.codigo, 200);
        assert.equal(
            consultas.some(function(sql) {
                return sql.includes('UPDATE usuarios') &&
                    sql.includes('fecha_actualizacion = CURRENT_TIMESTAMP');
            }),
            true
        );
    } finally {
        pool.query = queryOriginal;
    }
});

test('desactivar usuario utiliza fecha_actualizacion', async () => {
    const consultas = [];
    const queryOriginal = pool.query;

    pool.query = async function(sql) {
        consultas.push(sql);

        if (sql.includes('UPDATE usuarios')) {
            return { rowCount: 1 };
        }

        if (sql.includes('FROM usuarios u')) {
            return {
                rows: [{
                    id: 42,
                    nombre: 'Cliente',
                    apellido: 'Prueba',
                    email: 'cliente@example.com',
                    rol: 'CLIENTE',
                    activo: 0
                }]
            };
        }

        return { rows: [] };
    };

    try {
        const req = {
            params: {
                id: '42'
            },
            usuario: {
                id: '1',
                rol: 'ADMINISTRADOR'
            }
        };
        const res = crearRespuesta();

        await usuariosController.desactivarUsuario(req, res);

        assert.equal(res.codigo, 200);
        assert.equal(
            consultas.some(function(sql) {
                return sql.includes('UPDATE usuarios') &&
                    sql.includes('fecha_actualizacion = CURRENT_TIMESTAMP');
            }),
            true
        );
    } finally {
        pool.query = queryOriginal;
    }
});

test('cambia correctamente una contraseña', async () => {
    const hashActual = await bcrypt.hash('Actual123', 4);
    const queryOriginal = pool.query;
    let consultaActualizacion = null;

    pool.query = async function(sql, valores) {
        if (
            sql.includes('SELECT') &&
            sql.includes('password_hash')
        ) {
            return {
                rows: [{
                    id: 123,
                    password_hash: hashActual,
                    activo: 1
                }]
            };
        }

        if (sql.includes('UPDATE usuarios')) {
            consultaActualizacion = valores;
            return { rowCount: 1 };
        }

        return { rows: [] };
    };

    try {
        const req = {
            usuario: {
                id: '123'
            },
            body: {
                passwordActual: 'Actual123',
                passwordNueva: 'Nueva1234'
            }
        };
        const res = crearRespuesta();

        await authController.cambiarPassword(req, res);

        assert.equal(res.codigo, 200);
        assert.equal(consultaActualizacion.length, 2);
        assert.equal(await bcrypt.compare('Nueva1234', consultaActualizacion[0]), true);
    } finally {
        pool.query = queryOriginal;
    }
});

test('rechaza una contraseña actual incorrecta', async () => {
    const hashActual = await bcrypt.hash('Actual123', 4);
    const queryOriginal = pool.query;

    pool.query = async function(sql) {
        if (sql.includes('password_hash')) {
            return {
                rows: [{
                    id: 123,
                    password_hash: hashActual,
                    activo: 1
                }]
            };
        }
        return { rows: [] };
    };

    try {
        const req = {
            usuario: {
                id: '123'
            },
            body: {
                passwordActual: 'Incorrecta123',
                passwordNueva: 'Nueva1234'
            }
        };
        const res = crearRespuesta();

        await authController.cambiarPassword(req, res);

        assert.equal(res.codigo, 401);
    } finally {
        pool.query = queryOriginal;
    }
});
