# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NewsNexusAPI09 is a Node.js/Express REST API that serves as the backend for the NewsNexus suite of applications. This API manages news article collection, analysis, and reporting for the Consumer Product Safety Commission (CPSC) project focused on consumer product safety hazards.

## Architecture

### Core Components
- **Database**: Uses external NewsNexusDb09 (TypeScript) package via `newsnexusdb09` dependency
- **API Server**: Express.js application with modular route structure
- **Authentication**: JWT-based with bcrypt password hashing
- **External APIs**: Integration with NewsAPI, GNews, and Google RSS feeds

### Key Modules (`src/modules/`)
- `userAuthentication.js` - JWT auth, user management, admin creation
- `artificialIntelligence.js` - AI entity management for article categorization
- `queriesSql.js` - Database query abstractions and data retrieval
- `excelExports.js` - Report generation and Excel file exports
- `adminDb.js` - Database administration utilities
- `onStartUp.js` - Application initialization and admin user setup
- `common.js` - Shared utilities and helper functions

### Database Integration
- External TypeScript database package provides models and connections
- SQLite database with Sequelize ORM
- Complex schema with articles, users, AI entities, and approval workflows
- Database path configured via environment variables

## Development Commands

### Installation
```bash
npm install
```

### Running the Server
```bash
node src/server.js
```
- Server runs on port 8001 (configurable via PORT environment variable)
- Binds to 0.0.0.0 for external access

### Testing
Currently no test framework configured - `npm test` will exit with error.

## Environment Configuration

Required `.env` file with these key variables:
- `APP_NAME` - Application identifier for logging
- `JWT_SECRET` - Secret key for JWT token signing
- `PATH_DATABASE` - Directory path for SQLite database
- `NAME_DB` - Database filename
- `ADMIN_EMAIL_CREATE_ON_STARTUP` - JSON array of admin emails to create
- `NODE_ENV` - Environment (production/development)
- `AUTHENTIFICATION_TURNED_OFF` - Boolean to disable auth for development

## API Structure

### Key Endpoints
- `/artificial-intelligence/add-entity` - Register new AI categorization entities
- Authentication endpoints for user management
- Article management and approval workflows
- Report generation and export functionality

### Authentication
- JWT tokens required for most endpoints
- Admin users can be created automatically on startup
- bcrypt for password hashing

### API Documentation
- **Main Index**: `docs/API_REFERENCE_09.md` - Links to all router documentation
- **Detailed Docs**: `docs/api/{router}.md` or `docs/api/{category}/{router}.md` - Mirrors the `src/routes/` directory structure
- Each router file documents all endpoints within that router (e.g., `src/routes/analysis/llm01.js` → `docs/api/analysis/llm01.md`)
- When adding or modifying routes, update both the detailed router documentation and the main index
- Documentation includes authentication requirements, request/response examples, error codes, and usage notes

## External Dependencies

### NewsNexusDb09 Package
- Local file dependency: `../NewsNexusDb09`
- Provides all database models and connections
- TypeScript-based with compiled JavaScript output
- Must be built/compiled before API can function

### Third-party Services
- NewsAPI (newsapi.org)
- GNews (gnews.io)
- Google RSS feeds

## Important Notes

- No build process - runs directly on Node.js
- Error handling includes global uncaught exception and rejection handlers
- Logging prefixed with app name for multi-service environments
- Designed to run under PM2 process manager in production
- Database operations depend on external NewsNexusDb09 package availability