import { Link, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const location = useLocation();

  const menuItems = [
    {
      id: "virtual-fitting",
      path: "/",
      icon: "Shirt",
      label: "Виртуальная примерочная",
    },
    {
      id: "color-analysis",
      path: "/colortype",
      icon: "Palette",
      label: "Определение цветотипа",
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-gradient-to-b from-gray-900 to-gray-800 
          border-r border-gray-700 z-50 transition-all duration-300 ease-in-out
          ${isOpen ? "w-64" : "-translate-x-full lg:translate-x-0 lg:w-20"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Burger Button - Desktop only, inside sidebar */}
          <div className="hidden lg:flex items-center justify-center py-4 border-b border-gray-700">
            <button
              onClick={onToggle}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              <Icon name="Menu" size={24} className="text-gray-300" />
            </button>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 px-3 py-4 space-y-2 mt-16 lg:mt-0">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      onToggle();
                    }
                  }}
                  className={`
                    flex items-center gap-4 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-purple-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }
                  `}
                >
                  <Icon
                    name={item.icon}
                    size={24}
                    className="flex-shrink-0"
                  />
                  
                  <span className={`transition-opacity duration-200 ${isOpen ? "opacity-100" : "lg:opacity-0"}`} style={{ whiteSpace: 'normal' }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;