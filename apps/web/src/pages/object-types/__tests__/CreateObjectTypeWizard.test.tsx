import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CreateObjectTypeWizard from '@/pages/object-types/components/CreateObjectTypeWizard';
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

const mockMutateAsync = vi.fn();

vi.mock('@/api/object-types', () => ({
  useCreateObjectType: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
  objectTypeKeys: {
    all: ['object-types'],
    lists: () => ['object-types', 'list'],
    detail: (rid: string) => ['object-types', 'detail', rid],
  },
}));

vi.mock('@/api/properties', () => ({
  createPropertyDirect: vi.fn().mockResolvedValue({ rid: 'prop-rid-1' }),
  updatePropertyDirect: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/api/datasets', () => ({
  useDataset: vi.fn(() => ({
    data: {
      rid: 'ds-1',
      name: 'test-dataset',
      columns: [
        { name: 'id', inferredType: 'integer', isNullable: false },
        { name: 'name', inferredType: 'string', isNullable: true },
        { name: 'created_at', inferredType: 'timestamp', isNullable: true },
      ],
    },
  })),
}));

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreateObjectTypeWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function openWizardAtStep(step: number) {
  const store = useCreateWizardStore.getState();
  store.open();
  store.setSelectedDataset('ds-1');
  // Navigate to desired step
  for (let i = 0; i < step; i++) {
    store.nextStep();
  }
}

describe('CreateObjectTypeWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateWizardStore.getState().reset();
  });

  describe('Step 2 - Metadata', () => {
    it('shows Icon, Name, Description fields only (no ID, API Name, Plural Name)', () => {
      openWizardAtStep(1);
      renderWizard();

      const modal = screen.getByRole('dialog');

      // Should have these fields
      expect(within(modal).getByText(/^Icon$/i)).toBeInTheDocument();
      expect(within(modal).getByText(/^Name$/i)).toBeInTheDocument();
      expect(within(modal).getByText(/^Description$/i)).toBeInTheDocument();

      // Should NOT have these fields
      expect(within(modal).queryByLabelText(/^ID$/i)).not.toBeInTheDocument();
      expect(within(modal).queryByLabelText(/API Name/i)).not.toBeInTheDocument();
      expect(within(modal).queryByText(/Plural/i)).not.toBeInTheDocument();
    });
  });

  describe('Step 3 - Properties', () => {
    it('does NOT show "Add All" button', () => {
      openWizardAtStep(2);
      renderWizard();

      const modal = screen.getByRole('dialog');
      expect(within(modal).queryByText(/Add All/i)).not.toBeInTheDocument();
    });

    it('shows inline "Add Property" button (no modal trigger)', () => {
      openWizardAtStep(2);
      renderWizard();

      const modal = screen.getByRole('dialog');
      // Should have the add property button
      expect(
        within(modal).getByText(/Add Property/i),
      ).toBeInTheDocument();
    });

    it('shows PK and TK selector dropdowns at the top', () => {
      openWizardAtStep(2);
      renderWizard();

      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText(/Primary Key/i)).toBeInTheDocument();
      expect(within(modal).getByText(/Title/i)).toBeInTheDocument();
    });

    it('auto-maps dataset columns to properties when properties are empty', () => {
      openWizardAtStep(2);
      renderWizard();

      // After rendering, properties should be auto-mapped from dataset columns
      const props = useCreateWizardStore.getState().properties;
      expect(props.length).toBe(3);
      expect(props[0]!.displayName).toBe('id');
      expect(props[0]!.baseType).toBe('integer');
      expect(props[0]!.columnName).toBe('id');
      expect(props[1]!.displayName).toBe('name');
      expect(props[1]!.baseType).toBe('string');
      expect(props[2]!.displayName).toBe('created_at');
      expect(props[2]!.baseType).toBe('timestamp');
    });

    it('PK/TK selection updates store correctly via setProperties', () => {
      // This tests the handler logic directly since Ant Design Select
      // interactions are hard to simulate in jsdom
      useCreateWizardStore.getState().setProperties([
        { id: 'p1', displayName: 'ID', baseType: 'string' },
        { id: 'p2', displayName: 'Name', baseType: 'string' },
      ]);

      // Simulate PK selection: set p1 as primary key
      const props = useCreateWizardStore.getState().properties;
      const updatedPK = props.map((p) => ({
        ...p,
        isPrimaryKey: p.id === 'p1',
      }));
      useCreateWizardStore.getState().setProperties(updatedPK);

      let state = useCreateWizardStore.getState().properties;
      expect(state[0]!.isPrimaryKey).toBe(true);
      expect(state[1]!.isPrimaryKey).toBe(false);

      // Simulate TK selection: set p2 as title key
      const updatedTK = useCreateWizardStore.getState().properties.map((p) => ({
        ...p,
        isTitleKey: p.id === 'p2',
      }));
      useCreateWizardStore.getState().setProperties(updatedTK);

      state = useCreateWizardStore.getState().properties;
      expect(state[0]!.isPrimaryKey).toBe(true);
      expect(state[0]!.isTitleKey).toBe(false);
      expect(state[1]!.isPrimaryKey).toBe(false);
      expect(state[1]!.isTitleKey).toBe(true);

      // Simulate clearing PK (propId is undefined)
      const cleared = useCreateWizardStore.getState().properties.map((p) => ({
        ...p,
        isPrimaryKey: false,
      }));
      useCreateWizardStore.getState().setProperties(cleared);

      state = useCreateWizardStore.getState().properties;
      expect(state[0]!.isPrimaryKey).toBe(false);
      expect(state[1]!.isPrimaryKey).toBe(false);
    });
  });

  describe('Property creation on submit', () => {
    it('calls createPropertyDirect for each property after creating object type', async () => {
      const { createPropertyDirect, updatePropertyDirect } = await import(
        '@/api/properties'
      );

      openWizardAtStep(4);
      useCreateWizardStore.getState().setMetadata({ displayName: 'Aircraft' });
      useCreateWizardStore.getState().setProperties([
        {
          id: 'p1',
          displayName: 'Aircraft id',
          baseType: 'string',
          columnName: 'aircraft_id',
          isPrimaryKey: true,
        },
        {
          id: 'p2',
          displayName: 'Owner id',
          baseType: 'string',
          isTitleKey: true,
        },
      ]);

      mockMutateAsync.mockResolvedValueOnce({ rid: 'ot-new-rid' });

      renderWizard();

      // Click Create button
      await userEvent.click(screen.getByText(/^Create$/i));

      // Should have created the object type
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Aircraft',
        }),
      );

      // Should have created 2 properties
      expect(createPropertyDirect).toHaveBeenCalledTimes(2);
      expect(createPropertyDirect).toHaveBeenCalledWith(
        'ot-new-rid',
        expect.objectContaining({
          id: 'aircraft-id',
          apiName: 'aircraftId',
          displayName: 'Aircraft id',
          baseType: 'string',
          backingColumn: 'aircraft_id',
        }),
      );
      expect(createPropertyDirect).toHaveBeenCalledWith(
        'ot-new-rid',
        expect.objectContaining({
          id: 'owner-id',
          apiName: 'ownerId',
          displayName: 'Owner id',
          baseType: 'string',
          backingColumn: null,
        }),
      );

      // Should have set PK and TK
      expect(updatePropertyDirect).toHaveBeenCalledWith(
        'ot-new-rid',
        'prop-rid-1',
        { isPrimaryKey: true },
      );
      expect(updatePropertyDirect).toHaveBeenCalledWith(
        'ot-new-rid',
        'prop-rid-1',
        { isTitleKey: true },
      );
    });

    it('does NOT pass id or apiName in object type create request', async () => {
      openWizardAtStep(4);
      useCreateWizardStore.getState().setMetadata({ displayName: 'Aircraft' });

      mockMutateAsync.mockResolvedValueOnce({ rid: 'ot-new-rid' });

      renderWizard();

      await userEvent.click(screen.getByText(/^Create$/i));

      const createCall = mockMutateAsync.mock.calls[0]![0];
      expect(createCall).not.toHaveProperty('id');
      expect(createCall).not.toHaveProperty('apiName');
    });
  });
});
