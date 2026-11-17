const pool = require('../db');



// PREPARAR PRODUCTOS PARA EL FRONTEND - KATY


function prepararProducto(producto) {

    return {
        id: Number(producto.id),
        codigo: producto.codigo,
        nombre: producto.nombre,
        marca: producto.marca,
        modelo: producto.modelo,
        categoria: producto.categoria,
        precio: Number(producto.precio),

        precioAnterior:
            producto.precioAnterior === null ||
            producto.precioAnterior === undefined
                ? null
                : Number(producto.precioAnterior),

        stock: Number(producto.stock),
        descripcion: producto.descripcion,
        imagen: producto.imagen,
        origen: producto.origen,
        creado_en: producto.creado_en
    };
}



// VALIDAR DATOS DEL PRODUCTO - KATY


function validarDatosProducto(datosProducto) {

    const codigo = datosProducto.codigo;
    const nombre = datosProducto.nombre;
    const marca = datosProducto.marca;
    const modelo = datosProducto.modelo;
    const categoria = datosProducto.categoria;
    const precio = datosProducto.precio;
    const precioAnterior = datosProducto.precioAnterior;
    const stock = datosProducto.stock;
    const descripcion = datosProducto.descripcion;
    const imagen = datosProducto.imagen;

    // Validar campos principales

    if (
        typeof codigo !== 'string' ||
        !codigo.trim() ||
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        typeof marca !== 'string' ||
        !marca.trim() ||
        typeof modelo !== 'string' ||
        !modelo.trim() ||
        typeof categoria !== 'string' ||
        !categoria.trim() ||
        typeof precio !== 'number' ||
        !Number.isFinite(precio) ||
        precio < 0 ||
        !Number.isInteger(stock) ||
        stock < 0
    ) {
        return 'Debes ingresar datos válidos para el producto';
    }

    // Validar precio anterior

    if (
        precioAnterior !== undefined &&
        precioAnterior !== null &&
        (
            typeof precioAnterior !== 'number' ||
            !Number.isFinite(precioAnterior) ||
            precioAnterior <= precio
        )
    ) {
        return 'El precio anterior debe ser mayor al precio actual';
    }

    // Validar descripción

    if (
        descripcion !== undefined &&
        descripcion !== null &&
        typeof descripcion !== 'string'
    ) {
        return 'La descripción debe ser un texto válido';
    }

    // Validar imagen

    if (
        imagen !== undefined &&
        imagen !== null &&
        typeof imagen !== 'string'
    ) {
        return 'La imagen debe ser un texto válido';
    }

    // Sin errores

    return null;
}


// LISTAR TODOS LOS PRODUCTOS - KATY


async function listarProductos(req, res) {

    try {

        const resultado = await pool.query(
            `SELECT
                id,
                codigo,
                nombre,
                marca,
                modelo,
                categoria,
                precio,
                precio_anterior AS "precioAnterior",
                stock,
                descripcion,
                imagen,
                origen,
                creado_en
             FROM productos
             ORDER BY id`
        );

        // Preparar los productos para React

        const productos = resultado.rows.map(prepararProducto);

        return res.status(200).json(productos);

    } catch (error) {

        console.error(
            'Error al listar productos:',
            error.message
        );

        return res.status(503).json({
            mensaje: 'No fue posible consultar los productos'
        });
    }
}



// CONSULTAR PRODUCTO POR ID - KATY


async function obtenerProductoPorId(req, res) {

    // Obtener el ID desde la URL

    const id = Number(req.params.id);

    // Validar el identificador

    if (!Number.isSafeInteger(id) || id <= 0) {

        return res.status(400).json({
            mensaje: 'El ID debe ser un número entero positivo'
        });
    }

    try {

        // Consultar producto en PostgreSQL

        const resultado = await pool.query(
            `SELECT
                id,
                codigo,
                nombre,
                marca,
                modelo,
                categoria,
                precio,
                precio_anterior AS "precioAnterior",
                stock,
                descripcion,
                imagen,
                origen,
                creado_en
             FROM productos
             WHERE id = $1`,
            [id]
        );

        // Comprobar si existe

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        // Preparar producto para React

        const producto = prepararProducto(
            resultado.rows[0]
        );

        return res.status(200).json(producto);

    } catch (error) {

        console.error(
            'Error al consultar producto:',
            error.message
        );

        return res.status(503).json({
            mensaje: 'No fue posible consultar el producto'
        });
    }
}



// REGISTRAR PRODUCTO - KATY


async function registrarProducto(req, res) {

    // Obtener los datos del cliente

    const datosProducto = req.body || {};

    // Validar los datos

    const errorValidacion = validarDatosProducto(
        datosProducto
    );

    if (errorValidacion !== null) {

        return res.status(400).json({
            mensaje: errorValidacion
        });
    }

    // Obtener cada propiedad

    const codigo = datosProducto.codigo.trim().toUpperCase();
    const nombre = datosProducto.nombre.trim();
    const marca = datosProducto.marca.trim();
    const modelo = datosProducto.modelo.trim();
    const categoria = datosProducto.categoria.trim();
    const precio = datosProducto.precio;
    const precioAnterior = datosProducto.precioAnterior;
    const stock = datosProducto.stock;
    const descripcion = datosProducto.descripcion;
    const imagen = datosProducto.imagen;

    try {

        // Registrar producto en PostgreSQL

        const resultado = await pool.query(
            `INSERT INTO productos (
                codigo,
                nombre,
                marca,
                modelo,
                categoria,
                precio,
                precio_anterior,
                stock,
                descripcion,
                imagen,
                origen
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10, $11
            )
            RETURNING
                id,
                codigo,
                nombre,
                marca,
                modelo,
                categoria,
                precio,
                precio_anterior AS "precioAnterior",
                stock,
                descripcion,
                imagen,
                origen,
                creado_en`,
            [
                codigo,
                nombre,
                marca,
                modelo,
                categoria,
                precio,
                precioAnterior ?? null,
                stock,
                descripcion ?? null,
                imagen ?? null,
                'EC2'
            ]
        );

        // Preparar producto registrado

        const producto = prepararProducto(
            resultado.rows[0]
        );

        return res.status(201).json(producto);

    } catch (error) {

        // Código de producto duplicado

        if (error.code === '23505') {

            return res.status(409).json({
                mensaje: 'Ya existe un producto con ese código o identificador'
            });
        }

        console.error(
            'Error al registrar producto:',
            error.message
        );

        return res.status(503).json({
            mensaje: 'No fue posible registrar el producto'
        });
    }
}


// MODIFICAR PRODUCTO - KATY


async function modificarProducto(req, res) {

    // Obtener identificador

    const id = Number(req.params.id);

    // Validar identificador

    if (!Number.isSafeInteger(id) || id <= 0) {

        return res.status(400).json({
            mensaje: 'El ID debe ser un número entero positivo'
        });
    }

    // Obtener datos enviados

    const datosProducto = req.body || {};

    // Validar datos

    const errorValidacion = validarDatosProducto(
        datosProducto
    );

    if (errorValidacion !== null) {

        return res.status(400).json({
            mensaje: errorValidacion
        });
    }

    // Obtener cada propiedad

    const codigo = datosProducto.codigo.trim().toUpperCase();
    const nombre = datosProducto.nombre.trim();
    const marca = datosProducto.marca.trim();
    const modelo = datosProducto.modelo.trim();
    const categoria = datosProducto.categoria.trim();
    const precio = datosProducto.precio;
    const precioAnterior = datosProducto.precioAnterior;
    const stock = datosProducto.stock;
    const descripcion = datosProducto.descripcion;
    const imagen = datosProducto.imagen;

    try {

        // Actualizar producto

        const resultado = await pool.query(
            `UPDATE productos
             SET
                codigo = $1,
                nombre = $2,
                marca = $3,
                modelo = $4,
                categoria = $5,
                precio = $6,
                precio_anterior = $7,
                stock = $8,
                descripcion = $9,
                imagen = $10
             WHERE id = $11
             RETURNING
                id,
                codigo,
                nombre,
                marca,
                modelo,
                categoria,
                precio,
                precio_anterior AS "precioAnterior",
                stock,
                descripcion,
                imagen,
                origen,
                creado_en`,
            [
                codigo,
                nombre,
                marca,
                modelo,
                categoria,
                precio,
                precioAnterior ?? null,
                stock,
                descripcion ?? null,
                imagen ?? null,
                id
            ]
        );

        // Comprobar si existe

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        // Preparar producto actualizado

        const producto = prepararProducto(
            resultado.rows[0]
        );

        return res.status(200).json(producto);

    } catch (error) {

        // Restricción de valor único

        if (error.code === '23505') {

            return res.status(409).json({
                mensaje: 'Ya existe un producto con ese código o identificador'
            });
        }

        console.error(
            'Error al modificar producto:',
            error.message
        );

        return res.status(503).json({
            mensaje: 'No fue posible modificar el producto'
        });
    }
}



// ELIMINAR PRODUCTO - KATY

async function eliminarProducto(req, res) {

    // Obtener identificador

    const id = Number(req.params.id);

    // Validar identificador

    if (!Number.isSafeInteger(id) || id <= 0) {

        return res.status(400).json({
            mensaje: 'El ID debe ser un número entero positivo'
        });
    }

    try {

        // Eliminar producto de PostgreSQL

        const resultado = await pool.query(
            `DELETE FROM productos
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        // Comprobar si existía

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        // Confirmar eliminación

        return res.status(200).json({
            mensaje: 'Producto eliminado correctamente',
            id: Number(resultado.rows[0].id)
        });

    } catch (error) {

        // Producto asociado a pedidos

        if (error.code === '23503') {

            return res.status(409).json({
                mensaje: 'No se puede eliminar un producto asociado a pedidos'
            });
        }

        console.error(
            'Error al eliminar producto:',
            error.message
        );

        return res.status(503).json({
            mensaje: 'No fue posible eliminar el producto'
        });
    }
}


// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

module.exports = {
    listarProductos: listarProductos,
    obtenerProductoPorId: obtenerProductoPorId,
    registrarProducto: registrarProducto,
    modificarProducto: modificarProducto,
    eliminarProducto: eliminarProducto
};