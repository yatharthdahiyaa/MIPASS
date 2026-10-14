'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { INITIAL_SERVICES, INITIAL_SERVICE_AUDIT_LOGS } from '@/config/servicesData';
import { ServiceConfig, ServiceAuditEntry, ServiceStatus } from '@/types/services';
import { useRBAC } from './RBACContext';

const LOCAL_STORAGE_SERVICES_KEY = 'mipaas_services_config';
const LOCAL_STORAGE_AUDIT_KEY = 'mipaas_services_audit_log';

interface ServicesContextType {
  services: ServiceConfig[];
  serviceAuditLogs: ServiceAuditEntry[];
  homepageServices: ServiceConfig[];
  activeServices: ServiceConfig[];
  toggleHomepageListing: (serviceId: string, isListed?: boolean) => void;
  toggleServiceStatus: (serviceId: string, status?: ServiceStatus) => void;
  updateServiceConfig: (serviceId: string, updates: Partial<ServiceConfig>) => void;
  bulkRestoreAll: () => void;
  bulkEmergencyMaintenance: (notice?: string, restoreTime?: string) => void;
  bulkReset: () => void;
  getService: (serviceId: string) => ServiceConfig | undefined;
  isServiceClosed: (serviceId: string) => boolean;
  isLoading: boolean;
}

const ServicesContext = createContext<ServicesContextType | undefined>(undefined);

const saveToStorage = (newServices: ServiceConfig[], newAuditLogs: ServiceAuditEntry[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_SERVICES_KEY, JSON.stringify(newServices));
    localStorage.setItem(LOCAL_STORAGE_AUDIT_KEY, JSON.stringify(newAuditLogs));
  } catch (e) {
    console.warn('Failed to save services to localStorage:', e);
  }
};

export function ServicesProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, addAuditLog } = useRBAC();
  const [services, setServices] = useState<ServiceConfig[]>(INITIAL_SERVICES);
  const [serviceAuditLogs, setServiceAuditLogs] = useState<ServiceAuditEntry[]>(INITIAL_SERVICE_AUDIT_LOGS);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from LocalStorage on mount
  useEffect(() => {
    try {
      const savedServices = localStorage.getItem(LOCAL_STORAGE_SERVICES_KEY);
      const savedAudit = localStorage.getItem(LOCAL_STORAGE_AUDIT_KEY);

      if (savedServices) {
        const parsed = JSON.parse(savedServices);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = INITIAL_SERVICES.map((initial) => {
            const found = parsed.find((p: any) => p.id === initial.id);
            return found ? { ...initial, ...found } : initial;
          });
          setServices(merged);
        }
      }

      if (savedAudit) {
        const parsedLogs = JSON.parse(savedAudit);
        if (Array.isArray(parsedLogs)) {
          setServiceAuditLogs(parsedLogs);
        }
      }
    } catch (e) {
      console.warn('Failed to load services from localStorage:', e);
    } finally {
      setIsLoading(false);
    }

    // Cross-tab synchronization
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_SERVICES_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setServices(parsed);
        } catch {}
      }
      if (e.key === LOCAL_STORAGE_AUDIT_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setServiceAuditLogs(parsed);
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Helper to record an audit entry
  const recordAudit = useCallback(
    (
      serviceId: string,
      serviceName: string,
      action: ServiceAuditEntry['action'],
      changeDescription: string
    ) => {
      const newEntry: ServiceAuditEntry = {
        id: `sa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        serviceId,
        serviceName,
        action,
        changeDescription,
        performedBy: currentUser?.name || 'Administrator',
        role: currentUser?.role || 'admin',
      };

      if (addAuditLog) {
        addAuditLog(
          `admin:service_${action}`,
          `service:${serviceId}`,
          'allow',
          { change: changeDescription, performed_by: currentUser?.name }
        );
      }

      return newEntry;
    },
    [currentUser, addAuditLog]
  );

  // Toggle Homepage Listing
  const toggleHomepageListing = useCallback(
    (serviceId: string, forceValue?: boolean) => {
      const target = services.find((s) => s.id === serviceId);
      if (!target) return;

      const nextListed = forceValue !== undefined ? forceValue : !target.isListedOnHomepage;
      const updatedServices = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              isListedOnHomepage: nextListed,
              lastUpdated: new Date().toLocaleTimeString(),
              lastUpdatedBy: currentUser?.name || 'Admin',
            }
          : s
      );

      const changeText = nextListed
        ? `Listed '${target.name}' on the Homepage (now visible to public visitors).`
        : `Unlisted '${target.name}' from the Homepage (hidden from public view).`;

      const auditEntry = recordAudit(
        target.id,
        target.name,
        'homepage_visibility',
        changeText
      );

      const updatedLogs = [auditEntry, ...serviceAuditLogs.slice(0, 49)];

      setServices(updatedServices);
      setServiceAuditLogs(updatedLogs);
      saveToStorage(updatedServices, updatedLogs);

      fetch('/api/services/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          updates: { isListedOnHomepage: nextListed },
          user: currentUser?.name || 'Admin',
          role: currentUser?.role || 'admin',
        }),
      }).catch(() => {});
    },
    [services, serviceAuditLogs, currentUser, recordAudit]
  );

  // Toggle Operational Status (Active vs Temporarily Closed)
  const toggleServiceStatus = useCallback(
    (serviceId: string, forceStatus?: ServiceStatus) => {
      const target = services.find((s) => s.id === serviceId);
      if (!target) return;

      const nextStatus: ServiceStatus =
        forceStatus !== undefined
          ? forceStatus
          : target.status === 'active'
          ? 'maintenance'
          : 'active';

      const updatedServices = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              status: nextStatus,
              lastUpdated: new Date().toLocaleTimeString(),
              lastUpdatedBy: currentUser?.name || 'Admin',
            }
          : s
      );

      const isClosed = nextStatus !== 'active';
      const changeText = isClosed
        ? `Temporarily CLOSED service '${target.name}'. Users accessing this service will see maintenance screen.`
        : `Re-opened service '${target.name}' to Active operational state.`;

      const auditEntry = recordAudit(
        target.id,
        target.name,
        'status_change',
        changeText
      );

      const updatedLogs = [auditEntry, ...serviceAuditLogs.slice(0, 49)];

      setServices(updatedServices);
      setServiceAuditLogs(updatedLogs);
      saveToStorage(updatedServices, updatedLogs);

      fetch('/api/services/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          updates: { status: nextStatus },
          user: currentUser?.name || 'Admin',
          role: currentUser?.role || 'admin',
        }),
      }).catch(() => {});
    },
    [services, serviceAuditLogs, currentUser, recordAudit]
  );

  // Granular update for notice, restore time, reason
  const updateServiceConfig = useCallback(
    (serviceId: string, updates: Partial<ServiceConfig>) => {
      const target = services.find((s) => s.id === serviceId);
      if (!target) return;

      const updatedServices = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              ...updates,
              lastUpdated: new Date().toLocaleTimeString(),
              lastUpdatedBy: currentUser?.name || 'Admin',
            }
          : s
      );

      const auditEntry = recordAudit(
        target.id,
        target.name,
        'notice_update',
        `Configured maintenance parameters for '${target.name}': ${
          updates.maintenanceNotice ? `Notice: "${updates.maintenanceNotice}". ` : ''
        }${updates.estimatedRestore ? `ETA: ${updates.estimatedRestore}.` : ''}`
      );

      const updatedLogs = [auditEntry, ...serviceAuditLogs.slice(0, 49)];

      setServices(updatedServices);
      setServiceAuditLogs(updatedLogs);
      saveToStorage(updatedServices, updatedLogs);

      fetch('/api/services/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          updates,
          user: currentUser?.name || 'Admin',
          role: currentUser?.role || 'admin',
        }),
      }).catch(() => {});
    },
    [services, serviceAuditLogs, currentUser, recordAudit]
  );

  // Bulk actions
  const bulkRestoreAll = useCallback(() => {
    const updatedServices = services.map((s) => ({
      ...s,
      status: 'active' as ServiceStatus,
      isListedOnHomepage: true,
      lastUpdated: new Date().toLocaleTimeString(),
      lastUpdatedBy: currentUser?.name || 'Admin',
    }));

    const auditEntry = recordAudit(
      'all',
      'All 9 AI Services',
      'bulk_action',
      'Restored all clinical AI services to Active (Online) and Listed on Homepage.'
    );

    const updatedLogs = [auditEntry, ...serviceAuditLogs.slice(0, 49)];

    setServices(updatedServices);
    setServiceAuditLogs(updatedLogs);
    saveToStorage(updatedServices, updatedLogs);

    fetch('/api/services/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bulk_restore_all',
        user: currentUser?.name || 'Admin',
        role: currentUser?.role || 'admin',
      }),
    }).catch(() => {});
  }, [services, serviceAuditLogs, currentUser, recordAudit]);

  const bulkEmergencyMaintenance = useCallback(
    (notice?: string, restoreTime?: string) => {
      const updatedServices = services.map((s) => ({
        ...s,
        status: 'maintenance' as ServiceStatus,
        maintenanceNotice: notice || 'Emergency platform maintenance in progress. Inference queues temporarily paused.',
        estimatedRestore: restoreTime || 'Under engineering review',
        lastUpdated: new Date().toLocaleTimeString(),
        lastUpdatedBy: currentUser?.name || 'Admin',
      }));

      const auditEntry = recordAudit(
        'all',
        'All 9 AI Services',
        'bulk_action',
        'Triggered Emergency Platform Maintenance: Temporarily closed all AI clinical services.'
      );

      const updatedLogs = [auditEntry, ...serviceAuditLogs.slice(0, 49)];

      setServices(updatedServices);
      setServiceAuditLogs(updatedLogs);
      saveToStorage(updatedServices, updatedLogs);

      fetch('/api/services/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_emergency_maintenance',
          updates: { maintenanceNotice: notice, estimatedRestore: restoreTime },
          user: currentUser?.name || 'Admin',
          role: currentUser?.role || 'admin',
        }),
      }).catch(() => {});
    },
    [services, serviceAuditLogs, currentUser, recordAudit]
  );

  const bulkReset = useCallback(() => {
    const fresh = INITIAL_SERVICES.map((s) => ({ ...s }));
    const auditEntry = recordAudit(
      'all',
      'Platform Defaults',
      'bulk_action',
      'Reset all service configurations to default platform factory settings.'
    );

    const updatedLogs = [auditEntry, ...serviceAuditLogs.slice(0, 49)];

    setServices(fresh);
    setServiceAuditLogs(updatedLogs);
    saveToStorage(fresh, updatedLogs);

    fetch('/api/services/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bulk_reset',
        user: currentUser?.name || 'Admin',
        role: currentUser?.role || 'admin',
      }),
    }).catch(() => {});
  }, [serviceAuditLogs, currentUser, recordAudit]);

  // Query helpers
  const getService = useCallback(
    (serviceId: string) => services.find((s) => s.id === serviceId),
    [services]
  );

  const isServiceClosed = useCallback(
    (serviceId: string) => {
      const found = services.find((s) => s.id === serviceId);
      return found ? found.status !== 'active' : false;
    },
    [services]
  );

  // Derived lists
  const homepageServices = useMemo(
    () => services.filter((s) => s.isListedOnHomepage),
    [services]
  );

  const activeServices = useMemo(
    () => services.filter((s) => s.status === 'active'),
    [services]
  );

  return (
    <ServicesContext.Provider
      value={{
        services,
        serviceAuditLogs,
        homepageServices,
        activeServices,
        toggleHomepageListing,
        toggleServiceStatus,
        updateServiceConfig,
        bulkRestoreAll,
        bulkEmergencyMaintenance,
        bulkReset,
        getService,
        isServiceClosed,
        isLoading,
      }}
    >
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices(): ServicesContextType {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return context;
}
