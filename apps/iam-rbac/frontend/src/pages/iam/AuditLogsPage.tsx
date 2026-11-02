import React, { useState, useEffect } from 'react';
import { iamApi } from '../../api/iam';
import { AuditLogItem } from '../../types/iam';
import { Modal } from '../../components/common/Modal';
import {
  Activity,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Eye,
  Calendar,
} from 'lucide-react';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [effectFilter, setEffectFilter] = useState('');
  const [search, setSearch] = useState('');

  // Selected Log Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await iamApi.getAuditLogs({
        page,
        limit: pagination.limit,
        action: actionFilter || undefined,
        effect: effectFilter || undefined,
      });

      if (res.success && res.data) {
        setLogs(res.data.logs);
        setPagination(res.data.pagination);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(pagination.page);
  }, [pagination.page, actionFilter, effectFilter]);

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.resource.toLowerCase().includes(q) ||
      (log.user?.username && log.user.username.toLowerCase().includes(q)) ||
      (log.ipAddress && log.ipAddress.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-aws-blue dark:text-cyan-400" />
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Access &amp; Audit Logs (AWS CloudTrail)
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Complete audit trail of authentication attempts, RBAC evaluations, and administrative API calls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(pagination.page)}
            title="Refresh logs"
            className="p-2 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 font-semibold text-xs">
          {error}
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white dark:bg-aws-darkCard p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm text-xs">
        <div className="flex items-center gap-2 col-span-1 md:col-span-2 bg-gray-50 dark:bg-gray-800/40 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search action, resource ARN, user, or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={effectFilter}
            onChange={(e) => {
              setEffectFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none"
          >
            <option value="">All Effects (ALLOW / DENY)</option>
            <option value="ALLOW">ALLOW only</option>
            <option value="DENY">DENY only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none"
          >
            <option value="">All Event Actions</option>
            <option value="auth:login_success">auth:login_success</option>
            <option value="auth:login_failed">auth:login_failed</option>
            <option value="auth:logout">auth:logout</option>
            <option value="users:create">users:create</option>
            <option value="users:delete">users:delete</option>
            <option value="roles:create">roles:create</option>
            <option value="policies:create">policies:create</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4 font-bold">Event Time (UTC)</th>
                <th className="py-3 px-4 font-bold">Event Name</th>
                <th className="py-3 px-4 font-bold">Decision</th>
                <th className="py-3 px-4 font-bold">User Identity</th>
                <th className="py-3 px-4 font-bold">Source IP</th>
                <th className="py-3 px-4 font-bold">Resource Target</th>
                <th className="py-3 px-4 font-bold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-aws-orange border-t-transparent rounded-full animate-spin" />
                      <span>Reading CloudTrail event stream...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No audit logs matching current filter parameters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const date = new Date(log.timestamp);
                  const formattedTime = `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`;

                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formattedTime}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {log.effect === 'ALLOW' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle className="w-3 h-3" /> ALLOW
                          </span>
                        ) : log.effect === 'DENY' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 px-2 py-0.5 rounded border border-red-300 dark:border-red-800">
                            <XCircle className="w-3 h-3" /> DENY
                          </span>
                        ) : log.effect === 'WARN' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3" /> WARN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-300 dark:border-blue-800">
                            <Info className="w-3 h-3" /> INFO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {log.user ? (
                          <div>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {log.user.username}
                            </span>
                            <span className="text-[10px] text-gray-400 block">{log.user.email}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unauthenticated / System</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-700 dark:text-gray-300 max-w-xs truncate">
                        {log.resource}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          title="View Event Record JSON"
                          className="p-1.5 text-aws-blue dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-xs">
          <span className="text-gray-500">
            Page {pagination.page} of {pagination.totalPages || 1} ({pagination.total} total events)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 bg-white dark:bg-black/40 border border-gray-300 dark:border-gray-700 rounded disabled:opacity-40 cursor-pointer font-semibold"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 bg-white dark:bg-black/40 border border-gray-300 dark:border-gray-700 rounded disabled:opacity-40 cursor-pointer font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* EVENT RECORD JSON MODAL */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Event Record: ${selectedLog?.action}`}
        maxWidth="lg"
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
            <div>
              <span className="text-gray-500 block text-[11px]">Event ID:</span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">{selectedLog?.id}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px]">Timestamp:</span>
              <span className="font-mono text-gray-900 dark:text-white">{selectedLog?.timestamp}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px]">Source IP:</span>
              <span className="font-mono text-gray-900 dark:text-white">{selectedLog?.ipAddress}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px]">User Agent:</span>
              <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate block">
                {selectedLog?.userAgent || 'Standard Browser'}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Event Details &amp; Payload JSON:
            </label>
            <pre className="bg-gray-900 text-emerald-400 p-3 rounded font-mono text-xs overflow-x-auto max-h-60 border border-gray-800">
              {selectedLog?.details ? JSON.stringify(selectedLog.details, null, 2) : '{\n  "status": "recorded"\n}'}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setSelectedLog(null)}
              className="px-4 py-2 bg-aws-navy text-white rounded font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
