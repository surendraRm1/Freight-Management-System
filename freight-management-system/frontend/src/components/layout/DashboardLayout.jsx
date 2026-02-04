import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Truck,
  LogOut,
  Calculator,
  Menu,
  X,
  FileText,
  TrendingUp,
  ArrowUpRight,
  NotebookPen,
  ListChecks,
  Users,
  UserCheck,
  ClipboardList,
  ShieldCheck,
  UserCog,
  Settings,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import TaraSidebar from '../assistant/TaraSidebar';

const NAV_SECTIONS = [
  {
    id: 'ops',
    title: 'Execution hub',
    helper: 'Plan, book, and monitor shipments.',
  },
  {
    id: 'network',
    title: 'Transporter network',
    helper: 'Collaborate with transport partners.',
  },
  {
    id: 'finance',
    title: 'Finance & compliance',
    helper: 'Approve payouts and stay audit ready.',
  },
  {
    id: 'admin',
    title: 'Admin & security',
    helper: 'Control access, settings, and policies.',
  },
];

const TENANT_NAV_ITEMS = [
  {
    path: '/dashboard',
    label: 'Shipment overview',
    helper: 'Track live loads and status updates',
    icon: Truck,
    section: 'ops',
    roles: ['COMPANY_ADMIN', 'FINANCE_APPROVER', 'OPERATIONS', 'TRANSPORTER', 'USER', 'SUPER_ADMIN'],
  },
  {
    path: '/calculate',
    label: 'Create shipment',
    helper: 'Calculate rates and schedule pickup',
    icon: Calculator,
    section: 'ops',
    roles: ['COMPANY_ADMIN', 'OPERATIONS', 'USER', 'SUPER_ADMIN'],
  },
  {
    path: '/operations',
    label: 'Operations board',
    helper: 'Monitor live execution & drivers',
    icon: ClipboardList,
    section: 'ops',
    roles: ['COMPANY_ADMIN', 'OPERATIONS', 'SUPER_ADMIN'],
  },
  {
    path: '/quotes',
    label: 'Quote board',
    helper: 'Review transporter quotations',
    icon: NotebookPen,
    section: 'ops',
    roles: ['COMPANY_ADMIN', 'USER', 'SUPER_ADMIN'],
  },
  {
    path: '/transporter/inbox',
    label: 'Transporter inbox',
    helper: 'Respond to quotes and jobs',
    icon: ListChecks,
    section: 'network',
    roles: ['TRANSPORTER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/transporter/dashboard',
    label: 'Transporter console',
    helper: 'Pipeline, assignments, compliance',
    icon: ShieldCheck,
    section: 'network',
    roles: ['TRANSPORTER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/transporter/drivers',
    label: 'Driver directory',
    helper: 'Maintain driver & vehicle contacts',
    icon: UserCog,
    section: 'network',
    roles: ['TRANSPORTER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/finance',
    label: 'Finance approvals',
    helper: 'Approve POD and transporter invoices',
    icon: ArrowUpRight,
    section: 'finance',
    roles: ['COMPANY_ADMIN', 'FINANCE_APPROVER', 'SUPER_ADMIN'],
  },
  {
    path: '/admin/analytics',
    label: 'Analytics & downloads',
    helper: 'Monitor spend, SLA, and export reports',
    icon: TrendingUp,
    section: 'finance',
    roles: ['COMPANY_ADMIN', 'FINANCE_APPROVER', 'SUPER_ADMIN'],
  },
  {
    path: '/admin/users',
    label: 'Legacy user management',
    helper: 'Approve external registrations',
    icon: UserCheck,
    section: 'admin',
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/company/users',
    label: 'Company users',
    helper: 'Invite teammates & manage access',
    icon: UserCheck,
    section: 'admin',
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/company/settings',
    label: 'Company settings',
    helper: 'Manage billing & ERP webhook secret',
    icon: Settings,
    section: 'admin',
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/admin/agreements',
    label: 'Agreements workspace',
    helper: 'Draft and approve transporter contracts',
    icon: FileText,
    section: 'network',
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/admin/vendors',
    label: 'Transporter registry',
    helper: 'Onboard and maintain vendor profiles',
    icon: Users,
    section: 'network',
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/admin/compliance',
    label: 'Compliance queue',
    helper: 'Review GST, RCM, and e-way bill tasks',
    icon: ShieldCheck,
    section: 'finance',
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/agent/kyc',
    label: 'KYC uploads',
    helper: 'Submit driver & vehicle compliance packs',
    icon: ClipboardList,
    section: 'ops',
    roles: ['OPERATIONS', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/account/security',
    label: 'Account security',
    helper: 'Update 2FA, IP rules, and alerts',
    icon: Shield,
    section: 'admin',
    roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'FINANCE_APPROVER', 'OPERATIONS', 'TRANSPORTER', 'USER', 'AGENT'],
  },
];

const SUPER_ADMIN_NAV_ITEMS = [
  {
    path: '/super-admin/dashboard',
    label: 'Platform overview',
    helper: 'Active companies, users, activity',
    icon: TrendingUp,
  },
  {
    path: '/super-admin/companies',
    label: 'Company console',
    helper: 'Manage tenants & webhook secrets',
    icon: NotebookPen,
  },
  {
    path: '/super-admin/company-users',
    label: 'Company user management',
    helper: 'Create or suspend tenant users',
    icon: Users,
  },
  {
    path: '/super-admin/platform-users',
    label: 'Super admin users',
    helper: 'Manage platform staff accounts',
    icon: UserCheck,
  },
];

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSectionId, setOpenSectionId] = useState(null);

  const handleLogout = async () => {
    logout();
    navigate('/login');
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = useMemo(() => user?.name?.split(' ')[0] ?? 'there', [user]);
  const roleLabel = useMemo(() => {
    if (user?.role === 'VENDOR') return 'TRANSPORTER';
    return user?.role || '';
  }, [user]);

  const isActive = (path) => {
    if (path === '/calculate') {
      return location.pathname === '/calculate' || location.pathname === '/select-vendor';
    }
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname.startsWith('/shipments/');
    }
    if (path === '/quotes') {
      return location.pathname.startsWith('/quotes');
    }
    if (path === '/transporter/inbox') {
      return location.pathname.startsWith('/transporter');
    }
    if (path === '/admin/agreements') {
      return location.pathname.startsWith('/admin/agreements');
    }
  if (path === '/admin/users') {
    return location.pathname.startsWith('/admin/users');
  }
  if (path === '/admin/compliance') {
    return location.pathname.startsWith('/admin/compliance');
  }
  if (path === '/admin/analytics') {
    return location.pathname.startsWith('/admin/analytics');
  }
  if (path === '/agent/kyc') {
    return location.pathname.startsWith('/agent/kyc');
  }
    return location.pathname === path;
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const navItems = isSuperAdmin ? SUPER_ADMIN_NAV_ITEMS : TENANT_NAV_ITEMS;

  const filteredNav = useMemo(() => {
    if (isSuperAdmin) {
      return navItems;
    }
    return navItems.filter((item) => item.roles.includes(user?.role));
  }, [isSuperAdmin, navItems, user]);

  const groupedNav = useMemo(() => {
    if (isSuperAdmin) return [];
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: filteredNav.filter((item) => item.section === section.id),
    })).filter((section) => section.items.length > 0);
  }, [filteredNav, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) return;
    if (!groupedNav.length) {
      setOpenSectionId(null);
      return;
    }
    const activeSection = groupedNav.find((section) =>
      section.items.some((item) => isActive(item.path)),
    )?.id;

    if (activeSection) {
      setOpenSectionId((current) => (current === activeSection ? current : activeSection));
      return;
    }

    setOpenSectionId((current) => {
      if (current && groupedNav.some((section) => section.id === current)) {
        return current;
      }
      return groupedNav[0]?.id ?? null;
    });
  }, [groupedNav, isSuperAdmin, location.pathname]);

  const toggleSection = (sectionId) => {
    setOpenSectionId((current) => (current === sectionId ? null : sectionId));
  };

  const renderNavLinks = (onClick) => {
    const renderLink = (item) => {
      const Icon = item.icon;
      const active = isActive(item.path);

      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={onClick}
          className={`group flex flex-col rounded-2xl border px-4 py-3 transition ${
            active
              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
              : 'border-transparent bg-white/5 text-slate-300 hover:border-blue-400 hover:bg-blue-500/10 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-3 text-sm font-semibold">
              <span className={`rounded-xl bg-white/10 p-2 ${active ? 'text-blue-700' : 'text-blue-200'}`}>
                <Icon className="h-4 w-4" />
              </span>
              {item.label}
            </span>
            <ArrowUpRight className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-white'}`} />
          </div>
          <p className={`mt-2 text-xs leading-5 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-200'}`}>
            {item.helper}
          </p>
        </Link>
      );
    };

    if (isSuperAdmin) {
      return filteredNav.map((item) => renderLink(item));
    }

    return groupedNav.map((section) => {
      const expanded = openSectionId === section.id;
      return (
        <div
          key={section.id}
          className="rounded-2xl border border-white/10 bg-white/5 shadow-inner shadow-black/10"
        >
          <button
            type="button"
            onClick={() => toggleSection(section.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">
                {section.title}
              </p>
              <p className="text-[11px] text-blue-300/80">{section.helper}</p>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-blue-200 transition duration-200 ${
                expanded ? 'rotate-180 text-blue-100' : ''
              }`}
            />
          </button>
          {expanded && (
            <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3">
              {section.items.map((item) => renderLink(item))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="relative hidden w-72 flex-col justify-between bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 px-6 pb-8 pt-6 text-white lg:flex">
          <div>
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-200">FreightOS</p>
                <h1 className="text-lg font-bold">Command Centre</h1>
              </div>
            </Link>

            <div className="mt-8 flex flex-col gap-3">{renderNavLinks()}</div>
          </div>

          <div className="rounded-3xl bg-white/5 p-4 text-sm leading-5">
            <p className="font-semibold text-blue-100">Need a co-pilot?</p>
            <p className="mt-1 text-blue-200">
              Tara is docked in the corner. Open the chat to get live assistance on routes, pricing, and compliance.
            </p>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900 lg:hidden"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{greeting}</p>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Welcome back, {firstName}!
                  </h2>
                  <p className="text-sm text-slate-500">
                    Monitor shipments, trigger new bookings, or ask Tara to plan the next move.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-semibold text-white shadow">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden rounded-full bg-blue-100 px-3 py-1 text-xs font-medium uppercase text-blue-700 sm:inline-block">
                  {roleLabel || user?.role}
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>

          <footer className="border-t border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
              <div>&copy; 2025 Freight Management System. All rights reserved.</div>
              <div className="flex gap-6">
                <a href="#" className="transition hover:text-blue-600">
                  Terms of Service
                </a>
                <a href="#" className="transition hover:text-blue-600">
                  Privacy Policy
                </a>
                <a href="#" className="transition hover:text-blue-600">
                  Contact Support
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 w-72 bg-slate-900 px-6 py-6 text-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-blue-200">FreightOS</p>
                  <p className="text-sm font-semibold">Command Centre</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-full border border-white/30 p-2 text-white transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8 flex flex-col gap-3">{renderNavLinks(() => setMobileMenuOpen(false))}</div>

            <div className="mt-6 rounded-3xl bg-white/10 p-4 text-sm text-blue-100">
              Open Tara from the floating button for instant help.
            </div>
          </div>
        </div>
      )}

      <TaraSidebar />
    </div>
  );
};

export default DashboardLayout;

