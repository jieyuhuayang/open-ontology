import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import WizardStepProperties from '@/pages/object-types/components/WizardStepProperties';
import { useCreateWizardStore } from '@/stores/create-wizard-store';

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

vi.mock('@/api/datasets', () => ({
  useDataset: vi.fn(() => ({
    data: {
      rid: 'ds-1',
      name: 'test-dataset',
      columns: [
        { name: 'id', inferredType: 'integer', isNullable: false },
        { name: 'name', inferredType: 'string', isNullable: true },
      ],
    },
  })),
}));

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WizardStepProperties />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WizardStepProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateWizardStore.getState().reset();
    useCreateWizardStore.getState().setSelectedDataset('ds-1');
  });

  it('renders PK and TK select controls (combobox role)', () => {
    renderComponent();
    const comboboxes = screen.getAllByRole('combobox');
    // At least 2 for PK/TK, plus base type selects in each table row
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('auto-maps dataset columns to properties', () => {
    renderComponent();
    const props = useCreateWizardStore.getState().properties;
    expect(props).toHaveLength(2);
    expect(props[0]!.displayName).toBe('id');
    expect(props[0]!.baseType).toBe('integer');
    expect(props[0]!.columnName).toBe('id');
    expect(props[1]!.displayName).toBe('name');
    expect(props[1]!.baseType).toBe('string');
  });

  it('PK/TK select options use displayName as aria-label', () => {
    renderComponent();
    // Open PK select
    const comboboxes = screen.getAllByRole('combobox');
    comboboxes[0]!.focus();
    comboboxes[0]!.click();
    // Check that options have correct aria-labels (displayNames)
    const options = screen.getAllByRole('option');
    const ariaLabels = options.map((o) => o.getAttribute('aria-label'));
    expect(ariaLabels).toContain('id');
    expect(ariaLabels).toContain('name');
  });

  it('PK selection via setProperties correctly updates store', () => {
    renderComponent();
    // Simulate what the PK onChange handler does
    const props = useCreateWizardStore.getState().properties;
    const targetId = props[0]!.id;

    const updated = props.map((p) => ({
      ...p,
      isPrimaryKey: p.id === targetId,
    }));
    useCreateWizardStore.getState().setProperties(updated);

    const result = useCreateWizardStore.getState().properties;
    expect(result[0]!.isPrimaryKey).toBe(true);
    expect(result[0]!.displayName).toBe('id');
    expect(result[1]!.isPrimaryKey).toBe(false);
  });

  it('TK selection via setProperties correctly updates store', () => {
    renderComponent();
    const props = useCreateWizardStore.getState().properties;
    const targetId = props[1]!.id;

    const updated = props.map((p) => ({
      ...p,
      isTitleKey: p.id === targetId,
    }));
    useCreateWizardStore.getState().setProperties(updated);

    const result = useCreateWizardStore.getState().properties;
    expect(result[0]!.isTitleKey).toBe(false);
    expect(result[1]!.isTitleKey).toBe(true);
    expect(result[1]!.displayName).toBe('name');
  });

  it('clearing PK/TK sets all to false', () => {
    // First set PK
    renderComponent();
    const props = useCreateWizardStore.getState().properties;
    useCreateWizardStore.getState().setProperties(
      props.map((p) => ({ ...p, isPrimaryKey: p.id === props[0]!.id })),
    );

    // Then clear (simulating allowClear — propId is undefined)
    const current = useCreateWizardStore.getState().properties;
    useCreateWizardStore.getState().setProperties(
      current.map((p) => ({ ...p, isPrimaryKey: false })),
    );

    const result = useCreateWizardStore.getState().properties;
    expect(result.every((p) => !p.isPrimaryKey)).toBe(true);
  });

  it('shows "Add Property" button (not a modal trigger)', () => {
    renderComponent();
    expect(screen.getByText(/Add Property/i)).toBeInTheDocument();
  });

  it('does NOT show "Add All" button', () => {
    renderComponent();
    expect(screen.queryByText(/Add All/i)).not.toBeInTheDocument();
  });
});
