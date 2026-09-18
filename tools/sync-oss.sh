#!/usr/bin/env bash
# Prepare/test a server-only snapshot; publication requires explicit --push.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node tools/oss/sync.mjs "$@"
