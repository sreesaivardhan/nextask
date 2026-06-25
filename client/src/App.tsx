import { RouterProvider } from 'react-router-dom';
import { router } from './routes/router';
import { useSessionStore } from './stores/sessionStore';
import { useEffect } from 'react';
import { ToastContainer } from './components/ToastContainer';

function App(): React.ReactElement {
  const { checkSession, isLoading } = useSessionStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer />
    </>
  );
}

export default App;
