# Database Migration Required

## Status

The persona CRUD API endpoints have been implemented, but they require a database schema update to function properly.

## What Was Implemented

✅ **5 API Endpoints** (Tasks 5-9):
- `GET /api/personas` - List personas with optional filters (blueprint, difficulty, is_active)
- `GET /api/personas/:id` - Get single persona by ID
- `POST /api/personas` - Create new persona with validation
- `PATCH /api/personas/:id` - Update persona (partial updates supported)
- `DELETE /api/personas/:id` - Soft delete persona (sets is_active = false)

## What's Missing

The `personas` table exists but is missing several columns that were added in the enhanced schema:
- `blueprint` (TEXT with CHECK constraint)
- `difficulty` (INTEGER 1-5 with CHECK constraint)
- `prompt_template` (TEXT)
- `first_message_template` (TEXT)
- `is_active` (BOOLEAN)
- `updated_at` (TIMESTAMPTZ with auto-update trigger)

## How to Fix

### Option 1: Supabase Dashboard (Recommended)

1. Open the Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/ghrzknsercrwumyycbzk/sql/new
   ```

2. Copy and paste the contents of:
   ```
   supabase/migrations/03_update_personas_schema.sql
   ```

3. Click "Run" to execute the migration

4. Verify by running:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'personas'
   ORDER BY ordinal_position;
   ```

### Option 2: Using Supabase CLI

If you have the database password:

```bash
supabase db push --db-url "your-connection-string"
```

### Option 3: Programmatic (Not Recommended)

The migration SQL has been saved in:
```
supabase/migrations/03_update_personas_schema.sql
```

## Testing After Migration

Once the migration is applied, test the endpoints:

```bash
# List personas (should return empty array initially)
curl http://localhost:3000/api/personas

# Create a persona
curl -X POST http://localhost:3000/api/personas \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sarah Chen",
    "role": "VP of Sales",
    "blueprint": "sales",
    "difficulty": 3,
    "company_context": "Enterprise SaaS company selling HR automation tools",
    "personality_traits": ["skeptical", "data-driven", "busy"],
    "communication_style": "Direct and to-the-point, values efficiency",
    "objection_patterns": ["budget concerns", "ROI questions"],
    "prompt_template": "You are Sarah Chen, VP of Sales...",
    "first_message_template": "Hi, this is Sarah. I only have 10 minutes..."
  }'

# Get persona by ID (use ID from create response)
curl http://localhost:3000/api/personas/<persona-id>

# Update persona
curl -X PATCH http://localhost:3000/api/personas/<persona-id> \
  -H "Content-Type: application/json" \
  -d '{"difficulty": 4}'

# Delete persona (soft delete)
curl -X DELETE http://localhost:3000/api/personas/<persona-id>

# List only active personas
curl http://localhost:3000/api/personas?is_active=true

# Filter by blueprint
curl http://localhost:3000/api/personas?blueprint=sales&difficulty=3
```

## Files Changed

```
src/app/api/personas/route.ts          (GET and POST handlers)
src/app/api/personas/[id]/route.ts     (GET, PATCH, DELETE handlers)
supabase/migrations/03_update_personas_schema.sql
```

## Next Steps

1. Apply the database migration (see "How to Fix" above)
2. Test all 5 endpoints
3. Proceed with implementing the UI components for persona management

## Commit

```
feat(api): implement persona CRUD endpoints

- GET /api/personas (list with filters)
- GET /api/personas/:id (single)
- POST /api/personas (create with validation)
- PATCH /api/personas/:id (update with validation)
- DELETE /api/personas/:id (soft delete)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

Commit hash: `1977ded`
