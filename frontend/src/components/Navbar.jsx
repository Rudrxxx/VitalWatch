import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  const links = [
    { name: '/monitor', label: 'Monitor' },
    { name: '/analytics', label: 'Analytics' },
    { name: '/performance', label: 'Performance' },
    { name: '/chatbot', label: 'Chatbot' },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-black border-b border-cyan-400/20 px-6 py-4 flex items-center justify-between">
      <Link to="/" className="text-cyan-400 font-bold text-xl tracking-widest uppercase">
        VitalWatch
      </Link>
      <div className="flex space-x-8">
        {links.map(link => {
          const isActive = location.pathname.startsWith(link.name);
          return (
            <Link
              key={link.name}
              to={link.name}
              className={`transition uppercase tracking-widest text-xs h-full flex items-center ${
                isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-cyan-400'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
