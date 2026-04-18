import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';

export function NotFound() {
  return (
    <Layout>
      <div className="text-center py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-gray-600 mb-6">Page not found</p>
        <Link 
          to="/" 
          className="text-blue-600 hover:text-blue-800"
        >
          Go back to Tournaments
        </Link>
      </div>
    </Layout>
  );
}
