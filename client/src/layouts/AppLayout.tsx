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
          <div className="flex items-center gap-1 bg-elevated border border-strong rounded-xl px-2 py-1">
            <div className="flex items-center gap-2 px-1 py-0.5">
              {/* Avatar circle */}
              <div className="w-7 h-7 rounded-full border-2 border-primary bg-surface text-primary flex items-center justify-center font-bold text-xs shrink-0">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-primary hidden sm:block pr-1">
                {user.displayName}
              </span>
            </div>
            <div className="w-px h-5 bg-strong mx-1 shrink-0" />
            <Link
              to="/profile"
              className="text-sm text-secondary hover:text-primary font-medium px-2.5 py-1.5 rounded-lg hover:bg-surface transition-colors"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-secondary font-medium px-2.5 py-1.5 rounded-lg hover:text-status-danger hover:bg-status-danger/8 transition-colors"
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
