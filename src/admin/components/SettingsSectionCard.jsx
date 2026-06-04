import React from 'react';

const SettingsSectionCard = ({ icon, title, description, actions, children }) => (
  <section className="settings-section-card">
    <header className="settings-section-header">
      <div className="settings-section-title-wrap">
        <span className="settings-section-icon" aria-hidden="true">{icon}</span>
        <div>
          <h4>{title}</h4>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="settings-section-actions">{actions}</div> : null}
    </header>
    <div className="settings-section-body">{children}</div>
  </section>
);

export default SettingsSectionCard;
