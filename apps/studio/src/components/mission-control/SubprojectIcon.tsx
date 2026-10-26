import React from 'react';

export type SubprojectCategory = 'frontend' | 'backend' | 'library' | 'tool' | 'docs' | 'module';

export interface SubprojectClassification {
  category: SubprojectCategory;
  typeLabel: string;
  color: string;
  badgeBg: string;
}

export function classifySubproject(name: string, desc?: string): SubprojectClassification {
  const text = `${name} ${desc ?? ''}`.toLowerCase();

  if (text.includes('doc') || text.includes('wiki') || text.includes('guide')) {
    return {
      category: 'docs',
      typeLabel: 'Documentation',
      color: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
    };
  }

  if (
    text.startsWith('tools/') ||
    text.includes('cli') ||
    text.includes('tool') ||
    text.includes('script') ||
    text.includes('scaffold') ||
    text.includes('devops') ||
    text.includes('harness')
  ) {
    return {
      category: 'tool',
      typeLabel: 'Tool / CLI',
      color: '#ec4899',
      badgeBg: 'rgba(236, 72, 153, 0.15)',
    };
  }

  if (
    text.startsWith('libs/') ||
    text.includes('lib') ||
    text.includes('protocol') ||
    text.includes('shared') ||
    text.includes('types') ||
    text.includes('schema') ||
    text.includes('sdk') ||
    text.includes('domain') ||
    text.includes('core')
  ) {
    return {
      category: 'library',
      typeLabel: 'Shared Library',
      color: '#a855f7',
      badgeBg: 'rgba(168, 85, 247, 0.15)',
    };
  }

  if (
    text.includes('api') ||
    text.includes('server') ||
    text.includes('bridge') ||
    text.includes('backend') ||
    text.includes('service') ||
    text.includes('worker') ||
    text.includes('daemon') ||
    text.includes('gateway')
  ) {
    return {
      category: 'backend',
      typeLabel: 'Backend Service',
      color: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
    };
  }

  if (
    text.startsWith('apps/') ||
    text.includes('web') ||
    text.includes('app') ||
    text.includes('frontend') ||
    text.includes('ui') ||
    text.includes('client') ||
    text.includes('portal') ||
    text.includes('mobile') ||
    text.includes('next') ||
    text.includes('react')
  ) {
    return {
      category: 'frontend',
      typeLabel: 'Frontend App',
      color: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
    };
  }

  return {
    category: 'module',
    typeLabel: 'Workspace Module',
    color: '#94a3b8',
    badgeBg: 'rgba(148, 163, 184, 0.15)',
  };
}

export function SubprojectIcon({
  category,
  size = 28,
  className = '',
}: {
  category: SubprojectCategory;
  size?: number;
  className?: string;
}) {
  const s = size;

  switch (category) {
    case 'frontend':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          data-testid="subproject-icon-frontend"
        >
          <rect x="2" y="3" width="20" height="18" rx="3" stroke="#10b981" strokeWidth="1.8" fill="rgba(16,185,129,0.08)" />
          <path d="M2 8H22" stroke="#10b981" strokeWidth="1.5" />
          <circle cx="5.5" cy="5.5" r="1" fill="#10b981" />
          <circle cx="8.5" cy="5.5" r="1" fill="#38bdf8" />
          <rect x="5" y="11" width="6" height="7" rx="1.5" fill="rgba(16,185,129,0.3)" stroke="#10b981" strokeWidth="1.2" />
          <path d="M14 12H19" stroke="#10b981" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M14 15H18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    case 'backend':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          data-testid="subproject-icon-backend"
        >
          <rect x="3" y="3" width="18" height="7" rx="2" stroke="#f59e0b" strokeWidth="1.8" fill="rgba(245,158,11,0.08)" />
          <rect x="3" y="14" width="18" height="7" rx="2" stroke="#f59e0b" strokeWidth="1.8" fill="rgba(245,158,11,0.08)" />
          <circle cx="6.5" cy="6.5" r="1" fill="#10b981" />
          <circle cx="6.5" cy="17.5" r="1" fill="#10b981" />
          <path d="M14 6.5H18" stroke="rgba(245,158,11,0.8)" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M14 17.5H18" stroke="rgba(245,158,11,0.8)" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M12 10V14" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      );

    case 'library':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          data-testid="subproject-icon-library"
        >
          <path
            d="M12 2L20.5 7V17L12 22L3.5 17V7L12 2Z"
            stroke="#a855f7"
            strokeWidth="1.8"
            strokeLinejoin="round"
            fill="rgba(168,85,247,0.08)"
          />
          <path d="M12 22V12" stroke="#a855f7" strokeWidth="1.6" />
          <path d="M20.5 7L12 12L3.5 7" stroke="#a855f7" strokeWidth="1.6" />
          <path d="M16 4.5L7.5 9.5" stroke="rgba(168,85,247,0.4)" strokeWidth="1.2" />
        </svg>
      );

    case 'tool':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          data-testid="subproject-icon-tool"
        >
          <rect x="2" y="4" width="20" height="16" rx="3" stroke="#ec4899" strokeWidth="1.8" fill="rgba(236,72,153,0.08)" />
          <path d="M6 9L9.5 12L6 15" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.5 15H17" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'docs':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          data-testid="subproject-icon-docs"
        >
          <path
            d="M4 19.5V5.5C4 4.12 5.12 3 6.5 3H20V20H6.5C5.12 20 4 19.5 4 19.5Z"
            stroke="#38bdf8"
            strokeWidth="1.8"
            fill="rgba(56,189,248,0.08)"
          />
          <path d="M4 17C5.12 17 6.5 17.5 6.5 17.5H20" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M8 7H16" stroke="rgba(56,189,248,0.8)" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M8 10H14" stroke="rgba(56,189,248,0.5)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    case 'module':
    default:
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          data-testid="subproject-icon-module"
        >
          <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="#94a3b8" strokeWidth="1.8" fill="rgba(148,163,184,0.1)" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="#94a3b8" strokeWidth="1.8" fill="rgba(148,163,184,0.1)" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="#94a3b8" strokeWidth="1.8" fill="rgba(148,163,184,0.1)" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="#94a3b8" strokeWidth="1.8" fill="rgba(148,163,184,0.1)" />
        </svg>
      );
  }
}
