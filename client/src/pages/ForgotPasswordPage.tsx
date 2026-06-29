import { CheckCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useToastStore } from '../stores/toastStore';

export function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const { forgotPassword, isLoading, error, clearError } = useSessionStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!email) return;

    try {
      await forgotPassword(email);
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
          Reset your password
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
                  <h3 className="text-sm font-medium text-status-success">Email sent</h3>
                  <div className="mt-2 text-sm text-status-success/80">
                    <p>If an account exists for {email}, you will receive a password reset link shortly.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-status-danger/10 border-l-4 border-status-danger text-status-danger px-4 py-3 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Email address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="block w-full px-4 py-2.5 bg-background border border rounded-lg text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition duration-150 sm:text-sm"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-subtle text-sm font-medium text-inverse bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
