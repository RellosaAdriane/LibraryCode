import { useCallback, useMemo, useState } from 'react';
import { api } from '../../api';

export function useAdminSettings({
  user,
  setMessage,
  setConfirmDialog,
  logAction,
  showUserToast,
  sessions,
  securityLogs,
  lowStockBooks
}) {
  const [signupSettings, setSignupSettings] = useState({
    email_verification_enabled: true
  });
  const [signupSettingsLoading, setSignupSettingsLoading] = useState(true);
  const [signupSettingsSaving, setSignupSettingsSaving] = useState(false);
  const [penaltySettings, setPenaltySettings] = useState({
    grace_days: 7,
    daily_fee: 150,
    block_overdue_days: 14
  });
  const [penaltySettingsLoading, setPenaltySettingsLoading] = useState(true);
  const [penaltySettingsSaving, setPenaltySettingsSaving] = useState(false);
  const [announcementSettings, setAnnouncementSettings] = useState({
    enabled: false,
    title: 'Library Notice',
    message: ''
  });
  const [announcementSettingsLoading, setAnnouncementSettingsLoading] = useState(true);
  const [announcementSettingsSaving, setAnnouncementSettingsSaving] = useState(false);
  const [ssoSettings, setSsoSettings] = useState({
    enabled: false,
    provider_name: 'SSO / LDAP',
    allowed_domains: [],
    admin_only: false
  });
  const [ssoSettingsForm, setSsoSettingsForm] = useState({
    provider_name: 'SSO / LDAP',
    allowed_domains: '',
    enabled: false,
    admin_only: false
  });
  const [ssoSettingsLoading, setSsoSettingsLoading] = useState(true);
  const [ssoSettingsSaving, setSsoSettingsSaving] = useState(false);
  const [admin2faSettings, setAdmin2faSettings] = useState({ enabled: false });
  const [admin2faLoading, setAdmin2faLoading] = useState(true);
  const [admin2faSaving, setAdmin2faSaving] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');

  const loadSignupSettings = useCallback(async () => {
    setSignupSettingsLoading(true);
    const result = await api.getSignupSettings();
    if (result.success && result.settings) {
      setSignupSettings({
        email_verification_enabled: Boolean(result.settings.email_verification_enabled)
      });
    } else {
      setMessage(result.message || 'Failed to load signup settings.');
    }
    setSignupSettingsLoading(false);
  }, [setMessage]);

  const loadPenaltySettings = useCallback(async () => {
    setPenaltySettingsLoading(true);
    const result = await api.getPenaltySettings();
    if (result.success && result.settings) {
      setPenaltySettings({
        grace_days: Number(result.settings.grace_days ?? 7),
        daily_fee: Number(result.settings.daily_fee ?? 150),
        block_overdue_days: Number(result.settings.block_overdue_days ?? 14)
      });
    } else {
      setMessage(result.message || 'Failed to load penalty settings.');
    }
    setPenaltySettingsLoading(false);
  }, [setMessage]);

  const loadAnnouncementSettings = useCallback(async () => {
    setAnnouncementSettingsLoading(true);
    const result = await api.getAnnouncementSettings();
    if (result.success && result.settings) {
      setAnnouncementSettings({
        enabled: Boolean(result.settings.enabled),
        title: result.settings.title || 'Library Notice',
        message: result.settings.message || ''
      });
    } else {
      setMessage(result.message || 'Failed to load announcement settings.');
    }
    setAnnouncementSettingsLoading(false);
  }, [setMessage]);

  const loadSsoSettings = useCallback(async () => {
    setSsoSettingsLoading(true);
    const result = await api.getSsoSettings();
    if (result.success && result.settings) {
      const nextSettings = {
        enabled: Boolean(result.settings.enabled),
        provider_name: result.settings.provider_name || 'SSO / LDAP',
        allowed_domains: Array.isArray(result.settings.allowed_domains) ? result.settings.allowed_domains : [],
        admin_only: Boolean(result.settings.admin_only)
      };
      setSsoSettings(nextSettings);
      setSsoSettingsForm({
        enabled: nextSettings.enabled,
        provider_name: nextSettings.provider_name,
        allowed_domains: nextSettings.allowed_domains.join(', '),
        admin_only: nextSettings.admin_only
      });
    } else {
      setMessage(result.message || 'Failed to load SSO settings.');
    }
    setSsoSettingsLoading(false);
  }, [setMessage]);

  const loadAdmin2faSettings = useCallback(async () => {
    setAdmin2faLoading(true);
    const result = await api.getAdmin2faSettings();
    if (result.success && result.settings) {
      setAdmin2faSettings({
        enabled: Boolean(result.settings.enabled)
      });
    } else {
      setMessage(result.message || 'Failed to load admin 2FA settings.');
    }
    setAdmin2faLoading(false);
  }, [setMessage]);

  const handleSsoSave = async () => {
    setSsoSettingsSaving(true);
    const allowedDomains = ssoSettingsForm.allowed_domains
      .split(',')
      .map((domain) => domain.trim())
      .filter(Boolean);

    const result = await api.updateSsoSettings({
      enabled: ssoSettingsForm.enabled,
      provider_name: ssoSettingsForm.provider_name,
      allowed_domains: allowedDomains,
      admin_only: ssoSettingsForm.admin_only
    });
    setSsoSettingsSaving(false);

    if (result.success && result.settings) {
      setSsoSettings(result.settings);
      setSsoSettingsForm({
        enabled: Boolean(result.settings.enabled),
        provider_name: result.settings.provider_name || 'SSO / LDAP',
        allowed_domains: (result.settings.allowed_domains || []).join(', '),
        admin_only: Boolean(result.settings.admin_only)
      });
      setMessage(result.message || 'SSO settings updated.');
      logAction('SSO Settings', result.settings.enabled ? 'Enabled' : 'Disabled');
    } else {
      setMessage(result.message || 'Failed to update SSO settings.');
    }
  };

  const handleSsoToggle = async () => {
    const nextEnabled = !ssoSettingsForm.enabled;
    setSsoSettingsForm((prev) => ({
      ...prev,
      enabled: nextEnabled
    }));
    setSsoSettingsSaving(true);

    const allowedDomains = ssoSettingsForm.allowed_domains
      .split(',')
      .map((domain) => domain.trim())
      .filter(Boolean);

    const result = await api.updateSsoSettings({
      enabled: nextEnabled,
      provider_name: ssoSettingsForm.provider_name,
      allowed_domains: allowedDomains,
      admin_only: ssoSettingsForm.admin_only
    });
    setSsoSettingsSaving(false);

    if (result.success && result.settings) {
      setSsoSettings(result.settings);
      setSsoSettingsForm({
        enabled: Boolean(result.settings.enabled),
        provider_name: result.settings.provider_name || 'SSO / LDAP',
        allowed_domains: (result.settings.allowed_domains || []).join(', '),
        admin_only: Boolean(result.settings.admin_only)
      });
      setMessage(result.message || 'SSO settings updated.');
      logAction('SSO Settings', result.settings.enabled ? 'Enabled' : 'Disabled');
    } else {
      setMessage(result.message || 'Failed to update SSO settings.');
    }
  };

  const handleAdmin2faToggle = async () => {
    const nextEnabled = !admin2faSettings.enabled;

    const runToggle = async () => {
      setAdmin2faSaving(true);
      const result = await api.updateAdmin2faSettings({ enabled: nextEnabled });
      setAdmin2faSaving(false);

      if (result.success && result.settings) {
        setAdmin2faSettings({ enabled: Boolean(result.settings.enabled) });
        showUserToast(result.settings.enabled ? 'Admin 2FA enabled.' : 'Admin 2FA disabled.');
        logAction('Admin 2FA', result.settings.enabled ? 'Enabled' : 'Disabled');
      } else {
        showUserToast(result.message || 'Failed to update admin 2FA.', true);
      }
    };

    if (!nextEnabled) {
      setConfirmDialog({
        title: 'Disable admin 2FA?',
        message: 'Admins will no longer need an email verification code at login. This reduces account security.',
        confirmLabel: 'Disable 2FA',
        onConfirm: async () => {
          setConfirmDialog(null);
          await runToggle();
        }
      });
      return;
    }

    await runToggle();
  };

  const handlePenaltySettingsSave = async () => {
    setPenaltySettingsSaving(true);
    const payload = {
      grace_days: Math.max(0, Number(penaltySettings.grace_days) || 0),
      daily_fee: Math.max(0, Number(penaltySettings.daily_fee) || 0),
      block_overdue_days: Math.max(0, Number(penaltySettings.block_overdue_days) || 0)
    };
    const result = await api.updatePenaltySettings(payload);
    setPenaltySettingsSaving(false);

    if (result.success && result.settings) {
      setPenaltySettings({
        grace_days: Number(result.settings.grace_days ?? payload.grace_days),
        daily_fee: Number(result.settings.daily_fee ?? payload.daily_fee),
        block_overdue_days: Number(result.settings.block_overdue_days ?? payload.block_overdue_days)
      });
      showUserToast('Borrowing rules saved successfully.');
      logAction('Penalty Settings', 'Updated');
    } else {
      showUserToast(result.message || 'Failed to update penalty settings.', true);
    }
  };

  const handleAnnouncementSettingsSave = async () => {
    setAnnouncementSettingsSaving(true);
    const result = await api.updateAnnouncementSettings({
      enabled: announcementSettings.enabled,
      title: announcementSettings.title,
      message: announcementSettings.message
    });
    setAnnouncementSettingsSaving(false);

    if (result.success && result.settings) {
      setAnnouncementSettings({
        enabled: Boolean(result.settings.enabled),
        title: result.settings.title || 'Library Notice',
        message: result.settings.message || ''
      });
      showUserToast('Announcement updated successfully.');
      logAction('Announcement Settings', result.settings.enabled ? 'Enabled' : 'Disabled');
    } else {
      showUserToast(result.message || 'Failed to update announcement settings.', true);
    }
  };

  const handleAnnouncementToggle = async () => {
    const nextEnabled = !announcementSettings.enabled;
    setAnnouncementSettings((prev) => ({
      ...prev,
      enabled: nextEnabled
    }));
    setAnnouncementSettingsSaving(true);

    const result = await api.updateAnnouncementSettings({
      enabled: nextEnabled,
      title: announcementSettings.title,
      message: announcementSettings.message
    });

    setAnnouncementSettingsSaving(false);
    setMessage(result.message || (result.success ? 'Announcement visibility updated.' : 'Failed to update announcement visibility.'));

    if (result.success && result.settings) {
      setAnnouncementSettings({
        enabled: Boolean(result.settings.enabled),
        title: result.settings.title || 'Library Notice',
        message: result.settings.message || ''
      });
      logAction('Announcement Visibility', result.settings.enabled ? 'Enabled' : 'Disabled');
    }
  };

  const handleSignupVerificationToggle = async () => {
    const nextEnabled = !signupSettings.email_verification_enabled;
    setSignupSettingsSaving(true);

    const result = await api.updateSignupSettings({
      email_verification_enabled: nextEnabled
    });

    setSignupSettingsSaving(false);
    setMessage(result.message || (result.success ? 'Signup settings updated.' : 'Failed to update signup settings.'));

    if (result.success && result.settings) {
      setSignupSettings({
        email_verification_enabled: Boolean(result.settings.email_verification_enabled)
      });
      logAction(
        'Signup Email Verification',
        result.settings.email_verification_enabled ? 'Enabled' : 'Disabled'
      );
    }
  };

  const settingsSummary = useMemo(() => {
    const activeSessions = sessions.filter((session) => !session.revoked_at);
    const failedLogins = securityLogs.filter((entry) => {
      const event = String(entry.event || '').toLowerCase();
      return event.includes('fail') || event.includes('denied');
    }).length;

    return {
      activeSessions: activeSessions.length,
      studentsOnline: activeSessions.filter((session) => session.role === 'student').length,
      overdueBooks: lowStockBooks.length,
      failedLogins
    };
  }, [sessions, securityLogs, lowStockBooks]);

  return {
    signupSettings,
    setSignupSettings,
    signupSettingsLoading,
    signupSettingsSaving,
    penaltySettings,
    setPenaltySettings,
    penaltySettingsLoading,
    penaltySettingsSaving,
    announcementSettings,
    setAnnouncementSettings,
    announcementSettingsLoading,
    announcementSettingsSaving,
    ssoSettings,
    setSsoSettings,
    ssoSettingsForm,
    setSsoSettingsForm,
    ssoSettingsLoading,
    ssoSettingsSaving,
    admin2faSettings,
    setAdmin2faSettings,
    admin2faLoading,
    admin2faSaving,
    settingsTab,
    setSettingsTab,
    loadSignupSettings,
    loadPenaltySettings,
    loadAnnouncementSettings,
    loadSsoSettings,
    loadAdmin2faSettings,
    handleSsoSave,
    handleSsoToggle,
    handleAdmin2faToggle,
    handlePenaltySettingsSave,
    handleAnnouncementSettingsSave,
    handleAnnouncementToggle,
    handleSignupVerificationToggle,
    settingsSummary
  };
}
