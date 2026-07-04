import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';  
import { storageKeys } from '../../lib/api'; 

const initialState = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
};

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

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

const handleSubmit = async (event) => {
  event.preventDefault();
  setError('');
  setSuccess('');
  setSubmitting(true);

  try {
    const response = await authService.register(form);
    if (response?.access_token) {
      localStorage.setItem(storageKeys.token, response.access_token);
    }
    navigate('/verify-email', { state: { user: response?.user } });
  } catch (err) {
    const errors = err?.response?.data?.errors;
    const firstError = errors ? Object.values(errors)[0]?.[0] : null;
    setError(firstError || err?.response?.data?.message || 'Registration failed.');
  } finally {
    setSubmitting(false);
  }
};
  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-wide">
        <div className="stack-md">
          <div>
            <h1>Create Your Account</h1>
            <p>Get started with your free account</p>
          </div>
        </div>

        <form className="form-grid two-columns" onSubmit={handleSubmit}>
          <label>
             <span className="field-label">First name<span className="required-mark">*</span></span>
            <input className="text-input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Enter your first name" required />
          </label>
          <label>
             <span className="field-label">Last name<span className="required-mark">*</span></span>
            <input className="text-input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Enter your last name" required />
          </label>
          <label>
             <span className="field-label">Username<span className="required-mark">*</span></span>
            <input className="text-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Enter your username" required />
          </label>
          <label>
             <span className="field-label">Email<span className="required-mark">*</span></span>
            <input className="text-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Enter your email" required />
          </label>
          <label>
             <span className="field-label">Phone<span className="required-mark">*</span></span>
            <input className="text-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+2547..." />
          </label>
          <div className="info-tile compact">
            <strong>Default role</strong>
            <span>Cashier</span>
          </div>
    <label>
            <span className="field-label">Password<span className="required-mark">*</span></span>
            <div className="password-field">
              <input
                className="text-input"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters"
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
          <label>
             <span className="field-label">Confirm password<span className="required-mark">*</span></span>
            <div className="password-field">
              <input
                className="text-input"
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.password_confirmation}
                onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
                placeholder="Confirm your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>
          {error ? <p className="form-error span-2">{error}</p> : null}
          {success ? <p className="form-success span-2">{success}</p> : null}
          <button className="primary-button span-2" disabled={submitting}>{submitting ? 'Creating...' : 'Register'}</button>
        </form>

        <p className="auth-switch">Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}
