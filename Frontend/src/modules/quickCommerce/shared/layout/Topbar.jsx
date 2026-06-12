import React from 'react';
import { useAuth } from '@core/context/AuthContext';
import {
    HiOutlineLogout,
    HiOutlineUserCircle,
    HiOutlineBell,
    HiOutlineSearch,
    HiOutlineMenu
} from 'react-icons/hi';
import { ChevronDown, User, LogOut } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu";
import quickSpicyLogo from "@food/assets/quicky-spicy-logo.png";
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@qc/lib/utils';
import { sellerApi } from '@modules/seller/services/sellerApi';
import { adminApi } from '@modules/admin/services/adminApi';
import { AnimatePresence } from 'framer-motion';
import NotificationPopup from './NotificationPopup';
import { toast } from 'sonner';

import { useSettings } from '@core/context/SettingsContext';
import { getCachedSettings, loadBusinessSettings } from '@food/utils/businessSettings';

const Topbar = ({ onMenuClick }) => {
    const { user, logout, role } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const location = useLocation();

    const appName = settings?.appName || 'App';
    const logoUrl = settings?.logoUrl || '';

    const [searchQuery, setSearchQuery] = React.useState('');
    const [notifications, setNotifications] = React.useState([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [showNotifications, setShowNotifications] = React.useState(false);
    const notificationRef = React.useRef(null);

    const [foodLogoUrl, setFoodLogoUrl] = React.useState(() => getCachedSettings()?.logo?.url || null);
    const [adminData, setAdminData] = React.useState(null);

    // Load admin data from localStorage (same source as Food AdminNavbar)
    React.useEffect(() => {
        const loadAdminData = () => {
            try {
                const adminUserStr = localStorage.getItem('admin_user');
                if (adminUserStr) {
                    setAdminData(JSON.parse(adminUserStr));
                }
            } catch (error) {}
        };
        loadAdminData();
        const handleAuthChange = () => loadAdminData();
        window.addEventListener('adminAuthChanged', handleAuthChange);
        window.addEventListener('storage', handleAuthChange);
        return () => {
            window.removeEventListener('adminAuthChanged', handleAuthChange);
            window.removeEventListener('storage', handleAuthChange);
        };
    }, []);
    
    React.useEffect(() => {
        const loadLogo = async () => {
            try {
                let cached = getCachedSettings();
                if (cached?.logo?.url) setFoodLogoUrl(cached.logo.url);
                
                const settings = await loadBusinessSettings();
                if (settings?.logo?.url) setFoodLogoUrl(settings.logo.url);
            } catch (error) {}
        };
        loadLogo();
        
        const handleSettingsUpdate = () => {
            const cached = getCachedSettings();
            if (cached?.logo?.url) setFoodLogoUrl(cached.logo.url);
        };
        window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);
        return () => window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
    }, []);

    const isSeller = location.pathname.startsWith('/qc/seller') || location.pathname.startsWith('/seller');
    const isAdmin = location.pathname.startsWith('/qc/admin');

    const handleSearchSubmit = (e) => {
        e?.preventDefault();
        const q = (searchQuery || '').trim();
        if (!q) return;
        if (isSeller) {
            navigate(`/seller/products?q=${encodeURIComponent(q)}`);
        }
    };

    const fetchNotifications = async () => {
        try {
            if (!isSeller && !isAdmin) return;
            const response = isSeller
                ? await sellerApi.getNotifications()
                : await adminApi.getNotifications();
            if (response.data.success) {
                setNotifications(response.data.result.notifications);
                setUnreadCount(response.data.result.unreadCount);
            }
        } catch (error) {
            console.error("Notif Fetch Error:", error);
        }
    };

    React.useEffect(() => {
        fetchNotifications();
        if (!isSeller && !isAdmin) return undefined;
        const poll = setInterval(fetchNotifications, 20000);
        return () => clearInterval(poll);
    }, [isSeller, isAdmin]);

    // Handle Click Outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id) => {
        try {
            if (!id) return;
            if (isSeller) await sellerApi.markNotificationRead(id);
            if (isAdmin) await adminApi.markNotificationRead(id);
            fetchNotifications();
        } catch (error) {
            toast.error("Failed to mark as read");
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            if (isSeller) await sellerApi.markAllNotificationsRead();
            if (isAdmin) await adminApi.markAllNotificationsRead();
            fetchNotifications();
            toast.success("All caught up!");
        } catch (error) {
            toast.error("Failed to mark all as read");
        }
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <header className={cn(
            "sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm transition-all duration-300",
            (role === 'admin' || role === 'seller')
                ? "px-4 md:px-6"
                : "px-6"
        )}>
            <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onMenuClick}
                        className="md:hidden p-2 rounded-md text-neutral-700 hover:bg-neutral-100 hover:text-black transition-colors"
                    >
                        <HiOutlineMenu className="w-5 h-5" />
                    </button>
                    {/* Logo block mirroring Food */}
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-12 rounded-lg bg-white flex items-center justify-center ring-neutral-200">
                        {foodLogoUrl || logoUrl ? (
                          <img
                            src={foodLogoUrl || logoUrl}
                            alt={appName}
                            className="w-24 h-10 object-contain"
                            loading="lazy"
                            onError={(e) => {
                              e.target.src = quickSpicyLogo;
                            }}
                          />
                        ) : (
                          <img src={quickSpicyLogo} alt="Buddy Services" className="w-24 h-10 object-contain" loading="lazy" />
                        )}
                      </div>
                    </div>
                </div>

                {/* Center: Search Bar */}
                <div className="hidden md:flex flex-1 justify-center max-w-md mx-8">
                    <form onSubmit={handleSearchSubmit} className="relative w-full group flex items-center">
                        <button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-100 text-neutral-600 cursor-text w-full border border-neutral-200" onClick={(e) => e.currentTarget.nextElementSibling.focus()}>
                            <HiOutlineSearch className="w-4 h-4 text-neutral-700" />
                            <input
                                type="text"
                                placeholder={isSeller ? "Search products..." : "Search"}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                                className="flex-1 bg-transparent border-none text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-0"
                            />
                            <span className="text-xs px-2 py-0.5 rounded bg-white text-neutral-600 border border-neutral-200 shrink-0">
                                Ctrl+K
                            </span>
                        </button>
                    </form>
                </div>


            <div className="flex items-center gap-3">
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative h-8 w-8 rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700 flex items-center justify-center hover:bg-neutral-100 transition-colors"
                        aria-label="Notifications"
                    >
                        <HiOutlineBell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 min-w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>

                    <AnimatePresence>
                        {showNotifications && (
                            <NotificationPopup
                                notifications={notifications}
                                onMarkAsRead={handleMarkAsRead}
                                onMarkAllAsRead={handleMarkAllAsRead}
                                onClose={() => setShowNotifications(false)}
                            />
                        )}
                    </AnimatePresence>
                </div>

                <div className="h-8 w-px bg-neutral-200 mx-1"></div>
                
                {/* User Profile */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-2 pl-3 border-l border-neutral-200 cursor-pointer hover:bg-neutral-100 rounded-md px-2 py-1 transition-colors">
                      <div className="hidden md:block">
                        <p className="text-sm font-medium text-neutral-900">
                          {isSeller ? (user?.shopName || user?.ownerName || user?.name || "Seller") : (adminData?.name || user?.name || "System Admin")}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {isSeller ? (user?.email || "seller@example.com") : (adminData?.email || user?.email || "admin@example.com")}
                        </p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-neutral-700 hidden md:block" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 text-neutral-900"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100"
                        onClick={() => {
                            if (location.pathname.startsWith('/qc/admin')) navigate('/qc/admin/profile');
                            else if (location.pathname.startsWith('/admin')) navigate('/admin/profile');
                            else if (location.pathname.startsWith('/qc/seller')) navigate('/qc/seller/profile');
                            else if (location.pathname.startsWith('/seller')) navigate('/qc/seller/profile');
                            else if (location.pathname.startsWith('/delivery')) navigate('/delivery/profile');
                            else navigate('/profile');
                        }}
                      >
                        <User className="mr-2 w-4 h-4" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-red-600 hover:bg-red-50 focus:bg-red-50"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 w-4 h-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

            </div>
            </div>
        </header>
    );
};

export default Topbar;

