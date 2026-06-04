import React from 'react';
import AdminNavIcon from './AdminNavIcon';

const SectionTitle = ({ icon, children }) => (
  <h3 className="section-title section-title-with-icon">
    {icon ? (
      <span className="section-title-icon" aria-hidden="true">
        <AdminNavIcon name={icon} />
      </span>
    ) : null}
    <span>{children}</span>
  </h3>
);

export default SectionTitle;
