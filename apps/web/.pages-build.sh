#!/bin/bash
# Cloudflare Pages build script for Veyra frontend
# Set this as the build command in Cloudflare Pages dashboard:
#   Build command: bash .pages-build.sh
#   Build output directory: .next

set -e

# Install dependencies
npm install

# Set environment variables
export NEXT_PUBLIC_API_URL="https://veyra-api-production.kipkiruigideon890.workers.dev"
export NEXT_PUBLIC_MOCK_API="false"

# Build Next.js
npx next build
