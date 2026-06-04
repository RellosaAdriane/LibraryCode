import React from 'react';

const UserRoleIcon = ({ role, affiliation }) => {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };
  const normalizedRole = String(role || '').toLowerCase();
  const normalizedAffiliation = String(affiliation || '').toLowerCase();

  if (normalizedRole === 'admin') {
    return (
      <svg {...commonProps}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }

  if (normalizedAffiliation === 'staff' || normalizedRole === 'staff') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5h8v2" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M22 10 12 3 2 10l10 6 10-6z" />
      <path d="M6 12v5c0 2.2 2.7 4 6 4s6-1.8 6-4v-5" />
    </svg>
  );
};

export default UserRoleIcon;
