import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmptyState, SkeletonText, SkeletonPage, BrandLogo, BrandLoader, BrandSuccess } from '@/shared/ui';
import { ErrorBoundary } from '@/shared/feedback';

describe('EmptyState', () => {
  it('renders title and message', () => {
    render(<EmptyState title="Nothing here" message="Try again later" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try again later')).toBeInTheDocument();
  });

  it('renders with different variants', () => {
    const { container } = render(<EmptyState title="Error" message="Oops" variant="error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});

describe('SkeletonText', () => {
  it('renders with default width', () => {
    const { container } = render(<SkeletonText />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

describe('SkeletonPage', () => {
  it('renders skeleton rows', () => {
    const { container } = render(<SkeletonPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });
});

describe('Brand marks', () => {
  it('renders BrandLogo badge and glyph with accessible and decorative modes', () => {
    const { rerender, container } = render(<BrandLogo />);
    expect(screen.getByRole('img', { name: 'MuntiCares' })).toBeInTheDocument();

    rerender(<BrandLogo variant="glyph" decorative />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('mask')).toBeInTheDocument();
  });

  it('renders BrandLoader as progressbar with unique mask IDs across instances', () => {
    const { container } = render(
      <>
        <BrandLoader label="Loading portal" />
        <BrandLoader label="Loading reset" />
      </>
    );
    expect(screen.getByRole('progressbar', { name: 'Loading portal' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Loading reset' })).toBeInTheDocument();
    const maskIds = [...container.querySelectorAll('mask')].map((el) => el.getAttribute('id'));
    expect(new Set(maskIds).size).toBe(2);
  });

  it('renders BrandSuccess in one-shot and loop modes without mask collisions', () => {
    const { container } = render(
      <>
        <BrandSuccess label="Visit requested" />
        <BrandSuccess loop label="Success loop" />
      </>
    );
    expect(screen.getByRole('img', { name: 'Visit requested' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Success loop' })).toBeInTheDocument();
    const maskIds = [...container.querySelectorAll('mask')].map((el) => el.getAttribute('id'));
    expect(new Set(maskIds).size).toBe(2);
  });
});
