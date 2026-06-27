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
        <Link to="/dashboard" className="text-gray-500 hover:text-gray-800 text-sm font-medium flex items-center gap-1 w-fit transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Profile</h1>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg border">
        <div className="px-4 py-5 sm:px-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">User Information</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Personal details and authentication.</p>
          </div>
        </div>
        
        <div className="border-t border-gray-200">
          <form onSubmit={handleSave} className="px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">Full Name</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full max-w-lg border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </dd>
              </div>

              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">Email address</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                  <span className="bg-gray-50 border px-3 py-2 rounded-md w-full max-w-lg text-gray-500 cursor-not-allowed">
                    {user.email || 'No email provided'}
                  </span>
                </dd>
              </div>

              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">Authentication Provider</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    LOCAL
                  </span>
                </dd>
              </div>

              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">Member Since</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                  {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </dd>
              </div>

            </dl>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmitting || displayName.trim() === user.displayName || !displayName.trim()}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting || displayName.trim() === user.displayName}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
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
