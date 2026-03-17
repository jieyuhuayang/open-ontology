import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SearchHighlight from '../SearchHighlight';

describe('SearchHighlight', () => {
  it('highlights matching text', () => {
    const { container } = render(<SearchHighlight text="Employee Records" query="Employee" />);
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0]?.textContent).toBe('Employee');
  });

  it('returns plain text when no match', () => {
    const { container } = render(<SearchHighlight text="Hello World" query="xyz" />);
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(0);
    expect(container.textContent).toBe('Hello World');
  });

  it('is case insensitive', () => {
    const { container } = render(<SearchHighlight text="employee records" query="EMPLOYEE" />);
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0]?.textContent).toBe('employee');
  });

  it('returns text unchanged when query is empty', () => {
    const { container } = render(<SearchHighlight text="Hello" query="" />);
    expect(container.textContent).toBe('Hello');
    expect(container.querySelectorAll('mark').length).toBe(0);
  });
});
