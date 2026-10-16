#!/bin/sh
# dta diff publish hook: commits the report folder to an assets branch of this repository,
# under pr-<number>/<sha>/, and prints its URL. No extra service.
#   publish: sh .github/dta-diff-publish.sh
# Needs GITHUB_TOKEN with contents:write and GITHUB_REPOSITORY (both set in GitHub Actions).
# Images in the PR comment load from github.com/<repo>/raw/…; with GitHub Pages serving the
# branch, set DTA_DIFF_PAGES_URL (e.g. https://owner.github.io/repo) to link the HTML report.
set -eu
report="$1"
branch="${DTA_DIFF_BRANCH:-dta-diff-assets}"
remote="${DTA_DIFF_REMOTE:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
pr=$(node -p "require(process.argv[1]).pr" "$report/pull-request.json")
sha=$(node -p "require(process.argv[1]).sha" "$report/pull-request.json")
dest="pr-$pr/$sha"

work=$(mktemp -d)
if ! git clone --quiet --depth 1 --branch "$branch" "$remote" "$work" 2>/dev/null; then
  git init --quiet "$work"
  git -C "$work" checkout --quiet --orphan "$branch"
  git -C "$work" remote add origin "$remote"
fi
rm -rf "${work:?}/pr-$pr" # one report per pull request: the latest push
mkdir -p "$work/$dest"
cp -R "$report/." "$work/$dest/"
git -C "$work" add -A
git -C "$work" -c user.name="dta diff" -c user.email="dta-diff@users.noreply.github.com" \
  commit --quiet -m "dta diff report for #$pr ($sha)"
git -C "$work" push --quiet origin "$branch" >&2

echo "${DTA_DIFF_PAGES_URL:-https://github.com/${GITHUB_REPOSITORY}/raw/${branch}}/$dest"
