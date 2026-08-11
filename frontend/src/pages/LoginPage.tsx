import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, Input } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { ApiError } from '../types/api';
import { EyeIcon, EyeSlashIcon } from '../components/ui/Icons';
import { RequestAccessModal } from './RequestAccessModal';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [requestOpen, setRequestOpen] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Email is required';
    if (!password) next.password = 'Password is required';
    setFieldErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Unable to sign in');
        const byField: { email?: string; password?: string } = {};
        if (err.errors) {
          for (const item of err.errors) {
            byField[item.field as 'email' | 'password'] = item.message;
          }
        }
        setFieldErrors(byField);
      } else {
        setError('Unexpected error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.brandPanel}>
        <div className={styles.brandBlock}>
          <span className={styles.brandMark}>M<span className={styles.accent}>.</span>ERP</span>
          <p className={styles.tagline}>Mini ERP + CRM Operations Portal</p>
          <ul className={styles.features}>
            <li>
              <strong>Customers &amp; CRM</strong> — track leads, follow-ups and account status
            </li>
            <li>
              <strong>Products &amp; Stock</strong> — live inventory with low-stock alerts
            </li>
            <li>
              <strong>Sales Challans</strong> — draft, confirm and cancel with automatic stock deduction
            </li>
            <li>
              <strong>Role-based access</strong> — Admin, Sales, Warehouse and Accounts
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <h1>Sign in</h1>
          <p className="text-secondary">Use your work account to access the portal.</p>

          <form onSubmit={submit} noValidate>
            <Field label="Work email" required error={fieldErrors.email}>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                invalid={Boolean(fieldErrors.email)}
              />
            </Field>
            <Field label="Password" required error={fieldErrors.password}>
              <div className={styles.passwordWrap}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  invalid={Boolean(fieldErrors.password)}
                  className={styles.passwordInput}
                />
                <button
                  type="button"
                  className={styles.toggle}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
            </Field>
            {error && <div className={styles.formError} role="alert">{error}</div>}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>

          <div className={styles.demoBox}>
            <p className={styles.demoTitle}>Demo accounts</p>
            <div className={styles.demoRows}>
              <span><b>Admin</b> — admin@crmportal.dev · Admin@123</span>
              <span><b>Sales</b> — sales@crmportal.dev · Sales@123</span>
              <span><b>Warehouse</b> — warehouse@crmportal.dev · Warehouse@123</span>
              <span><b>Accounts</b> — accounts@crmportal.dev · Accounts@123</span>
            </div>
          </div>

          <div className={styles.requestBox}>
            <p className={styles.requestText}>
              Don&apos;t have an account?{' '}
              <button type="button" className={styles.requestLink} onClick={() => setRequestOpen(true)}>
                Request access
              </button>
            </p>
          </div>
        </div>
      </div>

      <RequestAccessModal open={requestOpen} onClose={() => setRequestOpen(false)} onSubmitted={() => setRequestOpen(false)} />
    </div>
  );
}