#!/bin/bash
# Build the app and copy deployable output into this folder,
# following the repo convention (see prompt-injection-viz/):
# GitHub Pages (Jekyll) serves committed files as-is — there is
# no Vite build step on the server, so dist output must be committed.
set -e
cd "$(dirname "$0")"
npm run build
cp dist/index.html ./index.html
rm -rf ./assets
cp -r dist/assets ./assets
rm -rf ./calendar
cp -r dist/calendar ./calendar
cp dist/favicon.svg ./favicon.svg 2>/dev/null || true
cp dist/icons.svg ./icons.svg 2>/dev/null || true
echo "deploy-ready: index.html + assets/ + calendar/ updated"
