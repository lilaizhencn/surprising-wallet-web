import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LandingPage from '../pages/LandingPage';

describe('LandingPage', () => {
  it('links the Console and developer actions to their application routes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/console/login" element={<h1>Console sign in</h1>} />
          <Route path="/console/developer-docs" element={<h1>Developer documentation</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: /blockchain infrastructure for every product you build/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Tenant isolation')).not.toHaveLength(0);
    expect(screen.getByText('Reliable webhook delivery')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Native SegWit multisig' })).toBeInTheDocument();
    expect(screen.getByRole('heading', {
      name: 'Batch collection and sponsored gas',
    })).toBeInTheDocument();
    expect(screen.getByRole('heading', {
      name: 'A shared foundation for all your product lines',
    })).toBeInTheDocument();
    expect(screen.getByText('Deployment and ongoing technical support included'))
      .toBeInTheDocument();
    expect(screen.getAllByText('business@tokdou.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/surprising_app/).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.chain-logo-item')).toHaveLength(27);
    expect(document.querySelector('[title="BTC"] svg')).not.toBeNull();
    expect(document.querySelector('[title="USDT"] svg')).not.toBeNull();
    expect(document.querySelector('[title="USDC"] svg')).not.toBeNull();

    await user.click(screen.getAllByRole('button', { name: /open console/i })[0]);
    expect(
      screen.getByRole('heading', { name: /console sign in/i }),
    ).toBeInTheDocument();
  });

  it('opens the API integration guide from the top developer menu', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/console/developer-docs" element={<h1>Developer documentation</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: /^developers$/i }));
    expect(screen.getByRole('heading', { name: /developer documentation/i })).toBeInTheDocument();
  });
});
