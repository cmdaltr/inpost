#!/bin/bash
set -e

MESSAGE=""
AUTH=false

for arg in "$@"; do
  case "$arg" in
    --auth) AUTH=true ;;
    *) MESSAGE="$arg" ;;
  esac
done

MESSAGE="${MESSAGE:-chore: update source}"

echo "Building..."
npm run build

if [ "$AUTH" = true ]; then
  echo "Refreshing LinkedIn credentials..."
  node dist/src/index.js auth linkedin
fi

echo "Committing: $MESSAGE"
git add -A
git commit -m "$MESSAGE"

echo "Pushing..."
git push
