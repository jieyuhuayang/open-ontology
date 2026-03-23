import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getValidationErrors } from '@/components/SaveDialog/ErrorsTab';
import ErrorsTab from '@/components/SaveDialog/ErrorsTab';
import type { Change } from '@/api/types';

const validChange: Change = {
  id: 'chg-1',
  resourceType: 'ObjectType',
  resourceRid: 'ri.ontology.object-type.abc',
  changeType: 'CREATE',
  before: null,
  after: { displayName: 'Employee' },
  timestamp: '2026-01-01T00:00:00Z',
};

const invalidChange: Change = {
  id: 'chg-2',
  resourceType: 'ObjectType',
  resourceRid: 'ri.ontology.object-type.def',
  changeType: 'CREATE',
  before: null,
  after: {},
  timestamp: '2026-01-01T00:00:00Z',
};

const validLinkType: Change = {
  id: 'chg-lt-1',
  resourceType: 'LinkType',
  resourceRid: 'ri.ontology.link-type.abc',
  changeType: 'CREATE',
  before: null,
  after: {
    sideA: { displayName: 'Employees' },
    sideB: { displayName: 'Departments' },
  },
  timestamp: '2026-01-01T00:00:00Z',
};

const invalidLinkType: Change = {
  id: 'chg-lt-2',
  resourceType: 'LinkType',
  resourceRid: 'ri.ontology.link-type.def',
  changeType: 'CREATE',
  before: null,
  after: { sideA: { displayName: 'Employees' }, sideB: {} },
  timestamp: '2026-01-01T00:00:00Z',
};

describe('getValidationErrors', () => {
  it('returns empty for valid changes', () => {
    expect(getValidationErrors([validChange])).toHaveLength(0);
  });

  it('returns error for change missing displayName', () => {
    const errors = getValidationErrors([invalidChange]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.messageKey).toBe('changeManagement.missingDisplayName');
  });

  it('skips DELETE changes', () => {
    const deleteChange: Change = { ...invalidChange, changeType: 'DELETE' };
    expect(getValidationErrors([deleteChange])).toHaveLength(0);
  });

  it('returns empty for LinkType with sideA/sideB displayNames', () => {
    expect(getValidationErrors([validLinkType])).toHaveLength(0);
  });

  it('returns error for LinkType missing sideB displayName', () => {
    const errors = getValidationErrors([invalidLinkType]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('LinkType: missing display name');
  });
});

describe('ErrorsTab', () => {
  it('shows empty state when no errors', () => {
    render(
      <MemoryRouter>
        <ErrorsTab changes={[validChange]} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No errors/i)).toBeInTheDocument();
  });

  it('shows error list with Open link when errors exist', () => {
    render(
      <MemoryRouter>
        <ErrorsTab changes={[invalidChange]} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/missing display name/)).toBeInTheDocument();
    expect(screen.getByText(/Open/)).toBeInTheDocument();
  });
});
