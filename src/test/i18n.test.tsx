import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { I18nProvider, useI18n } from '../i18n';

function LocaleProbe() {
  const { locale, t } = useI18n();
  return <div data-testid="locale-probe">{locale} · {t('Overview')}</div>;
}

describe('internationalization', () => {
  beforeEach(() => window.localStorage.removeItem('surprising-wallet-locale'));
  afterEach(() => window.localStorage.removeItem('surprising-wallet-locale'));

  it('switches to Chinese and persists the selected locale', async () => {
    const user = userEvent.setup();
    const view = render(
      <I18nProvider>
        <LanguageSwitch />
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(screen.getByTestId('locale-probe')).toHaveTextContent('en-US · Overview');
    await user.click(screen.getByText('中文'));

    expect(screen.getByTestId('locale-probe')).toHaveTextContent('zh-CN · 概览');
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN');
    expect(window.localStorage.getItem('surprising-wallet-locale')).toBe('zh-CN');

    view.unmount();
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale-probe')).toHaveTextContent('zh-CN · 概览');
  });
});
