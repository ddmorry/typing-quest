# Typing RPG Database Setup

This document describes the Supabase database schema and setup process for the Typing RPG game.

## Overview

The database schema implements a typing RPG game for English learners, with tables for word packs, words, gaming sessions, and detailed attempt tracking. The schema includes Row Level Security (RLS) policies to ensure data privacy and guest session support.

## Schema Structure

### Core Tables

1. **profiles** - User profiles linked to auth.users
2. **word_packs** - Selectable word sets (NGSL, TOEIC, etc.)
3. **words** - Individual words with difficulty levels L1-L5
4. **sessions** - Game play sessions with stats and settings
5. **attempts** - Individual word typing attempts with metrics

### Views

1. **session_summary** - Aggregated session statistics for dashboard

## Table Details

### `profiles`

- Links to Supabase auth.users table
- Stores display_name and timestamps
- RLS: Users can only access their own profile

### `word_packs`

- Contains themed word collections (NGSL, TOEIC, Academic, etc.)
- Defines level ranges (level_min to level_max)
- Supports tags for categorization
- Public read access (no RLS for read operations)

### `words`

- Individual words with metadata
- Links to word_packs via pack_id
- Includes level (1-5), pronunciation, and meaning
- Auto-calculated length field
- Unique constraint on (pack_id, text)

### `sessions`

- Tracks individual game sessions
- Supports both authenticated users and guests (user_id can be null)
- Stores configuration in settings JSONB field
- Stores final stats in stats JSONB field
- RLS: Users can access their own sessions + guest sessions

### `attempts`

- Detailed logging of each word typing attempt
- Links to sessions and words
- Auto-calculates WPM from character count and timing
- Tracks accuracy, errors, score, and combo
- RLS: Access controlled via session ownership

## Key Features

### Row Level Security (RLS)

- **profiles**: Users can only access their own profile data
- **sessions/attempts**: Users can access their own data + guest sessions (user_id = null)
- **word_packs/words**: Public read access for educational content

### Guest Session Support

- Anonymous users can play by creating sessions with user_id = null
- Guest sessions are accessible to all users for demo purposes
- Future feature: Guest-to-user session transfer upon registration

### Performance Optimization

- Strategic indexes on foreign keys and commonly queried fields
- Generated WPM column for efficient calculations
- Composite indexes for pack + level queries

### Data Integrity

- Check constraints for valid level ranges (1-5)
- Foreign key relationships with cascade deletes
- Unique constraints to prevent duplicate words per pack
- Positive duration and time constraints

## Database Schema Files

- `/supabase/migrations/20250823170953_initial_schema.sql` - Complete DDL with tables, indexes, and RLS policies
- `/supabase/seed.sql` - Test data with 3 word packs and 75+ words

## Setup Instructions

### Prerequisites

- Docker Desktop installed and running
- Supabase CLI installed

### Local Development Setup

1. **Install Supabase CLI** (if not already installed):

   ```bash
   brew install supabase/tap/supabase
   ```

2. **Initialize Supabase** (already done):

   ```bash
   supabase init
   ```

3. **Start local development environment**:

   ```bash
   supabase start
   ```

4. **Apply migrations and seed data**:
   ```bash
   supabase db reset
   ```

### Database URLs

When Supabase is running locally:

- **API URL**: http://127.0.0.1:54321
- **DB URL**: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- **Studio URL**: http://127.0.0.1:54323

## Test Data

The seed file includes:

### Word Packs

1. **NGSL Basic 1000** (Levels 1-3) - 30 common English words
2. **TOEIC Essentials** (Levels 2-4) - 20 business vocabulary words
3. **Academic Word List** (Levels 3-5) - 25 academic vocabulary words

### Testing Verification

The following queries can be used to verify the setup:

```sql
-- Check word pack distribution
SELECT
  wp.title,
  wp.level_min,
  wp.level_max,
  COUNT(w.*) as total_words,
  COUNT(w.*) FILTER (WHERE w.level = 1) as level_1,
  COUNT(w.*) FILTER (WHERE w.level = 2) as level_2,
  COUNT(w.*) FILTER (WHERE w.level = 3) as level_3,
  COUNT(w.*) FILTER (WHERE w.level = 4) as level_4,
  COUNT(w.*) FILTER (WHERE w.level = 5) as level_5
FROM word_packs wp
LEFT JOIN words w ON w.pack_id = wp.id
GROUP BY wp.id, wp.title, wp.level_min, wp.level_max
ORDER BY wp.title;

-- Test session summary view
SELECT * FROM session_summary;

-- Check RLS policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('profiles', 'sessions', 'attempts');
```

## Game Mechanics Integration

The schema supports the game mechanics outlined in the PRD:

### Damage/Healing Calculations

- `attempts.score` stores calculated damage/healing based on:
  - Word level and length
  - Typing accuracy and speed (WPM)
  - Combo multiplier
  - Error penalties

### Session Statistics

- Real-time stats stored in `sessions.stats` JSONB
- Detailed attempt tracking for analysis
- Aggregated views for dashboard display

### Word Selection Algorithm

- Query by pack_id and level range
- Random sampling for game variety
- Support for different difficulty levels

## Security Considerations

1. **Minimal Data Collection**: Only essential game data is stored
2. **RLS Protection**: Row-level security prevents unauthorized access
3. **Guest Privacy**: Anonymous sessions support privacy-first gaming
4. **Input Validation**: Database constraints prevent invalid data
5. **Rate Limiting**: Future consideration for API endpoints

## Performance Considerations

- **Indexes**: Strategic indexing for common query patterns
- **Generated Columns**: Pre-calculated WPM values
- **JSONB Storage**: Flexible stats storage with indexing support
- **Cascade Deletes**: Clean data removal without orphaned records

## Migration Management

- All schema changes should be created as new migrations
- Use `supabase migration new <description>` to create new migration files
- Test migrations locally before deploying to production
- Keep seed data separate from schema migrations

## Monitoring and Maintenance

- Monitor slow queries using Supabase Dashboard
- Regular backup of word pack data
- Index usage analysis for optimization
- RLS policy performance monitoring

## Future Enhancements

1. **User-Generated Content**: RLS policies for user-created word packs
2. **Analytics**: Advanced session analysis and learning insights
3. **Multiplayer**: Support for shared sessions and leaderboards
4. **Content Management**: Admin interface for word pack management
5. **Localization**: Multi-language support for international users

## Troubleshooting

### Common Issues

1. **Docker not running**: Start Docker Desktop before `supabase start`
2. **Port conflicts**: Check for other services using ports 54321-54323
3. **Migration failures**: Check SQL syntax and foreign key references
4. **RLS access denied**: Verify user context and policy conditions

### Debugging Queries

```sql
-- Check table existence and row counts
SELECT schemaname, tablename,
       (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = tablename) as column_count
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'word_packs', 'words', 'sessions', 'attempts');

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE rowsecurity = true;
```

## Development Workflow

1. Make schema changes in new migration files
2. Test locally with `supabase db reset`
3. Verify with sample INSERT/SELECT operations
4. Update seed data if needed
5. Document changes in this README
6. Commit migration files to version control

---

**Database Schema Version**: v1.0 (Initial Implementation)
**Last Updated**: 2025-08-23
**Migration File**: `20250823170953_initial_schema.sql`
