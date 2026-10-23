#!/usr/bin/env bash
# Recria um banco local e roda os testes das regras (precisa de PostgreSQL 15+).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-rebanho_teste}
psql -q -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/00_stub_supabase.sql
for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/01_regras.sql
