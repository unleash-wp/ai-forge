#!/usr/bin/env bash
# Publish the pages in wiki/ to the GitHub Wiki.
#
# GitHub only provisions a repo's wiki git remote AFTER the first page is created
# in the web UI. So, once per repo:
#   1. open https://github.com/unleash-wp/ai-forge/wiki
#   2. click "Create the first page", type anything, Save.
# Then run this script; it force-syncs every page from wiki/ over it.
set -euo pipefail

REPO_URL="https://github.com/unleash-wp/ai-forge.wiki.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! git clone "$REPO_URL" "$TMP" 2>/dev/null; then
  echo "The wiki isn't initialized yet."
  echo "Open https://github.com/unleash-wp/ai-forge/wiki, click 'Create the first"
  echo "page', save any content, then run this script again."
  exit 1
fi

cp "$ROOT"/wiki/*.md "$TMP"/
cd "$TMP"
git add -A
if git diff --cached --quiet; then
  echo "Wiki already up to date."
  exit 0
fi
git commit -q -m "Sync wiki from repo (wiki/)"
git push -q origin HEAD
echo "Wiki published: https://github.com/unleash-wp/ai-forge/wiki"
