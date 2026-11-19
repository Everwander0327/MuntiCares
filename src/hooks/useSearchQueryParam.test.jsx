import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import useSearchQueryParam from './useSearchQueryParam';

const Harness = ({ keys, onMatch }) => {
  const location = useLocation();
  const navigate = useNavigate();
  useSearchQueryParam(keys, onMatch);
  return (
    <div>
      <span data-testid="search">{location.search}</span>
      <button
        type="button"
        onClick={() => navigate('/requests?q=Therapy&tab=past&keep=1')}
      >
        Jump Again
      </button>
    </div>
  );
};

describe('useSearchQueryParam', () => {
  it('consumes listed query params, invokes callback, strips consumed keys, and preserves others', () => {
    const onMatch = vi.fn();

    render(
      <MemoryRouter initialEntries={['/requests?q=Nursing&tab=all&view=compact']}>
        <Routes>
          <Route
            path="/requests"
            element={<Harness keys={['q', 'tab']} onMatch={onMatch} />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(onMatch).toHaveBeenCalledWith({ q: 'Nursing', tab: 'all' });
    expect(screen.getByTestId('search').textContent).toBe('?view=compact');
  });

  it('re-triggers when navigating to new query params while staying mounted on the same route', () => {
    const onMatch = vi.fn();

    render(
      <MemoryRouter initialEntries={['/requests?q=Nursing']}>
        <Routes>
          <Route
            path="/requests"
            element={<Harness keys={['q', 'tab']} onMatch={onMatch} />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(onMatch).toHaveBeenLastCalledWith({ q: 'Nursing', tab: null });
    expect(screen.getByTestId('search').textContent).toBe('');

    fireEvent.click(screen.getByText('Jump Again'));

    expect(onMatch).toHaveBeenCalledTimes(2);
    expect(onMatch).toHaveBeenLastCalledWith({ q: 'Therapy', tab: 'past' });
    expect(screen.getByTestId('search').textContent).toBe('?keep=1');
  });
});
