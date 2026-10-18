# 🚀 Brainova National Olympiad — Client Delivery & Database Integration Guide

This guide details everything required to package, deliver, and connect this application to your client's production environment and database.

---

## 📋 1. What to Deliver to the Client

### A. Delivery Bundle Structure
When packaging the project as a ZIP or pushing to the client's repository, include:
- `public/` (All static assets, CSS, images, JS, HTML templates)
- `routes/` (API endpoint controllers: auth, admin, exam, public)
- `services/` (Email dispatcher service)
- `db/` (Database schemas & adapters: `schema.sql`, `supabase_rls.sql`, `database.js`)
- `server.js` (Main Node.js Express server)
- `package.json` & `package-lock.json`
- `.env.example` (Config template for client to fill)
- `Dockerfile` (Container deployment)
- `README.md` & `CLIENT_DELIVERY_GUIDE.md`

### ⚠️ What to EXCLUDE from the Delivery ZIP:
- ❌ `node_modules/` (The client or server runs `npm install` on their target machine)
- ❌ `.env` (Never send your private `.env` file containing personal passwords; send `.env.example` instead)
- ❌ `brainova.db` (Local SQLite test database with developer test records, unless delivering a pre-seeded standalone demo)
- ❌ `.git/` (If sending a clean zip package)

---

## 🗄️ 2. Connecting to Client's Database

The backend dynamically supports **MySQL / MariaDB**, **PostgreSQL**, and **SQLite** via `DB_CLIENT` in `.env`.

### 🔹 Option A: Client uses MySQL / MariaDB (Most Common: cPanel, VPS, AWS RDS, Hostinger)

1. **Create the Database & User**:
   - In **cPanel** > **MySQL Databases**:
     - Create database: `client_brainova`
     - Create user: `client_dbuser` with a strong password.
     - Add user to database with **ALL PRIVILEGES**.
   - Or via **MySQL CLI**:
     ```sql
     CREATE DATABASE brainova_olympiad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
     CREATE USER 'brainova_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
     GRANT ALL PRIVILEGES ON brainova_olympiad.* TO 'brainova_user'@'localhost';
     FLUSH PRIVILEGES;
     ```

2. **Import Schema**:
   - Open **phpMyAdmin** (or MySQL CLI):
   - Select the database `brainova_olympiad`.
   - Go to **Import** tab > Choose file `db/schema.sql` > Click **Go**.
   - *Note:* The application's `initDatabase()` will also auto-detect empty databases and apply `db/schema.sql` if privileges allow!

3. **Configure `.env`**:
   On the client server, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Set:
   ```env
   DB_CLIENT=mysql
   MYSQL_HOST=localhost       # Or RDS endpoint, e.g., db.xxxx.rds.amazonaws.com
   MYSQL_PORT=3306
   MYSQL_USER=client_dbuser
   MYSQL_PASSWORD=StrongPassword123!
   MYSQL_DATABASE=brainova_olympiad
   ```

---

### 🔹 Option B: Client uses PostgreSQL or Supabase

1. **Create Database**:
   - In Supabase SQL Editor or `psql`, execute the statements inside [db/supabase_rls.sql](file:///db/supabase_rls.sql).
2. **Configure `.env`**:
   ```env
   DB_CLIENT=postgres
   PG_HOST=db.your-supabase-project.supabase.co
   PG_PORT=5432
   PG_USER=postgres
   PG_PASSWORD=YourPassword
   PG_DATABASE=postgres
   PG_SSL=true
   ```

---

### 🔹 Option C: Zero-Config Embedded Database (SQLite)

If the client wants the portal running on a single server without managing an external database server:
```env
DB_CLIENT=sqlite
```
- No database installation or credentials needed.
- Automatically self-seeds tables, questions, schools, and sample cohorts on startup.

---

## 📧 3. Client Email / SMTP Setup

Ensure registrations and contact quotes are delivered to the client's inbox:
1. Open `.env` on client server.
2. Set:
   ```env
   ADMIN_NOTIFICATION_EMAIL=client_admin@theirdomain.com
   EMAIL_SERVICE=smtp
   EMAIL_USER=no-reply@theirdomain.com
   EMAIL_PASS=smtp_account_password
   SMTP_HOST=mail.theirdomain.com
   SMTP_PORT=587
   SMTP_SECURE=false
   EMAIL_FROM_NAME="Brainova National Olympiad"
   EMAIL_FROM_ADDRESS=no-reply@theirdomain.com
   ```

---

## 🖥️ 4. Server Deployment Methods

### Method 1: cPanel / LiteSpeed (Node.js Application Manager)
1. In cPanel, navigate to **Setup Node.js App**.
2. Click **Create Application**:
   - **Node.js version**: 18.x or 20.x
   - **Application mode**: Production
   - **Application root**: `brainova`
   - **Application startup file**: `server.js`
3. Click **Create**.
4. Upload all files into the root folder.
5. Click **Run NPM Install**.
6. Click **Restart**.

### Method 2: VPS / Linux Server (Ubuntu/Debian) with PM2 & Nginx
```bash
# 1. Clone or extract project
cd /var/www/brainova

# 2. Install production dependencies
npm install --production

# 3. Configure environment
cp .env.example .env
nano .env

# 4. Start with PM2 Process Manager
npm install -g pm2
pm2 start server.js --name "brainova-portal"
pm2 save
pm2 startup
```

**Nginx Reverse Proxy Config (`/etc/nginx/sites-available/brainova`)**:
```nginx
server {
    listen 80;
    server_name brainovanationalolympiad.com www.brainovanationalolympiad.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## ✅ 5. Final Handover Verification Checklist

Before handing the keys to the client, perform this quick 3-minute test:

1. **Health Check Endpoint**:
   Visit `https://domain.com/api/health`
   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "Brainova National Olympiad Portal",
     "version": "1.0.0",
     "database": "mysql"
   }
   ```
2. **Student Registration**:
   Register a test student from `/register.html`. Verify redirect to `/registration-success.html`.
3. **Master Admin Login**:
   Visit `/login.html`, log in with `ADMIN_USER` and `ADMIN_PASSWORD`, verify dashboard loads live records at `/admin`.
4. **Mock Exam Engine**:
   Visit `/exam.html`, select any subject (Maths, English, Science, Cyber, GK), start 15-question exam, and verify score calculation and certificate submission.
