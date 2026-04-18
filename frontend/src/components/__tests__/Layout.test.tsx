import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Layout } from '../Layout';

describe('Layout', () => {
  it('renders the header with title', () => {
    render(
      <BrowserRouter>
        <Layout>Test content</Layout>
      </BrowserRouter>
    );
    
    expect(screen.getByText('VGC Usage Stats')).toBeInTheDocument();
  });
  
  it('renders navigation links', () => {
    render(
      <BrowserRouter>
        <Layout>Test content</Layout>
      </BrowserRouter>
    );
    
    expect(screen.getByText('Tournaments')).toBeInTheDocument();
    expect(screen.getByText('Usage Stats')).toBeInTheDocument();
    expect(screen.getByText('Team Analysis')).toBeInTheDocument();
  });
  
  it('renders children content', () => {
    render(
      <BrowserRouter>
        <Layout>Test content</Layout>
      </BrowserRouter>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});
