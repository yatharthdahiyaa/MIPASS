import React from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import { useIndicLanguage } from '@/context/IndicLanguageContext';
import { Resource } from '@/types/multiLevelRbac';
import {
  Activity,
  BarChart3,
  Building,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileCheck2,
  Globe,
  KeyRound,
  LayoutDashboard,
  Lock,
  Network,
  Receipt,
  Server,
  Shield,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';

interface NavItem {
  id: Resource;
  label: string;
  labelHi: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  requiredResource: Resource;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  titleHi: string;
  items: NavItem[];
}

export default function LeftSidebar() {
  const {
    activeModule,
    setActiveModule,
    canAccessModule,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    language,
    activeRole,
    statAlerts,
  } = useMultiLevelAdmin();
  const { t } = useIndicLanguage();

  const sections: NavSection[] = [
    {
      title: 'Core Operations',
      titleHi: 'मुख्य संचालन',
      items: [
        {
          id: 'overview',
          label: 'Overview & KPIs',
          labelHi: 'सिंहावलोकन एवं संकेतक',
          icon: LayoutDashboard,
          requiredResource: 'overview',
        },
        {
          id: 'clinical_ops',
          label: 'Clinical Operations',
          labelHi: 'क्लिनिकल कार्यप्रवाह',
          icon: Stethoscope,
          requiredResource: 'clinical_ops',
          badge: statAlerts.length > 0 ? `${statAlerts.length} STAT` : undefined,
          badgeColor: '#FF7869',
        },
      ],
    },
    {
      title: 'Organization & Access',
      titleHi: 'संस्थान एवं पहुंच',
      items: [
        {
          id: 'organisations',
          label: 'Organisations & Sites',
          labelHi: 'संगठन और शाखाएं',
          icon: Building,
          requiredResource: 'organisations',
        },
        {
          id: 'users',
          label: 'Users & Access',
          labelHi: 'उपयोगकर्ता एवं अधिकार',
          icon: Users,
          requiredResource: 'users',
        },
        {
          id: 'roles',
          label: 'Roles & Permissions',
          labelHi: 'भूमिकाएं एवं अनुमतियां',
          icon: KeyRound,
          requiredResource: 'roles',
        },
        {
          id: 'approvals',
          label: 'Approvals & Break-Glass',
          labelHi: 'स्वीकृतियां एवं आपातकाल',
          icon: ShieldCheck,
          requiredResource: 'approvals',
        },
      ],
    },
    {
      title: 'AI Governance & Models',
      titleHi: 'एआई मॉडल गवर्नेंस',
      items: [
        {
          id: 'models',
          label: 'Models & Agents',
          labelHi: 'एआई मॉडल और एजेंट्स',
          icon: Cpu,
          requiredResource: 'models',
          badge: 'L0-L2',
        },
      ],
    },
    {
      title: 'Compliance & Finance',
      titleHi: 'अनुपालन एवं वित्त',
      items: [
        {
          id: 'privacy_consent',
          label: 'Privacy & DPDP Act',
          labelHi: 'गोपनीयता (DPDP 2023)',
          icon: FileCheck2,
          requiredResource: 'privacy_consent',
        },
        {
          id: 'integrations',
          label: 'Integrations & PACS',
          labelHi: 'PACS / DICOM गेटवे',
          icon: Network,
          requiredResource: 'integrations',
        },
        {
          id: 'billing',
          label: 'Billing & Usage (INR)',
          labelHi: 'बिलिंग एवं उपयोग (₹)',
          icon: Receipt,
          requiredResource: 'billing',
        },
        {
          id: 'audit',
          label: 'Forensic Audit Log',
          labelHi: 'ऑडिट लॉग (अपरिवर्तनीय)',
          icon: Shield,
          requiredResource: 'audit',
        },
      ],
    },
    {
      title: 'Platform Infrastructure',
      titleHi: 'प्लेटफॉर्म अवसंरचना',
      items: [
        {
          id: 'platform_health',
          label: 'Platform SRE Health',
          labelHi: 'सिस्टम स्वास्थ्य एवं लेटेंसी',
          icon: Server,
          requiredResource: 'platform_health',
        },
        {
          id: 'website_cms',
          label: 'Public Website CMS',
          labelHi: 'वेबसाइट सेवा नियंत्रण',
          icon: Globe,
          requiredResource: 'website_cms',
        },
      ],
    },
  ];

  const content = (
    <div className="flex flex-col h-full justify-between select-none py-3">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between px-4 pb-4 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00DCCE] to-[#7C5CFC] flex items-center justify-center font-bold text-black text-sm shrink-0 shadow-md">
              M
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <div className="font-bold text-sm tracking-wide text-white">MIPaaS Admin</div>
                <div className="text-[10px] text-teal-400 font-mono">Healthcare AI OS</div>
              </div>
            )}
          </div>

          {/* Collapse button on desktop */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-4 px-2 max-h-[calc(100vh-180px)] overflow-y-auto">
          {sections.map((section, sIdx) => {
            // Filter section items: show only if user has permission
            const visibleItems = section.items.filter((item) => canAccessModule(item.requiredResource));

            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx}>
                {!sidebarCollapsed && (
                  <div className="px-3 pb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {t(section.title, language === 'HI' ? section.titleHi : section.title)}
                  </div>
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeModule === item.id;
                    const itemDisplayLabel = t(item.label, language === 'HI' ? item.labelHi : item.label);

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveModule(item.id);
                          setMobileDrawerOpen(false);
                        }}
                        title={sidebarCollapsed ? itemDisplayLabel : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-teal-500/20 to-teal-500/5 text-teal-300 font-semibold border border-teal-500/30 shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-400' : 'text-gray-400'}`} />
                        {!sidebarCollapsed && (
                          <div className="flex-1 flex items-center justify-between truncate text-left">
                            <span className="truncate">{itemDisplayLabel}</span>
                            {item.badge && (
                              <span
                                className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: item.badgeColor ? `${item.badgeColor}25` : 'rgba(255,255,255,0.1)',
                                  color: item.badgeColor || '#73C8BF',
                                  border: `1px solid ${item.badgeColor || 'rgba(255,255,255,0.2)'}`,
                                }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer: User Role Scope Tag */}
      <div className="px-3 pt-3 border-t border-white/10">
        {!sidebarCollapsed ? (
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-semibold text-white truncate">{activeRole.name}</span>
            </div>
            <div className="text-[10px] text-gray-400 truncate">{activeRole.levelLabel}</div>
          </div>
        ) : (
          <div className="flex justify-center" title={`${activeRole.name} (${activeRole.levelLabel})`}>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-white/10 transition-all duration-200 shrink-0 z-20 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
        style={{ backgroundColor: '#07131D' }}
      >
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div
            className="relative w-72 max-w-[85vw] h-full border-r border-white/15 z-10 shadow-2xl animate-in slide-in-from-left duration-200"
            style={{ backgroundColor: '#07131D' }}
          >
            {content}
          </div>
        </div>
      )}
    </>
  );
}
