
import { useEffect, useState } from 'react'
import { GitBranch, CheckCircle2, LoaderCircle, RotateCw } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const inputClassName =
  'mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-sm text-[#f0e5c9] outline-none transition placeholder:text-[#756b5a] focus:border-[#c69b45]'

// Form component for configuring GitHub webhook triggers, repository bindings, and event types
function GitHubTriggerConfigForm({ value, errors, onChange }) {
  const [connected, setConnected] = useState(false)
  const [username, setUsername] = useState('')
  const [repositories, setRepositories] = useState(null)
  const [branchState, setBranchState] = useState({ repository: '', branches: [] })
  const [connectionMessage, setConnectionMessage] = useState('')
  const loading = connected && repositories === null
  const branches = branchState.repository === value.repository ? branchState.branches : []
  const loadingBranches = Boolean(
    connected && value.repository && branchState.repository !== value.repository,
  )

  // Updates a single field in the GitHub trigger form value
  const setField = (key, nextValue) =>
    onChange({ ...value, [key]: nextValue })

  // Opens a popup window to initiate GitHub OAuth authorization
  const connectGitHub = () => {
    const popup = window.open(
      `${API_URL}/api/integrations/github/connect`,
      'github-oauth',
      'width=600,height=700',
    )

    if (!popup) {
      setConnectionMessage('Please allow popups for this site.')
    } else {
      setConnectionMessage('Complete authorization in the GitHub popup.')
      const pollTimer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(pollTimer)
          void loadConnectionStatus(true)
        }
      }, 700)
    }
  }

  // Fetches repositories accessible to the authenticated GitHub user
  const loadRepositories = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/integrations/github/repositories`,
        { credentials: 'include' },
      )
      if (!response.ok) throw new Error('Failed to load repositories')

      const data = await response.json()
      setRepositories(data.repositories || [])
      setConnectionMessage('')
    } catch (err) {
      console.error('Error fetching repositories:', err)
      setRepositories([])
      setConnectionMessage('Could not load repositories. Please try again.')
    }
  }

  // Checks current GitHub OAuth connection status and username from backend
  const loadConnectionStatus = async (showMessage = false) => {
    try {
      const response = await fetch(
        `${API_URL}/api/integrations/github/status`,
        { credentials: 'include' },
      )
      if (!response.ok) throw new Error('GitHub status request failed')

      const data = await response.json()
      const isConnected = Boolean(data.connected)
      setConnected(isConnected)
      setUsername(data.username || '')
      if (isConnected) {
        void loadRepositories()
      }
      if (showMessage) {
        setConnectionMessage(
          isConnected
            ? `GitHub connected${data.username ? ` as @${data.username}` : ''}. Loading repositories...`
            : 'GitHub authorization was not confirmed by the backend.',
        )
      }
    } catch {
      setConnectionMessage('Unable to check GitHub connection. Check your backend.')
    }
  }

  useEffect(() => {
    // Listens for postMessage auth events from the GitHub OAuth popup
    const handleOAuthMessage = (event) => {
      if (event.data?.type !== 'oauth-result' || event.data?.provider !== 'github') {
        return
      }

      if (!event.data.connected) {
        setConnectionMessage(event.data.error || 'GitHub authorization failed.')
        return
      }
      void loadConnectionStatus(true)
    }

    void loadConnectionStatus()
    window.addEventListener('message', handleOAuthMessage)
    window.addEventListener('focus', () => void loadConnectionStatus())
    return () => {
      window.removeEventListener('message', handleOAuthMessage)
      window.removeEventListener('focus', () => void loadConnectionStatus())
    }
  }, [])

  useEffect(() => {
    if (!connected) return undefined
    void loadRepositories()
  }, [connected])

  useEffect(() => {
    if (!connected || !value.repository) return undefined

    let active = true
    // Fetches branches for the selected repository
    const loadBranches = async () => {
      const [owner, repo] = value.repository.split('/')

      try {
        const response = await fetch(
          `${API_URL}/api/integrations/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
          { credentials: 'include' },
        )
        if (!response.ok) throw new Error('Failed to load branches')

        const data = await response.json()
        if (active) {
          setBranchState({
            repository: value.repository,
            branches: data.branches || [],
          })
        }
      } catch {
        if (active) {
          setBranchState({ repository: value.repository, branches: [] })
          setConnectionMessage('Could not load branches for this repository.')
        }
      }
    }

    void loadBranches()
    return () => {
      active = false
    }
  }, [connected, value.repository])

  const disconnectGitHub = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/integrations/github/disconnect`,
        {
          method: 'POST',
          credentials: 'include',
        },
      )

      if (!response.ok) {
        throw new Error('Disconnect failed')
      }

      setConnected(false)
      setUsername('')
      setRepositories([])
      setBranchState({ repository: '', branches: [] })
      setConnectionMessage('GitHub disconnected.')
    } catch {
      setConnectionMessage('Could not disconnect GitHub.')
    }
  }

  return (
    <div className="space-y-5">
      {/* GitHub OAuth connection */}
      <section className="rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {connected ? (
              <CheckCircle2 size={16} className="text-green-400" />
            ) : (
              <GitBranch size={17} className="text-[#f0e5c9]" />
            )}

            <span className="text-xs text-[#c9b991]">
              {connected
                ? `Connected${username ? ` as ${username}` : ''}`
                : 'Not connected'}
            </span>
          </div>

          <span className="rounded-full border border-[#8e7139]/30 px-2 py-1 text-[10px] uppercase tracking-wide text-[#a9997b]">
            {connected ? 'Authorized' : 'GitHub OAuth'}
          </span>
        </div>

        {!connected ? (
          <button
            type="button"
            onClick={connectGitHub}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-[#8e7139]/40 px-3 py-2 text-xs font-medium text-[#f0d58e] transition hover:border-[#c69b45] hover:bg-[#d4ad58]/8"
          >
            <GitBranch size={15} />
            Connect GitHub
          </button>
        ) : (
          <button
            type="button"
            onClick={disconnectGitHub}
            className="mt-3 w-full rounded-md border border-red-900/50 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30"
          >
            Disconnect GitHub
          </button>
        )}

        <p role="status" className="mt-2 text-[11px] leading-relaxed text-[#e0bb72]">
          {connectionMessage ||
            (connected
              ? 'Choose a repository to configure your trigger.'
              : 'Connect your account to load authorized repositories.')}
        </p>
      </section>

      {/* Repository */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="github-repository" className="block text-xs font-medium text-[#c9b991]">
            Repository<span className="ml-1 text-[#d98a74]">*</span>
          </label>
          {connected && (
            <button
              type="button"
              onClick={loadRepositories}
              className="inline-flex items-center gap-1 text-[11px] text-[#d4ad58] hover:text-[#f0d58e] transition"
              title="Refresh repository list"
            >
              <RotateCw size={11} /> Refresh
            </button>
          )}
        </div>

        <select
          id="github-repository"
          value={value.repository}
          disabled={!connected || loading}
          onChange={(event) => {
            onChange({
              ...value,
              repository: event.target.value,
              branch: '',
            })
          }}
          aria-invalid={Boolean(errors.repository)}
          className={inputClassName}
        >
          <option value="">
            {!connected
              ? 'Connect GitHub first'
              : loading
                ? 'Loading repositories...'
                : 'Select repository'}
          </option>

          {repositories?.map((repo) => (
            <option key={repo.full_name} value={repo.full_name}>
              {repo.full_name}
            </option>
          ))}
        </select>

        {loading && (
          <LoaderCircle size={14} className="mt-2 animate-spin text-[#c69b45]" />
        )}

        {errors.repository && (
          <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">
            {errors.repository}
          </p>
        )}
      </div>

      {/* Branch */}
      <div>
        <label htmlFor="github-branch" className="block text-xs font-medium text-[#c9b991]">
          Branch
        </label>

        <select
          id="github-branch"
          value={value.branch}
          disabled={!connected || !value.repository || loadingBranches}
          onChange={(event) => setField('branch', event.target.value)}
          className={inputClassName}
        >
          <option value="">
            {loadingBranches ? 'Loading branches...' : 'Select branch'}
          </option>

          {branches.map((branch) => (
            <option key={branch.name} value={branch.name}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Events */}
      <fieldset>
        <legend className="mb-2 block text-xs font-medium text-[#c9b991]">
          Events<span className="ml-1 text-[#d98a74]">*</span>
        </legend>

        <div className="grid grid-cols-2 gap-2">
          {[
            ['push', 'Push'],
            ['pull_request', 'Pull Request'],
            ['issues', 'Issue Created'],
            ['release', 'Release Published'],
          ].map(([event, label]) => (
            <label
              key={event}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 px-2.5 py-2.5 text-xs text-[#c9b991]"
            >
              <input
                type="checkbox"
                checked={(value.events || []).includes(event)}
                onChange={(changeEvent) =>
                  setField(
                    'events',
                    changeEvent.target.checked
                      ? [...(value.events || []), event]
                      : (value.events || []).filter((item) => item !== event),
                  )
                }
                className="h-3.5 w-3.5 accent-[#c69b45]"
              />
              {label}
            </label>
          ))}
        </div>

        {errors.events && (
          <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">
            {errors.events}
          </p>
        )}
      </fieldset>

      {/* Branch filters */}
      <div>
        <label htmlFor="github-branches-include" className="block text-xs font-medium text-[#c9b991]">
          Only these branches
        </label>
        <input
          id="github-branches-include"
          value={value.branchesInclude || ''}
          onChange={(event) => setField('branchesInclude', event.target.value)}
          placeholder="feature/*, release/*"
          className={inputClassName}
        />
        <p className="mt-1.5 text-[11px] text-[#8f8065]">
          Comma-separated patterns. Leave empty to include all branches.
        </p>
      </div>

      <div>
        <label htmlFor="github-branches-ignore" className="block text-xs font-medium text-[#c9b991]">
          Ignore these branches
        </label>
        <input
          id="github-branches-ignore"
          value={value.branchesIgnore || ''}
          onChange={(event) => setField('branchesIgnore', event.target.value)}
          placeholder="experimental/*"
          className={inputClassName}
        />
      </div>

      {value.events?.includes('pull_request') && (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 px-3 py-2.5 text-xs text-[#c9b991]">
          <input
            type="checkbox"
            checked={Boolean(value.includeDrafts)}
            onChange={(event) => setField('includeDrafts', event.target.checked)}
            className="h-4 w-4 accent-[#c69b45]"
          />
          Include draft pull requests
        </label>
      )}
    </div>
  )
}

export default GitHubTriggerConfigForm
