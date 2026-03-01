import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '@/locales/i18n';

describe('i18n', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US');
  });

  it('initializes successfully', () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it('supportedLngs includes en-US and zh-CN', () => {
    const supported = i18n.options.supportedLngs;
    expect(supported).toContain('en-US');
    expect(supported).toContain('zh-CN');
  });

  it('uses load: currentOnly to prevent parent language loading', () => {
    expect(i18n.options.load).toBe('currentOnly');
  });

  it('has fallbackLng as en-US', () => {
    expect(i18n.options.fallbackLng).toEqual(['en-US']);
  });

  it('translates nav.discover to English', async () => {
    await i18n.changeLanguage('en-US');
    expect(i18n.t('nav.discover')).toBe('Discover');
  });

  it('translates nav.discover to Chinese', async () => {
    await i18n.changeLanguage('zh-CN');
    expect(i18n.t('nav.discover')).toBe('发现');
  });

  it('contains all required translation key groups', () => {
    const requiredGroups = [
      'app.title',
      'nav.discover',
      'topBar.searchPlaceholder',
      'sidebar.resources',
      'detail.overview',
      'discover.recentlyViewed',
      'common.save',
      'error.pageNotFound',
      'language.en-US',
    ];
    for (const key of requiredGroups) {
      expect(i18n.exists(key)).toBe(true);
    }
  });
});
