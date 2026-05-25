import { render, screen } from '@testing-library/react';

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ element }) => <div>{element}</div>,
  Navigate: ({ to }) => <div data-testid="navigate">{to}</div>,
  Outlet: () => <div data-testid="outlet" />,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  NavLink: ({ children, to }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock('./login', () => () => <div>Login page</div>);
jest.mock('./ForgotPassword', () => () => <div>Forgot password page</div>);
jest.mock('./Dashboard', () => () => <div>Admin dashboard</div>);
jest.mock('./StudentDashboard', () => () => <div>Student dashboard</div>);
jest.mock('./pages/student/StudentHome', () => () => <div>Student home</div>);
jest.mock('./pages/student/Books', () => () => <div>Books page</div>);
jest.mock('./pages/student/Borrowed', () => () => <div>Borrowed page</div>);
jest.mock('./pages/student/Returned', () => () => <div>Returned page</div>);
jest.mock('./pages/student/Profile', () => () => <div>Profile page</div>);
jest.mock('./pages/student/Settings', () => () => <div>Settings page</div>);

import App from './App';

test('renders the application routes', () => {
  render(<App />);
  expect(screen.getByText(/student dashboard/i)).toBeInTheDocument();
});
