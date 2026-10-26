import {
  ArrowRight,
  Sparkles,
  Workflow,
} from 'lucide-react'
import logo from '../../assets/logo.png'

function AuthPage({ children, onExploreWorkspace }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#100d0a] px-4 py-10 text-[#e5d8b8] sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-136 w-136 rounded-full bg-[#9a6b24]/10 blur-[120px]" />
        <div className="absolute -bottom-64 -right-40 h-152 w-152 rounded-full bg-[#8f4d3b]/10 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#8e7139_0.7px,transparent_0.7px)] bg-size-[24px_24px]" />
      </div>

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-[#8e7139]/30 bg-[#17120e]/95 shadow-[0_30px_100px_rgba(0,0,0,0.55)] lg:min-h-160 lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-[#8e7139]/20 bg-[linear-gradient(150deg,rgba(42,32,20,0.96),rgba(23,18,14,0.98)_56%,rgba(16,13,10,0.98))] p-10 lg:flex xl:p-12">
          <div aria-hidden="true" className="absolute -right-28 top-36 h-72 w-72 rounded-full border border-[#d4ad58]/10">
            <div className="absolute inset-8 rounded-full border border-[#d4ad58]/10" />
            <div className="absolute inset-16 rounded-full border border-[#d4ad58]/10" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4ad58] shadow-[0_0_30px_10px_rgba(212,173,88,0.22)]" />
          </div>

          <a href="#" onClick={(event) => event.preventDefault()} className="relative flex w-fit items-center gap-3">
            <img src={logo} alt="" className="h-10 w-10 rounded-lg object-cover shadow-lg shadow-black/25" />
            <span className="font-display text-sm font-semibold tracking-wide text-[#f0d58e]">
              Dormammu Loop
            </span>
          </a>

          <div className="relative my-12">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d4ad58]/20 bg-[#d4ad58]/7 px-3 py-1.5 text-[11px] font-medium tracking-wide text-[#d4ad58]">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              YOUR AUTOMATION WORKSPACE
            </span>
            <h1 className="font-display max-w-md text-4xl leading-[1.2] text-[#f0e5c9] xl:text-[2.75rem]">
              Make the work
              <br />
              <span className="text-[#d4ad58]">flow</span> your way.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#a9997b]">
              Bring your tools together and turn your best ideas into workflows that just work.
            </p>

            <div className="mt-10 rounded-xl border border-[#8e7139]/25 bg-[#100d0a]/60 p-4 shadow-xl shadow-black/10">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-medium text-[#c9b991]">
                  <Workflow aria-hidden="true" className="h-4 w-4 text-[#d4ad58]" />
                  A little less busywork
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#75c5a0] shadow-[0_0_8px_rgba(117,197,160,0.6)]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-[#d4ad58]/25 bg-[#d4ad58]/8 px-3 py-2 text-[11px] text-[#e5d8b8]">
                  New request
                </span>
                <span className="h-px flex-1 bg-[#8e7139]/40" />
                <span className="rounded-md border border-[#8e7139]/25 bg-[#17120e] px-3 py-2 text-[11px] text-[#a9997b]">
                  Your workflow
                </span>
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-[#d4ad58]" />
              </div>
            </div>
          </div>

          <p className="relative text-xs text-[#766b59]">A calmer way to connect the things you do.</p>
        </aside>

        <div className="flex items-center justify-center p-6 sm:p-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-md">
            <a href="#" onClick={(event) => event.preventDefault()} className="mb-10 flex w-fit items-center gap-2.5 lg:hidden">
              <img src={logo} alt="" className="h-9 w-9 rounded-lg object-cover" />
              <span className="font-display text-sm font-semibold tracking-wide text-[#f0d58e]">
                Dormammu Loop
              </span>
            </a>

            {children}

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-[#8e7139]/20" />
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#766b59]">or</span>
              <span className="h-px flex-1 bg-[#8e7139]/20" />
            </div>

            <button
              type="button"
              onClick={onExploreWorkspace}
              className="w-full rounded-lg border border-[#8e7139]/30 bg-transparent px-4 py-3 text-sm font-medium text-[#c9b991] transition hover:border-[#d4ad58]/55 hover:bg-[#d4ad58]/5 hover:text-[#f0d58e]"
            >
              Explore the workspace
            </button>

            <p className="mt-5 text-center text-[11px] leading-5 text-[#766b59]">
              Authentication is not configured yet. You can explore the workspace in demo mode.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AuthPage
