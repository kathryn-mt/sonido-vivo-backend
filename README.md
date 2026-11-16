# sonido-vivo-backend
Backend de Sonido Vivo desarrollado con Node.js, Express y PostgreSQL


# Avance del proyecto - Sonido Vivo Backend

| Operación | Estado | Qué significa |
|---|---|---|
| Conexión EC2 con PostgreSQL RDS | Listo | El backend se conecta correctamente a la base de datos de AWS mediante SSL. |
| Servidor Node.js y Express | Listo | El servidor funciona en el puerto 3000 y responde correctamente. |
| Ruta de saludo | Listo | La ruta `/api/saludo` responde correctamente. |
| Consultar productos | Listo | La ruta GET `/api/productos` permite consultar los productos almacenados en PostgreSQL. |
| Registrar productos | Listo | La ruta POST `/api/productos` permite registrar productos en PostgreSQL. |
| Tabla de usuarios | Listo | La tabla existe en PostgreSQL y conserva los datos después de reiniciar el backend. Las contraseñas se almacenan mediante hash. |
| Inicio de sesión | Listo | El login consulta al usuario, comprueba el hash de la contraseña y entrega un JWT. |
| Registro de usuarios | Listo | El registro guarda los usuarios en PostgreSQL con el rol asignado por el servidor. |
| Modificar usuarios | Listo | Se comprobó la modificación de datos y su persistencia en PostgreSQL. |
| Listar usuarios | Listo | Se comprobó el listado con administrador y la restricción de acceso para clientes. |
| Eliminar o desactivar usuarios | Listo | Se comprobó la desactivación lógica, la persistencia del registro y el bloqueo del inicio de sesión. |

## Estado general

El backend de Sonido Vivo cuenta con conexión a PostgreSQL mediante Amazon RDS, servidor Node.js y Express, gestión de productos, autenticación mediante JWT y operaciones CRUD de usuarios.