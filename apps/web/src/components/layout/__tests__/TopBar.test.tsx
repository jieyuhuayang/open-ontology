import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopBar from '@/components/layout/TopBar';

function renderTopBar() {
  return render(
    <MemoryRouter>
      <TopBar />
    </MemoryRouter>,
  );
}

describe('TopBar', () => {
  it('renders a header element', () => {
    renderTopBar();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('shows Ontology Management title', () => {
    renderTopBar();
    expect(screen.getByText('Ontology Management')).toBeInTheDocument();
  });

  it('contains search bar placeholder', () => {
    renderTopBar();
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
  });

  it('contains change status slot', () => {
    const { container } = renderTopBar();
    expect(container.querySelector('#change-status-slot')).toBeInTheDocument();
  });

  it('contains New button', () => {
    renderTopBar();
    expect(screen.getByText(/new/i)).toBeInTheDocument();
  });

  it('contains language switcher', () => {
    renderTopBar();
    expect(screen.getByText(/english|中文/i)).toBeInTheDocument();
  });
});
