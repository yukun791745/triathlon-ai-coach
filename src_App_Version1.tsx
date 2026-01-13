import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AuthCallback from './pages/AuthCallback'
import ActivityDetailPage from './pages/ActivityDetailPage'
import AICoachPage from './pages/AICoachPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/activity/:id" element={<ActivityDetailPage />} />
        <Route path="/ai" element={<AICoachPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App