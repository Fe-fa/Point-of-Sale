import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserHomePath } from '../../utils/helpers';

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 1 12s4 7 11 7a10.94 10.94 0 0 0 5.39-1.39" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '', device_name: 'web-browser' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await login(form);

      if (response.requires_verification) {
        navigate('/verify-email', { state: { user: response.user } });
        return;
      }

      const next = location.state?.from?.pathname || getUserHomePath(response.user);
      navigate(next, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.errors?.username?.[0] ||
        'Login failed.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="stack-md">
          <div>
            <h1>Welcome Back</h1>
            <p>Sign in to your account to continue</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
           <span className="field-label">Username<span className="required-mark">*</span></span>
            <input className="text-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Enter your username" required />
          </label>
           <label>
            <span className="field-label">Password<span className="required-mark">*</span></span>
            <div className="password-field">
              <input
                className="text-input"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="auth-links-row">
          <p className="auth-switch">No account yet? <Link to="/register">Create one</Link></p>
          <Link className="text-link" to="/forgot-password">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}