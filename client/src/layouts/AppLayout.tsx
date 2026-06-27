import { Outlet, Navigate, Link } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';

export function AppLayout(): React.ReactElement {
  const { user, deleteSession } = useSessionStore();

  const handleLogout = () => {
    deleteSession();
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="font-bold text-xl text-blue-600">NexTask</div>
        {user && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {user.displayName}
              </span>
            </div>
            <Link
              to="/profile"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-2 rounded-md hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
