import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import MyCourses from './pages/MyCourses';
import CourseLearn from './pages/CourseLearn';
import InstructorDashboard from './pages/InstructorDashboard';
import CreateCourse from './pages/CreateCourse';
import EditCourse from './pages/EditCourse';
import CreateLesson from './pages/CreateLesson';
import EditLesson from './pages/EditLesson';
import Profile from './pages/Profile';
import VerifyCertificate from './pages/VerifyCertificate';
import Wallet from './pages/Wallet';
import Dashboard from './pages/Dashboard';
import Practice from './pages/Practice';
import ProblemSolve from './pages/ProblemSolve';

import Footer from './components/Footer';
import BackToTop from './components/BackToTop';

function AppContent() {
  const location = useLocation();
  // Hide global nav/footer on the full-screen course learning player
  // Ids are MongoDB ObjectIds (24 hex chars), not integers. The previous
  // `\d+` pattern never matched one, so the player route silently stopped
  // mounting. Matching any non-empty segment keeps this working regardless of
  // id format.
  const isLearningPlayer =
    /\/courses\/[^/]+\/learn$/.test(location.pathname) ||
    /^\/my-courses\/[^/]+$/.test(location.pathname);

  if (isLearningPlayer) {
    // Render ONLY the course learn page — no global navbar or footer
    return (
      <Routes>
        <Route path="/my-courses/:id" element={<ProtectedRoute><CourseLearn /></ProtectedRoute>} />
        <Route path="/courses/:id/learn" element={<ProtectedRoute><CourseLearn /></ProtectedRoute>} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/:slug" element={<ProblemSolve />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/verify/:certId" element={<VerifyCertificate />} />

          {/* Protected Routes - Learner */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/my-courses" element={<ProtectedRoute><MyCourses /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Protected Routes - Instructor */}
          <Route path="/instructor/dashboard" element={<ProtectedRoute requireInstructor={true}><InstructorDashboard /></ProtectedRoute>} />
          <Route path="/instructor/courses/create" element={<ProtectedRoute requireInstructor={true}><CreateCourse /></ProtectedRoute>} />
          <Route path="/instructor/courses/:id/edit" element={<ProtectedRoute requireInstructor={true}><EditCourse /></ProtectedRoute>} />
          <Route path="/instructor/courses/:id/lessons/create" element={<ProtectedRoute requireInstructor={true}><CreateLesson /></ProtectedRoute>} />
          <Route path="/instructor/courses/:id/lessons/:lessonId/edit" element={<ProtectedRoute requireInstructor={true}><EditLesson /></ProtectedRoute>} />

          {/* Wallet */}
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center pt-16">
              <div className="text-center">
                <div className="text-8xl font-black text-gradient mb-4 font-display">404</div>
                <h1 className="text-2xl font-bold text-foreground mb-3">Page Not Found</h1>
                <p className="text-muted-foreground mb-8 text-sm">The page you're looking for doesn't exist.</p>
                <a href="/" className="btn-primary">Go back home</a>
              </div>
            </div>
          } />
        </Routes>
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <AppContent />
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
