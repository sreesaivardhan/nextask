import { Outlet, Navigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';

export function AppLayout(): React.ReactElement {
  const { user, deleteSession } = useSessionStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="font-bold text-xl text-blue-600">NexTask</div>
        <div className="flex items-center gap-4">
          <span className="text-gray-700 font-medium">{user.displayName}</span>
          <button
            onClick={deleteSession}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Log Out
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
