const pool = require('../db');



// PREPARAR PRODUCTOS PARA REACT - KATY


function prepararProducto(producto) {

    return {
        id: Number(producto.id_producto),
        codigo: producto.sku,
        nombre: producto.nombre,
        marca: producto.marca,
        modelo: producto.modelo,
        categoria: producto.categoria,
        id_categoria: Number(producto.id_categoria),
        precio: Number(producto.precio_clp),
        precioAnterior: null,
        stock: Number(producto.stock),
        descripcion: producto.descripcion,
        imagen: producto.imagen_url,
        activo: Number(producto.activo)
    };
}



// CONSULTA BASE DE PRODUCTOS - KATY


const consultaProductos = `
    SELECT
        p.id_producto,
        p.id_categoria,
        p.sku,
        p.nombre,
        p.marca,
        p.modelo,
        p.descripcion,
        p.precio_clp,
        p.stock,
        p.imagen_url,
        p.activo,
        c.nombre AS categoria
    FROM productos p
    INNER JOIN categorias c
        ON p.id_categoria = c.id_categoria
`;



// VALIDAR DATOS DEL PRODUCTO - KATY


function validarDatosProducto(datosProducto) {

    const codigo = datosProducto.codigo;
    const nombre = datosProducto.nombre;
    const marca = datosProducto.marca;
    const modelo = datosProducto.modelo;
    const categoria = datosProducto.categoria;
    const precio = datosProducto.precio;
    const stock = datosProducto.stock;
    const descripcion = datosProducto.descripcion;
    const imagen = datosProducto.imagen;
    const precioAnterior = datosProducto.precioAnterior;

    // Validar los datos obligatorios

    if (
        typeof codigo !== 'string' ||
        !codigo.trim() ||
        codigo.trim().length > 50 ||
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        nombre.trim().length > 150 ||
        typeof categoria !== 'string' ||
        !categoria.trim() ||
        typeof precio !== 'number' ||
        !Number.isFinite(precio) ||
        precio < 0 ||
        !Number.isInteger(stock) ||
        stock < 0
    ) {
        return 'Debes ingresar código, nombre, categoría, precio y stock válidos';
    }

    // Validar marca

    if (
        marca !== undefined &&
        marca !== null &&
        (
            typeof marca !== 'string' ||
            marca.length > 100
        )
    ) {
        return 'La marca debe ser un texto válido';
    }

    // Validar modelo

    if (
        modelo !== undefined &&
        modelo !== null &&
        (
            typeof modelo !== 'string' ||
            modelo.length > 100
        )
    ) {
        return 'El modelo debe ser un texto válido';
    }

    // Validar descripción

    if (
        descripcion !== undefined &&
        descripcion !== null &&
        (
            typeof descripcion !== 'string' ||
            descripcion.length > 500
        )
    ) {
        return 'La descripción debe tener como máximo 500 caracteres';
    }

    // Validar imagen

    if (
        imagen !== undefined &&
        imagen !== null &&
        (
            typeof imagen !== 'string' ||
            imagen.length > 500
        )
    ) {
        return 'La imagen debe ser un texto válido';
    }

    // El modelo actual no contempla precio anterior

    if (
        precioAnterior !== undefined &&
        precioAnterior !== null
    ) {
        return 'El modelo de base de datos todavía no contempla precioAnterior';
    }

    return null;
}



// BUSCAR CATEGORÍA POR NOMBRE - KATY


async function buscarCategoria(nombreCategoria) {

    const resultado = await pool.query(
        `SELECT id_categoria
         FROM categorias
         WHERE LOWER(nombre) = LOWER($1)`,
        [nombreCategoria.trim()]
    );

    if (resultado.rows.length === 0) {
        return null;
    }

    return Number(resultado.rows[0].id_categoria);
}



// CONSULTAR PRODUCTO EN POSTGRESQL - KATY


async function buscarProductoPorId(id) {

    const resultado = await pool.query(
        consultaProductos + `
        WHERE p.id_producto = $1`,
        [id]
    );

    if (resultado.rows.length === 0) {
        return null;
    }

    return prepararProducto(resultado.rows[0]);
}



// LISTAR TODOS LOS PRODUCTOS - KATY


async function listarProductos(req, res) {

    try {

        const resultado = await pool.query(
            consultaProductos + `
            ORDER BY p.id_producto`
        );

        const productos = resultado.rows.map(
            prepararProducto
        );

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

    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {

        return res.status(400).json({
            mensaje: 'El ID debe ser un número entero positivo'
        });
    }

    try {

        const producto = await buscarProductoPorId(id);

        if (producto === null) {

            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

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

    const datosProducto = req.body || {};

    const errorValidacion = validarDatosProducto(
        datosProducto
    );

    if (errorValidacion !== null) {

        return res.status(400).json({
            mensaje: errorValidacion
        });
    }

    // Obtener datos

    const codigo = datosProducto.codigo.trim().toUpperCase();
    const nombre = datosProducto.nombre.trim();

    const marca = datosProducto.marca === undefined ||
                  datosProducto.marca === null
        ? null
        : datosProducto.marca.trim();

    const modelo = datosProducto.modelo === undefined ||
                   datosProducto.modelo === null
        ? null
        : datosProducto.modelo.trim();

    const categoria = datosProducto.categoria.trim();
    const precio = datosProducto.precio;
    const stock = datosProducto.stock;

    const descripcion = datosProducto.descripcion === undefined
        ? null
        : datosProducto.descripcion;

    const imagen = datosProducto.imagen === undefined
        ? null
        : datosProducto.imagen;

    try {

        // Buscar categoría

        const idCategoria = await buscarCategoria(categoria);

        if (idCategoria === null) {

            return res.status(400).json({
                mensaje: 'La categoría indicada no existe'
            });
        }

        // Registrar producto

        const resultado = await pool.query(
            `INSERT INTO productos (
                id_categoria,
                sku,
                nombre,
                marca,
                modelo,
                descripcion,
                precio_clp,
                stock,
                imagen_url,
                activo
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10
            )
            RETURNING id_producto`,
            [
                idCategoria,
                codigo,
                nombre,
                marca,
                modelo,
                descripcion,
                precio,
                stock,
                imagen,
                1
            ]
        );

        const idProducto = Number(
            resultado.rows[0].id_producto
        );

        const producto = await buscarProductoPorId(idProducto);

        return res.status(201).json(producto);

    } catch (error) {

        if (error.code === '23505') {

            return res.status(409).json({
                mensaje: 'Ya existe un producto con ese código'
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

    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {

        return res.status(400).json({
            mensaje: 'El ID debe ser un número entero positivo'
        });
    }

    const datosProducto = req.body || {};

    const errorValidacion = validarDatosProducto(
        datosProducto
    );

    if (errorValidacion !== null) {

        return res.status(400).json({
            mensaje: errorValidacion
        });
    }

    // Obtener datos

    const codigo = datosProducto.codigo.trim().toUpperCase();
    const nombre = datosProducto.nombre.trim();

    const marca = datosProducto.marca === undefined ||
                  datosProducto.marca === null
        ? null
        : datosProducto.marca.trim();

    const modelo = datosProducto.modelo === undefined ||
                   datosProducto.modelo === null
        ? null
        : datosProducto.modelo.trim();

    const categoria = datosProducto.categoria.trim();
    const precio = datosProducto.precio;
    const stock = datosProducto.stock;

    const descripcion = datosProducto.descripcion === undefined
        ? null
        : datosProducto.descripcion;

    const imagen = datosProducto.imagen === undefined
        ? null
        : datosProducto.imagen;

    try {

        // Buscar categoría

        const idCategoria = await buscarCategoria(categoria);

        if (idCategoria === null) {

            return res.status(400).json({
                mensaje: 'La categoría indicada no existe'
            });
        }

        // Actualizar producto

        const resultado = await pool.query(
            `UPDATE productos
             SET
                id_categoria = $1,
                sku = $2,
                nombre = $3,
                marca = $4,
                modelo = $5,
                descripcion = $6,
                precio_clp = $7,
                stock = $8,
                imagen_url = $9
             WHERE id_producto = $10
             RETURNING id_producto`,
            [
                idCategoria,
                codigo,
                nombre,
                marca,
                modelo,
                descripcion,
                precio,
                stock,
                imagen,
                id
            ]
        );

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        const producto = await buscarProductoPorId(id);

        return res.status(200).json(producto);

    } catch (error) {

        if (error.code === '23505') {

            return res.status(409).json({
                mensaje: 'Ya existe un producto con ese código'
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

    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {

        return res.status(400).json({
            mensaje: 'El ID debe ser un número entero positivo'
        });
    }

    try {

        const resultado = await pool.query(
            `DELETE FROM productos
             WHERE id_producto = $1
             RETURNING id_producto`,
            [id]
        );

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        return res.status(200).json({
            mensaje: 'Producto eliminado correctamente',
            id: Number(resultado.rows[0].id_producto)
        });

    } catch (error) {

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


// EXPORTAR FUNCIONES


module.exports = {
    listarProductos: listarProductos,
    obtenerProductoPorId: obtenerProductoPorId,
    registrarProducto: registrarProducto,
    modificarProducto: modificarProducto,
    eliminarProducto: eliminarProducto
};