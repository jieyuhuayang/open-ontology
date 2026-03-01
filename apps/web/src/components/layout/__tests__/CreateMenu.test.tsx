import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CreateMenu from '@/components/layout/CreateMenu';

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <CreateMenu />
    </MemoryRouter>,
  );
}

describe('CreateMenu', () => {
  it('renders a New button', () => {
    renderWithRouter();
    expect(screen.getByText(/new/i)).toBeInTheDocument();
  });

  it('shows dropdown with Create Object Type and Create Link Type', async () => {
    renderWithRouter();
    await userEvent.click(screen.getByText(/new/i));

    expect(await screen.findByText(/create object type/i)).toBeInTheDocument();
    expect(await screen.findByText(/create link type/i)).toBeInTheDocument();
  });
});
