const pool = require('../db');

// ==========================================
// LISTAR TODOS LOS PRODUCTOS
// ==========================================

async function listarProductos(req, res) {
    try {
        const resultado = await pool.query(
            `SELECT id, nombre, precio, stock, origen, creado_en
             FROM productos
             ORDER BY id`
        );

        return res.status(200).json(resultado.rows);

    } catch (error) {
        console.error('Error al listar productos:', error.message);

        return res.status(503).json({
            mensaje: 'No fue posible consultar los productos'
        });
    }
}

// ==========================================
// CONSULTAR UN PRODUCTO POR ID
// ==========================================

async function obtenerProductoPorId(req, res) {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            mensaje: 'El ID debe ser un número entero positivo'
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT id, nombre, precio, stock, origen, creado_en
             FROM productos
             WHERE id = $1`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        return res.status(200).json(resultado.rows[0]);

    } catch (error) {
        console.error('Error al consultar producto:', error.message);

        return res.status(503).json({
            mensaje: 'No fue posible consultar el producto'
        });
    }
}

// REGISTRAR PRODUCTO - KATY //


async function registrarProducto(req, res) {

    // Obtener los datos enviados por el cliente
    const datosProducto = req.body || {};

    const nombre = datosProducto.nombre;
    const precio = datosProducto.precio;
    const stock = datosProducto.stock;

    // Validar los datos recibidos
    if (
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        typeof precio !== 'number' ||
        !Number.isFinite(precio) ||
        precio < 0 ||
        !Number.isInteger(stock) ||
        stock < 0
    ) {
        return res.status(400).json({
            mensaje: 'Debes ingresar nombre, precio y stock válidos'
        });
    }

    try {

        // Insertar el producto en PostgreSQL
        const resultado = await pool.query(
            `INSERT INTO productos (nombre, precio, stock, origen)
             VALUES ($1, $2, $3, $4)
             RETURNING id, nombre, precio, stock, origen, creado_en`,
            [
                nombre.trim(),
                precio,
                stock,
                'EC2'
            ]
        );

        // Responder con el producto registrado
        return res.status(201).json(resultado.rows[0]);

    } catch (error) {

        console.error(
            'Error al registrar producto:',
            error.message
        );

        return res.status(503).json({
            mensaje: 'No fue posible registrar el producto'
        });
    }
}

// MODIFICAR PRODUCTO - KATY //

async function modificarProducto(req, res) {

    // Obtener el identificador del producto
    const id = Number(req.params.id);

    // Obtener los datos enviados
    const datosProducto = req.body || {};

    const nombre = datosProducto.nombre;
    const precio = datosProducto.precio;
    const stock = datosProducto.stock;

    // Validar el identificador
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            mensaje: 'El ID debe ser un número entero positivo'
        });
    }

    // Validar los datos del producto
    if (
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        typeof precio !== 'number' ||
        !Number.isFinite(precio) ||
        precio < 0 ||
        !Number.isInteger(stock) ||
        stock < 0
    ) {
        return res.status(400).json({
            mensaje: 'Debes ingresar nombre, precio y stock válidos'
        });
    }

    try {

        // Actualizar el producto en PostgreSQL
        const resultado = await pool.query(
            `UPDATE productos
             SET nombre = $1,
                 precio = $2,
                 stock = $3
             WHERE id = $4
             RETURNING id, nombre, precio, stock, origen, creado_en`,
            [
                nombre.trim(),
                precio,
                stock,
                id
            ]
        );

        // Comprobar si existe el producto
        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        // Responder con el producto actualizado
        return res.status(200).json(resultado.rows[0]);

    } catch (error) {

        console.error(
            'Error al modificar producto:',
            error.message
        );

        return res.status(503).json({
            mensaje: 'No fue posible modificar el producto'
        });
    }
}
// ELIMINAR PRODUCTO - KATY //


async function eliminarProducto(req, res) {

    // Obtener el ID del producto
    const id = Number(req.params.id);

    // Validar el identificador
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            mensaje: 'El ID debe ser un número entero positivo'
        });
    }

    try {

        // Eliminar producto por ID
        const resultado = await pool.query(
            `DELETE FROM productos
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        // Comprobar si el producto existía
        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        // Confirmar eliminación
        return res.status(200).json({
            mensaje: 'Producto eliminado correctamente',
            id: resultado.rows[0].id
        });

    } catch (error) {

        // Un producto referenciado por un pedido no debe eliminarse
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

// EXPORTAR FUNCIONES //


module.exports = {
    listarProductos: listarProductos,
    obtenerProductoPorId: obtenerProductoPorId,
    registrarProducto: registrarProducto,
    modificarProducto: modificarProducto,
    eliminarProducto: eliminarProducto
};