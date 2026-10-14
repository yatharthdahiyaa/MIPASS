import React, { useState, useEffect } from 'react';
import { iamApi } from '../../api/iam';
import { IamPolicy } from '../../types/iam';
import { Can } from '../../components/common/Can';
import { Modal } from '../../components/common/Modal';
import {
  FileCode,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Copy,
  Check,
  Eye,
} from 'lucide-react';

export function PoliciesPage() {
  const [policies, setPolicies] = useState<IamPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // View Policy JSON Modal State
  const [viewPolicy, setViewPolicy] = useState<IamPolicy | null>(null);
  const [copied, setCopied] = useState(false);

  // Create Policy Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [policyName, setPolicyName] = useState('');
  const [policyDesc, setPolicyDesc] = useState('');
  const [policyJson, setPolicyJson] = useState(
    JSON.stringify(
      {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['users:read', 'billing:*'],
            Resource: ['*'],
          },
        ],
      },
      null,
      2
    )
  );
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete Policy State
  const [targetPolicy, setTargetPolicy] = useState<IamPolicy | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchPolicies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await iamApi.getPolicies();
      if (res.success) setPolicies(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load policies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    let parsedDocument: any;
    try {
      parsedDocument = JSON.parse(policyJson);
      if (!parsedDocument.Statement || !Array.isArray(parsedDocument.Statement)) {
        throw new Error("Policy must contain a 'Statement' array.");
      }
    } catch (parseErr: any) {
      setCreateError(`Invalid JSON Document: ${parseErr.message}`);
      setCreateLoading(false);
      return;
    }

    try {
      const res = await iamApi.createPolicy({
        name: policyName.trim(),
        description: policyDesc.trim(),
        document: parsedDocument,
      });

      if (res.success) {
        setIsCreateOpen(false);
        setPolicyName('');
        setPolicyDesc('');
        fetchPolicies();
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create policy.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (!targetPolicy) return;
    setDeleteLoading(true);

    try {
      await iamApi.deletePolicy(targetPolicy.id);
      setIsDeleteOpen(false);
      setTargetPolicy(null);
      fetchPolicies();
    } catch (err: any) {
      alert(err.message || 'Failed to delete policy.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (viewPolicy) {
      navigator.clipboard.writeText(JSON.stringify(viewPolicy.document, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredPolicies = policies.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <FileCode className="w-6 h-6 text-emerald-500" />
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              IAM Policies
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            An IAM policy is an object in AWS that, when associated with an identity or resource, defines its permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPolicies}
            title="Refresh policies"
            className="p-2 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Can action="policies:create">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="py-2 px-3.5 bg-aws-orange hover:bg-aws-orangeHover text-black text-xs font-extrabold rounded shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create policy
            </button>
          </Can>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 dark:text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-3 bg-white dark:bg-aws-darkCard p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filter policies by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs text-gray-900 dark:text-white focus:outline-none"
        />
        <span className="text-[11px] text-gray-400 whitespace-nowrap">
          {filteredPolicies.length} polic{filteredPolicies.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4 font-bold">Policy name</th>
                <th className="py-3 px-4 font-bold">Type</th>
                <th className="py-3 px-4 font-bold">Description</th>
                <th className="py-3 px-4 font-bold">Statement Summary</th>
                <th className="py-3 px-4 font-bold">Attached Roles</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-aws-orange border-t-transparent rounded-full animate-spin" />
                      <span>Loading policies...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPolicies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 text-xs">
                    No policies found.
                  </td>
                </tr>
              ) : (
                filteredPolicies.map((p) => {
                  const statements = p.document?.Statement || [];
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setViewPolicy(p)}
                          className="font-bold text-aws-blue dark:text-cyan-400 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                        >
                          <FileCode className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span>{p.name}</span>
                        </button>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {p.id.slice(0, 8)}...</div>
                      </td>
                      <td className="py-3 px-4">
                        {p.isSystem ? (
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-black border border-purple-300 dark:border-purple-800 inline-flex items-center gap-1">
                            <Shield className="w-3 h-3" /> AWS Managed
                          </span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded font-bold">
                            Customer Managed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {p.description || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {statements.map((s: any, idx: number) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                s.Effect === 'Allow'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                              }`}
                            >
                              {s.Effect}: {Array.isArray(s.Action) ? s.Action.join(', ') : s.Action}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                        {p.attachedRolesCount} role{p.attachedRolesCount === 1 ? '' : 's'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setViewPolicy(p)}
                            title="View JSON Document"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {!p.isSystem && (
                            <Can action="policies:delete" fallback="disable">
                              <button
                                onClick={() => {
                                  setTargetPolicy(p);
                                  setIsDeleteOpen(true);
                                }}
                                title="Delete Policy"
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </Can>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW POLICY JSON MODAL */}
      <Modal
        isOpen={!!viewPolicy}
        onClose={() => setViewPolicy(null)}
        title={`Policy Document: ${viewPolicy?.name}`}
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">{viewPolicy?.description}</span>
            <button
              onClick={handleCopyJson}
              className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded flex items-center gap-1.5 cursor-pointer font-semibold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </div>

          <pre className="bg-gray-900 text-emerald-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96 border border-gray-800 select-all leading-relaxed">
            {viewPolicy ? JSON.stringify(viewPolicy.document, null, 2) : ''}
          </pre>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setViewPolicy(null)}
              className="px-4 py-2 bg-aws-navy text-white rounded font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* CREATE POLICY MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New IAM Policy"
        maxWidth="lg"
      >
        <form onSubmit={handleCreatePolicy} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 font-semibold">
              {createError}
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Policy name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. EC2ReadOnlyAccess"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="Grants read access to EC2 instances..."
              value={policyDesc}
              onChange={(e) => setPolicyDesc(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-gray-700 dark:text-gray-300">
                Policy Document (JSON)
              </label>
              <span className="text-[10px] text-gray-400 font-mono">
                Syntax: Version, Statement [Effect, Action, Resource]
              </span>
            </div>
            <textarea
              rows={9}
              required
              value={policyJson}
              onChange={(e) => setPolicyJson(e.target.value)}
              className="w-full p-3 font-mono text-xs border border-gray-300 dark:border-gray-700 rounded bg-gray-900 text-emerald-400 focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading || !policyName.trim()}
              className="px-4 py-2 bg-aws-orange hover:bg-aws-orangeHover text-black rounded font-extrabold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {createLoading ? 'Validating...' : 'Create Policy'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete IAM Policy"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete policy{' '}
            <strong className="text-red-600 font-bold">{targetPolicy?.name}</strong>? It will be detached from all roles automatically.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeletePolicy}
              disabled={deleteLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {deleteLoading ? 'Deleting...' : 'Delete Policy'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
