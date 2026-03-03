import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders PK/TK selects and they have correct ARIA roles', () => {
    renderComponent();

    // Get all combobox role elements (Ant Design Select renders as combobox)
    const comboboxes = screen.getAllByRole('combobox');
    // Should have at least 2 for PK/TK plus the base type selects in table rows
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('PK select can be opened and shows property options', async () => {
    renderComponent();

    // Wait for auto-mapping
    const props = useCreateWizardStore.getState().properties;
    expect(props.length).toBe(2);

    // Find all comboboxes
    const comboboxes = screen.getAllByRole('combobox');
    // First combobox should be the PK select
    const pkSelect = comboboxes[0]!;

    // Click to open
    await userEvent.click(pkSelect);

    // Check if dropdown options appeared
    // Ant Design renders options in a dropdown with role="option"
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  it('selecting PK option updates store', async () => {
    renderComponent();

    // Wait for auto-mapping
    expect(useCreateWizardStore.getState().properties.length).toBe(2);

    const comboboxes = screen.getAllByRole('combobox');
    const pkSelect = comboboxes[0]!;

    // Click to open PK dropdown
    await userEvent.click(pkSelect);

    // Click the first option (should be "id")
    const options = screen.getAllByRole('option');
    // Debug: log full option HTML
    console.log('Option 0 outerHTML:', options[0]?.outerHTML.slice(0, 300));
    console.log('Option 0 inner:', options[0]?.innerHTML.slice(0, 300));

    // Click the first option regardless
    await userEvent.click(options[0]!);

    // Check store was updated
    const updatedProps = useCreateWizardStore.getState().properties;
    const pkProp = updatedProps.find((p) => p.isPrimaryKey);
    expect(pkProp).toBeDefined();
    expect(pkProp!.displayName).toBe('id');
  });
});
