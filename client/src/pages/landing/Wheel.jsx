import { Code2, Mail, MessageCircle } from 'lucide-react'
import { m as motion } from 'framer-motion'

const integrations = [
  { name: 'Gmail', icon: Mail },
  { name: 'GitHub', icon: Code2 },
  { name: 'Discord', icon: MessageCircle },
]

function Wheel({ className = '', reducedMotion }) {
  const spokes = Array.from({ length: 36 }, (_, index) => index * 10)
  const petals = Array.from({ length: 12 }, (_, index) => index * 30)

  return (
    <div className={`relative ${className}`}>
      <svg
        aria-hidden="true"
        className="landing-wheel absolute inset-0 h-full w-full"
        viewBox="0 0 500 500"
        fill="none"
      >
      <defs>
        <radialGradient id="wheel-glow">
          <stop offset="0" stopColor="#ffd27a" stopOpacity=".5" />
          <stop offset=".32" stopColor="#f4a342" stopOpacity=".15" />
          <stop offset="1" stopColor="#f4a342" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wheel-stroke" x1="50" y1="50" x2="450" y2="450">
          <stop stopColor="#f4cb73" stopOpacity=".85" />
          <stop offset=".48" stopColor="#db7936" stopOpacity=".5" />
          <stop offset="1" stopColor="#f4cb73" stopOpacity=".82" />
        </linearGradient>
      </defs>
      <circle cx="250" cy="250" r="240" fill="url(#wheel-glow)" />
      <motion.g
        stroke="url(#wheel-stroke)"
        style={{ transformOrigin: '250px 250px' }}
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 100, ease: 'linear', repeat: Infinity }}
      >
        <circle cx="250" cy="250" r="220" strokeWidth="1.2" strokeDasharray="2 5" />
        <circle cx="250" cy="250" r="210" strokeWidth="2" strokeDasharray="1 10" />
        <circle cx="250" cy="250" r="194" strokeWidth="1" />
        <circle cx="250" cy="250" r="181" strokeWidth="1.2" strokeDasharray="9 4 1 4" />
        {spokes.map((angle) => (
          <line key={angle} x1="250" y1="56" x2="250" y2="75" transform={`rotate(${angle} 250 250)`} strokeWidth="1.2" />
        ))}
        {Array.from({ length: 24 }, (_, index) => (
          <path
            key={`mark-${index}`}
            d="M250 30 L255 39 L250 48 L245 39 Z"
            transform={`rotate(${index * 15} 250 250)`}
            fill="#e9b65c"
            fillOpacity=".65"
            stroke="none"
          />
        ))}
      </motion.g>
      <motion.g
        stroke="#e7a14d"
        style={{ transformOrigin: '250px 250px' }}
        animate={reducedMotion ? undefined : { rotate: -360 }}
        transition={{ duration: 67, ease: 'linear', repeat: Infinity }}
      >
        <circle cx="250" cy="250" r="166" strokeOpacity=".5" />
        <circle cx="250" cy="250" r="153" strokeOpacity=".4" strokeDasharray="3 7" />
        {petals.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 250 250)`} strokeOpacity=".78">
            <path d="M250 88 C270 117 278 144 250 171 C222 144 230 117 250 88Z" />
            <circle cx="250" cy="112" r="3" fill="#e7a14d" fillOpacity=".85" />
          </g>
        ))}
        <path d="M250 104 L396 250 L250 396 L104 250 Z" strokeOpacity=".36" />
        <path d="M250 130 L370 250 L250 370 L130 250 Z" strokeOpacity=".34" />
      </motion.g>
      <motion.g
        stroke="#f0c879"
        style={{ transformOrigin: '250px 250px' }}
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 38, ease: 'linear', repeat: Infinity }}
      >
        <circle cx="250" cy="250" r="112" strokeOpacity=".74" />
        <circle cx="250" cy="250" r="97" strokeOpacity=".45" strokeDasharray="2 6" />
        <path d="M250 144 L342 197 L342 303 L250 356 L158 303 L158 197 Z" strokeOpacity=".55" />
        <path d="M250 158 L330 250 L250 342 L170 250 Z" strokeOpacity=".45" />
        {Array.from({ length: 8 }, (_, index) => (
          <circle key={`bead-${index}`} cx="250" cy="143" r="3" transform={`rotate(${index * 45} 250 250)`} fill="#f0c879" fillOpacity=".9" />
        ))}
      </motion.g>
      <motion.g
        style={{ transformOrigin: '250px 250px' }}
        animate={reducedMotion ? undefined : { scale: [0.94, 1.08, 0.94], opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
      >
        <circle cx="250" cy="250" r="68" fill="url(#wheel-glow)" />
        <circle cx="250" cy="250" r="52" stroke="#f3c96e" strokeOpacity=".82" />
        <circle cx="250" cy="250" r="39" stroke="#e58e42" strokeOpacity=".72" strokeDasharray="2 5" />
        <path d="M250 211 L285 250 L250 289 L215 250 Z" stroke="#f4cb73" strokeOpacity=".86" />
        <circle cx="250" cy="250" r="8" fill="#ffd27a" />
      </motion.g>
      <motion.g
        style={{ transformOrigin: '250px 250px' }}
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 13, ease: 'linear', repeat: Infinity }}
      >
        <circle cx="250" cy="30" r="4" fill="#ffcd6b" />
        <circle cx="250" cy="30" r="11" stroke="#ffcd6b" strokeOpacity=".4" />
      </motion.g>
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[18%] rounded-full border border-dashed border-[#d4ad58]/15"
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ transformOrigin: '50% 50%' }}
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
      >
        {integrations.map(({ name, icon: Icon }, index) => {
          const angle = (index / integrations.length) * Math.PI * 2 - Math.PI / 2
          const orbitRadius = 32

          return (
            <div
              key={name}
              className="absolute"
              style={{
                left: `${50 + Math.cos(angle) * orbitRadius}%`,
                top: `${50 + Math.sin(angle) * orbitRadius}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <motion.div
                animate={reducedMotion ? undefined : { rotate: -360 }}
                transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
                className="flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-full border border-[#d4ad58]/40 bg-[#17120e]/95 text-[#f0d58e] shadow-[0_0_20px_rgba(212,173,88,.12)] backdrop-blur sm:h-12 sm:w-12"
                title={name}
              >
                <Icon aria-hidden="true" className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                <span className="text-[7px] font-medium leading-none text-[#c9b991] sm:text-[8px]">
                  {name}
                </span>
              </motion.div>
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}

export default Wheel
