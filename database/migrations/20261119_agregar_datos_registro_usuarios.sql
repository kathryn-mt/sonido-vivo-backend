-- ==========================================
-- SONIDO VIVO
-- MIGRACION: REGISTRO COMPLETO DE USUARIOS
-- Responsable: Noemi Pichiguen
-- ==========================================

BEGIN;

-- Agregar campos del formulario de registro
-- sin eliminar los usuarios existentes.

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS run VARCHAR(9),
    ADD COLUMN IF NOT EXISTS region VARCHAR(100),
    ADD COLUMN IF NOT EXISTS comuna VARCHAR(100),
    ADD COLUMN IF NOT EXISTS direccion VARCHAR(300);

-- Evitar que dos usuarios tengan el mismo RUN.
-- Se admiten valores NULL para usuarios antiguos.

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_run_unique_idx
    ON public.usuarios (UPPER(run))
    WHERE run IS NOT NULL;

COMMIT;
