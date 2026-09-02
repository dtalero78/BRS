#!/bin/bash
# PreToolUse (matcher: "Bash") del agente `lector-bd`.
# Contrato: JSON por stdin; exit 2 = llamada BLOQUEADA; exit 0 = permitida.
#
# backend/.env apunta a la base de PRODUCCION, asi que el hook falla CERRADO:
# si no puede leer el comando, bloquea.
#
# Criterio: la lista negra de SQL solo se aplica a comandos que PUEDEN llegar a
# la base (invocan node/psql/npm/...). Un `grep "DROP TABLE" migrations/` o un
# `cat` de una migracion no ejecutan nada: ahi esas palabras son texto, y
# bloquearlos rompia el trabajo diario del agente (diffear esquema vs migraciones).

INPUT=$(cat)

if command -v jq >/dev/null 2>&1; then
  COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
  if [ $? -ne 0 ]; then
    echo "BLOQUEADO: no se pudo interpretar la llamada; este agente es de solo lectura." >&2
    exit 2
  fi
else
  COMMAND=$(printf '%s' "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')
fi

if [ -z "$COMMAND" ]; then
  echo "BLOQUEADO: comando vacio o ilegible; este agente es de solo lectura." >&2
  exit 2
fi

# ── Lista negra, aplicada al texto que se le pase ──────────────────────────────
sql_de_escritura() {
  # OJO: el \b va por alternativa, no al final del grupo. Un \b global rompe
  # 'UPDATE <tabla>', cuya alternativa termina a mitad de palabra.
  printf '%s' "$1" | grep -qiE '\b(INSERT[[:space:]]+INTO|UPDATE[[:space:]]+[a-zA-Z_"`]|DELETE[[:space:]]+FROM|DROP[[:space:]]+(TABLE|INDEX|VIEW|SCHEMA|DATABASE|CONSTRAINT|COLUMN)\b|TRUNCATE\b|ALTER[[:space:]]+(TABLE|DATABASE|ROLE|USER)\b|GRANT[[:space:]]|REVOKE[[:space:]]|VACUUM\b|REINDEX\b)' && return 0
  printf '%s' "$1" | grep -qiE '\bCREATE[[:space:]]+(TEMP|TEMPORARY|TABLE|INDEX|VIEW|SCHEMA|DATABASE|EXTENSION|FUNCTION|TRIGGER|ROLE|USER)\b' && return 0
  printf '%s' "$1" | grep -qiE '\\copy|\bCOPY\b.*\b(FROM|TO)\b' && return 0
  # Metodos de knex que escriben, por si el SQL va armado con el query builder.
  printf '%s' "$1" | grep -qiE '\.(insert|update|del|delete|truncate|dropTable|createTable|alterTable)\(' && return 0
  return 1
}

# ── ¿Este comando puede siquiera llegar a la base? ────────────────────────────
# Si no invoca ningun runtime ni cliente de BD, es inspeccion de archivos: se permite.
if ! printf '%s' "$COMMAND" | grep -qE '(^|[|;&[:space:]`(])(node|npx|npm|yarn|pnpm|bun|deno|ts-node|python3?|psql|pg_dump|pg_restore|knex|sequelize|prisma|bash|sh|zsh|source|\./)'; then
  exit 0
fi

# ── Modo estricto: el comando SI puede ejecutar algo ──────────────────────────
if sql_de_escritura "$COMMAND"; then
  echo "BLOQUEADO: SQL de escritura. Este agente solo hace SELECT / EXPLAIN / catalogo (pg_*, information_schema)." >&2
  exit 2
fi

# Migraciones y seeds (nombres reales de backend/package.json).
if printf '%s' "$COMMAND" | grep -qiE 'knex[[:space:]]+(migrate|seed)|npm[[:space:]]+run[[:space:]]+db:(migrate|rollback|seed)|npm[[:space:]]+run[[:space:]]+(migrate|seed)'; then
  echo "BLOQUEADO: correr migraciones o seeds no le corresponde a este agente." >&2
  exit 2
fi

# `npm start` del backend corre `knex migrate:latest` antes del server.
if printf '%s' "$COMMAND" | grep -qiE 'npm[[:space:]]+start|node[[:space:]]+server\.js'; then
  echo "BLOQUEADO: arrancar el backend ejecuta 'knex migrate:latest'. No es de solo lectura." >&2
  exit 2
fi

# Ejecutar un .sql desde archivo.
if printf '%s' "$COMMAND" | grep -qiE 'psql[^|]*[[:space:]]-f[[:space:]]|--file='; then
  echo "BLOQUEADO: ejecutar archivos .sql no esta permitido." >&2
  exit 2
fi

# ── El SQL suele vivir DENTRO del script, no en la linea de comando ───────────
# Si se ejecuta un archivo local, se inspecciona su contenido con el mismo criterio.
for ARCHIVO in $(printf '%s' "$COMMAND" | grep -oE '[A-Za-z0-9_./~-]+\.(js|mjs|cjs|ts|py|sh)\b'); do
  [ -f "$ARCHIVO" ] || continue
  if sql_de_escritura "$(cat "$ARCHIVO" 2>/dev/null)"; then
    echo "BLOQUEADO: el script '$ARCHIVO' contiene SQL de escritura. Este agente es de solo lectura." >&2
    exit 2
  fi
done

exit 0
