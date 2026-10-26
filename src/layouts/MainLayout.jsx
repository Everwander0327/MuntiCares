import { Outlet, useLocation } from 'react-router-dom';
import { Navbar, Footer, ScrollProgress } from '@/shared/navigation';

const MainLayout = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden w-full max-w-full">
      <ScrollProgress />
      <Navbar />
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
    </div>
  );
};

export default MainLayout;
