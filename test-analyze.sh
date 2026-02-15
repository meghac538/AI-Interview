#!/bin/bash

# Test script for voice analysis endpoint
# Usage: ./test-analyze.sh <session_id>

SESSION_ID=${1:-""}

if [ -z "$SESSION_ID" ]; then
  echo "Usage: ./test-analyze.sh <session_id>"
  echo ""
  echo "Example:"
  echo "  ./test-analyze.sh 550e8400-e29b-41d4-a716-446655440000"
  exit 1
fi

echo "Testing voice analysis endpoint..."
echo "Session ID: $SESSION_ID"
echo ""

curl -X POST http://localhost:3000/api/voice/analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"round_number\": 1
  }" | jq '.'

echo ""
echo "Test complete!"
