import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, Input } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { friendlyAuthError, isFirebaseConfigured } from '../firebase/client';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const configured = isFirebaseConfigured();

  const go = (to: string) => {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? to, { replace: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const next: { name?: string; email?: string; password?: string } = {};
    if (mode === 'signup' && !name.trim()) next.name = 'Name is required';
    if (!email.trim()) next.email = 'Email is required';
    if (!password) next.password = 'Password is required';
    setFieldErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(name.trim(), email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      go('/');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      go('/');
    } catch (err) {
      setError(friendlyAuthError(err));
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
          <h1>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
          <p className="text-secondary">
            {mode === 'signin'
              ? 'Use your work account to access the portal.'
              : 'New accounts start with view-only access until an admin grants a role.'}
          </p>

          {!configured && (
            <div className={styles.configError} role="alert">
              Firebase is not configured. Add the VITE_FIREBASE_* environment variables and restart the dev server.
            </div>
          )}

          <form onSubmit={submit} noValidate>
            {mode === 'signup' && (
              <Field label="Full name" required error={fieldErrors.name}>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name"
                  invalid={Boolean(fieldErrors.name)}
                />
              </Field>
            )}
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
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                invalid={Boolean(fieldErrors.password)}
              />
            </Field>

            {error && <div className={styles.formError} role="alert">{error}</div>}

            <Button type="submit" size="lg" loading={loading} className="w-full" disabled={!configured}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className={styles.divider}><span>or</span></div>

          <Button type="button" variant="secondary" size="lg" onClick={() => void handleGoogle()} disabled={!configured || loading} className="w-full">
            Continue with Google
          </Button>

          <div className={styles.switchRow}>
            {mode === 'signin' ? (
              <p>
                New to the portal?{' '}
                <button type="button" className={styles.switchLink} onClick={() => { setMode('signup'); setError(null); }}>
                  Create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button type="button" className={styles.switchLink} onClick={() => { setMode('signin'); setError(null); }}>
                  Sign in
                </button>
              </p>
            )}
          </div>

          <div className={styles.notice}>
            Need a role? Ask an admin to grant you access to <b>Sales</b>, <b>Warehouse</b> or <b>Admin</b>.
          </div>
        </div>
      </div>
    </div>
  );
}