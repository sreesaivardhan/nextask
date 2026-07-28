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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-surface border-b border-strong px-6 py-3 flex justify-between items-center">
        <div className="font-bold text-lg text-primary-accent tracking-tight">NexTask</div>
        {user && (
          <div className="flex items-center gap-2">
            {/* Avatar circle + name — no extra box, just the circle */}
            <div className="w-7 h-7 rounded-full border-2 border-primary bg-surface text-primary flex items-center justify-center font-bold text-xs shrink-0">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-primary hidden sm:block">
              {user.displayName}
            </span>
            {/* Separate pill for Profile */}
            <Link
              to="/profile"
              className="text-sm text-secondary hover:text-primary font-medium px-3 py-1.5 rounded-lg border border-strong hover:bg-elevated transition-colors"
            >
              Profile
            </Link>
            {/* Separate pill for Logout — red on hover */}
            <button
              onClick={handleLogout}
              className="text-sm text-secondary font-medium px-3 py-1.5 rounded-lg border border-strong hover:text-status-danger hover:bg-status-danger/8 hover:border-status-danger/30 transition-colors"
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
