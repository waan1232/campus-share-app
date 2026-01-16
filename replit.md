# CampusShare

## Overview

CampusShare is a peer-to-peer rental marketplace designed for college students. The platform allows verified students (using .edu email addresses) to list items they own for rent and request to borrow items from other students on their campus. The application covers categories like electronics, textbooks, sports equipment, and party supplies.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state management
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Form Handling**: React Hook Form with Zod validation
- **Fonts**: DM Sans (body) and Outfit (display/headings)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **Build Tool**: esbuild for server bundling, Vite for client
- **API Design**: RESTful endpoints defined in shared route contracts with Zod schemas

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema-to-validation integration
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Schema Location**: `shared/schema.ts` contains all table definitions

### Authentication
- **Strategy**: Passport.js with Local Strategy
- **Password Hashing**: scrypt with random salt
- **Session Management**: Express-session with PostgreSQL session store
- **User Verification**: Requires .edu email addresses for registration

### Key Design Patterns
- **Shared Types**: The `shared/` directory contains schema definitions and route contracts used by both client and server, ensuring type safety across the stack
- **API Contract Pattern**: Routes are defined with input/output Zod schemas in `shared/routes.ts`, allowing type-safe API calls
- **Component Architecture**: UI components follow shadcn/ui patterns with composition and variant support via class-variance-authority

### Database Schema
The application has three main tables:
1. **users**: Student accounts with username, password, name, and verified .edu email
2. **items**: Rental listings with title, description, category, price per day, and availability status
3. **rentals**: Rental requests linking items to renters with date ranges and status tracking (pending/approved/rejected/completed)

## External Dependencies

### Database
- PostgreSQL database (connection via `DATABASE_URL` environment variable)
- Drizzle Kit for database migrations (`npm run db:push`)

### Session Management
- connect-pg-simple requires the session table to exist in PostgreSQL
- Session secret configured via `SESSION_SECRET` environment variable

### Development Tools
- Replit-specific Vite plugins for development (cartographer, dev-banner, runtime-error-modal)
- Hot module replacement configured for development mode

### Build Configuration
- Production builds bundle server dependencies listed in the allowlist to reduce cold start times
- Client builds output to `dist/public`, server to `dist/index.cjs`