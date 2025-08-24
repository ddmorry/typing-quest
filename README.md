# Typing RPG (Browser Game)

A typing RPG browser game designed for English learners, particularly for intermediate users needing typing practice. The game combines RPG mechanics (levels, battles, rewards) with instant feedback (accuracy, speed, combos) to make typing practice engaging.

## 🎮 Game Overview

- **Target Audience**: English learners (high school to adult level)
- **Game Type**: Turn-based RPG with real-time typing elements
- **Platform**: Web browser (React + Next.js + Phaser 3)
- **Languages**: Japanese (primary), English (secondary)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for Next.js 15 support)
- Docker (for Supabase local development)
- Supabase CLI

### Database Setup

1. **Install Supabase CLI:**

   ```bash
   brew install supabase/tap/supabase
   ```

2. **Start local Supabase:**

   ```bash
   supabase start
   ```

3. **Reset database with migrations and seed data:**

   ```bash
   supabase db reset
   ```

4. **Access Supabase Studio:**
   - Open http://127.0.0.1:54323 in your browser
   - View database schema, run queries, and manage data

### Development Commands

```bash
# Database (Available Now)
supabase start       # Start local Supabase instance
supabase stop        # Stop local Supabase instance
supabase db reset    # Reset database with latest migrations and seed data
supabase status      # Check status of local services

# Application (✅ Ready - TYP-16 Complete)
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run linting
npm run typecheck    # Run TypeScript type checking
npm test             # Run tests (TBD)
```

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js (App Router) + React + TypeScript + Tailwind CSS
- **Game Engine**: Phaser 3 (loaded only in `/game` route as CSR island)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **UI Components**: shadcn/ui (Radix primitives)
- **State Management**: Zustand
- **Internationalization**: next-intl

### Database Schema (✅ Implemented)

- **`profiles`**: User profiles with authentication integration
- **`word_packs`**: Themed vocabulary collections (NGSL, TOEIC, Academic)
- **`words`**: Individual words with difficulty levels L1-L5
- **`sessions`**: Game session tracking with guest support
- **`attempts`**: Detailed typing attempt logging with auto WPM calculation
- **`session_summary`**: Aggregated statistics view

## 🎯 Game Features

### Core Mechanics

- **Combat System**: Turn-based with real-time typing elements
- **Input Modes**: Attack (right word) / Heal (left word) / Guard (enemy attacks)
- **Damage Calculations**: Based on word level, length, accuracy, speed, and combo
- **Guest Play**: Anonymous sessions with optional account creation

### Accessibility Features

- WCAG AA compliance target
- High contrast mode support
- OpenDyslexic font option
- Screen reader compatibility
- Keyboard navigation support

## 📊 Development Status

### ✅ Completed (Sprint 0)

- [x] Project documentation and architecture
- [x] **TYP-14**: Supabase DDL schema implementation with RLS policies
- [x] Database migrations and seed data
- [x] Local development environment setup

### 🚧 In Progress

- [ ] Next.js application initialization
- [ ] Phaser 3 game engine integration
- [ ] UI component system setup

### 📋 Planned (MVP - Target: 2025-09-16)

- [ ] Single battle gameplay (1v1)
- [ ] Basic settings and word pack selection
- [ ] Results screen and dashboard
- [ ] Guest play with optional account creation

## 📁 Project Structure

```
docs/                      # Project documentation
├── prd.md                # Product Requirements Document
├── roadmap.md            # Development roadmap
└── rfc/                  # Architecture decisions

supabase/                 # Database setup ✅ IMPLEMENTED
├── migrations/           # Database schema migrations
├── seed.sql             # Test data for development
├── config.toml          # Supabase configuration
└── README.md           # Database setup guide

app/ (planned)           # Next.js application
features/ (planned)      # Feature-based components
lib/ (planned)          # Shared utilities and stores
```

## 🎯 Key Metrics (KPI)

- Initial session length ≥ 6 minutes (median)
- Accuracy ≥ 90% (median)
- 7-day retention ≥ 20% (test users)
- Guest → registration conversion ≥ 10%

## 🔒 Security & Privacy

- Minimal personal information collection (email only)
- Supabase Row Level Security (RLS) for data privacy
- Client sends minimal data (no raw keystrokes)
- Rate limiting on critical APIs

## 📚 Documentation

- **[PRD](docs/prd.md)**: Complete product requirements
- **[Roadmap](docs/roadmap.md)**: Development timeline and milestones
- **[Architecture](docs/rfc/0001-architecture.md)**: Technical architecture decisions
- **[Database Setup](supabase/README.md)**: Supabase configuration and testing

## 🤝 Contributing

This project follows a structured development approach with Linear issue tracking and GitHub integration. See the issue guidelines in `docs/epic_issue_guidelines.md` for contribution workflow.

## 📄 License

[License information to be added]
