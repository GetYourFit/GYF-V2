#!/usr/bin/env bash
set -euo pipefail

platform=${1:?usage: check-bundle-budget.sh <web|android> <max-bytes>}
max_bytes=${2:?usage: check-bundle-budget.sh <web|android> <max-bytes>}

case "$platform" in
  web) set -- dist/_expo/static/js/web/entry-*.js ;;
  android) set -- dist/_expo/static/js/android/entry-*.hbc ;;
  *) echo "unsupported platform: $platform" >&2; exit 2 ;;
esac

[[ $# -eq 1 && -f $1 ]] || { echo "expected exactly one $platform entry bundle" >&2; exit 1; }
bytes=$(wc -c < "$1" | tr -d ' ')
(( bytes <= max_bytes )) || { echo "$platform bundle is $bytes bytes; budget is $max_bytes" >&2; exit 1; }
echo "$platform bundle: $bytes/$max_bytes bytes"
