import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { useToastStore } from '../stores/toastStore';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-muted hover:text-secondary">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-muted hover:text-secondary">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

export function ResetPasswordPage(): React.ReactElement {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const { resetPassword, isLoading, error, clearError } = useSessionStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const location = useLocation();

  const token = new URLSearchParams(location.search).get('token');

  useEffect(() => {
    clearError();
    if (!token) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setTokenError('No reset token provided.');
    }
  }, [clearError, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!token) {
      setTokenError('No reset token provided.');
      return;
    }

    if (password !== confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }

    if (password.length < 8) {
      addToast('Password must be at least 8 characters long', 'error');
      return;
    }

    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      const msg = error.response?.data?.error || error.message;
      addToast(msg, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="mt-6 text-3xl font-bold tracking-tight text-primary">
          Choose a new password
        </h2>
        <p className="mt-2 text-sm text-secondary">
          Or{' '}
          <Link to="/login" className="font-medium text-primary hover:text-primary transition duration-150">
            return to sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-4 border border sm:rounded-xl sm:px-10 shadow-subtle">
          {success ? (
            <div className="rounded-lg bg-status-success/10 p-4 border border-status-success/20">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-status-success"><CheckCircle className="w-5 h-5 inline-block mr-2" /></span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-status-success">Password reset</h3>
                  <div className="mt-2 text-sm text-status-success/80">
                    <p>Your password has been successfully reset. Redirecting to login...</p>
                  </div>
                </div>
              </div>
            </div>
          ) : tokenError ? (
            <div className="bg-status-danger/10 border-l-4 border-status-danger text-status-danger px-4 py-3 rounded-lg text-sm font-medium">
              {tokenError}
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-status-danger/10 border-l-4 border-status-danger text-status-danger px-4 py-3 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full px-4 py-2.5 bg-background border border rounded-lg text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition duration-150 sm:text-sm pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 focus:outline-none"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full px-4 py-2.5 bg-background border border rounded-lg text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition duration-150 sm:text-sm pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 focus:outline-none"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !password || !confirmPassword}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-subtle text-sm font-medium text-inverse bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
