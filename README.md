# sonido-vivo-backend
Backend de Sonido Vivo desarrollado con Node.js, Express y PostgreSQL

# Sonido Vivo - Backend

## Tecnologías

- Node.js y Express
- PostgreSQL mediante `pg`
- JWT para autenticación y autorización
- bcrypt para el hash de contraseñas
- Swagger UI / OpenAPI 3 para documentación interactiva

## Estructura principal

```text
controllers/       Controladores de autenticación, usuarios y productos
routes/            Rutas Express
middlewares/       Verificación de JWT y roles
utils/             Validaciones compartidas
docs/openapi.json  Contrato OpenAPI de autenticación y usuarios
docs/swagger.js    Registro de Swagger UI
tests/             Pruebas automatizadas
server.js          Configuración e inicio de Express
```

## Instalación e inicio

```bash
npm install
node server.js
```

El servidor escucha en el puerto `3000`. Las variables de entorno requeridas
para la conexión y JWT deben configurarse localmente; no se documentan ni
incluyen valores secretos en este repositorio.

## Swagger UI

Abrir [http://localhost:3000/api/docs](http://localhost:3000/api/docs). La
interfaz ofrece **Try it out** y el botón **Authorize** para proporcionar un
JWT al probar rutas protegidas. Los endpoints públicos de registro e inicio de
sesión no requieren autorización. La especificación usa el mismo origen que
Swagger UI.

La documentación actual cubre:

- Autenticación: registro, login de cliente, login de personal, cambio de
  contraseña, perfil y acceso administrativo.
- Usuarios: listado, creación de vendedores, consulta, actualización y
  desactivación lógica.

Los endpoints de productos existen en la API, pero aún no están incluidos en
esta documentación. Los endpoints de pedidos tampoco se documentan aquí.
OpenAPI está organizado para que se puedan agregar después nuevos tags y
paths en `docs/openapi.json`.

## Autenticación y permisos

Los endpoints protegidos usan `Authorization: Bearer <JWT>`. El token se
obtiene mediante los endpoints de inicio de sesión. Los roles del backend son
`CLIENTE`, `VENDEDOR` y `ADMINISTRADOR`.

- `CLIENTE` y `VENDEDOR` pueden consultar y actualizar su propio perfil.
- En su propio perfil, `CLIENTE` y `VENDEDOR` solo pueden modificar nombre,
  apellido, región, comuna y dirección.
- RUN, correo, rol y estado de cuenta no se cambian mediante la actualización
  del perfil. La contraseña se cambia exclusivamente en
  `PATCH /api/v1/auth/cambiar-password`.
- `ADMINISTRADOR` puede listar y crear usuarios, consultar perfiles y
  desactivar cuentas; la desactivación es lógica y no elimina el registro.

## Endpoints documentados

| Módulo | Método | Endpoint | Acceso |
|---|---|---|---|
| Autenticación | POST | `/api/v1/auth/registro` | Público |
| Autenticación | POST | `/api/v1/auth/login` | Público |
| Autenticación | POST | `/api/v1/auth/login-personal` | Público |
| Autenticación | PATCH | `/api/v1/auth/cambiar-password` | JWT |
| Autenticación | GET | `/api/v1/auth/perfil` | JWT |
| Autenticación | GET | `/api/v1/auth/administracion` | JWT, ADMINISTRADOR |
| Usuarios | GET | `/api/v1/usuarios` | JWT, ADMINISTRADOR |
| Usuarios | POST | `/api/v1/usuarios` | JWT, ADMINISTRADOR |
| Usuarios | GET | `/api/v1/usuarios/{id}` | JWT, propietario o ADMINISTRADOR |
| Usuarios | PUT | `/api/v1/usuarios/{id}` | JWT, propietario o ADMINISTRADOR |
| Usuarios | DELETE | `/api/v1/usuarios/{id}` | JWT, ADMINISTRADOR |

## Frontend

Repositorio frontend: [Sonido-Vivo-Proyecto](https://github.com/kathryn-mt/Sonido-Vivo-Proyecto).

# Avance del proyecto - Sonido Vivo Backend

| Operación | Estado | Qué significa |
|---|---|---|
| Conexión EC2 con PostgreSQL RDS | Listo | El backend se conecta correctamente a la base de datos de AWS mediante SSL. |
| Servidor Node.js y Express | Listo | El servidor funciona en el puerto 3000 y responde correctamente. |
| Ruta de saludo | Listo | La ruta `/api/saludo` responde correctamente. |
| Consultar productos | Listo | La ruta GET `/api/v1/productos` permite consultar los productos almacenados en PostgreSQL. |
| Registrar productos | Listo | La ruta POST `/api/v1/productos` permite registrar productos en PostgreSQL. |
| Tabla de usuarios | Listo | La tabla existe en PostgreSQL y conserva los datos después de reiniciar el backend. Las contraseñas se almacenan mediante hash. |
| Inicio de sesión | Listo | El login consulta al usuario, comprueba el hash de la contraseña y entrega un JWT. |
| Registro de usuarios | Listo | El registro guarda los usuarios en PostgreSQL con el rol asignado por el servidor. |
| Modificar usuarios | Listo | Se comprobó la modificación de datos y su persistencia en PostgreSQL. |
| Listar usuarios | Listo | Se comprobó el listado con administrador y la restricción de acceso para clientes. |
| Eliminar o desactivar usuarios | Listo | Se comprobó la desactivación lógica, la persistencia del registro y el bloqueo del inicio de sesión. |
| Swagger de autenticación y usuarios | Listo | OpenAPI 3 se sirve en `/api/docs` e incluye pruebas interactivas y autenticación JWT. |

## Estado general

El backend de Sonido Vivo cuenta con conexión a PostgreSQL mediante Amazon RDS, servidor Node.js y Express, gestión de productos, autenticación mediante JWT y operaciones CRUD de usuarios.