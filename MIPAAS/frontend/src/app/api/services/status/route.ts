import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_SERVICES, INITIAL_SERVICE_AUDIT_LOGS } from '@/config/servicesData';
import { ServiceConfig, ServiceAuditEntry, ServiceStatus } from '@/types/services';

// Server-side in-memory store (persists across requests during runtime)
let currentServices: ServiceConfig[] = [...INITIAL_SERVICES];
let currentAuditLogs: ServiceAuditEntry[] = [...INITIAL_SERVICE_AUDIT_LOGS];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      services: currentServices,
      auditLogs: currentAuditLogs,
      summary: {
        total: currentServices.length,
        active: currentServices.filter((s) => s.status === 'active').length,
        maintenance: currentServices.filter((s) => s.status === 'maintenance' || s.status === 'offline').length,
        listedOnHomepage: currentServices.filter((s) => s.isListedOnHomepage).length,
        unlistedFromHomepage: currentServices.filter((s) => !s.isListedOnHomepage).length,
      },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, serviceId, updates, bulkAction, user = 'Arthur Davis', role = 'admin' } = body;

    const timestamp = new Date().toLocaleTimeString();

    // 1. Bulk actions
    if (action === 'bulk_reset') {
      currentServices = INITIAL_SERVICES.map((s) => ({ ...s }));
      const newAudit: ServiceAuditEntry = {
        id: `sa-${Date.now()}`,
        timestamp,
        serviceId: 'all',
        serviceName: 'All Services',
        action: 'bulk_action',
        changeDescription: 'Reset all clinical services to default operational and homepage-listed state.',
        performedBy: user,
        role,
      };
      currentAuditLogs = [newAudit, ...currentAuditLogs.slice(0, 49)];
      return NextResponse.json({ success: true, data: { services: currentServices, auditLogs: currentAuditLogs } });
    }

    if (action === 'bulk_emergency_maintenance') {
      currentServices = currentServices.map((s) => ({
        ...s,
        status: 'maintenance' as ServiceStatus,
        maintenanceNotice: updates?.maintenanceNotice || 'Platform-wide emergency maintenance in progress. Inference queues paused.',
        estimatedRestore: updates?.estimatedRestore || 'Under review',
        lastUpdated: timestamp,
        lastUpdatedBy: user,
      }));
      const newAudit: ServiceAuditEntry = {
        id: `sa-${Date.now()}`,
        timestamp,
        serviceId: 'all',
        serviceName: 'All Services',
        action: 'bulk_action',
        changeDescription: 'Triggered Emergency Maintenance: Temporarily closed all AI diagnostic services.',
        performedBy: user,
        role,
      };
      currentAuditLogs = [newAudit, ...currentAuditLogs.slice(0, 49)];
      return NextResponse.json({ success: true, data: { services: currentServices, auditLogs: currentAuditLogs } });
    }

    if (action === 'bulk_restore_all') {
      currentServices = currentServices.map((s) => ({
        ...s,
        status: 'active' as ServiceStatus,
        isListedOnHomepage: true,
        lastUpdated: timestamp,
        lastUpdatedBy: user,
      }));
      const newAudit: ServiceAuditEntry = {
        id: `sa-${Date.now()}`,
        timestamp,
        serviceId: 'all',
        serviceName: 'All Services',
        action: 'bulk_action',
        changeDescription: 'Restored all services to Active (Online) and Listed on Homepage.',
        performedBy: user,
        role,
      };
      currentAuditLogs = [newAudit, ...currentAuditLogs.slice(0, 49)];
      return NextResponse.json({ success: true, data: { services: currentServices, auditLogs: currentAuditLogs } });
    }

    // 2. Single service update
    if (serviceId) {
      const idx = currentServices.findIndex((s) => s.id === serviceId);
      if (idx === -1) {
        return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
      }

      const existing = currentServices[idx];
      const updated: ServiceConfig = {
        ...existing,
        ...updates,
        lastUpdated: timestamp,
        lastUpdatedBy: user,
      };

      currentServices[idx] = updated;

      let changeDesc = 'Updated service parameters.';
      if (updates.status !== undefined && updates.status !== existing.status) {
        changeDesc = `Changed status from '${existing.status}' to '${updates.status}' (${updates.status === 'active' ? 'Reopened' : 'Temporarily Closed'}).`;
      } else if (updates.isListedOnHomepage !== undefined && updates.isListedOnHomepage !== existing.isListedOnHomepage) {
        changeDesc = updates.isListedOnHomepage
          ? 'Listed service on Homepage (visible in Pathways).'
          : 'Unlisted service from Homepage (hidden from public visitors).';
      } else if (updates.maintenanceNotice) {
        changeDesc = `Updated maintenance notice: "${updates.maintenanceNotice}".`;
      }

      const newAudit: ServiceAuditEntry = {
        id: `sa-${Date.now()}`,
        timestamp,
        serviceId: existing.id,
        serviceName: existing.name,
        action: updates.status ? 'status_change' : updates.isListedOnHomepage !== undefined ? 'homepage_visibility' : 'notice_update',
        changeDescription: changeDesc,
        performedBy: user,
        role,
      };

      currentAuditLogs = [newAudit, ...currentAuditLogs.slice(0, 49)];

      return NextResponse.json({
        success: true,
        data: {
          service: updated,
          services: currentServices,
          auditLogs: currentAuditLogs,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
