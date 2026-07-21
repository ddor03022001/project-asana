#!/bin/sh

# Script to install the git pre-commit hook
HOOK_DIR=".git/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

if [ ! -d ".git" ]; then
    echo "❌ Error: .git directory not found. Please run this script from the repository root."
    exit 1
fi

echo "Installing git pre-commit hook..."
cp scripts/pre-commit "$HOOK_FILE"
chmod +x "$HOOK_FILE"

echo "✅ Git pre-commit hook installed successfully!"
exit 0
