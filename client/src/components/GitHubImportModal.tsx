import { useState } from 'react';
import { api } from '../services/api';
import { useToastStore } from '../stores/toastStore';

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

interface PreviewResult {
  repo: string;
  totalOpenIssues: number;
  importLimit: number;
  skippedCount: number;
  importableCount: number;
  pullRequestsIgnored: number;
  sampleIssues: {
    number: number;
    title: string;
    labels: { name: string; color: string }[];
    assignee: string | null;
    milestone: string | null;
    createdAt: string;
  }[];
}

export function GitHubImportModal({ isOpen, onClose, boardId }: GitHubImportModalProps) {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<'input' | 'validating' | 'fetching' | 'preparing_preview' | 'preview' | 'importing' | 'creating_cards' | 'running_ai' | 'completed'>('input');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ importedCount: number; skippedCount: number; pullRequestsIgnored: number } | null>(null);
  
  const { addToast } = useToastStore();

  const isValidUrl = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.trim());

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    if (error) setError('');
  };

  const handlePreview = async () => {
    setError('');
    const trimmedUrl = url.trim();
    if (!isValidUrl) {
      return;
    }
    
    try {
      setStep('validating');
      setTimeout(() => { if (step === 'validating') setStep('fetching'); }, 500);
      setTimeout(() => { if (step === 'fetching') setStep('preparing_preview'); }, 1500);
      const data = await api.post(`/boards/${boardId}/github/preview`, { url: trimmedUrl });
      setPreview(data as PreviewResult);
      setStep('preview');
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setStep('input');
      setError(errorObj.message || 'Failed to fetch preview');
    }
  };

  const handleImport = async () => {
    setError('');
    try {
      setStep('importing');
      setTimeout(() => { if (step === 'importing') setStep('creating_cards'); }, 1000);
      
      const data = await api.post(`/boards/${boardId}/github/import`, { url: url.trim() });
      
      setStep('running_ai');
      
      setTimeout(() => {
        setImportResult(data as { importedCount: number; skippedCount: number; pullRequestsIgnored: number });
        setStep('completed');
        addToast(`Successfully imported ${(data as { importedCount: number }).importedCount} issues.`, 'success');
      }, 1500);

    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setStep('preview');
      setError(errorObj.message || 'Failed to import issues');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={['input', 'preview', 'completed'].includes(step) ? onClose : undefined} />
      <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary">Import from GitHub</h2>
          {['input', 'preview', 'completed'].includes(step) && (
            <button onClick={onClose} className="text-muted hover:text-secondary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 bg-status-danger/5 text-status-danger border border-status-danger/20 p-3 rounded-xl text-sm flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Public Repository URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={handleUrlChange}
                  placeholder="https://github.com/facebook/react"
                  className="w-full border border-strong rounded-2xl p-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && isValidUrl && handlePreview()}
                />
                <p className="text-xs text-muted mt-2">
                  Only open issues (excluding pull requests) will be imported. Ensure the repository is public.
                </p>
              </div>
            </div>
          )}

          {step === 'validating' && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <svg className="animate-spin h-8 w-8 text-primary-accent mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Validating Repository...</p>
            </div>
          )}

          {step === 'fetching' && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <svg className="animate-spin h-8 w-8 text-primary-accent mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Fetching Issues...</p>
            </div>
          )}

          {step === 'preparing_preview' && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <svg className="animate-spin h-8 w-8 text-primary-accent mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Preparing Preview...</p>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-6">
              <div className="bg-background p-4 rounded-2xl border border">
                <h3 className="text-lg font-bold text-primary mb-2">{preview.repo}</h3>
                <ul className="text-sm space-y-1 text-secondary">
                  <li><span className="font-medium">Total Open Issues:</span> {preview.totalOpenIssues}</li>
                  <li><span className="font-medium">Import Limit:</span> {preview.importLimit}</li>
                  <li><span className="font-medium text-status-success">Eligible Issues:</span> {preview.importableCount}</li>
                  <li><span className="font-medium">Skipped Existing:</span> {preview.skippedCount}</li>
                  <li><span className="font-medium text-muted">Pull Requests Ignored:</span> {preview.pullRequestsIgnored}</li>
                </ul>
              </div>

              {preview.importableCount > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">Preview</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2 border border rounded-2xl p-2 bg-background/50">
                    {preview.sampleIssues.map((issue) => (
                      <div key={issue.number} className="bg-surface p-3 rounded-xl shadow-subtle border border text-sm">
                        <div className="flex gap-2 items-start mb-1">
                          <span className="text-muted font-mono">#{issue.number}</span>
                          <span className="font-medium text-primary line-clamp-2">{issue.title}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {issue.labels.map(l => (
                            <span key={l.name} className="px-2 py-0.5 rounded-xl text-xs font-medium border" style={{ backgroundColor: `#${l.color}20`, borderColor: `#${l.color}40`, color: `#${l.color}` }}>
                              {l.name}
                            </span>
                          ))}
                          {issue.assignee && (
                            <span className="px-2 py-0.5 rounded-xl text-xs font-medium bg-surface text-primary-accent border border-primary">
                              @{issue.assignee}
                            </span>
                          )}
                          {issue.milestone && (
                            <span className="px-2 py-0.5 rounded-xl text-xs font-medium bg-status-warning/5 text-status-warning border border-status-warning/20">
                              {issue.milestone}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {preview.importableCount > preview.sampleIssues.length && (
                      <div className="text-center py-2 text-xs text-muted font-medium">
                        + {preview.importableCount - preview.sampleIssues.length} more issues
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <svg className="animate-spin h-8 w-8 text-primary-accent mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Importing Issues...</p>
            </div>
          )}

          {step === 'creating_cards' && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <svg className="animate-spin h-8 w-8 text-primary-accent mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Creating Cards...</p>
            </div>
          )}

          {step === 'running_ai' && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <svg className="animate-spin h-8 w-8 text-primary-accent mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Running AI Analysis...</p>
            </div>
          )}

          {step === 'completed' && importResult && (
            <div className="flex flex-col items-center justify-center py-12 text-primary">
              <div className="w-12 h-12 bg-status-success/5 text-status-success border border-status-success/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-medium text-lg mb-4">Completed</p>
              <div className="bg-background p-4 rounded-2xl w-full max-w-sm border border">
                <ul className="text-sm space-y-2">
                  <li className="flex justify-between"><span className="text-secondary">Imported:</span><span className="font-bold">{importResult.importedCount}</span></li>
                  <li className="flex justify-between"><span className="text-secondary">Skipped:</span><span className="font-bold">{importResult.skippedCount}</span></li>
                  <li className="flex justify-between"><span className="text-secondary">Pull Requests Ignored:</span><span className="font-bold">{importResult.pullRequestsIgnored}</span></li>
                  <li className="flex justify-between"><span className="text-secondary">Existing Cards:</span><span className="font-bold">{importResult.skippedCount}</span></li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border flex justify-end gap-3 bg-background rounded-b-xl">
          {['input', 'preview', 'completed'].includes(step) && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-secondary hover:bg-elevated rounded-2xl transition"
            >
              Cancel
            </button>
          )}
          
          {step === 'input' && (
            <button
              onClick={handlePreview}
              disabled={!isValidUrl || !!error}
              className="px-4 py-2 text-sm font-medium bg-primary text-inverse hover:bg-primary-hover text-inverse rounded-2xl transition shadow-subtle disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview Issues
            </button>
          )}

          {step === 'preview' && (
            <button
              onClick={handleImport}
              disabled={preview?.importableCount === 0}
              className="px-4 py-2 text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition rounded-2xl shadow-subtle disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {preview?.importableCount ? `Import ${preview.importableCount} Issues` : 'Import 0 Issues'}
            </button>
          )}
          
          {step === 'completed' && importResult && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium bg-primary text-inverse hover:bg-primary-hover text-inverse rounded-2xl transition shadow-subtle"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
