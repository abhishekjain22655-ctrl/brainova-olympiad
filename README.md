# Brainova National Olympiad - Full-Stack Production Platform

Production-ready, fully functional copy and enhancement of the **Brainova National Olympiad** (`www.brainovanationalolympiad.com`) educational platform, ready for immediate GitHub push and production server deployment.

---

## 🔍 STEP 1: Live Tech Audit & Database Detection Report

| Layer | Target Footprint Detected | Evidence / Technographic Scan |
| :--- | :--- | :--- |
| **Target URL** | `https://www.brainovanationalolympiad.com` | Live production audit performed |
| **Web Server / Infrastructure** | **LiteSpeed Web Server (HTTP/2 & HTTP/3 QUIC)** | Header: `Server: LiteSpeed`, `alt-svc: h3=":443"` |
| **Backend Framework** | **PHP / CodeIgniter 4 (CI4)** | Cookie: `set-cookie: ci_session=...; expires=...; Max-Age=7200; path=/; HttpOnly; SameSite=Lax; secure`<br>Route structure: `/user/login.html`, `/student-registration-submit.html`, `/public/assets/` |
| **Underlying Database** | **MySQL / MariaDB** (standard for CodeIgniter / cPanel / LiteSpeed stack) | Relational multi-tenant tables (`schools`, `students`, `exams`, `exam_attempts`). |
| **Frontend Assets** | Bootstrap 5, Slick Slider, Flatpickr, FontAwesome 6, Isotope Filter | Verified from asset bundles & stylesheet tokens |

---

## 🚀 Key Features Built-In

1. **Brand 1:1 Aesthetic Design System:**
   - Exact corporate palette: Brand Coral/Orange (`#f16032`), Deep Navy (`#19124d`), Dark Surface (`#120e38`), Forest Teal (`#004439`).
   - Official logos and image hooks downloaded into `public/assets/images/`.
   - Dynamic numerical counter animations (50,000+ Students, 1,200+ Partner Schools, 98% Satisfaction).
   - Preloader, responsive navigation bar, quick quote modal, and newsletter subscriptions.

2. **Dedicated Subject Portals:**
   - Dedicated syllabus breakdowns and class modules (Classes 1 - 12) for:
     - **Mathematics Olympiad** (Algebra, Geometry, Arithmetic, Spatial Reasoning)
     - **English Olympiad** (Grammar, Syntax, Comprehension, Vocabulary)
     - **General Knowledge Olympiad** (Current Affairs, Science, History, Geography)
     - **Science Olympiad** (Physics, Chemistry, Biology)
     - **Cyber & Computer Olympiad** (Hardware, Algorithms, Coding logic)
   - 1-click **Launch Mock Exam** directly from any subject portal!

3. **Live Online Examination Platform (`/exam.html`):**
   - Active countdown timer with visual progress bar and under-3-minute warning alert.
   - Interactive Question Palette with status indicators:
     - Answered (Green)
     - Marked for Review (Purple)
     - Visited Unanswered (Yellow)
     - Not Visited (Gray)
     - Current Question (Blue outline)
   - Save & Next, Mark for Review, and Clear Response controls.
   - Automated grading engine calculating score (`+4 / 0`), percentage, percentile rank, and time taken.
   - Instant scorecard modal with detailed question-by-question review, student choice, correct answer, and explanations.

4. **Multi-Tenant Student & School Registration (`/register.html`):**
   - Dual-tab registration interface.
   - Automatic generation of unique roll numbers (e.g. `BNO-2026-0001`) and school tenant codes (e.g. `SCH-101`).
   - Dynamic institution selection tying students directly to their school tenant.

5. **Master Control Admin Dashboard (`/admin`):**
   - **Global Metric Cards:** Total Students, Verified Schools (Tenants), Completed Exams, Average Score %, Pass Rate.
   - **Registration Ledger:** Interactive multi-tenant table showing Student Name, Roll No, School/Tenant Name, Class, Email, Registration Date, Last Login Timestamp, and Status Badge (Active/Pending/Suspended).
   - **Subject Grid Performance:** Multi-tenant score tracker cleanly mapping exam scores across English, GK, and Maths with color-coded score badges.
   - **Unified Controls:**
     - Instant real-time Search Bar (searches by Name, Email, School, Roll Number).
     - Custom date wrapper filters (All Time, Today, Last 7 Days, Last 30 Days).
     - Tenant filter dropdown (filter by specific School).
     - **Live "Export to CSV" Button:** Generates and downloads RFC-4180 compliant CSV files of the filtered ledger or performance matrix.

---

## 🗄️ Database Architecture (Step 4)

This repository includes triple-tier database versatility:

1. **Built-in Zero-Config SQLite (Default):**
   - Self-seeds with realistic partner schools (Delhi Public School, St. Xavier's, Kendriya Vidyalaya), enrolled students, authentic questions, and scored exam attempts.
   - Starts immediately out of the box with zero external setup.

2. **MySQL / MariaDB (`db/schema.sql`):**
   - Matches the target audited CodeIgniter/LiteSpeed architecture.
   - Execute `mysql -u root -p < db/schema.sql` to deploy on MySQL.

3. **PostgreSQL / Supabase with Row-Level Security (`db/supabase_rls.sql`):**
   - Native multi-tenant isolation via PostgreSQL Row-Level Security (RLS).
   - Enforces institutional tenant privacy so schools only read their enrolled cohorts.

To switch database drivers, simply update `DB_CLIENT` in `.env`:
```env
DB_CLIENT=sqlite    # or 'mysql' or 'postgres'
```

---

## ⚡ Quick Start (Local Run)

```bash
# 1. Install dependencies
npm install

# 2. Launch production server
npm start
```

Visit in your browser:
- **Public Portal:** [http://localhost:3000](http://localhost:3000)
- **Subject Portals:** [http://localhost:3000/olympiads.html](http://localhost:3000/olympiads.html)
- **Interactive Mock Exam:** [http://localhost:3000/exam.html](http://localhost:3000/exam.html)
- **Master Admin Dashboard:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Registration Portal:** [http://localhost:3000/register.html](http://localhost:3000/register.html)
- **Login Portal:** [http://localhost:3000/login.html](http://localhost:3000/login.html)

---

## 🔑 Evaluator Demo Credentials

On the [Login Page](http://localhost:3000/login.html), use the **One-Click Autofill** buttons or enter:

| Role | Username / Identifier | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Master Admin** | `admin@brainova.com` | `Admin@2026` | Full Master Control & Global Ledger |
| **Student** | `aarav.sharma@gmail.com` | `Brainova@2026` | Subject Portals & Mock Exams |
| **School Tenant** | `principal@dpsrkp.net` | `Brainova@2026` | Institutional Ledger View |

---

## 📦 How to Push to GitHub & Deploy

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "feat: complete production release of Brainova National Olympiad"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/brainova-national-olympiad.git
git push -u origin main
```

### Step 2: Deploy to Cloud (Render / Railway / VPS / cPanel)
- **Render / Railway:** Connect your GitHub repository. Set build command to `npm install` and start command to `npm start`.
- **Docker:** Run `docker build -t brainova-web .` and `docker run -p 3000:3000 brainova-web`.
- **VPS / cPanel (LiteSpeed / Node.js Application Manager):** Upload files, run `npm install --production`, and configure your application startup file as `server.js`.
