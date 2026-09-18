#!/usr/bin/env bash
# Full native/server/web checks -> immutable staging -> backup -> promotion -> TLS probe.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  exec node --env-file=.env deploy/release.mjs "$@"
else
  exec node deploy/release.mjs "$@"
fi
