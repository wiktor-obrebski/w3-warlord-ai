#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
db="${JASSDOC_DB:-$script_dir/jass.db}"
name="${1:-}"

JASSDOC_DB_URL="https://github.com/WurstScript/wurst-jassdoc-build/releases/latest/download/jass.db"

if [[ -z "$name" ]]; then
  echo "Usage: $(basename "$0") <symbol>" >&2
  exit 1
fi

if [[ ! "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "Invalid JASS symbol: $name" >&2
  exit 1
fi

if [[ ! -f "$db" ]]; then
  tmp="${db}.tmp"

  echo "Jassdoc database not found. Downloading latest version..." >&2

  mkdir -p "$(dirname "$db")"
  trap 'rm -f "$tmp"' EXIT

  curl -fL "$JASSDOC_DB_URL" -o "$tmp"
  mv "$tmp" "$db"

  trap - EXIT
fi

source_code="$(
  sqlite3 "$db" "
    SELECT value
    FROM annotations
    WHERE fnname = '$name'
      AND anname = 'source-code'
    LIMIT 1;
  "
)"

if [[ -z "$source_code" ]]; then
  echo "Symbol not found: $name" >&2
  exit 1
fi

return_type="$(
  sqlite3 "$db" "
    SELECT value
    FROM annotations
    WHERE fnname = '$name'
      AND anname = 'return-type'
      AND trim(value) <> ''
    LIMIT 1;
  "
)"

comment="$(
  sqlite3 "$db" "
    SELECT
      ' * ' || replace(
        trim(value),
        char(10),
        char(10) || ' * '
      )
    FROM annotations
    WHERE fnname = '$name'
      AND anname = 'comment'
      AND trim(value) <> ''
    LIMIT 1;
  "
)"

parameters="$(
  sqlite3 "$db" "
    SELECT
      ' * @param ' ||
      p.param ||
      CASE
        WHEN t.value IS NOT NULL AND trim(t.value) <> ''
          THEN ' (' || t.value || ')'
        ELSE ''
      END ||
      CASE
        WHEN trim(p.value) <> ''
          THEN ' ' || replace(
            trim(p.value),
            char(10),
            char(10) || ' *   '
          )
        ELSE ''
      END
    FROM parameters p
    LEFT JOIN params_extra o
      ON o.fnname = p.fnname
      AND o.param = p.param
      AND o.anname = 'param_order'
    LEFT JOIN params_extra t
      ON t.fnname = p.fnname
      AND t.param = p.param
      AND t.anname = 'param_type'
    WHERE p.fnname = '$name'
    ORDER BY CAST(o.value AS INTEGER);
  "
)"

annotations="$(
  sqlite3 "$db" "
    SELECT
      ' * @' || anname ||
      CASE
        WHEN trim(value) <> ''
          THEN ' ' || replace(
            trim(value),
            char(10),
            char(10) || ' *   '
          )
        ELSE ''
      END
    FROM annotations
    WHERE fnname = '$name'
      AND anname NOT IN (
        'comment',
        'return-type',
        'source-file',
        'source-code',
        'start-line',
        'end-line',
        'type'
      )
    ORDER BY rowid;
  "
)"

echo "/**"

has_content=false

if [[ -n "$return_type" ]]; then
  echo " * Returns: $return_type"
  has_content=true
fi

if [[ -n "$comment" ]]; then
  if $has_content; then
    echo " *"
  fi

  printf '%s\n' "$comment"
  has_content=true
fi

if [[ -n "$parameters" ]]; then
  if $has_content; then
    echo " *"
  fi

  printf '%s\n' "$parameters"
  has_content=true
fi

if [[ -n "$annotations" ]]; then
  if $has_content; then
    echo " *"
  fi

  printf '%s\n' "$annotations"
fi

echo " */"
printf '%s\n' "$source_code"
