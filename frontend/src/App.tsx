import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { AppShell } from './components/layouts/AppShell';
import { ProtectedRoute, RequireRole } from './components/guards';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
import { ChallansPage } from './pages/challans/ChallansPage';
import { ChallanCreatePage } from './pages/challans/ChallanCreatePage';
import { ChallanDetailPage } from './pages/challans/ChallanDetailPage';
import { AccessRequestsPage } from './pages/admin/AccessRequestsPage';

function NotFound() {
  return (
    <div>
      <h2>Page not found</h2>
      <p className="text-secondary">The page you are looking for does not exist.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/:id" element={<CustomerDetailPage />} />
              <Route
                path="products"
                element={<ProductsPage />}
              />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route
                path="challans"
                element={<ChallansPage />}
              />
              <Route path="challans/new" element={<RequireRole roles={['ADMIN', 'SALES']}><ChallanCreatePage /></RequireRole>} />
              <Route path="challans/:id" element={<ChallanDetailPage />} />
              <Route path="access-requests" element={<RequireRole roles={['ADMIN']}><AccessRequestsPage /></RequireRole>} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}