import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
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

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-background">
            <Navbar />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:id" element={<CourseDetail />} />

              {/* Protected Routes - Learner */}
              <Route
                path="/my-courses"
                element={
                  <ProtectedRoute>
                    <MyCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-courses/:id"
                element={
                  <ProtectedRoute>
                    <CourseLearn />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/:id/learn"
                element={
                  <ProtectedRoute>
                    <CourseLearn />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes - Instructor */}
              <Route
                path="/instructor/dashboard"
                element={
                  <ProtectedRoute requireInstructor={true}>
                    <InstructorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/courses/create"
                element={
                  <ProtectedRoute requireInstructor={true}>
                    <CreateCourse />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/courses/:id/edit"
                element={
                  <ProtectedRoute requireInstructor={true}>
                    <EditCourse />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/courses/:id/lessons/create"
                element={
                  <ProtectedRoute requireInstructor={true}>
                    <CreateLesson />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/courses/:id/lessons/:lessonId/edit"
                element={
                  <ProtectedRoute requireInstructor={true}>
                    <EditLesson />
                  </ProtectedRoute>
                }
              />

              {/* 404 Route */}
              <Route
                path="*"
                element={
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
                      <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
                      <a href="/" className="text-primary hover:underline">
                        Go back home
                      </a>
                    </div>
                  </div>
                }
              />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
