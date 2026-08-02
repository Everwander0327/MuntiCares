import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ScrollProgress from '../components/ScrollProgress';

const MainLayout = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div className="min-h-screen">
      <ScrollProgress />
      <Navbar />
      <main>
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
    </div>
  );
};

export default MainLayout;
