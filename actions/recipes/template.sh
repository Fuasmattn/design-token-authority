#!/bin/sh
# dta diff publish hook, template for any host: upload the report folder, print its URL last.
#   publish: sh .github/dta-diff-publish.sh
# dta diff passes the folder as the first argument (also in DTA_REPORT_DIR). The last line of
# stdout must be the URL the folder is served from (index.html is appended for the report link).
# Send everything else your upload prints to stderr, or point diff.publish.url at the URL
# (a JSON path such as $.url, or a regular expression).
set -eu
report="$1"

# One folder per commit, so every push keeps its own report.
id="${GITHUB_SHA:-$(git rev-parse HEAD)}"

# 1. Upload "$report" (index.html, result.json, summary.md, base/, head/, diff/) to your host,
#    for example under reports/$id/. Keep the folder structure: all links in it are relative.
echo "upload $report to <your host>/reports/$id/" >&2

# 2. Print the public URL of that folder.
echo "https://reports.example.com/$id"
