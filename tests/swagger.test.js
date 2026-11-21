const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const express = require('express');

const openapi = require('../docs/openapi.json');
const swagger = require('../docs/swagger');

const endpointsEsperados = {
    '/api/v1/auth/registro': ['post'],
    '/api/v1/auth/login': ['post'],
    '/api/v1/auth/login-personal': ['post'],
    '/api/v1/auth/cambiar-password': ['patch'],
    '/api/v1/auth/perfil': ['get'],
    '/api/v1/auth/administracion': ['get'],
    '/api/v1/usuarios': ['get', 'post'],
    '/api/v1/usuarios/{id}': ['get', 'put', 'delete'],
    '/api/v1/usuarios/{id}/reactivar': ['patch']
};

function comprobarReferencias(documento, valor) {
    if (Array.isArray(valor)) {
        for (const elemento of valor) {
            comprobarReferencias(documento, elemento);
        }
        return;
    }

    if (!valor || typeof valor !== 'object') {
        return;
    }

    if (typeof valor.$ref === 'string') {
        assert.ok(valor.$ref.startsWith('#/'), 'referencia local requerida');
        let destino = documento;
        const partes = valor.$ref.slice(2).split('/');

        for (const parte of partes) {
            const clave = parte.replace(/~1/g, '/').replace(/~0/g, '~');
            assert.ok(
                destino && Object.prototype.hasOwnProperty.call(destino, clave),
                'referencia OpenAPI inexistente: ' + valor.$ref
            );
            destino = destino[clave];
        }
    }

    for (const clave of Object.keys(valor)) {
        comprobarReferencias(documento, valor[clave]);
    }
}

test('OpenAPI declara estructura, autenticación y endpoints con métodos reales', () => {
    assert.equal(openapi.openapi, '3.0.3');
    assert.equal(typeof openapi.info.title, 'string');
    assert.deepEqual(Object.keys(endpointsEsperados).sort(), Object.keys(openapi.paths).sort());
    comprobarReferencias(openapi, openapi);

    const rutasAuth = fs.readFileSync(
        require.resolve('../routes/auth.routes'),
        'utf8'
    );
    const rutasUsuarios = fs.readFileSync(
        require.resolve('../routes/usuarios.routes'),
        'utf8'
    );

    for (const ruta of Object.keys(endpointsEsperados)) {
        const metodosDocumentados = Object.keys(openapi.paths[ruta])
            .filter(function(clave) {
                return ['get', 'post', 'put', 'patch', 'delete'].includes(clave);
            })
            .sort();
        assert.deepEqual(metodosDocumentados, endpointsEsperados[ruta].sort());

        for (const metodo of endpointsEsperados[ruta]) {
            assert.equal(typeof openapi.paths[ruta][metodo], 'object');
            assert.ok(openapi.paths[ruta][metodo].operationId);
            assert.ok(openapi.paths[ruta][metodo].responses);

            const esAuth = ruta.startsWith('/api/v1/auth/');
            const prefijo = esAuth ? '/api/v1/auth' : '/api/v1/usuarios';
            let rutaExpress = ruta.slice(prefijo.length);

            if (!rutaExpress) {
                rutaExpress = '/';
            }

            rutaExpress = rutaExpress.replace('{id}', ':id');
            const fuenteRutas = esAuth ? rutasAuth : rutasUsuarios;
            const declaracion = "router." + metodo + "(\n    '" + rutaExpress + "'";

            assert.equal(
                fuenteRutas.includes(declaracion),
                true,
                'ruta documentada debe existir: ' + metodo.toUpperCase() + ' ' + ruta
            );
        }
    }

    assert.deepEqual(
        openapi.components.schemas.RegistroCliente.required,
        [
            'nombre',
            'apellido',
            'email',
            'run',
            'region',
            'comuna',
            'direccion',
            'password'
        ]
    );
    assert.deepEqual(
        Object.keys(openapi.components.schemas.ActualizarPerfilPropio.properties),
        ['nombre', 'apellido', 'region', 'comuna', 'direccion']
    );
    assert.equal(
        openapi.components.schemas.ActualizarPerfilPropio.additionalProperties,
        false
    );

    assert.deepEqual(openapi.paths['/api/v1/auth/registro'].post.security, []);
    assert.deepEqual(openapi.paths['/api/v1/auth/login'].post.security, []);
    assert.deepEqual(openapi.paths['/api/v1/auth/login-personal'].post.security, []);

    for (const ruta of Object.keys(endpointsEsperados)) {
        for (const metodo of endpointsEsperados[ruta]) {
            const operacion = openapi.paths[ruta][metodo];

            if (
                ruta !== '/api/v1/auth/registro' &&
                ruta !== '/api/v1/auth/login' &&
                ruta !== '/api/v1/auth/login-personal'
            ) {
                assert.deepEqual(operacion.security, [{ BearerAuth: [] }]);
            }
        }
    }

    assert.deepEqual(openapi.components.securitySchemes.BearerAuth, {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Introduce el JWT recibido al iniciar sesión. No uses credenciales reales en ejemplos o capturas.'
    });
});

test('OpenAPI incluye ejemplos ficticios sin tokens utilizables ni secretos', () => {
    const textoEspecificacion = JSON.stringify(openapi);

    assert.match(textoEspecificacion, /example\.com/);
    assert.match(textoEspecificacion, /token-ficticio-no-utilizable/);
    assert.doesNotMatch(textoEspecificacion, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
    assert.doesNotMatch(textoEspecificacion, /JWT_SECRET\s*[:=]\s*[^,}]+/);
    assert.doesNotMatch(textoEspecificacion, /password_hash"\s*:/);
});

test('Swagger UI se sirve desde /api/docs y ofrece interfaz interactiva', async () => {
    const app = express();
    swagger.register(app);
    const server = http.createServer(app);

    await new Promise(function(resolve, reject) {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    try {
        const address = server.address();
        const response = await fetch('http://127.0.0.1:' + address.port + '/api/docs/');
        const html = await response.text();
        const configuracionResponse = await fetch(
            'http://127.0.0.1:' + address.port + '/api/docs/swagger-ui-init.js'
        );
        const configuracion = await configuracionResponse.text();

        assert.equal(response.status, 200);
        assert.equal(configuracionResponse.status, 200);
        assert.match(html, /swagger-ui/);
        assert.match(html, /swagger-ui-bundle\.js/);
        assert.match(html, /swagger-ui-init\.js/);
        assert.match(html, /Sonido Vivo API/);
        assert.match(configuracion, /supportedSubmitMethods/);
        assert.match(configuracion, /"tryItOutEnabled":\s*true/);
        assert.match(configuracion, /\/api\/v1\/auth\/registro/);
    } finally {
        await new Promise(function(resolve, reject) {
            server.close(function(error) {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
});
