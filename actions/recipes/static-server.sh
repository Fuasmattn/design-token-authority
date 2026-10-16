#!/bin/sh
# dta diff publish hook: copies the report folder to a directory your web server serves (an
# on-premise host, a mounted share) and prints its URL. Over SSH, replace the copy with
#   rsync -a --delete "$report/" "deploy@diff.example.internal:/srv/dta-diff/$id/"
# Needs DTA_DIFF_ROOT (served directory) and DTA_DIFF_BASE_URL (its public URL).
set -eu
report="$1"
id="${GITHUB_SHA:-$(git rev-parse HEAD)}"
mkdir -p "$DTA_DIFF_ROOT/$id"
cp -R "$report/." "$DTA_DIFF_ROOT/$id/"
echo "$DTA_DIFF_BASE_URL/$id"
