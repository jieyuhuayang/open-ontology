import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/locales/i18n';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('renders language switch entry', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText(/english|中文/i)).toBeInTheDocument();
  });

  it('displays current language name', async () => {
    await i18n.changeLanguage('en-US');
    render(<LanguageSwitcher />);
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('calls changeLanguage when switching', async () => {
    await i18n.changeLanguage('en-US');
    const spy = vi.spyOn(i18n, 'changeLanguage');
    render(<LanguageSwitcher />);

    const trigger = screen.getByText('English');
    await userEvent.click(trigger);

    // Find and click the Chinese option in the dropdown
    const zhOption = await screen.findByText('中文');
    await userEvent.click(zhOption);

    expect(spy).toHaveBeenCalledWith('zh-CN');
    spy.mockRestore();
  });
});
