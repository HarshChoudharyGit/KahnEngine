import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import Header from './components/Header.jsx'
import SideBar from './components/SideBar.jsx'
import LandingPage from './pages/landing/LandingPage.jsx'
import DashboardPage from './pages/dashboard/DashboardPage.jsx'
import WorkflowCanvas from './components/WorkflowCanvas.jsx'
import { getWorkflow, saveWorkflow, deleteWorkflow } from './services/api.js'

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
  const [isTogglingActive, setIsTogglingActive] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
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
          if (wf.status) setIsActive(wf.status === 'active' || wf.status === 'ACTIVE')
        }
      })
      .catch((err) => {
        console.warn('Workflow not found or deleted:', err.message)
        if (isMounted) {
          setLoadedWorkflow(null)
          navigate('/dashboard', { replace: true })
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingWorkflow(false)
      })

    return () => {
      isMounted = false
    }
  }, [workflowIdParam, navigate])

  const handleToggleActive = async () => {
    if (isTogglingActive) return
    const nextActive = !isActive
    const nextStatus = nextActive ? 'active' : 'inactive'
    setIsTogglingActive(true)
    try {
      if (workflowIdParam || loadedWorkflow?.id) {
        await saveWorkflow({
          ...(loadedWorkflow || {}),
          id: workflowIdParam || loadedWorkflow?.id,
          name: workflowTitle,
          status: nextStatus,
        })
        setLoadedWorkflow((prev) => (prev ? { ...prev, status: nextStatus } : prev))
      }
      setIsActive(nextActive)
      setSaveStatus('saved')
    } catch (err) {
      console.error('Failed to update workflow active status:', err)
      alert(`Could not update active status: ${err.message}`)
    } finally {
      setIsTogglingActive(false)
    }
  }

  const handleReloadWorkflow = async () => {
    if (isReloading) return
    setIsReloading(true)
    try {
      if (workflowIdParam) {
        const fresh = await getWorkflow(workflowIdParam)
        if (fresh) {
          setLoadedWorkflow({
            ...fresh,
            revision: (loadedWorkflow?.revision || 0) + 1,
          })
          if (fresh.name) setWorkflowTitle(fresh.name)
          if (fresh.status) setIsActive(fresh.status === 'active' || fresh.status === 'ACTIVE')
          setSaveStatus('saved')
        }
      } else {
        setSelectedTemplate((current) => ({
          id: current?.id,
          revision: (current?.revision ?? 0) + 1,
        }))
        setSaveStatus('saved')
      }
    } catch (err) {
      console.error('Failed to reload workflow:', err)
      alert(`Failed to reload workflow: ${err.message}`)
    } finally {
      setIsReloading(false)
    }
  }

  const handleDeleteWorkflow = async () => {
    if (!workflowIdParam) return
    if (!window.confirm(`Are you sure you want to permanently delete "${workflowTitle}"?`)) return
    try {
      await deleteWorkflow(workflowIdParam)
      navigate('/dashboard')
    } catch (err) {
      alert(`Failed to delete workflow: ${err.message}`)
    }
  }

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
          isTogglingActive={isTogglingActive}
          onToggleActive={handleToggleActive}
          onReload={handleReloadWorkflow}
          isReloading={isReloading}
          onDeleteWorkflow={workflowIdParam ? handleDeleteWorkflow : undefined}
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
