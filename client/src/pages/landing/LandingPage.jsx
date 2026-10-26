import { useRef, useState } from 'react'
import {
  LazyMotion,
  domAnimation,
  m as motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  GitBranch,
  MousePointer2,
  Play,
  Sparkles,
  Workflow,
} from 'lucide-react'
import Wheel from './Wheel.jsx'
import WorkflowPreview from './WorkflowPreview.jsx'
import LandingFooter from './LandingFooter.jsx'
import LandingNavigation from './LandingNavigation.jsx'
import {
  disconnectedSteps,
  features,
  revealProps,
  workflowStages,
  workflowPreviewTitle,
} from '../../data/landingData.js'
import './landing.css'

// Marketing landing page featuring animated visual loop, value propositions, and live demo preview
function LandingPage({ onLaunchBuilder }) {
  const [replayKey, setReplayKey] = useState(0)
  const reducedMotion = useReducedMotion()
  const heroRef = useRef(null)
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const wheelScale = useSpring(useTransform(heroProgress, [0, 1], [1, 0.76]), {
    stiffness: 80,
    damping: 24,
    mass: 0.45,
  })
  const wheelRotation = useSpring(useTransform(heroProgress, [0, 1], [0, 42]), {
    stiffness: 70,
    damping: 22,
    mass: 0.5,
  })

  // Generates a smooth scroll event handler for anchor links
  const scrollLink = (id) => (event) => {
    event.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  // Restarts the interactive workflow demo animation
  const replayDemo = () => {
    setReplayKey((key) => key + 1)
  }

  return (
    <LazyMotion features={domAnimation}>
    <div className="landing-page min-h-screen">
      <LandingNavigation
        onLaunchBuilder={onLaunchBuilder}
        onNavigateToSection={scrollLink}
        reducedMotion={reducedMotion}
      />

      <main>
        <section ref={heroRef} id="home" className="relative flex min-h-190 items-center overflow-hidden pt-20 lg:min-h-screen">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_48%,rgba(116,58,27,.2),transparent_42%),radial-gradient(ellipse_at_12%_20%,rgba(115,75,35,.13),transparent_38%),linear-gradient(180deg,#100d0a_0%,#100d0a_80%,#15100c_100%)]" />
          <div aria-hidden="true" className="landing-noise pointer-events-none absolute inset-0 opacity-30" />
          {[
            'left-[8%] top-[30%] h-1 w-1 bg-[#f0d58e]',
            'left-[43%] top-[18%] h-1.5 w-1.5 bg-[#d4ad58]',
            'bottom-[22%] left-[36%] h-1 w-1 bg-[#d98a54]',
            'right-[12%] top-[24%] h-1 w-1 bg-[#f0d58e]',
            'bottom-[16%] right-[28%] h-1.5 w-1.5 bg-[#d4ad58]',
          ].map((particleClass, index) => (
            <motion.div
              key={particleClass}
              aria-hidden="true"
              className={`absolute rounded-full ${particleClass}`}
              initial={{ opacity: 0.25, y: 0 }}
              animate={reducedMotion ? undefined : { opacity: [0.25, 0.8, 0.25], y: [0, -18, 0], x: [0, 10, 0] }}
              transition={{ duration: 7 + index, ease: 'easeInOut', repeat: Infinity }}
            />
          ))}

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-5 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[.95fr_1.05fr] lg:gap-0 lg:pb-16">
            <motion.div {...revealProps(reducedMotion)} className="relative z-10 max-w-2xl">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d4ad58]/25 bg-[#d4ad58]/6 px-3.5 py-2 text-[10px] font-semibold tracking-[.18em] text-[#d4ad58] sm:text-[11px]">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                IDEAS, IN MOTION
              </span>
              <h1 className="landing-display landing-hero-title text-4xl leading-[1.18] text-[#f0e5c9] sm:text-5xl lg:text-[4.25rem]">
                Make the work
                <br />
                <span className="bg-linear-to-r from-[#f0d58e] via-[#d4ad58] to-[#c76c4d] bg-clip-text text-transparent">flow</span> your way.
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[#a9997b] sm:text-base sm:leading-8">
                Dormammu Loop helps you turn an idea into a connected workflow. Shape the steps, see the flow, and make your process your own.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onLaunchBuilder}
                  className="landing-cta rounded-lg p-px shadow-[0_8px_32px_rgba(212,173,88,.14)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(212,173,88,.22)]"
                >
                  <span className="flex items-center justify-center gap-2 rounded-[7px] bg-[#c69b45] px-5 py-3.5 text-sm font-semibold text-[#21170c]">
                    <span className="absolute inset-0 -z-10 bg-[#c69b45]" />
                    Enter the workspace <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </span>
                </button>
                <a href="#how-it-works" onClick={scrollLink('how-it-works')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#8e7139]/35 px-5 py-3.5 text-sm text-[#d5c5a3] transition hover:border-[#d4ad58]/65 hover:text-[#f0d58e]">
                  <Play aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
                  Witness the flow
                </a>
              </div>
              <div className="mt-10 flex items-center gap-3 text-xs text-[#88795e]">
                <span className="flex -space-x-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#100d0a] bg-[#3a2b1e]"><Workflow aria-hidden="true" className="h-3.5 w-3.5 text-[#d4ad58]" /></span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#100d0a] bg-[#33221b]"><Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[#d98a54]" /></span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#100d0a] bg-[#28241b]"><GitBranch aria-hidden="true" className="h-3.5 w-3.5 text-[#c5aa72]" /></span>
                </span>
                <span>A clearer way to connect your work.</span>
              </div>
            </motion.div>

            <motion.div
              aria-hidden="true"
              style={{ scale: reducedMotion ? 1 : wheelScale, rotate: reducedMotion ? 0 : wheelRotation }}
              className="relative mx-auto flex aspect-square w-full max-w-152.5 items-center justify-center lg:-mr-16 lg:ml-0"
            >
              <div className="absolute inset-[10%] rounded-full bg-[#c76c4d]/6 blur-[70px]" />
              <div className="absolute inset-[9%] rounded-full border border-[#d4ad58]/10" />
              <div className="absolute inset-[17%] rounded-full border border-[#d4ad58]/8" />
              <Wheel className="relative h-full w-full" reducedMotion={reducedMotion} />
              <div className="absolute bottom-[17%] left-[8%] rounded-lg border border-[#8e7139]/35 bg-[#17120e]/90 px-3 py-2 shadow-xl backdrop-blur">
                <span className="flex items-center gap-2 text-[10px] text-[#c9b991]"><span className="h-1.5 w-1.5 rounded-full bg-[#d4ad58]" />Every step, connected</span>
              </div>
              <div className="absolute right-[6%] top-[25%] rounded-lg border border-[#8e7139]/35 bg-[#17120e]/90 px-3 py-2 shadow-xl backdrop-blur">
                <span className="flex items-center gap-2 text-[10px] text-[#c9b991]"><Sparkles aria-hidden="true" className="h-3 w-3 text-[#d4ad58]" />Intent to workflow</span>
              </div>
            </motion.div>
          </div>

          <a href="#experience" onClick={scrollLink('experience')} className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[9px] uppercase tracking-[.2em] text-[#88795e]">
            Explore the experience
            <motion.span
              animate={reducedMotion ? undefined : { y: [0, 6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ArrowDown aria-hidden="true" className="h-4 w-4 text-[#d4ad58]" />
            </motion.span>
          </a>
        </section>

        <section id="experience" className="relative border-y border-[#8e7139]/15 bg-[linear-gradient(180deg,#15100c,#100d0a)] py-24 sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
            <motion.div {...revealProps(reducedMotion)}>
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#b28e4a]">Before the flow</p>
              <h2 className="landing-display mt-5 text-3xl leading-tight text-[#f0e5c9] sm:text-4xl">
                Busy work is not a workflow.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#a9997b]">
                Repeated handoffs and disconnected tools make simple processes feel complicated. Start with the outcome; bring the steps into view.
              </p>
              <a href="#how-it-works" onClick={scrollLink('how-it-works')} className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[#d4ad58] hover:text-[#f0d58e]">
                Find your flow <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </motion.div>

            <motion.div {...revealProps(reducedMotion, 0.1)} className="relative min-h-72.5 overflow-hidden rounded-2xl border border-[#8e7139]/20 bg-[#130f0c] p-6 sm:p-10">
              <div aria-hidden="true" className="absolute inset-0 opacity-30 bg-[radial-gradient(#8e7139_0.7px,transparent_0.7px)] bg-size-[22px_22px]" />
              <div aria-hidden="true" className="absolute left-[16%] top-[24%] h-px w-[70%] rotate-13 bg-linear-to-r from-transparent via-[#8f4d3b]/60 to-transparent" />
              <div aria-hidden="true" className="absolute left-[20%] top-[63%] h-px w-[63%] rotate-[-17deg] bg-linear-to-r from-transparent via-[#d4ad58]/40 to-transparent" />
              <div className="relative grid min-h-57.5 grid-cols-2 items-center gap-4 sm:grid-cols-4">
                {disconnectedSteps.map(({ icon: Icon, title, spot }, index) => (
                  <motion.div
                    key={title}
                    className={`${spot} mx-auto flex w-28 flex-col items-center gap-3 rounded-xl border border-[#8e7139]/35 bg-[#1b1510]/95 p-4 text-center shadow-xl`}
                    animate={reducedMotion ? undefined : { y: [0, index % 2 ? 9 : -9, 0] }}
                    transition={{ duration: 6 + index, ease: 'easeInOut', repeat: Infinity }}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#8e7139]/35 bg-[#100d0a] text-[#bf9860]"><Icon aria-hidden="true" className="h-4 w-4" /></span>
                    <span className="text-xs text-[#c9b991]">{title}</span>
                  </motion.div>
                ))}
              </div>
              <span className="absolute bottom-5 left-6 text-[9px] uppercase tracking-[.16em] text-[#766b59]">Disconnected steps · scattered attention</span>
            </motion.div>
          </div>
        </section>

        <section id="how-it-works" className="relative overflow-hidden py-24 sm:py-32">
          <div aria-hidden="true" className="absolute -right-48 top-0 h-136 w-136 rounded-full bg-[#8e5c23]/8 blur-[100px]" />
          <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
            <motion.div {...revealProps(reducedMotion)} className="mx-auto max-w-2xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#b28e4a]">From intention to sequence</p>
              <h2 className="landing-display mt-5 text-3xl leading-tight text-[#f0e5c9] sm:text-4xl">
                Every idea has a sequence.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#a9997b]">
                Describe what you want to happen, then arrange each step into a workflow you can inspect and edit.
              </p>
            </motion.div>

            <motion.div {...revealProps(reducedMotion, 0.1)} className="relative mx-auto mt-14 max-w-6xl rounded-2xl border border-[#8e7139]/25 bg-[linear-gradient(145deg,rgba(36,27,19,.85),rgba(19,15,12,.94))] p-5 shadow-[0_30px_80px_rgba(0,0,0,.28)] sm:p-9">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#8e7139]/20 pb-5">
                <div>
                  <span className="font-mono text-[9px] uppercase tracking-[.18em] text-[#88795e]">Workflow concept</span>
                  <p className="mt-1 text-sm font-medium text-[#e5d8b8]">{workflowPreviewTitle}</p>
                </div>
                <button type="button" onClick={replayDemo} className="flex items-center gap-2 rounded-md border border-[#8e7139]/35 px-3 py-2 text-xs text-[#c9b991] transition hover:border-[#d4ad58]/65 hover:text-[#f0d58e]">
                  <Play aria-hidden="true" className="h-3 w-3" /> Replay preview
                </button>
              </div>
              <WorkflowPreview replayKey={replayKey} reducedMotion={reducedMotion} />
            </motion.div>

            <motion.div {...revealProps(reducedMotion)} className="mt-12 grid gap-6 text-center sm:grid-cols-3">
              {workflowStages.map(([number, title, description]) => (
                <div key={number} className="border-t border-[#8e7139]/25 pt-5">
                  <span className="text-[10px] tracking-[.18em] text-[#b28e4a]">{number}</span>
                  <h3 className="landing-display mt-2 text-lg text-[#e5d8b8]">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-[#88795e]">{description}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="features" className="border-y border-[#8e7139]/15 bg-[#15100c] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <motion.div {...revealProps(reducedMotion)} className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#b28e4a]">A focused toolkit</p>
                <h2 className="landing-display mt-5 text-3xl leading-tight text-[#f0e5c9] sm:text-4xl">One space. More ways to flow.</h2>
              </div>
              <p className="max-w-sm text-sm leading-7 text-[#a9997b]">A thoughtful set of tools to help you build, understand, and refine connected work.</p>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ number, icon: Icon, title, description }, index) => (
                <motion.article
                  key={number}
                  {...revealProps(reducedMotion, index * 0.09)}
                  whileHover={reducedMotion ? undefined : { y: -5, borderColor: 'rgba(212,173,88,.55)' }}
                  className="group relative min-h-67.5 overflow-hidden rounded-xl border border-[#8e7139]/25 bg-[linear-gradient(155deg,#211a13,#17120e_72%)] p-6"
                >
                  <div aria-hidden="true" className="absolute -right-12 -top-12 h-32 w-32 rounded-full border border-[#d4ad58]/[0.07] transition duration-500 group-hover:scale-125 group-hover:border-[#d4ad58]/20" />
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d4ad58]/25 bg-[#100d0a] text-[#d4ad58] transition group-hover:shadow-[0_0_24px_rgba(212,173,88,.12)]">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="mt-7 block text-[9px] tracking-[.18em] text-[#88795e]">{number} / TOOL</span>
                  <h3 className="landing-display mt-2 text-lg text-[#e5d8b8]">{title}</h3>
                  <p className="mt-3 text-xs leading-6 text-[#9d9076]">{description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#100d0a] py-24 sm:py-32">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(53,32,54,.4),transparent_55%),radial-gradient(ellipse_at_82%_50%,rgba(122,65,34,.12),transparent_40%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1fr]">
            <motion.div {...revealProps(reducedMotion)} className="relative order-2 mx-auto flex aspect-square w-full max-w-110 items-center justify-center lg:order-1">
              <div className="absolute inset-[12%] rounded-full bg-[#7f4228]/20 blur-[65px]" />
              <div className="absolute inset-[10%] rounded-full border border-[#d4ad58]/15" />
              <motion.div
                className="absolute inset-[13%] rounded-full border border-dashed border-[#d4ad58]/40"
                animate={reducedMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 42, ease: 'linear', repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-[22%] rounded-full border border-[#d98a54]/45"
                animate={reducedMotion ? undefined : { rotate: -360 }}
                transition={{ duration: 29, ease: 'linear', repeat: Infinity }}
              />
              <div className="absolute inset-[30%] rounded-full border border-[#d4ad58]/35 [background:radial-gradient(circle,rgba(212,173,88,.14),rgba(40,24,24,.08)_54%,transparent_72%)]" />
              <div className="absolute inset-[40%] rounded-full border border-[#f0d58e]/40 shadow-[0_0_70px_rgba(217,131,62,.18)]" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#f0d58e]/60 bg-[#d4ad58]/10 text-[#f0d58e] shadow-[0_0_50px_rgba(212,173,88,.28)]">
                <Sparkles aria-hidden="true" className="h-6 w-6" />
              </div>
              <span className="absolute left-[10%] top-[34%] rounded-md border border-[#8e7139]/35 bg-[#17120e] px-3 py-2 text-[10px] text-[#c9b991]">complex input</span>
              <span className="absolute bottom-[24%] right-[8%] rounded-md border border-[#8e7139]/35 bg-[#17120e] px-3 py-2 text-[10px] text-[#c9b991]">clear sequence</span>
            </motion.div>
            <motion.div {...revealProps(reducedMotion, 0.1)} className="order-1 lg:order-2">
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#b28e4a]">When systems get complex</p>
              <h2 className="landing-display mt-5 text-3xl leading-tight text-[#f0e5c9] sm:text-4xl">
                Even complexity can find its rhythm.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-[#a9997b]">
                Bring scattered steps into one considered view. Start small, connect the parts, and keep control of how your process takes shape.
              </p>
              <button type="button" onClick={onLaunchBuilder} className="mt-8 inline-flex items-center gap-2 rounded-md border border-[#8e7139]/40 px-4 py-3 text-sm font-medium text-[#e5d8b8] transition hover:border-[#d4ad58]/70 hover:text-[#f0d58e]">
                Shape a workflow <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-[#8e7139]/20 bg-[linear-gradient(180deg,#17120e,#100d0a)] py-28 sm:py-36">
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-144 w-xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#b57532]/8 blur-[90px]" />
          <motion.div {...revealProps(reducedMotion)} className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
            <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-[#d4ad58]/35 bg-[#d4ad58]/[0.07] text-[#d4ad58] shadow-[0_0_55px_rgba(212,173,88,.1)]">
              <MousePointer2 aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#b28e4a]">Your next workflow starts here</p>
            <h2 className="landing-display mt-5 text-3xl leading-tight text-[#f0e5c9] sm:text-5xl">
              Give your next idea a clear path.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#a9997b]">
              Design the steps. See how they connect. Let your ideas move from intention to an editable workflow.
            </p>
            <motion.button
              type="button"
              onClick={onLaunchBuilder}
              whileHover={reducedMotion ? undefined : { y: -3, scale: 1.02 }}
              whileTap={reducedMotion ? undefined : { scale: 0.98 }}
              className="landing-cta mt-8 inline-flex rounded-lg p-px shadow-[0_8px_32px_rgba(212,173,88,.14)]"
            >
              <span className="flex items-center gap-2 rounded-[7px] bg-[#c69b45] px-6 py-3.5 text-sm font-semibold text-[#21170c]">
                Open the workflow builder <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </motion.button>
            <p className="mt-4 text-xs text-[#766b59]">The builder opens in this demo workspace.</p>
          </motion.div>
        </section>
      </main>

      <LandingFooter onNavigateToSection={scrollLink} />
    </div>
    </LazyMotion>
  )
}

export default LandingPage
