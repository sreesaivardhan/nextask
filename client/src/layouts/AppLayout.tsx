import { Outlet } from 'react-router-dom';

export function AppLayout(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50">
      <main>
        <Outlet />
      </main>
    </div>
  );
}
