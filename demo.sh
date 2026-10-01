#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
uv run build.py
python3 -m http.server --directory dist 8000
