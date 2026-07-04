import { useEffect, useState } from 'react';
import {
  BarChart2,
  ChevronDown,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Package,
  PackagePlus,
  Receipt,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { visibleNav } from '../../config/routePermissions';

const ICON_MAP = {
  LayoutDashboard,
  BarChart2,
  ShoppingCart,
  Receipt,
  ClipboardList,
  CreditCard,
  Users,
  Package,
  PackagePlus,
  Tag,
  Warehouse,
  UserCog,
  ScanLine,
  Store,
  ShieldCheck,
  Settings,
};

const COLLAPSIBLE_GROUPS = new Set(['Operations', 'Catalog', 'People', 'System']);

function NavIcon({ name, size = 16 }) {
  const Component = ICON_MAP[name];
  return Component ? <Component size={size} /> : null;
}

function getGroupKey(group, index) {
  return group.group ?? `group-${index}`;
}

function isItemActive(pathname, path) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function DynamicSidebar({ className = '' }) {
  const { user, can } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const groups = visibleNav(can, user.role, isAdmin);

  const [openGroups, setOpenGroups] = useState(() => {
    const initialState = {};

    groups.forEach((group, index) => {
      const key = getGroupKey(group, index);
      if (!group.group || !COLLAPSIBLE_GROUPS.has(group.group)) return;

      initialState[key] = true;
    });

    return initialState;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };

      groups.forEach((group, index) => {
        const key = getGroupKey(group, index);
        if (!group.group || !COLLAPSIBLE_GROUPS.has(group.group)) return;

        if (!(key in next)) next[key] = true;

        const hasActiveChild = group.items.some((item) =>
          isItemActive(location.pathname, item.path)
        );

        if (hasActiveChild) {
          next[key] = true;
        }
      });

      return next;
    });
  }, [groups, location.pathname]);

  const toggleGroup = (groupKey) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  return (
    <nav className={`sidebar-nav ${className}`.trim()} aria-label="Main navigation">
      {groups.map((group, gi) => {
        const groupKey = getGroupKey(group, gi);
        const isCollapsible = Boolean(group.group && COLLAPSIBLE_GROUPS.has(group.group));
        const isOpen = isCollapsible ? openGroups[groupKey] !== false : true;
        const hasActiveChild = group.items.some((item) =>
          isItemActive(location.pathname, item.path)
        );

        return (
          <div
            key={groupKey}
            className={[
              'sidebar-group',
              isCollapsible ? 'sidebar-group--collapsible' : '',
              hasActiveChild ? 'sidebar-group--has-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {group.group ? (
              isCollapsible ? (
                <button
                  type="button"
                  className={`sidebar-group-toggle ${isOpen ? 'is-open' : ''}`.trim()}
                  onClick={() => toggleGroup(groupKey)}
                  aria-expanded={isOpen}
                  aria-controls={`sidebar-group-panel-${groupKey}`}
                >
                  <span className="sidebar-group-toggle__label">{group.group}</span>
                  <ChevronDown size={16} className="sidebar-group-chevron" />
                </button>
              ) : (
                <p className="sidebar-group-label">{group.group}</p>
              )
            ) : null}

            <ul
              id={`sidebar-group-panel-${groupKey}`}
              className={[
                'sidebar-group-list',
                isOpen ? 'is-open' : 'is-collapsed',
                !group.group ? 'sidebar-group-list--root' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`.trim()
                    }
                    end={
                      item.path === '/admin/dashboard' ||
                      item.path === '/admin/manager' ||
                      item.path === '/cashier/pos'
                    }
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
