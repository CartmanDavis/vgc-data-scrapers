import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatTable } from '../StatTable';

interface TestRow {
  id: number;
  name: string;
  value: number;
}

describe('StatTable', () => {
  const mockData: TestRow[] = [
    { id: 1, name: 'Item A', value: 100 },
    { id: 2, name: 'Item B', value: 200 },
    { id: 3, name: 'Item C', value: 50 },
  ];
  
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'value', header: 'Value' },
  ];
  
  it('renders table headers', () => {
    render(<StatTable data={mockData} columns={columns} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });
  
  it('renders all data rows', () => {
    render(<StatTable data={mockData} columns={columns} />);
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
    expect(screen.getByText('Item C')).toBeInTheDocument();
  });
  
  it('renders custom render function', () => {
    const columnsWithRender = [
      { key: 'id', header: 'ID' },
      { 
        key: 'name', 
        header: 'Name',
        render: (row: TestRow) => <span data-testid={`custom-${row.id}`}>{row.name.toUpperCase()}</span>,
      },
      { key: 'value', header: 'Value' },
    ];
    
    render(<StatTable data={mockData} columns={columnsWithRender} />);
    expect(screen.getByTestId('custom-1')).toBeInTheDocument();
    expect(screen.getByText('ITEM A')).toBeInTheDocument();
  });
  
  it('handles empty data', () => {
    render(<StatTable data={[]} columns={columns} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });
});
