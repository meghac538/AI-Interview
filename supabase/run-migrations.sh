#!/bin/bash
# Voice Realtime Feature - Database Setup Script
# Run this to apply migrations and seed data to your Supabase database

set -e  # Exit on error

echo "🚀 Voice Realtime Feature - Database Setup"
echo "=========================================="
echo ""

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
else
  echo "❌ Error: .env.local not found"
  exit 1
fi

# Check required env vars
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Missing Supabase environment variables"
  echo "   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

# Extract database connection string from Supabase URL
# Format: https://PROJECT_ID.supabase.co -> postgresql://postgres:[password]@db.PROJECT_ID.supabase.co:5432/postgres
PROJECT_ID=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's/https:\/\///' | sed 's/\.supabase\.co//')

echo "📦 Project: $PROJECT_ID"
echo ""

# Method 1: Using psql directly (if available)
echo "Option 1: Run via psql"
echo "----------------------"
echo "You'll need your Supabase database password (found in Supabase Dashboard > Settings > Database)"
echo ""
echo "Command:"
echo "psql \"postgresql://postgres:[YOUR_PASSWORD]@db.$PROJECT_ID.supabase.co:5432/postgres\" -f supabase/migrations/20260213_voice_realtime.sql"
echo "psql \"postgresql://postgres:[YOUR_PASSWORD]@db.$PROJECT_ID.supabase.co:5432/postgres\" -f supabase/seed/voice_personas_scenarios.sql"
echo ""

# Method 2: Using Supabase CLI (if available)
echo "Option 2: Run via Supabase CLI"
echo "-------------------------------"
echo "If you have Supabase CLI installed:"
echo ""
echo "supabase db reset  # Reset and run all migrations"
echo "psql \$DATABASE_URL -f supabase/seed/voice_personas_scenarios.sql"
echo ""

# Method 3: Manual via Supabase Dashboard
echo "Option 3: Manual via Supabase Dashboard (Recommended)"
echo "-----------------------------------------------------"
echo "1. Go to: $NEXT_PUBLIC_SUPABASE_URL/project/default/sql"
echo "2. Copy contents of: supabase/migrations/20260213_voice_realtime.sql"
echo "3. Paste into SQL Editor and click 'Run'"
echo "4. Copy contents of: supabase/seed/voice_personas_scenarios.sql"
echo "5. Paste into SQL Editor and click 'Run'"
echo ""

echo "✅ After running migrations, verify with:"
echo "   SELECT name, role FROM personas;"
echo "   SELECT title, industry FROM scenarios;"
echo ""
