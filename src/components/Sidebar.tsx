import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const menuItems = [
    {
      id: "virtual-fitting",
      path: "/virtual-fitting",
      icon: "Shirt",
      label: "Виртуальная примерочная",
    },
    {
      id: "color-analysis",
      path: "/color-analysis",
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
          ${isOpen ? "w-64" : "w-0 lg:w-20"}
          ${!isOpen && "lg:hover:w-64"}
        `}
      >
        <div className="flex flex-col h-full pt-20">
          {/* Menu Items */}
          <nav className="flex-1 px-3 py-4 space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              const showLabel = isOpen || hoveredItem === item.id;

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`
                    flex items-center gap-4 px-4 py-3 rounded-lg
                    transition-all duration-200 group relative
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
                  
                  {/* Label (visible when sidebar is open or on hover) */}
                  <span
                    className={`
                      whitespace-nowrap transition-opacity duration-200
                      ${showLabel ? "opacity-100" : "opacity-0 hidden lg:block"}
                    `}
                  >
                    {item.label}
                  </span>

                  {/* Tooltip for collapsed state on hover (desktop only) */}
                  {!isOpen && hoveredItem === item.id && (
                    <div className="hidden lg:block absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Spacer for desktop */}
      <div className={`hidden lg:block transition-all duration-300 ${isOpen ? "w-64" : "w-20"}`} />
    </>
  );
};

export default Sidebar;
