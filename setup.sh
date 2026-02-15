#!/usr/bin/env bash
set -e

npm install
npm run build
npm link

echo "Setup complete. Run 'postforge status' to verify your configuration."
