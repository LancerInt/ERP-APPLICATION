import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, User } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showWarehouseMenu, setShowWarehouseMenu] = useState(false);

  const user = useSelector((state) => state.auth?.user);
  const selectedWarehouse = useSelector((state) => state.warehouse?.selected);
  const warehouses = useSelector((state) => state.warehouse?.list || []);
  const notifications = useSelector((state) => state.notifications?.items || []);

  const handleLogout = () => {
    dispatch({ type: 'auth/logout' });
    navigate('/login');
  };

  const handleWarehouseChange = (warehouseId) => {
    dispatch({ type: 'warehouse/select', payload: warehouseId });
    setShowWarehouseMenu(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Left: Breadcrumbs or page title */}
        <div className="flex-1">
          <div className="text-sm text-slate-600">
            {/* Breadcrumbs can be injected here by page components */}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-6">
          {/* Warehouse Selector */}
          {warehouses.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowWarehouseMenu(!showWarehouseMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
              >
                <span className="text-sm font-medium text-slate-700">
                  {selectedWarehouse?.name || 'Select Warehouse'}
                </span>
                <ChevronDown size={16} className="text-slate-500" />
              </button>

              {showWarehouseMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                  {warehouses.map((wh) => (
                    <button
                      key={wh.id}
                      onClick={() => handleWarehouseChange(wh.id)}
                      className={`w-full text-left px-4 py-2 text-sm transition ${
                        selectedWarehouse?.id === wh.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {wh.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {notifications.length > 0 && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 max-h-96 overflow-y-auto z-50">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Notifications</h3>
                </div>
                <div className="divide-y divide-slate-200">
                  {notifications.map((notif, idx) => (
                    <div key={idx} className="p-4 hover:bg-slate-50 cursor-pointer transition">
                      <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                      <p className="text-sm text-slate-600 mt-1">{notif.message}</p>
                      <p className="text-xs text-slate-500 mt-2">{notif.timestamp}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <ChevronDown size={16} className="text-slate-500" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition">
                  <User size={16} />
                  Profile
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition">
                  <User size={16} />
                  Settings
                </button>
                <div className="border-t border-slate-200 my-2" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-2 transition"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
