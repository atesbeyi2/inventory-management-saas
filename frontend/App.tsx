import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { clerkPublishableKey } from './config';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import SalesOrders from './pages/SalesOrders';
import Customers from './pages/Customers';
import Warehouses from './pages/Warehouses';
import Settings from './pages/Settings';
import CompanySetup from './pages/CompanySetup';

const queryClient = new QueryClient();

function AppInner() {
  return (
    <Router>
      <SignedIn>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/setup" element={<CompanySetup />} />
            <Route path="/products" element={<Products />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/sales-orders" element={<SalesOrders />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/warehouses" element={<Warehouses />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </Router>
  );
}

export default function App() {
  // Check if we have a valid publishable key
  if (!clerkPublishableKey || clerkPublishableKey === "pk_test_placeholder_key_replace_with_actual_key") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Setup Required</h1>
            <p className="text-gray-600 mb-6">
              Please configure your Clerk publishable key to continue.
            </p>
            <div className="bg-gray-100 p-4 rounded-md text-left">
              <p className="text-sm font-medium text-gray-700 mb-2">Steps to configure:</p>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Go to <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Clerk Dashboard</a></li>
                <li>2. Navigate to API Keys</li>
                <li>3. Copy your publishable key</li>
                <li>4. Update <code className="bg-gray-200 px-1 rounded">frontend/config.ts</code></li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <AppInner />
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
