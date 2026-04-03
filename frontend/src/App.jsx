import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import MonitorPage from './pages/MonitorPage'
import AnalyticsPage from './pages/AnalyticsPage'
import PerformancePage from './pages/PerformancePage'
import ChatbotPage from './pages/ChatbotPage'

function App() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/chatbot" element={<ChatbotPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
