import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlaceholderPage from '@/components/PlaceholderPage';

describe('PlaceholderPage', () => {
  it('displays the provided title', () => {
    render(<PlaceholderPage title="Test Page" />);
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('shows Coming Soon text when comingSoon is true', () => {
    render(<PlaceholderPage title="Properties" comingSoon />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });

  it('does not show Coming Soon by default', () => {
    render(<PlaceholderPage title="Test Page" />);
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});
