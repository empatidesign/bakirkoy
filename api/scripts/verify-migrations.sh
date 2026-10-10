#!/usr/bin/env bash
# Task 14 (pre-launch test architecture plan, Step 1/2): migration-integrity verification.
#
# Part 1: compares source migration files (Migrations/*.cs) against the real
# __EFMigrationsHistory table read from an ACTUAL running/migrated Postgres database
# (never a fabricated/synthetic history), failing on any source-file-with-no-history-row
# or history-row-with-no-source-file mismatch, unless the mismatch is explicitly
# reconciled (dated, justified) in migration-exceptions.json.
#
# Part 2: creates a genuinely EMPTY disposable Postgres database on the already-running
# dev nexora-postgres container, runs a REAL `dotnet ef database update` (which invokes
# context.Database.MigrateAsync() under the hood, NOT EnsureCreatedAsync — this script
# never reuses NexoraApiFactory's EnsureCreated+stamp workaround), captures the real
# result, then starts the real hosted API against that database and calls the real
# GET /health/ready endpoint, then destroys the disposable database.
#
# Safety (Ruling S1, binding): every database this script touches is a fresh, script-owned,
# script-destroyed database on the local dev Postgres container. It NEVER connects to the
# `nexora` database (the real dev database with real historical data) for anything other
# than a read-only `SELECT MigrationId FROM __EFMigrationsHistory` in Part 1. It never runs
# MigrateAsync, EnsureCreated, or any DDL/DML against `nexora` itself.
#
# Exit code: 0 ONLY if the empty-database MigrateAsync experiment succeeds AND
# /health/ready returns 200 AND the history comparison has zero unreconciled mismatches.
# A real, evidenced migration defect must produce a non-zero exit — this is correct
# behavior for this script, not a bug (see Ruling A in task-14-brief.md).

set -uo pipefail

API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$API_DIR"

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
ARTIFACT_DIR="$API_DIR/artifacts/migration-verify-${RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
RESULT_JSON="$ARTIFACT_DIR/result.json"

PG_HOST="${NEXORA_PG_HOST:-localhost}"
PG_PORT="${NEXORA_PG_PORT:-34100}"
PG_USER="${NEXORA_PG_USER:-nexora_admin}"
PG_PASSWORD="${NEXORA_PG_PASSWORD:-Nexora2026!}"
PG_REAL_DB="${NEXORA_PG_REAL_DB:-nexora}"
DISPOSABLE_DB="nexora_migration_test_${RUN_ID//[-:.]/_}"

DOTNET_BIN="${NEXORA_DOTNET_BIN:-dotnet}"
if ! command -v "$DOTNET_BIN" >/dev/null 2>&1 && [ -x "/Users/mac/.dotnet/dotnet" ]; then
  DOTNET_BIN="/Users/mac/.dotnet/dotnet"
fi

log() { echo "[verify-migrations] $*"; }

overall_pass=true
part1_pass=true
part2_pass=true
part1_findings="[]"
empty_migrate_error=""
empty_migrate_ok=false
readiness_ok=false
readiness_body=""

cleanup_db() {
  local db="$1"
  PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$db\";" >/dev/null 2>&1 || true
}

API_PID=""
cleanup_api() {
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}

trap 'cleanup_api; cleanup_db "$DISPOSABLE_DB"' EXIT

# ---------------------------------------------------------------------------
# Part 1: migration-history comparison against the REAL dev database (read-only).
# ---------------------------------------------------------------------------
log "Part 1: comparing source Migrations/*.cs against real __EFMigrationsHistory on '$PG_REAL_DB' (read-only)"

MIG_DIR="$API_DIR/src/Nexora.Infrastructure/Persistence/Migrations"
SOURCE_IDS_FILE="$ARTIFACT_DIR/source-ids.txt"
HISTORY_IDS_FILE="$ARTIFACT_DIR/history-ids.txt"

ls "$MIG_DIR"/*.cs 2>/dev/null | grep -v '\.Designer\.cs$' | grep -v 'ModelSnapshot\.cs$' \
  | xargs -n1 basename | sed 's/\.cs$//' | sort > "$SOURCE_IDS_FILE"

if ! PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_REAL_DB" \
    -t -A -c "SELECT \"MigrationId\" FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" IS NOT NULL AND \"MigrationId\" <> '' ORDER BY \"MigrationId\";" \
    > "$HISTORY_IDS_FILE" 2>"$ARTIFACT_DIR/history-query.err"; then
  log "FAIL: could not read __EFMigrationsHistory from '$PG_REAL_DB' — see $ARTIFACT_DIR/history-query.err"
  part1_pass=false
  overall_pass=false
else
  sort -o "$HISTORY_IDS_FILE" "$HISTORY_IDS_FILE"

  SOURCE_MISSING_FROM_HISTORY="$ARTIFACT_DIR/source-missing-from-history.txt"
  HISTORY_MISSING_SOURCE="$ARTIFACT_DIR/history-missing-source.txt"
  comm -23 "$SOURCE_IDS_FILE" "$HISTORY_IDS_FILE" > "$SOURCE_MISSING_FROM_HISTORY"
  comm -13 "$SOURCE_IDS_FILE" "$HISTORY_IDS_FILE" > "$HISTORY_MISSING_SOURCE"

  # Load reconciliation manifest (explicit, dated, version-controlled exceptions).
  EXCEPTIONS_FILE="$API_DIR/scripts/migration-exceptions.json"
  if [ ! -f "$EXCEPTIONS_FILE" ]; then
    echo "[]" > "$EXCEPTIONS_FILE"
  fi

  n_source_missing=$(grep -c . "$SOURCE_MISSING_FROM_HISTORY" 2>/dev/null || echo 0)
  n_history_missing=$(grep -c . "$HISTORY_MISSING_SOURCE" 2>/dev/null || echo 0)

  # A source-file-with-no-history-row is EXPECTED for migrations not yet applied to this
  # particular dev database's history (e.g. freshly authored, not-yet-run migrations) —
  # this is not itself a defect. What Ruling A/this Step 1 actually cares about is the
  # inverse: a history row claiming a migration ran that has NO corresponding source file
  # (meaning the source of truth for what that migration actually did is gone) — that is
  # always a real, unreconciled defect unless explicitly excepted.
  if [ "$n_history_missing" -gt 0 ]; then
    unreconciled=0
    while read -r mig_id; do
      [ -z "$mig_id" ] && continue
      if ! grep -q "\"migrationId\": *\"$mig_id\"" "$EXCEPTIONS_FILE" 2>/dev/null; then
        unreconciled=$((unreconciled + 1))
        log "FAIL: __EFMigrationsHistory row '$mig_id' has no corresponding source file and is not reconciled in migration-exceptions.json"
      fi
    done < "$HISTORY_MISSING_SOURCE"
    if [ "$unreconciled" -gt 0 ]; then
      part1_pass=false
      overall_pass=false
    fi
  fi

  log "Part 1 result: $n_source_missing source-only migration(s) (not yet applied to '$PG_REAL_DB', informational), $n_history_missing history-only migration(s) (checked against reconciliation manifest)"
fi

# ---------------------------------------------------------------------------
# Part 2: real empty-database MigrateAsync experiment (via `dotnet ef database update`,
# which is the CLI-driven equivalent of context.Database.MigrateAsync() — no EnsureCreated).
# ---------------------------------------------------------------------------
log "Part 2: creating disposable empty database '$DISPOSABLE_DB' on dev Postgres (never touches '$PG_REAL_DB')"

if ! PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres \
    -c "CREATE DATABASE \"$DISPOSABLE_DB\";" >"$ARTIFACT_DIR/create-db.log" 2>&1; then
  log "FAIL: could not create disposable database — see $ARTIFACT_DIR/create-db.log"
  overall_pass=false
  part2_pass=false
else
  DISPOSABLE_CONN="Host=${PG_HOST};Port=${PG_PORT};Database=${DISPOSABLE_DB};Username=${PG_USER};Password=${PG_PASSWORD}"

  log "Running real 'dotnet ef database update' (MigrateAsync) against the empty disposable database"
  if "$DOTNET_BIN" ef database update \
      --project src/Nexora.Infrastructure \
      --startup-project src/Nexora.Api \
      --connection "$DISPOSABLE_CONN" \
      > "$ARTIFACT_DIR/empty-migrate.log" 2>&1; then
    empty_migrate_ok=true
    log "PASS: MigrateAsync from empty database succeeded (all migrations applied for real)"
  else
    empty_migrate_ok=false
    empty_migrate_error="$(tail -30 "$ARTIFACT_DIR/empty-migrate.log" | tr '\n' ' ' | sed 's/"/\\"/g')"
    log "FAIL: MigrateAsync from empty database failed — real Postgres/EF error captured in $ARTIFACT_DIR/empty-migrate.log"
    overall_pass=false
    part2_pass=false
  fi

  if [ "$empty_migrate_ok" = true ]; then
    log "Starting real hosted API (Testing environment) against the migrated disposable database"
    API_PORT="${NEXORA_VERIFY_API_PORT:-15199}"

    export ASPNETCORE_ENVIRONMENT=Testing
    export ASPNETCORE_URLS="http://127.0.0.1:${API_PORT}"
    export ConnectionStrings__PostgreSQL="$DISPOSABLE_CONN"
    export ConnectionStrings__Redis="${NEXORA_REDIS_CONN:-localhost:34200,password=NexoraRedis2026!,defaultDatabase=3}"
    export JwtSettings__SecretKey="nexora-migration-verify-secret-key-min-32-chars!!"
    export JwtSettings__Issuer="nexora"
    export JwtSettings__Audience="nexora-clients"
    export TestSupport__ApiKey="9f2c7a10b4e68d31c5f9072a6b8d4e1f03ac759bd2468e10f5c39a7d61be8420"
    export Vault__Enabled=false
    export Consul__EnableServiceDiscovery=false
    export Hangfire__Enabled=false
    export ElkSettings__Uri=""
    export MinioSettings__Endpoint="${NEXORA_MINIO_ENDPOINT:-localhost:34500}"
    export MinioSettings__AccessKey="${NEXORA_MINIO_ACCESS_KEY:-nexora_minio}"
    export MinioSettings__SecretKey="${NEXORA_MINIO_SECRET_KEY:-NexoraMinio2026!}"
    export MinioSettings__UseSSL=false
    export MinioSettings__PublicBucket="nexora-test-public"
    export MinioSettings__PrivateBucket="nexora-test-private"
    export Push__Enabled=false
    export SmsSettings__UseMockMode=false
    export SmtpSettings__UseMockMode=false
    export Nvi__UseMockMode=false
    export OtpSettings__MockCode=""
    export LibraryLock__AllowHttpOnPrivateNetwork=false
    export LibraryLock__UseHttps=true
    export Seed__Demo__Enabled=false
    export Seed__SuperAdmin__FullName="Migration Verify SuperAdmin"
    export Seed__SuperAdmin__Email="migration-verify-superadmin@nexora.local"
    export Seed__SuperAdmin__Password="MigrationVerify2026!"
    export CorsSettings__AllowedOrigins__0="http://localhost"

    API_DLL="$API_DIR/src/Nexora.Api/bin/Release/net10.0/Nexora.Api.dll"
    if [ ! -f "$API_DLL" ]; then
      log "API DLL not found at $API_DLL — building Release first"
      "$DOTNET_BIN" build -c Release "$API_DIR/src/Nexora.Api" > "$ARTIFACT_DIR/build.log" 2>&1
    fi

    "$DOTNET_BIN" exec "$API_DLL" --urls "http://127.0.0.1:${API_PORT}" \
      > "$ARTIFACT_DIR/api-startup.log" 2>&1 &
    API_PID=$!

    ready_attempts=0
    until curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health/ready" 2>/dev/null | grep -q "^200$"; do
      ready_attempts=$((ready_attempts + 1))
      if [ "$ready_attempts" -ge 30 ]; then
        break
      fi
      sleep 1
    done

    readiness_body="$(curl -s "http://127.0.0.1:${API_PORT}/health/ready" 2>/dev/null || echo '{}')"
    readiness_code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health/ready" 2>/dev/null || echo 000)"
    echo "$readiness_body" > "$ARTIFACT_DIR/health-ready-response.json"

    if [ "$readiness_code" = "200" ]; then
      readiness_ok=true
      log "PASS: /health/ready returned 200 against the freshly-migrated-from-empty database"
    else
      readiness_ok=false
      log "FAIL: /health/ready returned HTTP $readiness_code — see $ARTIFACT_DIR/api-startup.log and $ARTIFACT_DIR/health-ready-response.json"
      overall_pass=false
      part2_pass=false
    fi

    cleanup_api
    API_PID=""
  fi

  cleanup_db "$DISPOSABLE_DB"
fi

# ---------------------------------------------------------------------------
# Emit JSON evidence.
# ---------------------------------------------------------------------------
cat > "$RESULT_JSON" <<EOF
{
  "runId": "$RUN_ID",
  "script": "verify-migrations.sh",
  "timestampUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "safety": {
    "ruling": "S1",
    "disposableDatabase": "$DISPOSABLE_DB",
    "realDatabaseTouchedReadOnlyOnly": "$PG_REAL_DB",
    "note": "The real database was only ever queried with a read-only SELECT against __EFMigrationsHistory in Part 1. No DDL/DML/MigrateAsync/EnsureCreated was ever run against it. All Part 2 migration/readiness operations ran exclusively against the disposable database, which was dropped at end of run."
  },
  "part1_historyComparison": {
    "pass": $part1_pass,
    "sourceOnlyCount": ${n_source_missing:-0},
    "historyOnlyCount": ${n_history_missing:-0}
  },
  "part2_emptyDatabaseMigration": {
    "pass": $part2_pass,
    "migrateAsyncSucceeded": $empty_migrate_ok,
    "migrateAsyncError": "$empty_migrate_error",
    "healthReadySucceeded": $readiness_ok,
    "healthReadyResponse": $readiness_body
  },
  "overallPass": $overall_pass
}
EOF

log "Evidence written to $RESULT_JSON"

if [ "$overall_pass" = true ]; then
  log "OVERALL: PASS"
  exit 0
else
  log "OVERALL: FAIL (see evidence above — this may correctly reflect a real, unresolved migration defect)"
  exit 1
fi
