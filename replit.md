# SignVerify - Signature Verification SaaS

## Overview
A web-based signature verification platform that allows users to create mask templates on PDF documents, then compare signatures between PDFs using curve-based similarity analysis. Includes API access for programmatic verification.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Passport.js with local strategy, session-based
- **PDF Processing**: pdfjs-dist for rendering, canvas for image manipulation
- **Image Processing**: sharp for PNG generation, custom TypeScript implementation of OpenCV-style algorithms

## Key Features
1. **User Auth**: Login/register with session management, first user becomes admin
2. **Template Creation**: Upload PDF, draw mask regions over signature areas, save as reusable templates
3. **Signature Verification**: Upload two PDFs, apply template masks, compare extracted signatures
4. **API Access**: REST API with API key auth for programmatic verification
5. **Admin Panel**: User management, role assignment

## Data Model
- `users`: id, username, password (hashed), role (admin/user), apiKey
- `templates`: id, name, description, userId, maskRegions (JSON), dpi, matchMode
- `verifications`: id, templateId, userId, confidenceScore, results (JSON), file1Name, file2Name

## Signature Processing Pipeline
Port of Python OpenCV code to TypeScript:
1. PDF page → grayscale image (via pdfjs-dist + canvas)
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
`POST /api/v1/verify` - multipart form with X-API-Key header, templateId, file1, file2

## Key Dependencies
- pdfjs-dist, canvas, sharp, multer, passport, passport-local, express-session, connect-pg-simple, bcrypt, uuid
