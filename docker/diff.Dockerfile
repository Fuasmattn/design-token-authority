# A pinned environment for `dta diff`: Node 24, git and Playwright's Chromium with its system
# libraries and fonts. Same image locally and on self-hosted CI runners, so screenshots match.
#
#   docker build -f docker/diff.Dockerfile -t dta-diff .
#   docker run --rm -v "$PWD":/work dta-diff sh -c "pnpm install --frozen-lockfile && node bin/dta.js diff"
#
# Nothing is uploaded anywhere: the report stays in .dta/diff of the mounted project.
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx -y playwright-core@1.59.1 install --with-deps chromium

WORKDIR /work
# The mounted project belongs to the host user; let git work in it.
RUN git config --system --add safe.directory '*'
