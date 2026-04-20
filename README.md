<div align="center">
  <img src="https://img.icons8.com/nolan/256/1A6DFF/C822FF/book.png" alt="SkillVerse Logo" width="120" />

  # 🌌 SkillVerse
  
  **The ultimate gamified, next-generation skill-sharing platform.**

  <p align="center">
    <a href="#features">Features</a> •
    <a href="#gallery">Gallery</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Installation</a> •
    <a href="#api-documentation">API Docs</a>
  </p>

  ![React](https://img.shields.io/badge/React-18.2-blue?style=for-the-badge&logo=react)
  ![Vite](https://img.shields.io/badge/Vite-latest-646CFF?style=for-the-badge&logo=vite)
  ![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)
  ![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=nodedotjs)
  ![MySQL](https://img.shields.io/badge/MySQL-8.0-orange?style=for-the-badge&logo=mysql)
</div>

<br/>

SkillVerse is a premium, full-stack educational technology platform where users can seamlessly transition between teaching and learning. The platform features a spectacular, custom-built dark theme UI utilizing glassmorphism, staggered CSS animations, and highly fluid interactions.

Users earn **Skill Points** by completing modules, which can then be reinvested to unlock premium, expert-curated content!

---

## 📸 Gallery

*The stunning UI has been completely overhauled. (You can place your actual screenshots in the `docs/assets/` folder to display them here!)*

### 🌠 Immersive Landing Page
Features a staggered entrance cascade, an animated floating 3D IDE code-snippet, dynamic stat tickers, and glowing neon action states.
<img src="docs/assets/landing-page.png" onerror="this.src='https://placehold.co/1200x600/0d1021/7c5ce9.png?text=Landing+Page+Screenshot';" width="100%" alt="SkillVerse Landing Page" style="border-radius:12px; border: 1px solid rgba(255,255,255,0.1);" />

### 🔐 Split-Screen Authentication
A sleek, asymmetric layout with frosted-glass forms sliding up over animated gradient blobs. Brand visuals enter dynamically from the sides.
<div align="center">
  <img src="docs/assets/login.png" onerror="this.src='https://placehold.co/600x800/0d1021/7c5ce9.png?text=Login+Portal';" width="49%" alt="Login Page" style="border-radius:12px; border: 1px solid rgba(255,255,255,0.1);" />
  <img src="docs/assets/register.png" onerror="this.src='https://placehold.co/600x800/0d1021/7c5ce9.png?text=Registration+Portal';" width="49%" alt="Register Page" style="border-radius:12px; border: 1px solid rgba(255,255,255,0.1);" />
</div>

### 📚 Course Catalog & Dashboards
Advanced course filtering with beautiful tag selectors, interactive grids, and dedicated dual-dashboards for Learners and Instructors.
<img src="docs/assets/courses.png" onerror="this.src='https://placehold.co/1200x700/0d1021/7c5ce9.png?text=Course+Catalog+and+Dashboard';" width="100%" alt="Course Catalog" style="border-radius:12px; border: 1px solid rgba(255,255,255,0.1);" />

---

## ✨ Features

### 🎨 State-of-the-Art UI/UX
- **Custom Design System**: A comprehensive deep navy (`#0d1021`) and vibrant violet (`#7c5ce9`) aesthetic.
- **Advanced Animations**: Fluid `fade-in-up`, `fade-in-left`, and infinite `floating` keyframes injected straight from Tailwind.
- **Glassmorphism**: Beautiful frosted glass cards with `backdrop-blur` and subtle gradient border masks.

### 🎯 Gamified Learning Experience
- **Points Economy**: Earn points by passing quizzes and reaching milestones.
- **Reinvestment Loop**: Unlock premium content using earned points instead of real money.
- **Engaging Dashboard**: Track module completion and view real-time learning statistics.

### 👨‍🏫 Instructor Ecosystem
- **Course Studio**: Create, update, and manage your custom curriculum.
- **Monetization**: Set required point-costs for individual courses.
- **Analytics**: Monitor student progress, course popularity, and total enrollments.

### 🔐 Enterprise-Grade Security
- Secure password hashing using **bcrypt**.
- Rock-solid REST API protected by **JWT Bearer Authentication**.
- Granular Role-Based Access Control (Learner, Instructor, Both).
- SQL Injection & XSS threat mitigation routing.

---

## 🛠️ Tech Stack

### Frontend 💻
- **React 18.2** + **Vite**
- **Tailwind CSS** (Highly customized configurations + Keyframes)
- **React Router v6**
- **Lucide React** (Iconography)
- **Axios** (API Management)

### Backend ⚙️
- **Node.js** + **Express.js** 
- **MySQL 2** (Relational Data Model)
- **JWT** (JSON Web Tokens)
- **express-validator** & **Helmet**

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **MySQL** (v8.0+)
- **npm** or **yarn**

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/Kanavt15/SkillVerse.git
cd SkillVerse
```

**2. Setup Database**
```bash
mysql -u root -p < database/schema.sql
```

**3. Initialize Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your DB credentials & JWT secret
npm run dev
```

**4. Initialize Frontend**
```bash
cd ../frontend
npm install
npm run dev
```

The application will be running at [http://localhost:3000](http://localhost:3000)!

---

## 📡 API Documentation

### Authentication
- `POST /api/auth/register` - Create a new account
- `POST /api/auth/login` - Authenticate & receive JWT
- `GET /api/auth/profile` - Fetch current user snapshot

### Courses & Learning
- `GET /api/courses` - Fetch advanced paginated, filtered course catalog
- `POST /api/courses` - Publish a new course (Instructors only)
- `POST /api/enrollments` - Enroll in a course (Consumes points if required)
- `PUT /api/enrollments/lesson/:lessonId/complete` - Mark complete & earn rewards

---

## 🤝 Contributing
Contributions make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License
Distributed under the ISC License. 

<div align="center">
  <b>Built with ❤️ by the SkillVerse Team</b>
</div>
