import { Info } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [showMessage, setShowMessage] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setShowMessage(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-primary">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-secondary">
          Or{' '}
          <Link to="/login" className="font-medium text-primary-accent hover:text-primary-accent">
            return to sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-4 shadow sm:rounded-2xl sm:px-10 border">
          {showMessage ? (
            <div className="rounded-2xl bg-surface border border border-l-2 border-l-accent p-4 border border-primary/30">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-primary-accent"><Info className="w-5 h-5 inline-block mr-2" /></span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-primary-accent">Coming Soon</h3>
                  <div className="mt-2 text-sm text-primary-accent">
                    <p>Password reset functionality will be available in a future update.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-secondary">Email address</label>
                <div className="mt-1">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-strong rounded-2xl shadow-subtle placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={!email}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-2xl shadow-subtle text-sm font-medium text-primary bg-primary text-inverse hover:bg-primary-hover text-inverse focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  Send Reset Link
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
