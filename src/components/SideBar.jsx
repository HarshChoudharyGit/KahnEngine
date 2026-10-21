import logo from '../assets/logo.png'
import {
  BookOpen,
  Braces,
  Bug,
  GraduationCap,
  House,
  Info,
  Layers3,
  MessageCircle,
  MoreHorizontal,
  Sparkles,
  UserRound,
} from 'lucide-react'

const primaryLinks = [
  { label: 'Home', icon: House, active: true },
]

const resourceLinks = [
  { label: 'Templates', icon: Layers3 },
  { label: 'Variables', icon: Braces },
]

const helpLinks = [
  { label: 'Quickstart', icon: Sparkles },
  { label: 'Documentation', icon: BookOpen },
  { label: 'Forum', icon: MessageCircle },
  { label: 'Course', icon: GraduationCap },
  { label: 'Report a bug', icon: Bug },
  { label: 'About Dormammu Loop', icon: Info },
]

const NavLink = ({ label, icon: Icon, active = false, compact = false }) => (
  <button
    type="button"
    className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm transition ${
      active
        ? 'bg-[#c69b45]/15 text-[#f0d58e]'
        : 'text-[#b9aa8d] hover:bg-[#d4ad58]/8 hover:text-[#f0d58e]'
    }`}
    aria-current={active ? 'page' : undefined}
    title={compact ? label : undefined}
  >
    <Icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
    <span className={compact ? 'hidden truncate md:block' : 'truncate'}>{label}</span>
  </button>
)

const SideBar = () => {
  return (
    <aside className="flex h-screen w-17 shrink-0 flex-col border-r border-[#8e7139]/25 bg-[#17120e] text-[#e5d8b8] md:w-60">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[#8e7139]/25 px-4">
        <img src={logo} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
        <span className="font-display hidden truncate text-sm font-semibold tracking-wide text-[#f0d58e] md:block">
          Dormammu Loop
        </span>
      </div>

      <nav aria-label="Main navigation" className="sidebar-scroll flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {primaryLinks.map((link) => (
            <NavLink key={link.label} {...link} compact />
          ))}
        </div>

        <div className="mt-7">
          <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8f8065] md:block">
            Projects
          </p>
          <NavLink label="Personal" icon={UserRound} compact />
        </div>

        <div className="mt-7 space-y-1">
          {resourceLinks.map((link) => (
            <NavLink key={link.label} {...link} compact />
          ))}
        </div>

        <div className="mt-7">
          <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8f8065] md:block">
            Help
          </p>
          <div className="space-y-1">
            {helpLinks.map((link) => (
              <NavLink key={link.label} {...link} compact />
            ))}
          </div>
        </div>

        <button
          type="button"
          className="mt-5 flex h-10 items-center gap-3 rounded-md px-3 text-sm text-[#d4ad58] transition hover:bg-[#d4ad58]/8"
          title="Updates"
        >
          <span className="relative shrink-0">
            <Sparkles aria-hidden="true" className="h-4.5 w-4.5" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#c76c4d] ring-2 ring-[#17120e]" />
          </span>
          <span className="hidden md:block">1 update</span>
        </button>
      </nav>

      <div className="flex h-17 shrink-0 items-center gap-2 border-t border-[#8e7139]/25 px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d4ad58]/50 bg-[#332719] text-xs font-semibold text-[#f0d58e]">
          SL
        </div>
        <span className="hidden min-w-0 flex-1 truncate text-xs font-medium text-[#e5d8b8] md:block">
          Sorcerer Supreme
        </span>
        <button
          type="button"
          aria-label="Profile options"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-[#a9997b] hover:bg-[#d4ad58]/10 hover:text-[#f0d58e] md:flex"
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}

export default SideBar
