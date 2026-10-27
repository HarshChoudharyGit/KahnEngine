import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import Header from './components/Header.jsx'
import SideBar from './components/SideBar.jsx'
import LandingPage from './pages/landing/LandingPage.jsx'
import DashboardPage from './pages/dashboard/DashboardPage.jsx'
import WorkflowCanvas from './components/WorkflowCanvas.jsx'
import { getWorkflow } from './services/api.js'

function LandingRoute() {
  const navigate = useNavigate()

  return <LandingPage onLaunchBuilder={() => navigate('/dashboard')} />
}

function Workspace() {
  const [searchParams] = useSearchParams()
  const workflowIdParam = searchParams.get('wf')
  const [activeTab, setActiveTab] = useState('editor')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [workflowTitle, setWorkflowTitle] = useState('My workflow')
  const [loadedWorkflow, setLoadedWorkflow] = useState(null)
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(Boolean(workflowIdParam))
  const [saveStatus, setSaveStatus] = useState('saved')
  const [isSaving, setIsSaving] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const saveActionRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!workflowIdParam) {
      setLoadedWorkflow(null)
      setIsLoadingWorkflow(false)
      return
    }

    let isMounted = true
    setIsLoadingWorkflow(true)

    getWorkflow(workflowIdParam)
      .then((wf) => {
        if (!isMounted) return
        if (wf) {
          setLoadedWorkflow(wf)
          if (wf.name) setWorkflowTitle(wf.name)
        }
      })
      .catch((err) => {
        console.error('Failed to load workflow by ID:', err)
      })
      .finally(() => {
        if (isMounted) setIsLoadingWorkflow(false)
      })

    return () => {
      isMounted = false
    }
  }, [workflowIdParam])

  return (
    <div className="flex h-screen overflow-hidden bg-[#100d0a]">
      <SideBar
        onGoHome={() => navigate('/')}
        onGoDashboard={() => navigate('/dashboard')}
        onGoEditor={() => setActiveTab('editor')}
        onLoadTemplate={(templateId) => {
          setLoadedWorkflow(null)
          setSelectedTemplate((current) => ({
            id: templateId,
            revision: (current?.revision ?? 0) + 1,
          }))
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          activeTab={activeTab}
          onTabChange={setActiveTab}
          workflowTitle={workflowTitle}
          onWorkflowTitleChange={setWorkflowTitle}
          onSave={() => saveActionRef.current?.()}
          isSaving={isSaving}
          saveStatus={saveStatus}
          isActive={isActive}
          onToggleActive={() => setIsActive((prev) => !prev)}
        />
        {isLoadingWorkflow ? (
          <div className="flex flex-1 items-center justify-center bg-[#100d0a]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4ad58] border-t-transparent" />
              <span className="text-xs text-[#9d9076]">Loading workflow…</span>
            </div>
          </div>
        ) : (
          <WorkflowCanvas
            activeTab={activeTab}
            selectedTemplate={selectedTemplate}
            loadedWorkflow={loadedWorkflow}
            workflowTitle={workflowTitle}
            setSaveStatus={setSaveStatus}
            setIsSaving={setIsSaving}
            saveActionRef={saveActionRef}
          />
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/signup" element={<LandingRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
