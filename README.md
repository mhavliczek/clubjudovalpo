# Judo Club Management System

A backend API for managing a judo club, built with Express and SQLite.

## Features

- **Authentication**: Login system with JWT tokens
- **Roles**: Admin and Member roles
- **Members**: Register and manage club members
- **Belt Grades**: Track member progression through belt ranks
- **Attendance**: Record and track class attendance
- **Payments**: Manage membership fees and payments
- **Member Portal**: Each member can view their own info

## Installation

```bash
npm install
```

## Usage

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000`

## Default Admin User

- **Email:** `admin@judoclub.com`
- **Password:** `admin123`

**⚠️ Change the password after first login!**

## API Endpoints

### Authentication (Public)
- `POST /api/auth/login` - Login (body: `email`, `password`)
- `POST /api/auth/register` - Register new user (admin only)
- `GET /api/auth/me` - Get current user

### Config (Public)
- `GET /api/config` - Get club configuration

### Health (Public)
- `GET /health` - Health check

### Protected Endpoints (Require Auth)
- `GET /api/stats` - Dashboard statistics
- `GET /api/members` - List all members (admin only)
- `GET /api/members/:id` - Get member by ID
- `POST /api/members` - Create new member (admin only)
- `PUT /api/members/:id` - Update member (admin only)
- `DELETE /api/members/:id` - Delete member (admin only)
- `GET /api/grades` - Get all grades (admin only)
- `GET /api/grades/member/:memberId` - Get grades for a member
- `POST /api/grades` - Record new grade (admin only)
- `DELETE /api/grades/:id` - Delete grade (admin only)
- `GET /api/attendance` - List attendance records
- `POST /api/attendance` - Record attendance (admin only)
- `DELETE /api/attendance/:id` - Delete attendance (admin only)
- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment (admin only)
- `DELETE /api/payments/:id` - Delete payment (admin only)

## Deploy to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New +" → "Blueprint"
4. Connect your GitHub repository
5. Render will detect the `render.yaml` file
6. Click "Apply"

### Environment Variables (set in Render dashboard)

| Variable | Value |
|----------|-------|
| `CLUB_NAME` | Your club name |
| `JWT_SECRET` | Random secret (use generator) |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

## Database

The SQLite database is stored at `judo-club.db` in the project root.

**Note:** For production on Render, consider migrating to PostgreSQL for persistence.

## License

ISC
