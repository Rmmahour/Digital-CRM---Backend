# Abacus CRM - Backend API

Social Media CRM Backend built with Node.js, Express, Prisma, and PostgreSQL.

## Features

- JWT Authentication
- Role-based Access Control (7 roles)
- RESTful API
- PostgreSQL with Prisma ORM
- Real-time notifications with Socket.io
- Task management system
- Brand management
- Comment system

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Installation

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Set up environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` and add your PostgreSQL connection string:
\`\`\`
DATABASE_URL="postgresql://user:password@localhost:5432/abacus_crm?schema=public"
\`\`\`

3. Generate Prisma Client:
\`\`\`bash
npm run prisma:generate
\`\`\`

4. Run database migrations:
\`\`\`bash
npm run prisma:migrate
\`\`\`

5. Seed the database with sample data:
\`\`\`bash
npm run prisma:seed
\`\`\`

## Running the Server

Development mode with auto-reload:
\`\`\`bash
npm run dev
\`\`\`

Production mode:
\`\`\`bash
npm start
\`\`\`

The server will start on `http://localhost:5000`

## Test Accounts

After seeding, you can login with:

- **Super Admin**: superadmin@abacus.com / admin123
- **Admin**: admin@abacus.com / admin123
- **Account Manager**: manager@abacus.com / admin123
- **Writer**: writer@abacus.com / admin123
- **Designer**: designer@abacus.com / admin123

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register (Super Admin only)
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (Admin+)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user (Super Admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Super Admin only)

### Brands
- `GET /api/brands` - Get all brands
- `POST /api/brands` - Create brand (Admin+)
- `PUT /api/brands/:id` - Update brand (Admin+)
- `DELETE /api/brands/:id` - Delete brand (Admin+)

### Tasks
- `GET /api/tasks` - Get all tasks (filtered by role)
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Comments
- `GET /api/tasks/:taskId/comments` - Get task comments
- `POST /api/tasks/:taskId/comments` - Add comment

## Database Schema

See `prisma/schema.prisma` for the complete database schema.

## User Roles & Permissions

1. **SUPER_ADMIN** - Full system access, user management
2. **ADMIN** - Manage brands, tasks, approvals
3. **ACCOUNT_MANAGER** - Manage client accounts and tasks
4. **WRITER** - Create and edit content
5. **DESIGNER** - Create and edit designs
6. **POST_SCHEDULER** - Schedule and publish posts
7. **CLIENT_VIEWER** - View-only access

## Prisma Commands

- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run migrations
- `npm run prisma:studio` - Open Prisma Studio (GUI)
- `npm run prisma:seed` - Seed database

## Project Structure

\`\`\`
backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   └── server.js
├── .env.example
├── package.json
└── README.md
# Digital-CRM---Backend
