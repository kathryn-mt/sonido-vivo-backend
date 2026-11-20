const LIMITE_NOMBRE = 100;
const LIMITE_APELLIDO = 100;
const LIMITE_EMAIL = 255;
const LIMITE_REGION = 100;
const LIMITE_COMUNA = 100;
const LIMITE_DIRECCION = 300;
const LIMITE_PASSWORD = 128;

function limpiarTexto(valor) {
    return typeof valor === 'string' ? valor.trim() : valor;
}

function validarCorreo(correo) {
    return typeof correo === 'string'
        && correo.length <= LIMITE_EMAIL
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function normalizarRun(valor) {
    if (typeof valor !== 'string') {
        return null;
    }

    const run = valor
        .trim()
        .replace(/\./g, '')
        .replace(/-/g, '')
        .replace(/\s/g, '')
        .toUpperCase();

    if (!/^[0-9]{7,8}[0-9K]$/.test(run)) {
        return null;
    }

    return run;
}

function validarDigitoVerificador(runNormalizado) {
    if (!runNormalizado) {
        return false;
    }

    const cuerpo = runNormalizado.slice(0, -1);
    const digitoIngresado = runNormalizado.slice(-1);
    let suma = 0;
    let multiplicador = 2;

    for (let indice = cuerpo.length - 1; indice >= 0; indice -= 1) {
        suma += Number(cuerpo[indice]) * multiplicador;
        multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto = 11 - (suma % 11);
    let digitoEsperado;

    if (resto === 11) {
        digitoEsperado = '0';
    } else if (resto === 10) {
        digitoEsperado = 'K';
    } else {
        digitoEsperado = String(resto);
    }

    return digitoIngresado === digitoEsperado;
}

function validarRun(valor) {
    const run = normalizarRun(valor);

    if (!run || run.length > 9) {
        return null;
    }

    return validarDigitoVerificador(run) ? run : null;
}

function validarPassword(password) {
    return typeof password === 'string'
        && password.trim().length >= 8
        && password.length >= 8
        && password.length <= LIMITE_PASSWORD;
}

module.exports = {
    LIMITE_NOMBRE,
    LIMITE_APELLIDO,
    LIMITE_EMAIL,
    LIMITE_REGION,
    LIMITE_COMUNA,
    LIMITE_DIRECCION,
    LIMITE_PASSWORD,
    limpiarTexto,
    validarCorreo,
    normalizarRun,
    validarRun,
    validarPassword
};
