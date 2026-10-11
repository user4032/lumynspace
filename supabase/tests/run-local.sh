#!/bin/bash
# Перевірка міграцій на локальному Postgres 15+ (без Supabase).
# Використання:
#   DB_URL=postgres://postgres@localhost:5432/postgres ./supabase/tests/run-local.sh
#   або через unix-сокет: DB_URL="postgresql:///postgres?host=/var/run/postgresql" ./supabase/tests/run-local.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ADMIN_URL="${DB_URL:-postgres://postgres@localhost:5432/postgres}"

# замінюємо назву БД у URL на lumyn_test (з урахуванням ?query)
BASE="${ADMIN_URL%%\?*}"
QUERY=""
[[ "$ADMIN_URL" == *\?* ]] && QUERY="?${ADMIN_URL#*\?}"
TEST_URL="${BASE%/*}/lumyn_test${QUERY}"

psql "$ADMIN_URL" -q -c "drop database if exists lumyn_test" -c "create database lumyn_test"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/00_supabase_stubs.sql"

# 1) базова схема + її smoke-тест (дані лишаються в БД)
echo "→ міграція 0001_init.sql"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/../migrations/0001_init.sql"
echo "→ тест 01_rls_smoke_test.sql"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "$DIR/01_rls_smoke_test.sql" > /tmp/lumyn_01.log 2>&1
grep -E "OK:|FAIL" /tmp/lumyn_01.log || true

# 2) 0002 поверх наявних даних, в ОДНІЙ транзакції — як SQL Editor / supabase db push
echo "→ міграція 0002_mvp.sql (single transaction)"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$DIR/../migrations/0002_mvp.sql"
echo "→ міграція 0003_first_user_invites.sql (single transaction)"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$DIR/../migrations/0003_first_user_invites.sql"
echo "→ тест 02_mvp_test.sql"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "$DIR/02_mvp_test.sql" 2>&1 | sed -n 's/^psql:[^ ]* NOTICE:  //p; s/^NOTICE:  //p; /FAIL/p; /✓/p; /ERROR/p'
test "${PIPESTATUS[0]}" -eq 0

# 3) 0004 двічі поспіль (ідемпотентність) + її тест
echo "→ міграція 0004_live_features.sql (двічі, single transaction)"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$DIR/../migrations/0004_live_features.sql"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$DIR/../migrations/0004_live_features.sql"
echo "→ тест 04_live_features_test.sql"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "$DIR/04_live_features_test.sql" 2>&1 | sed -n 's/^psql:[^ ]* NOTICE:  //p; s/^NOTICE:  //p; /FAIL/p; /✓/p; /ERROR/p'
test "${PIPESTATUS[0]}" -eq 0
echo "✓ Міграції та RLS-перевірки пройшли"
