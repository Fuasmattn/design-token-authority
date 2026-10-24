#!/usr/bin/env bash
# Runs `dta diff` for a pull request and writes the verdict to $GITHUB_OUTPUT. Shared by the
# `diff` and `diff-pr` actions. Environment: DTA (how to run DTA), ARGS, REPORT (report folder),
# PR, SHA. The verdict decides the status check later; the run itself only fails on errors.
set -uo pipefail
$DTA diff --report "$REPORT" --format json -o "$RUNNER_TEMP/dta-diff.json" $ARGS
code=$?
set -e
if [ ! -f "$REPORT/result.json" ]; then
  echo "::error::dta diff wrote no report (exit $code). Run \`$DTA diff --check\` to see what is missing."
  exit 1
fi
printf '{"pr":%s,"sha":"%s"}\n' "${PR:-null}" "$SHA" > "$REPORT/pull-request.json"
# REPORT may be absolute or relative to the working directory.
result="$(cd "$REPORT" && pwd)/result.json"
verdict=$(node -e "process.stdout.write(require(process.argv[1]).verdict ?? '')" "$result")
echo "verdict=$verdict" >> "$GITHUB_OUTPUT"
echo "dta diff: ${verdict:-tokens only}" >> "$GITHUB_STEP_SUMMARY"
cat "$REPORT/summary.md" >> "$GITHUB_STEP_SUMMARY"
