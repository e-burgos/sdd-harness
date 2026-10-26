'use client';

interface AgentFaceProps {
  agent: string;
  size?: number;
  className?: string;
}

export function AgentFace({ agent, size = 32, className = '' }: AgentFaceProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      data-testid={`agent-face-${agent}`}
    >
      {renderFace(agent)}
    </svg>
  );
}

function renderFace(agent: string) {
  switch (agent) {
    case 'sdd-orchestrator': // Clara - Directora de Orquesta (Emerald & Crown)
      return (
        <g>
          {/* Hair back */}
          <path d="M7 19C7 11 11 6 18 6C25 6 29 11 29 19C29 27 26 31 18 31C10 31 7 27 7 19Z" fill="#064e3b" />
          {/* Head & Neck */}
          <path d="M15 26H21V30H15V26Z" fill="#fcd34d" />
          <path d="M11 17C11 13 14 10 18 10C22 10 25 13 25 17C25 22 22 26 18 26C14 26 11 22 11 17Z" fill="#fed7aa" />
          {/* Hair front bob */}
          <path d="M9 16C9 10 13 8 18 8C23 8 27 10 27 16C27 17 25 14 23 13C20 12 16 12 13 13C11 14 9 17 9 16Z" fill="#047857" />
          {/* Eyes & Smile */}
          <ellipse cx="15" cy="18" rx="1.2" ry="1.5" fill="#064e3b" />
          <ellipse cx="21" cy="18" rx="1.2" ry="1.5" fill="#064e3b" />
          <path d="M16 22Q18 24 20 22" stroke="#064e3b" strokeWidth="1.2" strokeLinecap="round" />
          {/* Comm Headset */}
          <path d="M25 18C25.8 18 26.5 19 26.5 20C26.5 21 25.8 22 25 22" fill="#10b981" />
          <path d="M25 21C23 23 20 23.5 19 23.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
          <circle cx="19" cy="23.5" r="1.2" fill="#34d399" />
          {/* Golden/Emerald Crown */}
          <path d="M13 7L14.5 10L18 6L21.5 10L23 7L24 11H12L13 7Z" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
          <circle cx="18" cy="6" r="1" fill="#10b981" />
        </g>
      );

    case 'sdd-functional': // Sophia - Diseñadora de Producto (Cyan & Round Glasses)
      return (
        <g>
          {/* Bob hair */}
          <path d="M8 18C8 10 12 6 18 6C24 6 28 10 28 18C28 24 27 27 26 27C24 27 24 22 24 18C24 13 21 9 18 9C15 9 12 13 12 18C12 22 12 27 10 27C9 27 8 24 8 18Z" fill="#0369a1" />
          {/* Neck & Face */}
          <path d="M15 26H21V30H15V26Z" fill="#fed7aa" />
          <path d="M11 17C11 13 14 10 18 10C22 10 25 13 25 17C25 22 22 26 18 26C14 26 11 22 11 17Z" fill="#fed7aa" />
          {/* Fringe */}
          <path d="M11 13C14 11 22 11 25 13C24 15 21 13 18 13C15 13 12 15 11 13Z" fill="#0284c7" />
          {/* Round Glasses */}
          <circle cx="14.5" cy="17.5" r="3" stroke="#0284c7" strokeWidth="1.2" fill="#e0f2fe" fillOpacity="0.4" />
          <circle cx="21.5" cy="17.5" r="3" stroke="#0284c7" strokeWidth="1.2" fill="#e0f2fe" fillOpacity="0.4" />
          <line x1="17.5" y1="17.5" x2="18.5" y2="17.5" stroke="#0284c7" strokeWidth="1.2" />
          {/* Eyes behind glass */}
          <circle cx="14.5" cy="17.5" r="1" fill="#0c4a6e" />
          <circle cx="21.5" cy="17.5" r="1" fill="#0c4a6e" />
          {/* Smile */}
          <path d="M16 22Q18 24.5 20 22" stroke="#0369a1" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );

    case 'sdd-planner': // Chronos - Maestro del Tiempo & WBS (Purple & Monocle)
      return (
        <g>
          {/* Slick hair */}
          <path d="M10 17C10 9 13 5 18 5C23 5 26 9 26 17C26 23 24 26 18 26C12 26 10 23 10 17Z" fill="#581c87" />
          {/* Face */}
          <path d="M15 25H21V30H15V25Z" fill="#fed7aa" />
          <path d="M11 17C11 13 14 10 18 10C22 10 25 13 25 17C25 22 22 26 18 26C14 26 11 22 11 17Z" fill="#fed7aa" />
          {/* Hair bangs parted */}
          <path d="M10 12C13 8 20 7 26 10C24 13 20 10 18 10C15 10 12 12 10 12Z" fill="#7e22ce" />
          {/* Normal eye left */}
          <ellipse cx="14.5" cy="17" rx="1.1" ry="1.4" fill="#3b0764" />
          {/* Clockwork Tech Monocle right eye */}
          <circle cx="21.5" cy="17" r="3.4" stroke="#a855f7" strokeWidth="1.4" fill="#fae8ff" fillOpacity="0.4" />
          <circle cx="21.5" cy="17" r="1.2" fill="#9333ea" />
          {/* Crosshair ticks */}
          <line x1="21.5" y1="13.8" x2="21.5" y2="14.8" stroke="#a855f7" strokeWidth="1" />
          <line x1="24.7" y1="17" x2="23.7" y2="17" stroke="#a855f7" strokeWidth="1" />
          {/* Monocle cord */}
          <path d="M24.5 18C25.5 21 26 24 26 26" stroke="#c084fc" strokeWidth="0.8" strokeDasharray="1 1" />
          {/* Focused smirk */}
          <path d="M16 22.5Q18.5 23.5 20.5 22" stroke="#581c87" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );

    case 'sdd-architect': // Daedalus - Guardián de Arquitectura (Pink & Tech Visor)
      return (
        <g>
          {/* Dark pink modern cut */}
          <path d="M9 16C9 9 13 6 18 6C23 6 27 9 27 16C27 24 23 26 18 26C13 26 9 24 9 16Z" fill="#831843" />
          {/* Face */}
          <path d="M15 25H21V30H15V25Z" fill="#fed7aa" />
          <path d="M11 17C11 13 14 10 18 10C22 10 25 13 25 17C25 22 22 26 18 26C14 26 11 22 11 17Z" fill="#fed7aa" />
          {/* Angular Hair */}
          <path d="M9 13L15 8L21 8L27 12L24 13L18 10L12 13L9 13Z" fill="#be185d" />
          {/* Rectangular architect glasses */}
          <rect x="11.5" y="15" width="6" height="4.5" rx="1" stroke="#ec4899" strokeWidth="1.2" fill="#fdf2f8" fillOpacity="0.3" />
          <rect x="18.5" y="15" width="6" height="4.5" rx="1" stroke="#ec4899" strokeWidth="1.2" fill="#fdf2f8" fillOpacity="0.3" />
          <line x1="17.5" y1="17" x2="18.5" y2="17" stroke="#ec4899" strokeWidth="1.2" />
          {/* Pupils */}
          <circle cx="14.5" cy="17.2" r="1" fill="#831843" />
          <circle cx="21.5" cy="17.2" r="1" fill="#831843" />
          {/* Neat goatee line */}
          <path d="M17 25H19L18 26L17 25Z" fill="#831843" />
          <path d="M16 22.5H20" stroke="#831843" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );

    case 'sdd-implementor-back': // Vulcan - Forjador del Backend (Amber & Welder Goggles)
      return (
        <g>
          {/* Rugged hair */}
          <path d="M8 16C8 9 12 5 18 5C24 5 28 9 28 16C28 23 24 26 18 26C12 26 8 23 8 16Z" fill="#78350f" />
          {/* Face */}
          <path d="M15 25H21V30H15V25Z" fill="#fcd34d" />
          <path d="M11 17C11 13 14 10 18 10C22 10 25 13 25 17C25 22 22 26 18 26C14 26 11 22 11 17Z" fill="#fde68a" />
          {/* Welder goggles pushed up on forehead */}
          <path d="M9 11C11 10 25 10 27 11" stroke="#451a03" strokeWidth="2.5" />
          <circle cx="14" cy="10" r="3.2" fill="#b45309" stroke="#f59e0b" strokeWidth="1.2" />
          <circle cx="14" cy="10" r="1.8" fill="#fef3c7" />
          <circle cx="22" cy="10" r="3.2" fill="#b45309" stroke="#f59e0b" strokeWidth="1.2" />
          <circle cx="22" cy="10" r="1.8" fill="#fef3c7" />
          {/* Determined eyes */}
          <ellipse cx="14.5" cy="17" rx="1.2" ry="1.4" fill="#451a03" />
          <ellipse cx="21.5" cy="17" rx="1.2" ry="1.4" fill="#451a03" />
          {/* Confident grin */}
          <path d="M15 22Q18 25 21 21.5" stroke="#78350f" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );

    case 'sdd-implementor-front': // Aurora - Artista Frontend & UI (Orange & Cyber Headset)
      return (
        <g>
          {/* Neon orange hair with flow */}
          <path d="M8 18C8 10 12 6 18 6C24 6 28 10 28 18C28 25 25 28 18 28C11 28 8 25 8 18Z" fill="#c2410c" />
          {/* Face */}
          <path d="M15 25H21V30H15V25Z" fill="#fed7aa" />
          <path d="M11 17C11 13 14 10 18 10C22 10 25 13 25 17C25 22 22 26 18 26C14 26 11 22 11 17Z" fill="#fed7aa" />
          {/* Asymmetrical fringe */}
          <path d="M9 14C13 10 22 9 27 14C23 16 19 13 16 13C12 13 10 15 9 14Z" fill="#ea580c" />
          {/* Expressive big eyes */}
          <ellipse cx="14.5" cy="17.5" rx="1.5" ry="2" fill="#431407" />
          <circle cx="15.2" cy="16.8" r="0.6" fill="#ffffff" />
          <ellipse cx="21.5" cy="17.5" rx="1.5" ry="2" fill="#431407" />
          <circle cx="22.2" cy="16.8" r="0.6" fill="#ffffff" />
          {/* Cyber barrette on hair */}
          <polygon points="10,11 12,9 14,11 12,13" fill="#fb923c" />
          {/* Cheerful wide smile */}
          <path d="M15 22Q18 25.5 21 22" stroke="#9a3412" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      );

    case 'sdd-reviewer': // Argus - Ojo Crítico & Reviewer (Cyan Cyber Visor)
      return (
        <g>
          {/* Dark slate hair/helmet */}
          <path d="M9 17C9 9 13 6 18 6C23 6 27 9 27 17C27 24 23 27 18 27C13 27 9 24 9 17Z" fill="#0e7490" />
          {/* Face */}
          <path d="M15 25H21V30H15V25Z" fill="#e2e8f0" />
          <path d="M11 17C11 13 14 10 18 10C22 10 25 13 25 17C25 22 22 26 18 26C14 26 11 22 11 17Z" fill="#e2e8f0" />
          {/* Laser Optic Visor */}
          <path d="M10 15H26V19.5H10V15Z" rx="2" fill="#0891b2" />
          <line x1="11" y1="17.2" x2="25" y2="17.2" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="18" cy="17.2" r="1.5" fill="#ffffff" />
          {/* Analytical sharp smirk */}
          <path d="M16 23H20" stroke="#155e75" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      );

    case 'sdd-steward': // Atlas - Conserje del Repositorio (Friendly Android Robot)
      return (
        <g>
          {/* Android Dome Head */}
          <rect x="10" y="10" width="16" height="16" rx="6" fill="#334155" stroke="#64748b" strokeWidth="1" />
          {/* Antenna */}
          <line x1="18" y1="10" x2="18" y2="5" stroke="#94a3b8" strokeWidth="1.5" />
          <circle cx="18" cy="5" r="1.5" fill="#38bdf8" />
          {/* Visor Screen */}
          <rect x="12" y="13" width="12" height="7" rx="3" fill="#0f172a" />
          {/* Digital Friendly Pill Eyes */}
          <circle cx="15" cy="16.5" r="1.5" fill="#38bdf8" />
          <circle cx="21" cy="16.5" r="1.5" fill="#38bdf8" />
          {/* Digital smile */}
          <path d="M15 22Q18 24 21 22" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
          {/* Ear Bolts */}
          <rect x="8.5" y="15" width="2" height="4" rx="1" fill="#64748b" />
          <rect x="25.5" y="15" width="2" height="4" rx="1" fill="#64748b" />
        </g>
      );

    case 'sdd-hermes':
      return (
        <g>
          <path d="M9 18C9 10 13 6 18 6C23 6 27 10 27 18C27 25 24 28 18 28C12 28 9 25 9 18Z" fill="#3f6212" />
          <path d="M15 25H21V30H15V25Z" fill="#fed7aa" />
          <path d="M11 17C11 13 14 10 18 10C22 10 25 13 25 17C25 22 22 26 18 26C14 26 11 22 11 17Z" fill="#fed7aa" />
          <path d="M7 16L4 12L7 13L9 15Z" fill="#a3e635" />
          <path d="M29 16L32 12L29 13L27 15Z" fill="#a3e635" />
          <path d="M10 12C14 10 22 10 26 12L25 15H11L10 12Z" fill="#65a30d" />
          <ellipse cx="14.5" cy="17.5" rx="1.2" ry="1.5" fill="#1a2e05" />
          <ellipse cx="21.5" cy="17.5" rx="1.2" ry="1.5" fill="#1a2e05" />
          <path d="M15 22Q18 25 21 22" stroke="#3f6212" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      );

    case 'user':
      return (
        <g>
          <circle cx="18" cy="13" r="5.5" fill="#e2e8f0" />
          <path d="M10 28C10 22.5 13.5 20.5 18 20.5C22.5 20.5 26 22.5 26 28" fill="#94a3b8" />
        </g>
      );

    default:
      return (
        <g>
          <circle cx="18" cy="18" r="14" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <ellipse cx="14" cy="16" rx="1.5" ry="2" fill="#38bdf8" />
          <ellipse cx="22" cy="16" rx="1.5" ry="2" fill="#38bdf8" />
          <path d="M14 23Q18 26 22 23" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
  }
}
