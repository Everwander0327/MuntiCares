import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { SkeletonText, SkeletonPage } from '../components/Skeleton';
import ErrorBoundary from '../components/ErrorBoundary';

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
