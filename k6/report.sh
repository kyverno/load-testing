#!/usr/bin/env bash

set -euo pipefail

grep "level=error" "$file_path"

# Store the exit code of the grep command
exit_code=$?

# Check if the exit code is 0 (match found) or 1 (no match found)
if [ $exit_code -eq 0 ]; then
    echo "Error found in the file."
    exit 1
elif [ $exit_code -eq 1 ]; then
    echo "No error found in the file."
    exit 0
else
    echo "An error occurred while searching the file."
    exit 1
fi