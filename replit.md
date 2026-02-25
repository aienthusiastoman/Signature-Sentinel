# SignVerify - Signature Verification SaaS

## Overview
A web-based signature verification platform that allows users to create mask templates on PDF documents, then compare signatures between PDFs using curve-based similarity analysis. Includes API access for programmatic verification.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Passport.js with local strategy, session-based
- **PDF Processing**: poppler (pdftoppm/pdfinfo) for PDF-to-image conversion
- **Image Processing**: sharp for PNG generation, custom TypeScript implementation of OpenCV-style algorithms

## Key Features
1. **User Auth**: Login/register with session management, first user becomes admin
2. **Template Creation**: Upload PDF, draw mask regions with file slot assignment, save as reusable templates
3. **Template Editing**: Edit existing templates (regions, settings, file slots)
4. **Signature Verification**: Upload N PDFs (one per file slot), apply corresponding mask regions, compare extracted signatures across all pairs
5. **API Access**: REST API with API key auth for programmatic verification
6. **Admin Panel**: User management, role assignment

## Data Model
- `users`: id, username, password (hashed), role (admin/user), apiKey
- `templates`: id, name, description, userId, maskRegions (JSON with fileSlot), fileSlotCount, dpi, matchMode
- `verifications`: id, templateId, userId, confidenceScore, results (JSON), fileNames (JSON), file1Name, file2Name

## Mask Regions & File Slots
Each mask region has a `fileSlot` (1-indexed) indicating which uploaded file it applies to. Templates can have 2-5 file slots. When verifying, users upload one PDF per slot. Each file is scanned using only the regions assigned to its slot.

## Signature Processing Pipeline
Port of Python OpenCV code to TypeScript:
1. PDF page → grayscale image (via poppler pdftoppm + sharp)
2. Crop mask region from page
3. Adaptive thresholding (Gaussian)
4. Remove horizontal/vertical lines
5. Find largest connected component
6. Normalize signature to standard size
7. Skeletonize (Zhang-Suen thinning)
8. Extract vertical curve profile
9. Compute normalized cross-correlation between curves

## Match Modes
- **strict**: Raw score only
- **relaxed**: 1.25x multiplier
- **vacation**: 1.4x multiplier

## API Endpoint
`POST /api/v1/verify` - multipart form with X-API-Key header, templateId, file1..fileN (one per slot)

## Key Dependencies
- sharp, multer, passport, passport-local, express-session, connect-pg-simple, bcrypt, uuid
- System: poppler_utils (pdftoppm, pdfinfo), util-linux

## Pages
- `/` - Dashboard
- `/templates` - Templates list
- `/templates/new` - Create template
- `/templates/:id` - Template detail + API docs
- `/templates/:id/edit` - Edit template
- `/verify` - Verify signatures
- `/verifications` - Verification history
- `/verifications/:id` - Verification detail
- `/admin/users` - Admin user management
- `/api-docs` - API documentation
