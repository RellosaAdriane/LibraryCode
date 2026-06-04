import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export function renderStudentPage(ui, { route = '/student-dashboard' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
}

export const studentUser = {
  id: 7,
  email: 'student.component@test.com',
  first_name: 'Casey',
  last_name: 'Student',
  role: 'student',
  session_id: 'sess_component_test'
};

export function seedStudentAuth() {
  sessionStorage.setItem('user', JSON.stringify(studentUser));
}
