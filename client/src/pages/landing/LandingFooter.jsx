import logo from '../../assets/logo.png'

function LandingFooter({ onNavigateToSection }) {
  const handleHomeClick = (event) => onNavigateToSection('home', event)

  return (
    <footer className="border-t border-[#8e7139]/20 bg-[#100d0a]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-xs text-[#766b59] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <a href="#home" onClick={handleHomeClick} className="flex items-center gap-2 text-[#b9aa8d]">
          <img src={logo} alt="" className="h-6 w-6 rounded object-cover" />
          <span className="landing-display text-[11px] text-[#c9b991]">Dormammu Loop</span>
        </a>
        <span>Make space for work that flows.</span>
        <span>© {new Date().getFullYear()} Dormammu Loop</span>
      </div>
    </footer>
  )
}

export default LandingFooter
