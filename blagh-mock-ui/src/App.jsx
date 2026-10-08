import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated, syncReporterConfig, getUser, showWidget, hideWidget } from './utils/auth'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import LeaveRequests from './pages/LeaveRequests'
import Announcements from './pages/Announcements'
import Payroll from './pages/Payroll'

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />
}

function AppInit({ children }) {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/login') {
      hideWidget()
    } else {
      showWidget()
    }
  }, [location.pathname])

  useEffect(() => {
    const user = getUser()
    if (user) syncReporterConfig(user)
  }, [])

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInit>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"      element={<Dashboard />} />
            <Route path="employees"      element={<Employees />} />
            <Route path="leave-requests" element={<LeaveRequests />} />
            <Route path="announcements"  element={<Announcements />} />
            <Route path="payroll"        element={<Payroll />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppInit>
    </BrowserRouter>
  )
}
