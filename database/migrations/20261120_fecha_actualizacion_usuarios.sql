-- Incorpora la fecha de la ultima modificacion sin eliminar ni recrear
-- usuarios. ADD COLUMN IF NOT EXISTS permite usar esta migracion tambien
-- en entornos donde la columna ya fue agregada manualmente.
BEGIN;

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ;

ALTER TABLE public.usuarios
    ALTER COLUMN fecha_actualizacion SET DEFAULT CURRENT_TIMESTAMP;

-- Las consultas de actualizacion y desactivacion de usuarios asignan
-- fecha_actualizacion = CURRENT_TIMESTAMP al modificar cada registro.

COMMIT;
