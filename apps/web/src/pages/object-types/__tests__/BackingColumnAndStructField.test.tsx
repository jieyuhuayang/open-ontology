import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BackingColumnSection from '../components/BackingColumnSection';
import StructFieldEditor from '../components/StructFieldEditor';
import type { StructField } from '@/api/types';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('BackingColumnSection', () => {
  it('renders unmapped state', () => {
    const onSave = vi.fn();
    render(
      <BackingColumnSection backingColumn={null} propertyName="Name" onSave={onSave} />,
    );
    expect(screen.getByText('Unmapped')).toBeInTheDocument();
    expect(screen.getByText('Map to Column')).toBeInTheDocument();
    expect(screen.queryByText('Remove Mapping')).not.toBeInTheDocument();
  });

  it('renders mapped state with change and remove buttons', () => {
    const onSave = vi.fn();
    render(
      <BackingColumnSection backingColumn="col_name" propertyName="Name" onSave={onSave} />,
    );
    expect(screen.getByText(/Mapped to/)).toBeInTheDocument();
    expect(screen.getByText('Change Mapping')).toBeInTheDocument();
    expect(screen.getByText('Remove Mapping')).toBeInTheDocument();
  });

  it('opens set mapping modal on button click', () => {
    const onSave = vi.fn();
    render(
      <BackingColumnSection backingColumn={null} propertyName="Name" onSave={onSave} />,
    );
    fireEvent.click(screen.getByText('Map to Column'));
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('hides buttons when disabled', () => {
    const onSave = vi.fn();
    render(
      <BackingColumnSection
        backingColumn="col"
        propertyName="Name"
        onSave={onSave}
        disabled
      />,
    );
    expect(screen.queryByText('Change Mapping')).not.toBeInTheDocument();
  });
});

describe('StructFieldEditor', () => {
  it('renders empty state with add button', () => {
    const onChange = vi.fn();
    render(<StructFieldEditor value={[]} onChange={onChange} />);
    expect(screen.getByText('Add Field')).toBeInTheDocument();
  });

  it('adds field on button click', () => {
    const onChange = vi.fn();
    render(<StructFieldEditor value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Add Field'));
    expect(onChange).toHaveBeenCalledWith([{ name: '', type: 'string' }]);
  });

  it('renders existing fields', () => {
    const fields: StructField[] = [
      { name: 'field1', type: 'string' },
      { name: 'field2', type: 'integer' },
    ];
    render(<StructFieldEditor value={fields} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
  });

  it('removes field on delete button click', () => {
    const onChange = vi.fn();
    const fields: StructField[] = [
      { name: 'f1', type: 'string' },
      { name: 'f2', type: 'integer' },
    ];
    render(<StructFieldEditor value={fields} onChange={onChange} />);
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]!);
    expect(onChange).toHaveBeenCalledWith([{ name: 'f2', type: 'integer' }]);
  });

  it('hides add and delete buttons when disabled', () => {
    const fields: StructField[] = [{ name: 'f1', type: 'string' }];
    render(<StructFieldEditor value={fields} disabled />);
    expect(screen.queryByText('Add Field')).not.toBeInTheDocument();
  });
});
