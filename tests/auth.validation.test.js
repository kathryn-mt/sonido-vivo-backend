const test = require('node:test');
const assert = require('node:assert/strict');

const {
    validarCorreo,
    validarRun,
    validarPassword
} = require('../utils/auth.validation');

test('normaliza y valida RUN', () => {
    assert.equal(validarRun('12.345.678-5'), '123456785');
});

test('rechaza RUN con digito verificador incorrecto', () => {
    assert.equal(validarRun('123456788'), null);
});

test('rechaza RUN sin formato valido', () => {
    assert.equal(validarRun('RUN_FICTICIO_VALIDO'), null);
});

test('valida correo y longitud basica', () => {
    assert.equal(validarCorreo('cliente@example.com'), true);
    assert.equal(validarCorreo('correo-invalido'), false);
});

test('exige al menos ocho caracteres para password', () => {
    assert.equal(validarPassword('12345678'), true);
    assert.equal(validarPassword('1234567'), false);
});
