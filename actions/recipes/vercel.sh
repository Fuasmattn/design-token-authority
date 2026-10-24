#!/bin/sh
# dta diff publish hook: Vercel preview deployment of the report folder.
#   publish: sh .github/dta-diff-publish.sh
# Needs VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID (an empty project just for reports,
# with Deployment Protection off for previews, so GitHub can load the images in the comment).
# `vercel deploy` prints the deployment URL as its last line, which is what dta diff reads.
set -eu
report="$1"
npx --yes vercel@62.1.0 deploy "$report" --token "$VERCEL_TOKEN" --yes
