import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useToastStore } from '../stores/toastStore';

export function ProfilePage(): React.ReactElement {
  const { user, updateProfile, error, clearError } = useSessionStore();
  const { addToast } = useToastStore();
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setDisplayName(user.displayName);
    }
    clearError();
  }, [user, clearError]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || displayName.trim() === user?.displayName) return;
    
    setIsSubmitting(true);
    try {
      await updateProfile(displayName);
      addToast('Profile updated successfully', 'success');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      addToast(error.response?.data?.error || error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(user?.displayName || '');
    clearError();
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link to="/dashboard" className="text-muted hover:text-primary text-sm font-medium flex items-center gap-1 w-fit transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
      <h1 className="text-3xl font-extrabold text-primary mb-8">Profile</h1>

      <div className="bg-surface shadow overflow-hidden sm:rounded-2xl border">
        <div className="px-4 py-5 sm:px-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary-accent font-bold text-2xl">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-primary">User Information</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted">Personal details and authentication.</p>
          </div>
        </div>
        
        <div className="border-t border">
          <form onSubmit={handleSave} className="px-4 py-5 sm:p-0">
            <dl className="divide-y divide-[var(--border-subtle)]">
              
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-muted flex items-center">Full Name</dt>
                <dd className="mt-1 text-sm text-primary sm:mt-0 sm:col-span-2">
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full max-w-lg border border-strong rounded-2xl shadow-subtle py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  />
                  {error && <p className="mt-2 text-sm text-status-danger">{error}</p>}
                </dd>
              </div>

              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-muted flex items-center">Email address</dt>
                <dd className="mt-1 text-sm text-primary sm:mt-0 sm:col-span-2 flex items-center">
                  <span className="bg-background border px-3 py-2 rounded-2xl w-full max-w-lg text-muted cursor-not-allowed">
                    {user.email || 'No email provided'}
                  </span>
                </dd>
              </div>

              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-muted flex items-center">Authentication Provider</dt>
                <dd className="mt-1 text-sm text-primary sm:mt-0 sm:col-span-2 flex items-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-elevated text-primary border border">
                    {user.authProvider || 'LOCAL'}
                  </span>
                </dd>
              </div>

              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-muted flex items-center">Member Since</dt>
                <dd className="mt-1 text-sm text-primary sm:mt-0 sm:col-span-2 flex items-center">
                  {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </dd>
              </div>

            </dl>

            <div className="bg-background px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border">
              <button
                type="submit"
                disabled={isSubmitting || displayName.trim() === user.displayName || !displayName.trim()}
                className="w-full inline-flex justify-center rounded-2xl border border-transparent shadow-subtle px-4 py-2 bg-primary text-inverse text-base font-medium text-primary hover:bg-primary-hover text-inverse focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting || displayName.trim() === user.displayName}
                className="mt-3 w-full inline-flex justify-center rounded-2xl border border-strong shadow-subtle px-4 py-2 bg-surface text-base font-medium text-secondary hover:bg-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
