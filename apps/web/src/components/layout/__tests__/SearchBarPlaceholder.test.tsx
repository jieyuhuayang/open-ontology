import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SearchBarPlaceholder from '@/components/layout/SearchBarPlaceholder';

describe('SearchBarPlaceholder', () => {
  it('renders an input with search placeholder text', () => {
    render(<SearchBarPlaceholder />);
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
  });

  it('shows ⌘K shortcut hint', () => {
    render(<SearchBarPlaceholder />);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('input is disabled', () => {
    render(<SearchBarPlaceholder />);
    const input = screen.getByPlaceholderText(/search by name/i);
    expect(input).toBeDisabled();
  });
});
