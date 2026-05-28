import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import emailIcon from './Components/email.png';
import passIcon from './Components/password.png';
import './login.css';
import { api } from './api';
import { clearAuth, getStoredUser } from './auth';
import {
  formatLibraryDisplayDate,
  libraryDateYearsAgo,
  libraryTodayISO
} from './utils/libraryTime';

const allowedDomains = ['cvsu.edu.ph', 'gmail.com', 'yahoo.com'];
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const LEGAL_CONTENT = {
  privacy: {
    title: 'Privacy Notice',
    href: '/server/privacy.php',
    paragraphs: [
      'We respect your privacy. This site collects only the information necessary to provide library services, such as name, email, affiliation, and authentication tokens. We store minimal personal data and employ reasonable safeguards to protect it.',
      'We do not sell or rent personal data. Data may be used for account management, notifications, and security auditing. For requests related to data access, correction, or removal, contact the site administrator at contact@cvsu.dev.'
    ]
  },
  terms: {
    title: 'Terms of Use',
    href: '/server/terms.php',
    paragraphs: [
      'By using this service you agree to comply with applicable policies and laws. You are responsible for keeping your account credentials secure and for any activity that occurs under your account.',
      'Prohibited activities include unauthorized access, abuse of resources, and actions that violate the rights of others. The operators reserve the right to suspend or remove accounts that violate these terms.',
      'For questions about these terms, contact contact@cvsu.dev.'
    ]
  }
};

const maskEmail = (email) => {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] || '*'}*@${domain}`;
  return `${name[0]}${'*'.repeat(Math.max(1, name.length - 2))}${name[name.length - 1]}@${domain}`;
};

const getPasswordStrength = (value) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 2) return { score, label: 'Weak', className: 'weak' };
  if (score <= 4) return { score, label: 'Medium', className: 'medium' };
  return { score, label: 'Strong', className: 'strong' };
};

const isValidRealName = (value) => {
  const trimmed = String(value || '').trim();
  if (!/^[A-Za-z][A-Za-z\s'-]*$/.test(trimmed)) return false;
  const letterCount = (trimmed.match(/[A-Za-z]/g) || []).length;
  return letterCount >= 3;
};

const isValidBirthday = (value) => {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date('1900-01-01T00:00:00');
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setFullYear(cutoff.getFullYear() - 16); // must be at least 16 years old
  return date <= cutoff && date >= minDate;
};

const decodeGoogleCredential = (credential) => {
  try {
    const parts = String(credential || '').split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const decoded = atob(paddedPayload);
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
};

const LoginNavIcon = ({ children }) => (
  <svg
    className="login-sidebar-icon-svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const loginNavIcons = {
  home: (
    <LoginNavIcon>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </LoginNavIcon>
  ),
  books: (
    <LoginNavIcon>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M4 5.5A2.5 2.5 0 0 0 6.5 8H20" />
    </LoginNavIcon>
  )
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [action, setAction] = useState('Login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState('home');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [loginStep, setLoginStep] = useState('password');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginChallengeId, setLoginChallengeId] = useState('');
  const [loginOtpCountdown, setLoginOtpCountdown] = useState(0);
  const [ssoSettings, setSsoSettings] = useState({
    enabled: false,
    provider_name: 'SSO / LDAP',
    allowed_domains: [],
    admin_only: false
  });
  const [ssoLoading, setSsoLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(GOOGLE_CLIENT_ID);
  const [googleCredential, setGoogleCredential] = useState('');
  const [needsGoogleLink, setNeedsGoogleLink] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkOtp, setLinkOtp] = useState('');
  const [linkOtpCountdown, setLinkOtpCountdown] = useState(0);
  const [legalModal, setLegalModal] = useState(null);
  const googleButtonRef = useRef(null);
  const otpInputRef = useRef(null);
  const legalCloseButtonRef = useRef(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [affiliation, setAffiliation] = useState('student');
  const [institutionId, setInstitutionId] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [signupStep, setSignupStep] = useState(1);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [signupVerificationEnabled, setSignupVerificationEnabled] = useState(true);
  const [signupErrors, setSignupErrors] = useState([]);

  useEffect(() => {
    let mounted = true;
    const loadSignupSettings = async () => {
      const result = await api.getSignupSettings();
      if (mounted && result.success && result.settings) {
        setSignupVerificationEnabled(Boolean(result.settings.email_verification_enabled));
      }
    };
    loadSignupSettings();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (retryAfterSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setRetryAfterSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (otpCountdown <= 0) return undefined;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  useEffect(() => {
    if (loginOtpCountdown <= 0) return undefined;
    const timer = setInterval(() => {
      setLoginOtpCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [loginOtpCountdown]);

  useEffect(() => {
    let mounted = true;
    const loadSsoSettings = async () => {
      const result = await api.getSsoSettings();
      if (mounted && result.success && result.settings) {
        setSsoSettings(result.settings);
      }
      if (mounted) {
        setSsoLoading(false);
      }
    };
    loadSsoSettings();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadGoogleConfig = async () => {
      const result = await api.getGoogleConfig();
      if (!mounted) return;

      const configuredClientId = String(result?.client_id || '').trim();
      if (configuredClientId) {
        setGoogleClientId(configuredClientId);
      }
    };

    loadGoogleConfig();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!googleClientId) {
      setGoogleReady(false);
      return undefined;
    }

    let cancelled = false;
    const scriptId = 'google-identity-services';

    const renderGoogleButton = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (cancelled) return;
          if (!response?.credential) {
            setMessage('Google sign-in did not return a credential.');
            return;
          }

          setGoogleLoading(true);
          setMessage('');

          if (action === 'Sign up') {
            const profile = decodeGoogleCredential(response.credential);
            setGoogleLoading(false);

            if (!profile) {
              setMessage('Could not read your Google profile. Please try again.');
              return;
            }

            setGoogleCredential(response.credential);
            setFirstName(profile.given_name || profile.name?.split(' ')?.[0] || '');
            setLastName(profile.family_name || profile.name?.split(' ')?.slice(1).join(' ') || '');
            setEmail(profile.email || '');
            setSignupStep(1);
            setMessage('Google account loaded. Please complete your profile below.');
            setAction('Sign up');
            return;
          }

          // Decode credential locally so we can prefill fields even if server omits profile
          const decodedProfile = decodeGoogleCredential(response.credential);
          const result = await api.googleAuth(response.credential, 'login');
          setGoogleLoading(false);

            if (!result.success) {
            if (result.needs_signup && (result.profile || decodedProfile)) {
              // Prefill signup form with provided profile and switch to signup
              setGoogleCredential(response.credential);
              setFirstName((result.profile && result.profile.first_name) || decodedProfile?.given_name || '');
              setLastName((result.profile && result.profile.last_name) || decodedProfile?.family_name || '');
              setEmail((result.profile && result.profile.email) || decodedProfile?.email || '');
              setSignupStep(1);
              setAction('Sign up');
              setMessage('Please complete your profile to finish signup.');
              return;
            }

            if (result.needs_link_otp && (result.profile || decodedProfile)) {
              // Open OTP modal for linking
              setGoogleCredential(response.credential);
              setFirstName((result.profile && result.profile.first_name) || decodedProfile?.given_name || '');
              setLastName((result.profile && result.profile.last_name) || decodedProfile?.family_name || '');
              setEmail((result.profile && result.profile.email) || decodedProfile?.email || '');
              setShowLinkModal(true);
              setMessage(result.message || 'An OTP was sent to your email to link this account.');
              setLinkOtp('');
              setLinkOtpCountdown(60);
              const timer = setInterval(() => setLinkOtpCountdown((s) => (s <= 1 ? 0 : s - 1)), 1000);
              setTimeout(() => clearInterval(timer), 61000);
              return;
            }

            // Fallback: older server responses may use `needs_link` to indicate linking is required.
            if (result.needs_link && result.profile) {
              setGoogleCredential(response.credential);
              setFirstName(result.profile.first_name || '');
              setLastName(result.profile.last_name || '');
              setEmail(result.profile.email || '');
              // Open modal and request OTP from server
              setShowLinkModal(true);
              setMessage('Requesting OTP to link your account...');
              setLinkOtp('');
              setLinkOtpCountdown(60);
              const timer = setInterval(() => setLinkOtpCountdown((s) => (s <= 1 ? 0 : s - 1)), 1000);
              api.googleAuth(response.credential, 'login').then((r) => {
                if (r && r.success) {
                  setMessage(r.message || 'OTP sent to your email.');
                } else {
                  setMessage(r.message || 'OTP send failed.');
                }
              }).catch(() => setMessage('Unable to request OTP.'))
                .finally(() => setTimeout(() => clearInterval(timer), 61000));
              return;
            }

            setMessage(result.message || 'Google sign-in failed.');
            return;
          }

          const user = result.user && typeof result.user === 'object' ? result.user : null;
          if (!user) {
            setMessage('Google auth response is missing user data. Please try again.');
            return;
          }

          const storedUser = persistLogin(user);
          if (!storedUser) return;

          if (action === 'Sign up') {
            resetSignup();
            setAction('Login');
          }

          const role = storedUser.role || 'student';
          const targetPath = role === 'admin' ? '/admin-dashboard' : '/student-dashboard';
          navigate(targetPath, { replace: true });
        },
      });

      const buttonWidth = Math.max(280, Math.min(420, Math.floor(googleButtonRef.current.getBoundingClientRect().width) || 320));
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: action === 'Sign up' ? 'signup_with' : 'signin_with',
        shape: 'pill',
        width: buttonWidth,
      });
      setGoogleReady(true);
    };

    const loadScript = () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        if (window.google?.accounts?.id) {
          renderGoogleButton();
        } else {
          existingScript.addEventListener('load', renderGoogleButton, { once: true });
        }
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleButton;
      script.onerror = () => {
        if (!cancelled) {
          setGoogleReady(false);
        }
      };
      document.head.appendChild(script);
    };

    loadScript();

    return () => {
      cancelled = true;
    };
  }, [action, googleClientId]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (action !== 'Login') {
      resetLogin2fa();
    }
  }, [action]);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const maskedSignupEmail = useMemo(() => maskEmail(email), [email]);
  const todayISO = useMemo(() => libraryTodayISO(), []);
  const legalUpdatedDate = useMemo(
    () => formatLibraryDisplayDate(new Date(), { month: 'long', day: 'numeric', year: 'numeric' }),
    []
  );
  const minBirthdayISO = useMemo(() => '1900-01-01', []);
  const maxBirthdayISO = useMemo(() => libraryDateYearsAgo(16), []);

  const resetSignup = () => {
    setFirstName('');
    setLastName('');
    setBirthday('');
    setGender('');
    setAffiliation('student');
    setInstitutionId('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setGoogleCredential('');
    setSignupStep(1);
    setOtpCountdown(0);
    setPolicyAccepted(false);
    setSignupErrors([]);
  };

  const validateEmail = (value) => {
    const parts = String(value).trim().split('@');
    if (parts.length !== 2) return false;
    return allowedDomains.includes(parts[1].toLowerCase());
  };

  const validateSignupStep = (step) => {
    const errors = [];

    if (step === 1) {
      if (!isValidRealName(firstName)) {
        errors.push('First name is not acceptable. Please input a real name (minimum 3 letters, no numbers).');
      }
      if (!isValidRealName(lastName)) {
        errors.push('Last name is not acceptable. Please input a real name (minimum 3 letters, no numbers).');
      }
      if (!birthday) {
        errors.push('Birthday is required.');
      } else if (!isValidBirthday(birthday)) {
        errors.push('Birthday is not valid. You must be at least 16 years old and not a future date.');
      }
      if (!gender) errors.push('Please select a gender.');
      if (!affiliation) errors.push('Please choose affiliation.');
      if (!institutionId.trim()) {
        errors.push('Institution ID is required.');
      } else if (!/^[A-Za-z0-9-]{6,20}$/.test(institutionId.trim())) {
        errors.push('Institution ID must be 6-20 letters/numbers.');
      }
    }

    if (step === 2) {
      if (!validateEmail(email)) errors.push('Use cvsu.edu.ph, gmail.com, or yahoo.com email.');
      if (password.length < 8 || password.length > 16 || /\s/.test(password)) {
        errors.push('Password must be 8 to 16 characters without spaces.');
      }
      if (passwordStrength.className === 'weak') {
        errors.push('Use a medium or strong password.');
      }
      if (confirmPassword !== password) errors.push('Confirm password must match password.');
      if (!policyAccepted) errors.push('You must accept the Privacy Notice and Terms.');
    }

    if (step === 3) {
      if (!/^\d{6}$/.test(otp)) errors.push('Enter a valid 6-digit OTP.');
    }

    setSignupErrors(errors);
    return errors.length === 0;
  };

  const resetLogin2fa = () => {
    setLoginStep('password');
    setLoginOtp('');
    setLoginChallengeId('');
    setLoginOtpCountdown(0);
  };

  const persistLogin = (nextUser) => {
    clearAuth();
    sessionStorage.setItem('user', JSON.stringify(nextUser));
    localStorage.setItem('user', JSON.stringify(nextUser));

    const storedUser = getStoredUser();
    if (!storedUser) {
      setMessage('Unable to save login session. Please try again.');
      return null;
    }

    return storedUser;
  };

  const handleLogin = async () => {
    if (showLinkModal) {
      await handleVerifyLinkOtp();
      return;
    }

    if (loginStep === '2fa') {
      if (!/^\d{6}$/.test(loginOtp)) {
        setMessage('Enter a valid 6-digit admin code.');
        return;
      }

      setLoading(true);
      setMessage('');
      const result = await api.login(email, password, {
        otp: loginOtp,
        challenge_id: loginChallengeId,
      });
      setLoading(false);

      if (result.success) {
        const user = result.user && typeof result.user === 'object' ? result.user : null;
        if (!user) {
          setMessage('Login response is missing user data. Please try again.');
          return;
        }

        const storedUser = persistLogin(user);
        if (!storedUser) return;

        resetLogin2fa();
        const role = storedUser.role || 'student';
        const targetPath = role === 'admin' ? '/admin-dashboard' : '/student-dashboard';
        navigate(targetPath, { replace: true });
        setTimeout(() => {
          if (window.location.pathname === '/login') {
            window.location.assign(targetPath);
          }
        }, 120);
        return;
      }

      if (result.requires_2fa) {
        setMessage(result.message || 'Admin verification required.');
        return;
      }

      setMessage(result.message || 'Unable to verify admin login.');
      return;
    }

    if (retryAfterSeconds > 0) {
      setMessage(`Too many attempts. Try again in ${retryAfterSeconds}s.`);
      return;
    }

    if (!email || !password) {
      setMessage('Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      setMessage('Use cvsu.edu.ph, gmail.com, or yahoo.com email.');
      return;
    }

    setLoading(true);
    setMessage('');

    const result = await api.login(email, password);
    setLoading(false);

    if (result.success) {
      if (result.requires_2fa) {
        setLoginStep('2fa');
        setLoginChallengeId(result.challenge_id || '');
        setLoginOtp('');
        setLoginOtpCountdown(300);
        setMessage(result.message || 'Admin verification required.');
        return;
      }

      const user = result.user && typeof result.user === 'object' ? result.user : null;
      if (!user) {
        setMessage('Login response is missing user data. Please try again.');
        return;
      }

      const storedUser = persistLogin(user);
      if (!storedUser) return;

      const role = storedUser.role || 'student';
      const targetPath = role === 'admin' ? '/admin-dashboard' : '/student-dashboard';
      navigate(targetPath, { replace: true });
      setTimeout(() => {
        if (window.location.pathname === '/login') {
          window.location.assign(targetPath);
        }
      }, 120);
    } else {
      if (result.retry_after_seconds) {
        setRetryAfterSeconds(Number(result.retry_after_seconds) || 0);
      }
      setMessage(result.message || 'Authentication service is currently unavailable. Please try again.');
    }
  };

  const handleResendAdminOtp = async () => {
    if (!email || !password) {
      setMessage('Enter your email and password to resend the admin code.');
      return;
    }

    setLoading(true);
    setMessage('');
    const result = await api.login(email, password);
    setLoading(false);

    if (result.requires_2fa) {
      setLoginStep('2fa');
      setLoginChallengeId(result.challenge_id || '');
      setLoginOtp('');
      setLoginOtpCountdown(300);
      setMessage(result.message || 'Admin verification required.');
      return;
    }

    if (result.success && result.user) {
      const storedUser = persistLogin(result.user);
      if (!storedUser) return;
      resetLogin2fa();
      const role = storedUser.role || 'student';
      const targetPath = role === 'admin' ? '/admin-dashboard' : '/student-dashboard';
      navigate(targetPath, { replace: true });
      return;
    }

    setMessage(result.message || 'Unable to resend admin code.');
  };

  const handleSsoLogin = async () => {
    if (!email) {
      setMessage('Enter your email to continue with SSO.');
      return;
    }

    const domain = String(email).trim().split('@')[1] || '';
    const allowedSsoDomains = Array.isArray(ssoSettings.allowed_domains)
      ? ssoSettings.allowed_domains
      : [];
    if (allowedSsoDomains.length > 0 && !allowedSsoDomains.includes(domain.toLowerCase())) {
      setMessage('Use an allowed email domain for SSO.');
      return;
    }

    setLoading(true);
    setMessage('');
    const result = await api.ssoLogin(email.trim());
    setLoading(false);

    if (result.success) {
      const user = result.user && typeof result.user === 'object' ? result.user : null;
      if (!user) {
        setMessage('SSO response is missing user data. Please try again.');
        return;
      }

      const storedUser = persistLogin(user);
      if (!storedUser) return;

      const role = storedUser.role || 'student';
      const targetPath = role === 'admin' ? '/admin-dashboard' : '/student-dashboard';
      navigate(targetPath, { replace: true });
      return;
    }

    setMessage(result.message || 'SSO login failed.');
  };

  const requestSignupOtp = async () => {
    if (!validateSignupStep(2)) return;

    const userData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      password,
      birthday: birthday || null,
      gender: gender || null,
      affiliation,
      institution_id: institutionId.trim(),
      google_credential: googleCredential || undefined
    };

    setLoading(true);
    setMessage('');
    const result = await api.requestSignupOtp(userData);
    setLoading(false);

    if (result.success && result.otp_required) {
      setSignupStep(3);
      setOtpCountdown(60);
      setOtp('');
      setSignupErrors([]);
      setMessage(result.message || 'OTP sent to your email.');
      return;
    }

    if (result.success && !result.otp_required) {
      setMessage('Registration successful! Please login.');
      setAction('Login');
      resetSignup();
      return;
    }

    setMessage(result.message || 'Unable to send OTP right now.');
  };

  const handleLinkAccount = async () => {
    if (!linkPassword) {
      setMessage('Enter your account password to link Google.');
      return;
    }

    setLoading(true);
    setMessage('');
    const result = await api.googleAuth(googleCredential, 'login', { link_password: linkPassword });
    setLoading(false);

    if (!result.success) {
      setMessage(result.message || 'Unable to link account.');
      return;
    }

    const user = result.user && typeof result.user === 'object' ? result.user : null;
    if (!user) {
      setMessage('Link response missing user data.');
      return;
    }

    const stored = persistLogin(user);
    if (!stored) return;

    setNeedsGoogleLink(false);
    setLinkPassword('');
    const role = stored.role || 'student';
    const targetPath = role === 'admin' ? '/admin-dashboard' : '/student-dashboard';
    navigate(targetPath, { replace: true });
  };

  const handleVerifyLinkOtp = async () => {
    if (!linkOtp) {
      setMessage('Enter the OTP sent to your email.');
      return;
    }

    setLoading(true);
    setMessage('');
    const result = await api.googleAuth(googleCredential, 'login', { link_otp: linkOtp });
    setLoading(false);

    if (!result.success) {
      setMessage(result.message || 'Unable to verify OTP.');
      return;
    }

    const user = result.user && typeof result.user === 'object' ? result.user : null;
    if (!user) {
      setMessage('Link response missing user data.');
      return;
    }

    const stored = persistLogin(user);
    if (!stored) return;

    setShowLinkModal(false);
    setLinkOtp('');
    const role = stored.role || 'student';
    const targetPath = role === 'admin' ? '/admin-dashboard' : '/student-dashboard';
    navigate(targetPath, { replace: true });
  };

  const handleResendLinkOtp = async () => {
    if (!googleCredential) return;
    setLoading(true);
    setMessage('');
    const result = await api.googleAuth(googleCredential, 'login');
    setLoading(false);
    if (!result.success) {
      setMessage(result.message || 'Unable to resend OTP.');
      return;
    }
    setMessage(result.message || 'OTP resent to your email.');
    setLinkOtpCountdown(60);
    const timer = setInterval(() => setLinkOtpCountdown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    setTimeout(() => clearInterval(timer), 61000);
  };

  const verifySignupOtpAndCreate = async () => {
    if (!validateSignupStep(3)) return;

    const userData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      password,
      birthday: birthday || null,
      gender: gender || null,
      affiliation,
      institution_id: institutionId.trim(),
      google_credential: googleCredential || undefined
    };

    setLoading(true);
    setMessage('');
    const result = await api.verifySignupOtp(userData, otp);
    setLoading(false);

    if (result.success) {
      setMessage('Registration successful! Please login.');
      setAction('Login');
      resetSignup();
    } else {
      setMessage(result.message || 'OTP verification failed.');
    }
  };

  const handleSignupPrimary = async () => {
    if (signupStep === 1) {
      if (!validateSignupStep(1)) return;
      setSignupStep(2);
      setSignupErrors([]);
      return;
    }

    if (signupStep === 2) {
      if (!signupVerificationEnabled) {
        if (!validateSignupStep(2)) return;
        const userData = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          password,
          birthday: birthday || null,
          gender: gender || null,
          affiliation,
          institution_id: institutionId.trim(),
          google_credential: googleCredential || undefined
        };
        setLoading(true);
        setMessage('');
        const result = await api.register(userData);
        setLoading(false);
        if (result.success) {
          setMessage('Registration successful! Please login.');
          setAction('Login');
          resetSignup();
        } else {
          setMessage(result.message || 'Registration failed.');
        }
        return;
      }
      await requestSignupOtp();
      return;
    }

    await verifySignupOtpAndCreate();
  };

  const signupPrimaryText = () => {
    if (loading) return 'Processing...';
    if (signupStep === 1) return 'Continue';
    if (signupStep === 2) return signupVerificationEnabled ? 'Send OTP' : 'Create Account';
    return 'Verify OTP & Sign up';
  };

  useEffect(() => {
    if (location.pathname.includes('/books')) {
      setActiveMenuItem('books');
      return;
    }
    if (location.pathname.startsWith('/student-dashboard')) {
      setActiveMenuItem('home');
    }
  }, [location.pathname]);

  const handleSidebarSelect = (item) => {
    setActiveMenuItem(item);
    setSidebarOpen(false);

    if (item === 'home') {
      navigate('/student-dashboard');
      return;
    }

    if (item === 'books') {
      navigate('/student-dashboard/books');
    }
  };

  const openLegalModal = (event, type) => {
    event.preventDefault();
    setLegalModal(type);
  };

  const closeLegalModal = () => {
    setLegalModal(null);
  };

  useEffect(() => {
    // When a modal opens, focus the first useful control and prevent background scroll.
    const modalOpen = showLinkModal || Boolean(legalModal);
    if (modalOpen) {
      try { document.body.style.overflow = 'hidden'; } catch (e) {}
    } else {
      try { document.body.style.overflow = ''; } catch (e) {}
    }

    if (showLinkModal) {
      setTimeout(() => {
        try {
          if (otpInputRef.current && typeof otpInputRef.current.focus === 'function') otpInputRef.current.focus();
        } catch (e) {}
      }, 80);
    }

    if (legalModal) {
      setTimeout(() => {
        try {
          if (legalCloseButtonRef.current && typeof legalCloseButtonRef.current.focus === 'function') legalCloseButtonRef.current.focus();
        } catch (e) {}
      }, 80);
    }
    return () => { try { document.body.style.overflow = ''; } catch (e) {} };
  }, [showLinkModal, legalModal]);

  useEffect(() => {
    if (!legalModal) return undefined;

    const handleLegalEscape = (event) => {
      if (event.key === 'Escape') {
        closeLegalModal();
      }
    };

    window.addEventListener('keydown', handleLegalEscape);
    return () => window.removeEventListener('keydown', handleLegalEscape);
  }, [legalModal]);

  const activeLegalContent = legalModal ? LEGAL_CONTENT[legalModal] : null;

  return (
    <div className="login-shell">
      {!sidebarOpen && (
        <button
          type="button"
          className="login-menu-btn"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
      )}

      <aside className={`login-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Library navigation">
        <div className="login-sidebar-header">
          <div className="login-sidebar-brand">
            <span className="login-sidebar-mark" aria-hidden="true">CV</span>
            <div>
              <strong>CVSU Library</strong>
              <small>Student portal</small>
            </div>
          </div>
          <button
            type="button"
            className="login-sidebar-close"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>
        <nav className="login-sidebar-nav">
          <button
            type="button"
            className={`login-sidebar-item ${activeMenuItem === 'home' ? 'active' : ''}`}
            onClick={() => handleSidebarSelect('home')}
          >
            <span className="login-sidebar-icon">{loginNavIcons.home}</span>
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`login-sidebar-item ${activeMenuItem === 'books' ? 'active' : ''}`}
            onClick={() => handleSidebarSelect('books')}
          >
            <span className="login-sidebar-icon">{loginNavIcons.books}</span>
            <span>Catalog</span>
          </button>
        </nav>
        <p className="login-sidebar-foot-note">Sign in on the right to borrow books and manage your account.</p>
      </aside>
      {sidebarOpen && (
        <button type="button" aria-label="Close menu" className="login-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="login-layout">
      <section className="login-visual-pane" aria-hidden="true">
        <div className="login-visual-content">
          <div className="login-visual-eyebrow">Library</div>
          <h1>Explore the books you need.</h1>
          <p>Borrow, track, and manage your library activity in one portal.</p>
        </div>
      </section>

      <section className="login-form-pane">
      <div className="container login-pro">
      <div className="login-brand">Library Portal</div>
      <div className="header">
        <div className="text">{action}</div>
        <div className="underline"></div>
      </div>

      {action === 'Sign up' && (
        <div className="signup-stepper" aria-label="Signup progress">
          <div className={`signup-step ${signupStep >= 1 ? 'active' : ''}`}>1. Profile</div>
          <div className={`signup-step ${signupStep >= 2 ? 'active' : ''}`}>2. Account</div>
          {signupVerificationEnabled && (
            <div className={`signup-step ${signupStep >= 3 ? 'active' : ''}`}>3. Verify</div>
          )}
        </div>
      )}

      {message && (
        <div className={`status-box ${message.toLowerCase().includes('successful') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {action === 'Sign up' && signupErrors.length > 0 && (
        <div className="status-box error" role="alert" aria-live="assertive">
          {signupErrors.map((err) => <div key={err}>{err}</div>)}
        </div>
      )}

      <div className="inputs">
        {action === 'Login' ? (
          <>
            {showLinkModal && (
              <div className="google-link-inline-status">
                <span className="google-link-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <path d="M9.2 16.2 4.8 11.8l-1.4 1.4 5.8 5.8L20.6 7.6l-1.4-1.4z" />
                  </svg>
                </span>
                <span className="google-link-inline-label">Signed in as:</span>
                <span className="google-link-inline-email">{email || 'your Google account'}</span>
              </div>
            )}

            {showLinkModal ? (
              <>
                <div className="input google-link-input google-link-field-active" style={{ flexDirection: 'column', position: 'relative' }}>
                  <label htmlFor="google-otp" className="login-field-label">Verification Code (OTP)</label>
                  <div className="google-link-code-row">
                    <img className="google-link-code-icon" src={passIcon} alt="verification icon" />
                    <input
                      id="google-otp"
                      className="google-link-code-input"
                      ref={otpInputRef}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoComplete="one-time-code"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={linkOtp}
                      onChange={(e) => setLinkOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      aria-label="Verification code"
                    />
                  </div>
                  <small className="helper-text">We sent a 6-digit verification code to your email.</small>
                  <button type="button" className="google-link-resend-link google-link-resend-inline" onClick={handleResendLinkOtp} disabled={loading || linkOtpCountdown > 0}>
                    Didn’t receive the code? Resend Code
                  </button>
                </div>
              </>
            ) : (
              <>
            <div className="input" style={{ flexDirection: 'column', position: 'relative' }}>
              <label htmlFor="login-email" className="login-field-label">Email Address</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <img src={emailIcon} alt="email icon" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', zIndex: 1 }} />
                <input
                  id="login-email"
                  type="email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || loginStep === '2fa'}
                  style={{ paddingLeft: '40px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div className="input" style={{ flexDirection: 'column', position: 'relative' }}>
              <label htmlFor="login-password" className="login-field-label">Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <img src={passIcon} alt="password icon" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', zIndex: 1 }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={16}
                  disabled={loading || loginStep === '2fa'}
                  style={{ paddingLeft: '40px', paddingRight: '45px', width: '100%', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    marginRight: '-4px',
                    zIndex: 1
                  }}
                >
                  <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                </button>
              </div>
            </div>

            <div className="login-meta-row">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading || loginStep === '2fa'}
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            {loginStep === '2fa' && (
              <div className="login-2fa-panel">
                <div className="login-2fa-title">Admin verification</div>
                <div className="login-2fa-subtitle">Enter the 6-digit code sent to your email.</div>
                <div className="input" style={{ flexDirection: 'column', position: 'relative' }}>
                  <label className="login-field-label" htmlFor="login-otp">Admin OTP</label>
                  <input
                    id="login-otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={loginOtp}
                    onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    style={{ width: '100%', boxSizing: 'border-box', letterSpacing: '4px' }}
                  />
                  <small className="helper-text">Code expires in 5 minutes.</small>
                </div>
                <div className="login-otp-actions">
                  <button
                    type="button"
                    className="login-secondary-btn"
                    onClick={handleResendAdminOtp}
                    disabled={loading || loginOtpCountdown > 0}
                  >
                    {loginOtpCountdown > 0 ? `Resend in ${loginOtpCountdown}s` : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    className="login-secondary-btn"
                    onClick={() => {
                      if (loading) return;
                      resetLogin2fa();
                      setMessage('');
                    }}
                    disabled={loading}
                  >
                    Back to login
                  </button>
                </div>
              </div>
            )}
          </>
            )}
          </>
        ) : (
          <>
            {signupStep === 1 && (
              <>
                <div className="input" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <label className="login-field-label" htmlFor="signup-first-name">First Name</label>
                  <input id="signup-first-name" type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  <small className="helper-text">Minimum 3 letters, no numbers.</small>
                </div>
                <div className="input" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <label className="login-field-label" htmlFor="signup-last-name">Last Name</label>
                  <input id="signup-last-name" type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  <small className="helper-text">Minimum 3 letters, no numbers.</small>
                </div>
                <div className="input" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <label className="login-field-label" htmlFor="signup-birthday">Birthday</label>
                  <input id="signup-birthday" type="date" value={birthday} min={minBirthdayISO} max={maxBirthdayISO} onChange={(e) => setBirthday(e.target.value)} />
                  <small className="helper-text">Use your real birth date — you must be at least 16 years old to register.</small>
                </div>

                <fieldset className="segmented-group">
                  <legend>Gender</legend>
                  <label><input type="radio" name="gender" value="male" checked={gender === 'male'} onChange={(e) => setGender(e.target.value)} />Male</label>
                  <label><input type="radio" name="gender" value="female" checked={gender === 'female'} onChange={(e) => setGender(e.target.value)} />Female</label>
                </fieldset>

                <fieldset className="segmented-group">
                  <legend>Affiliation</legend>
                  <label><input type="radio" name="affiliation" value="student" checked={affiliation === 'student'} onChange={(e) => setAffiliation(e.target.value)} />Student</label>
                  <label><input type="radio" name="affiliation" value="staff" checked={affiliation === 'staff'} onChange={(e) => setAffiliation(e.target.value)} />Staff</label>
                </fieldset>

                <div className="input" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <label className="login-field-label" htmlFor="signup-id">Institution ID</label>
                  <input id="signup-id" type="text" placeholder="e.g. 2024-12345" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} maxLength={20} />
                  <small className="helper-text">Used for institutional verification.</small>
                </div>
              </>
            )}

            {signupStep === 2 && (
              <>
                <div className="input" style={{ flexDirection: 'column', position: 'relative' }}>
                  <label className="login-field-label" htmlFor="signup-email">Email Address</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <img src={emailIcon} alt="email icon" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', zIndex: 1 }} />
                    <input
                      id="signup-email"
                      type="email"
                      placeholder="name@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      readOnly={Boolean(googleCredential)}
                      style={{
                        paddingLeft: '40px',
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: googleCredential ? '#f3f3f3' : undefined,
                        color: googleCredential ? '#333' : undefined
                      }}
                    />
                  </div>
                  <small className="helper-text">Accepted: cvsu.edu.ph, gmail.com, yahoo.com</small>
                  {googleCredential && (
                    <small className="helper-text" style={{ display: 'block', marginTop: '6px' }}>Email provided by Google — cannot be changed here.</small>
                  )}
                </div>

                <div className="input" style={{ flexDirection: 'column', position: 'relative' }}>
                  <label className="login-field-label" htmlFor="signup-password">Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <img src={passIcon} alt="password icon" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', zIndex: 1 }} />
                    <input id="signup-password" type={showPassword ? 'text' : 'password'} placeholder="Create password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={16} style={{ paddingLeft: '40px', paddingRight: '45px', width: '100%', boxSizing: 'border-box' }} />
                    <button type="button" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', marginRight: '-4px', zIndex: 1 }}>
                      <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                    </button>
                  </div>

                  <div className="password-strength-row">
                    <div className={`strength-pill ${passwordStrength.className}`}>{passwordStrength.label}</div>
                    <small className="helper-text">Use 8-16 chars, upper/lowercase, number, special char.</small>
                  </div>
                  <ul className="password-checklist">
                    <li className={password.length >= 8 ? 'ok' : ''}>At least 8 characters</li>
                    <li className={/[A-Z]/.test(password) ? 'ok' : ''}>Uppercase letter</li>
                    <li className={/[a-z]/.test(password) ? 'ok' : ''}>Lowercase letter</li>
                    <li className={/\d/.test(password) ? 'ok' : ''}>Number</li>
                    <li className={/[^A-Za-z0-9]/.test(password) ? 'ok' : ''}>Special character</li>
                  </ul>
                </div>

                <div className="input" style={{ flexDirection: 'column', position: 'relative' }}>
                  <label className="login-field-label" htmlFor="signup-confirm">Confirm Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <img src={passIcon} alt="confirm password icon" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', zIndex: 1 }} />
                    <input id="signup-confirm" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} maxLength={16} style={{ paddingLeft: '40px', paddingRight: '45px', width: '100%', boxSizing: 'border-box' }} />
                    <button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', marginRight: '-4px', zIndex: 1 }}>
                      <i className={showConfirmPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                    </button>
                  </div>
                </div>

                <label className="policy-check">
                  <input type="checkbox" checked={policyAccepted} onChange={(e) => setPolicyAccepted(e.target.checked)} />
                  <span>By signing up, you agree to our Privacy Notice and Terms.</span>
                </label>
              </>
            )}

            {signupStep === 3 && signupVerificationEnabled && (
              <>
                <div className="locked-summary">
                  <div><strong>Name:</strong> {firstName} {lastName}</div>
                  <div><strong>Email:</strong> {maskedSignupEmail}</div>
                  <div><strong>Affiliation:</strong> {affiliation}</div>
                </div>

                <div className="input" style={{ flexDirection: 'column', position: 'relative' }}>
                  <label className="login-field-label" htmlFor="signup-otp">One-Time Password (OTP)</label>
                  <input id="signup-otp" type="text" placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} style={{ width: '100%', boxSizing: 'border-box', letterSpacing: '3px' }} />
                  <small className="helper-text">Code expires in 5 minutes.</small>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {action === 'Login' && (
        <div className="forgetpass">
          <span role="button" tabIndex={0} onClick={() => !loading && navigate('/forgot-password')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !loading && navigate('/forgot-password')}>
            Forgot password?
          </span>
          {' | '}
          <span
            role="button"
            tabIndex={0}
            onClick={() => {
              if (loading) return;
              setAction('Sign up');
              setMessage('');
              resetSignup();
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !loading) {
                setAction('Sign up');
                setMessage('');
                resetSignup();
              }
            }}
          >
            Create account
          </span>
        </div>
      )}

      <div className={`submit-container ${showLinkModal ? 'google-link-submit' : ''}`}>
        <button
          className={`submit ${showLinkModal ? 'google-link-submit-btn' : ''}`}
          type="button"
          disabled={loading || (action === 'Login' && retryAfterSeconds > 0) || (showLinkModal && !/^\d{6}$/.test(linkOtp))}
          onClick={() => {
            if (action === 'Login') {
              handleLogin();
            } else {
              handleSignupPrimary();
            }
          }}
        >
          {action === 'Login'
            ? loading
              ? 'Logging in...'
              : showLinkModal
                ? 'Verify & Continue'
              : retryAfterSeconds > 0
                ? `Try again in ${retryAfterSeconds}s`
                : loginStep === '2fa'
                  ? 'Verify Admin Login'
                  : 'Login'
            : signupPrimaryText()}
        </button>

        {action === 'Sign up' && (
          <button
            className="submit gray"
            type="button"
            disabled={loading}
            onClick={async () => {
              if (signupStep === 3) {
                if (otpCountdown > 0) return;
                await requestSignupOtp();
                return;
              }

              if (signupStep > 1) {
                setSignupStep((prev) => prev - 1);
                setSignupErrors([]);
              } else {
                setAction('Login');
                setMessage('');
                resetSignup();
              }
            }}
          >
            {signupStep === 3 ? (otpCountdown > 0 ? `Resend OTP in ${otpCountdown}s` : 'Resend OTP') : signupStep > 1 ? 'Back' : 'Back to Login'}
          </button>
        )}
      </div>

      {action === 'Login' && ssoSettings.enabled && !showLinkModal && (
        <div className="sso-login-panel">
          <div className="sso-login-label">Or continue with {ssoSettings.provider_name || 'SSO / LDAP'}</div>
          <button
            type="button"
            className="submit sso"
            onClick={handleSsoLogin}
            disabled={loading || ssoLoading}
          >
            {loading ? 'Connecting...' : `Continue with ${ssoSettings.provider_name || 'SSO / LDAP'}`}
          </button>
        </div>
      )}

      {!showLinkModal && (
        <div className="google-auth-section">
          <h4 className="google-heading">Continue with Google</h4>
          <div className="google-button-wrapper">
            <div className="google-auth-button" ref={googleButtonRef} aria-label="Google authentication button" />
            {!googleClientId && (
              <button type="button" className="google-auth-fallback" disabled>
                Google sign-in is not configured
              </button>
            )}
            {googleClientId && !googleReady && (
              <button type="button" className="google-auth-fallback" disabled>
                Loading Google button...
              </button>
            )}
          </div>
          <small className="helper-text google-description">
            {googleLoading
              ? 'Checking your Google account...'
              : 'We use Google to verify your identity and create an account if one does not exist.'}
          </small>
        </div>
      )}

      <div className="login-footer google-links">
        <a href={LEGAL_CONTENT.privacy.href} aria-haspopup="dialog" onClick={(e) => openLegalModal(e, 'privacy')}>Privacy Notice</a>
        <span>|</span>
        <a href={LEGAL_CONTENT.terms.href} aria-haspopup="dialog" onClick={(e) => openLegalModal(e, 'terms')}>Terms</a>
        <span>|</span>
        <a href="mailto:contact@cvsu.dev">Help</a>
      </div>
    </div>
    </section>
    </div>

    {activeLegalContent && (
      <div className="legal-modal-overlay" onClick={closeLegalModal} role="presentation">
        <section
          className="legal-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="legal-modal-close"
            aria-label="Close legal notice"
            onClick={closeLegalModal}
            ref={legalCloseButtonRef}
          >
            &times;
          </button>
          <div className="legal-modal-kicker">Library Portal</div>
          <h2 id="legal-modal-title">{activeLegalContent.title}</h2>
          <p className="legal-modal-updated">Last updated: {legalUpdatedDate}</p>
          <div className="legal-modal-body">
            {activeLegalContent.paragraphs.map((paragraph) => (
              <p key={paragraph}>
                {paragraph.includes('contact@cvsu.dev') ? (
                  <>
                    {paragraph.split('contact@cvsu.dev')[0]}
                    <a href="mailto:contact@cvsu.dev">contact@cvsu.dev</a>
                    {paragraph.split('contact@cvsu.dev').slice(1).join('contact@cvsu.dev')}
                  </>
                ) : paragraph}
              </p>
            ))}
          </div>
        </section>
      </div>
    )}
    </div>
  );
};

export default Login;
