#!/usr/bin/env bash
set -e

npm install
npm run build
npm link

echo "Setup complete. Run 'inpost status' to verify your configuration."
