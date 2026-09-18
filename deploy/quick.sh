#!/usr/bin/env bash
# Compatibility entry point: the retired browser build must never be published.
set -euo pipefail
cd "$(dirname "$0")/.."
echo 'quick.sh retired. Run: npm run native:verify -- --release && npm run deploy -- --verified' >&2
exit 2
