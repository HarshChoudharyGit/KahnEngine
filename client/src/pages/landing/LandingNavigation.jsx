import { useState } from 'react'
import {
  AnimatePresence,
  m as motion,
  useMotionValueEvent,
  useScroll,
} from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'

const navigationLinks = [
  { id: 'experience', label: 'The experience' },
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How it works' },
]

function LandingNavigation({ onLaunchBuilder, onNavigateToSection, reducedMotion }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 24)
  })

  const handleSectionClick = (id) => (event) => {
    onNavigateToSection(id, event)
    setMenuOpen(false)
  }

  const launchBuilder = () => {
    setMenuOpen(false)
    onLaunchBuilder()
  }

  return (
    <nav
      className={`landing-nav fixed inset-x-0 top-0 z-50 border-b border-transparent ${scrolled ? 'is-scrolled' : ''}`}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#home" onClick={handleSectionClick('home')} className="flex items-center gap-2.5">
          <img src={logo} alt="" className="h-9 w-9 rounded-lg object-cover" />
          <span className="landing-display text-sm font-semibold tracking-wide text-[#f0d58e] sm:text-base">
            Dormammu Loop
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navigationLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={handleSectionClick(id)}
              className="text-xs text-[#b9aa8d] transition hover:text-[#f0d58e]"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="hidden cursor-pointer items-center gap-2 rounded-md border border-[#8e7139]/35 bg-[#17120e] px-4 py-2.5 text-xs font-semibold text-[#c9b991] transition hover:border-[#d4ad58]/50 hover:text-[#f0d58e] md:flex"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={onLaunchBuilder}
            className="hidden cursor-pointer items-center gap-2 rounded-md border border-[#d4ad58]/50 bg-[#d4ad58]/10 px-4 py-2.5 text-xs font-semibold text-[#f0d58e] transition hover:border-[#f0d58e] hover:bg-[#d4ad58]/20 md:flex"
          >
            Launch Builder <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-[#8e7139]/35 text-[#d4ad58] md:hidden"
        >
          {menuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="overflow-hidden border-t border-[#8e7139]/25 bg-[#100d0a]/95 px-5 py-4 backdrop-blur-xl md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {navigationLinks.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={handleSectionClick(id)}
                  className="rounded px-3 py-3 text-sm text-[#c9b991] hover:bg-[#d4ad58]/8"
                >
                  {label}
                </a>
              ))}
              <button
                type="button"
                onClick={launchBuilder}
                className="mt-2 flex items-center justify-center gap-2 rounded-md bg-[#c69b45] px-4 py-3 text-sm font-semibold text-[#21170c]"
              >
                Launch builder <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

export default LandingNavigation
