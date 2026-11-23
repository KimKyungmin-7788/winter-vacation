#!/usr/bin/env bash
# supabase/schema.sql 을 로컬 Postgres에서 문법·RLS 동작 검증한다 (Supabase 없이).
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d); chown postgres "$DIR" 2>/dev/null || true
run() { su postgres -c "$*"; }
run "$PGBIN/initdb -D $DIR/data >/dev/null"
run "$PGBIN/pg_ctl -D $DIR/data -o '-p 54329 -k $DIR' -l $DIR/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true' EXIT
P="$PGBIN/psql -h $DIR -p 54329 -v ON_ERROR_STOP=1 -q -d postgres"
run "$P -f $(dirname "$0")/sql-stub.sql"
run "$P -f $(dirname "$0")/../supabase/schema.sql"
run "$P -f $(dirname "$0")/sql-checks.sql"
echo "SQL OK"
