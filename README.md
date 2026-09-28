# Academic Compass

Academic Compass is an offline-first school management and academic performance tracking application. It streamlines mark entry, report generation, timetable management, and role-based access for principals, senior teachers, and teachers.

## Key Features

- **Role-based access control** — Principal, Senior Teacher, Teacher, and read-only roles
- **Offline-first mark entry** — works without internet and syncs when back online
- **Report form generation** — A4 printable report cards with student performance charts
- **Timetable management** — schedule creation with role-based edit permissions
- **Conflict resolution** — merge and review conflicting local changes
- **Transcripts & mark sheets** — detailed academic records with export support
- **Multi-curriculum support** — CBC and 8-4-4 curriculum tracking
- **Responsive UI** — mobile, tablet, and desktop friendly

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| State | Zustand |
| Backend | Express API server |
| Database | SQLite with Drizzle ORM |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Charts | Recharts |
| Build | pnpm workspaces |

## Prerequisites

- Node.js 20+
- pnpm 8+
- npm 9+ (optional)

## Installation

```bash
# Install dependencies
pnpm install
```

## Environment Setup

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite or PostgreSQL connection string |
| `SESSION_SECRET` | JWT signing secret |
| `PORT` | API server port (default: 8080) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `VITE_PORT` | Frontend dev server port (default: 5173) |
| `API_ORIGIN` | Backend URL for the frontend proxy |
| `DEV_BYPASS_APPROVAL` | Auto-approve new signups in development |

## Development

```bash
# Run backend API server
pnpm --filter @workspace/api-server run dev

# Run frontend dev server (separate terminal)
pnpm --filter @workspace/academic-compass run dev
```

- Frontend: `http://localhost:5173/`
- Backend API: `http://localhost:8080/`

## Build

```bash
# Build frontend for production
pnpm --filter @workspace/academic-compass run build

# Preview production build
pnpm --filter @workspace/academic-compass run serve

# Type check
pnpm --filter @workspace/academic-compass run typecheck
```

## Project Structure

```
Academic-Compass/
├── artifacts/
│   ├── academic-compass/       # Frontend React app
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── lib/            # Utilities and data
│   │   │   ├── pages/          # Route pages
│   │   │   └── store/          # Zustand stores
│   │   ├── public/             # Static assets
│   │   └── package.json
│   └── api-server/             # Express API server
│       ├── src/
│       │   ├── routes/         # API routes
│       │   └── lib/            # Database and store
│       └── package.json
├── lib/                        # Shared libraries
│   ├── db/                     # Database schema
│   ├── api-client-react/       # React API client
│   ├── api-zod/                # Zod schemas
│   └── api-spec/               # OpenAPI spec
├── scripts/                    # Build and CI scripts
└── package.json                # Root workspace config
```

## User Roles

| Role | Capabilities |
|------|-------------|
| **Principal** | Full system access, approve/reject signups, assign roles, manage staff and students, edit reports, timetables, and settings |
| **Senior Teacher** | Create/edit/delete timetable, add/delete learners, comment on reports, view mark sheets |
| **Teacher** | Enter marks, comment on report forms, view timetable, view students |
| **Unapproved** | Pending approval page until Principal grants access |

## Pages

| Page | Description |
|------|-------------|
| `/` | Dashboard with charts and KPIs |
| `/students` | Manage learners |
| `/classes` | Classes and streams management |
| `/subjects` | Subject configuration |
| `/teachers` | Staff directory |
| `/exams` | Exam creation and management |
| `/sheets` | Mark sheets review |
| `/entry` | Mark entry form |
| `/timetable` | Class timetable |
| `/conflicts` | Sync conflicts resolution |
| `/transcripts` | Student transcripts |
| `/reports` | A4 printable report forms |
| `/settings` | School settings and grading scale |
| `/profile` | User profile and role assignments |

## Signup & Approval Flow

1. First account created becomes **Principal** with full access
2. All subsequent accounts require **Principal approval**
3. During signup, users select their department to help the Principal assign roles faster
4. Once approved, the Principal assigns roles: Teacher or Senior Teacher

## Report Card Summary Boxes

The A4 report card header displays five summary boxes derived from the latest exam:

| Box | Value | Sub-line |
|-----|-------|----------|
| **Mean Grade** | Grade letter from the curriculum grading scale (e.g. `B+`, `EE2`) | Mean score %, e.g. `Mean 72.4%` |
| **Total Marks** | Sum of all subject scores | Number of subjects with marks |
| **Total Points** | Sum of grade points across subjects | Average points per subject |
| **Stream Pos.** | Rank / stream total | — |
| **Overall Pos.** | Rank / class total | — |

### Mean Grade Calculation

The mean grade is computed from the average raw score across all marked subjects:

```
mean = Σ(score) / N_subjects_with_marks
overallGrade = gradeFor(mean, curriculum.gradingScale)
```

- The **grade letter** is looked up in the curriculum's grading scale (KCSE or CBC bands).
- **Total Points** sums the grade points for each subject's individual grade.
- **Mean Points** = total points ÷ number of subjects (the standard KCSE aggregate).
- When no marks have been entered yet, the grade displays `—` rather than defaulting to the lowest band.

This logic lives in `statsForStudentExam` (`artifacts/academic-compass/src/lib/schoolData.ts:485`) and is shared by the web report card, the SMS summary, and the generated PDF.

## Database

The project uses SQLite for local development. The database file is stored at:

```
artifacts/api-server/data/academic-compass.sqlite
```

For production, update `DATABASE_URL` to a PostgreSQL connection string.

## Contributing

1. Create a feature branch from `feature/backend-completion`
2. Make your changes
3. Run `pnpm run typecheck` and ensure it passes
4. Commit with a descriptive message
5. Push and create a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please open an issue on GitHub.