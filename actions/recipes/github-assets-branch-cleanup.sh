#!/bin/sh
# Removes a closed pull request's reports from the assets branch (see github-assets-branch.sh).
# Run it on `pull_request_target: [closed]` with contents:write: sh cleanup.sh <pr number>
set -eu
pr="$1"
branch="${DTA_DIFF_BRANCH:-dta-diff-assets}"
remote="${DTA_DIFF_REMOTE:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
work=$(mktemp -d)
git clone --quiet --depth 1 --branch "$branch" "$remote" "$work" 2>/dev/null || exit 0
[ -d "$work/pr-$pr" ] || exit 0
git -C "$work" rm -r --quiet "pr-$pr"
git -C "$work" -c user.name="dta diff" -c user.email="dta-diff@users.noreply.github.com" \
  commit --quiet -m "dta diff: remove reports of closed #$pr"
git -C "$work" push --quiet origin "$branch"
