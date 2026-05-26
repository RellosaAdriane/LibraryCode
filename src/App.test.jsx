import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ element }) => <div>{element}</div>,
  Navigate: ({ to }) => <div data-testid="navigate">{to}</div>,
  Outlet: () => <div data-testid="outlet" />,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  NavLink: ({ children, to }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn()
}), { virtual: true });

vi.mock('./login', () => ({ default: () => <div>Login page</div> }));
vi.mock('./ForgotPassword', () => ({ default: () => <div>Forgot password page</div> }));
vi.mock('./Dashboard', () => ({ default: () => <div>Admin dashboard</div> }));
vi.mock('./StudentDashboard', () => ({ default: () => <div>Student dashboard</div> }));
vi.mock('./pages/student/StudentHome', () => ({ default: () => <div>Student home</div> }));
vi.mock('./pages/student/Books', () => ({ default: () => <div>Books page</div> }));
vi.mock('./pages/student/Borrowed', () => ({ default: () => <div>Borrowed page</div> }));
vi.mock('./pages/student/Returned', () => ({ default: () => <div>Returned page</div> }));
vi.mock('./pages/student/Profile', () => ({ default: () => <div>Profile page</div> }));
vi.mock('./pages/student/Settings', () => ({ default: () => <div>Settings page</div> }));

import App from './App';

test('renders the application routes', () => {
  render(<App />);
  expect(screen.getByText(/student dashboard/i)).toBeInTheDocument();
});