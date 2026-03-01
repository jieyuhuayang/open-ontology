import { describe, it, expect } from 'vitest';
import theme from '@/theme';

describe('theme', () => {
  it('exports a ThemeConfig with colorPrimary', () => {
    expect(theme.token?.colorPrimary).toBe('#1677ff');
  });

  it('sets borderRadius', () => {
    expect(theme.token?.borderRadius).toBe(6);
  });

  it('configures Layout component tokens', () => {
    expect(theme.components?.Layout).toEqual(
      expect.objectContaining({
        headerBg: '#ffffff',
        headerHeight: 56,
        siderBg: '#ffffff',
      }),
    );
  });

  it('configures Menu component tokens', () => {
    expect(theme.components?.Menu).toEqual(
      expect.objectContaining({
        itemBorderRadius: 6,
      }),
    );
  });
});
