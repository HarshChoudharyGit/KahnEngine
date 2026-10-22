import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Header from './components/Header.jsx'
import SideBar from './components/SideBar.jsx'
import LandingPage from './pages/landing/LandingPage.jsx'
import WorkflowCanvas from './components/WorkflowCanvas.jsx'

function LandingRoute() {
  const navigate = useNavigate()

  return <LandingPage onLaunchBuilder={() => navigate('/workspace')} />
}

function Workspace() {
  const [activeTab, setActiveTab] = useState('editor')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const navigate = useNavigate()

  return (
    <div className="flex h-screen overflow-hidden bg-[#100d0a]">
      <SideBar
        onGoHome={() => navigate('/')}
        onGoEditor={() => setActiveTab('editor')}
        onLoadTemplate={(templateId) => setSelectedTemplate((current) => ({
          id: templateId,
          revision: (current?.revision ?? 0) + 1,
        }))}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />
        <WorkflowCanvas activeTab={activeTab} selectedTemplate={selectedTemplate} />
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/signup" element={<LandingRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
