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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {/* Avatar chip — bg-primary/10 gives legible tint without opacity clash */}
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary-accent flex items-center justify-center font-bold text-sm">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-primary hidden sm:block">
                {user.displayName}
              </span>
            </div>
            <Link
              to="/profile"
              className="text-sm text-secondary hover:text-primary font-medium px-3 py-1.5 rounded-lg hover:bg-elevated transition-colors"
            >
              Profile
            </Link>
            {/* Logout — neutral text normally, soft destructive on hover */}
            <button
              onClick={handleLogout}
              className="text-sm text-secondary font-medium px-3 py-1.5 rounded-lg hover:text-status-danger hover:bg-status-danger/8 border border-transparent hover:border-status-danger/20 transition-colors"
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
