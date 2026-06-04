import React from 'react';

const AdminNavIcon = ({ name }) => {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };

  const icons = {
    dashboard: (
      <svg {...commonProps}>
        <rect x="3" y="3" width="7" height="8" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="15" width="7" height="6" rx="1.5" />
      </svg>
    ),
    books: (
      <svg {...commonProps}>
        <path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v12H8.5A3.5 3.5 0 0 1 5 16.5z" />
        <path d="M8 4.5v12A3.5 3.5 0 0 0 11.5 20" />
        <path d="M8 8h7" />
        <path d="M8 11h6" />
      </svg>
    ),
    analytics: (
      <svg {...commonProps}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 16l3.5-4 3 2.5L19 8" />
        <path d="M17 8h2v2" />
      </svg>
    ),
    activity: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
    logs: (
      <svg {...commonProps}>
        <path d="M7 3.5h7l3 3V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
        <path d="M14 3.5V7h3" />
        <path d="M9 11h6" />
        <path d="M9 15h6" />
      </svg>
    ),
    users: (
      <svg {...commonProps}>
        <path d="M16 19v-1.5A3.5 3.5 0 0 0 12.5 14h-5A3.5 3.5 0 0 0 4 17.5V19" />
        <circle cx="10" cy="8" r="3" />
        <path d="M20 19v-1.2a3 3 0 0 0-2.4-2.9" />
        <path d="M16.5 5.3a3 3 0 0 1 0 5.4" />
      </svg>
    ),
    settings: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05-2.1 2.1-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V20.5h-3v-.12A1.8 1.8 0 0 0 10.5 18.7a1.8 1.8 0 0 0-1.98.36l-.05.05-2.1-2.1.05-.05A1.8 1.8 0 0 0 6.8 15a1.8 1.8 0 0 0-1.66-1.1H5v-3h.12A1.8 1.8 0 0 0 6.8 9.8a1.8 1.8 0 0 0-.36-1.98l-.05-.05 2.1-2.1.05.05A1.8 1.8 0 0 0 10.5 6.1a1.8 1.8 0 0 0 1.1-1.66V4.3h3v.14a1.8 1.8 0 0 0 1.1 1.66 1.8 1.8 0 0 0 1.98-.36l.05-.05 2.1 2.1-.05.05a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.66 1.1h.12v3h-.12A1.8 1.8 0 0 0 19.4 15z" />
      </svg>
    ),
    copies: (
      <svg {...commonProps}>
        <path d="M7 7.5 12 5l5 2.5-5 2.5z" />
        <path d="M7 7.5v6L12 16l5-2.5v-6" />
        <path d="M12 10v6" />
        <path d="M5 11 3.5 12 12 16.5 20.5 12 19 11" />
      </svg>
    ),
    available: (
      <svg {...commonProps}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="m8.5 12.5 2.4 2.4 4.9-5.3" />
      </svg>
    ),
    warning: (
      <svg {...commonProps}>
        <path d="M12 4 21 20H3z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </svg>
    ),
    studentCap: (
      <svg {...commonProps}>
        <path d="M22 10 12 3 2 10l10 6 10-6z" />
        <path d="M6 12v5c0 2.2 2.7 4 6 4s6-1.8 6-4v-5" />
      </svg>
    ),
    adminShield: (
      <svg {...commonProps}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    staffBuilding: (
      <svg {...commonProps}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5h8v2" />
        <path d="M9 12h2" />
        <path d="M13 12h2" />
        <path d="M9 16h2" />
        <path d="M13 16h2" />
      </svg>
    ),
    search: (
      <svg {...commonProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
    refresh: (
      <svg {...commonProps}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    ),
    plus: (
      <svg {...commonProps}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
    returnBook: (
      <svg {...commonProps}>
        <path d="M4 12h11" />
        <path d="M11 5l7 7-7 7" />
      </svg>
    ),
    loan: (
      <svg {...commonProps}>
        <path d="M5 4.5h10A2.5 2.5 0 0 1 17.5 7v11H7.5A2.5 2.5 0 0 1 5 15.5z" />
        <path d="M8 4.5v11A2.5 2.5 0 0 0 10.5 18" />
        <path d="M14 9h3" />
      </svg>
    ),
    bell: (
      <svg {...commonProps}>
        <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
    ),
    laptop: (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M2 19h20" />
      </svg>
    ),
    mobile: (
      <svg {...commonProps}>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 18h2" />
      </svg>
    )
  };

  return icons[name] || null;
};

export default AdminNavIcon;
