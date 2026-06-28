import { BarChart3 , Lightbulb } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import { socketService } from '../services/socketService';

interface WeeklyDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  canGenerate: boolean;
}

interface WeeklyDigest {
  id: string;
  boardId: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  cardsCreated: number;
  cardsCompleted: number;
  currentVelocity: number;
  velocityTrend: string;
  currentWIP: number;
  topBottleneck: Record<string, unknown> | null;
  riskSummary: Record<string, unknown> | null;
  recommendations: string[];
}

export function WeeklyDigestModal({ isOpen, onClose, boardId, canGenerate }: WeeklyDigestModalProps) {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setLoading(true);
      setDigest(null);
    }
  }

  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      api.get(`/ai/digest/${boardId}`)
        .then((res) => {
          if (!ignore) setDigest(res as WeeklyDigest);
        })
        .catch((err: unknown) => {
          if (!ignore) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch digest';
            addToast(errorMessage, 'error');
          }
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, boardId, addToast]);

  useEffect(() => {
    if (!isOpen) return;
    
    const socket = socketService.getSocket();
    if (!socket) return;
    
    const onDigestGenerated = ({ boardId: eventBoardId, digest: digestStr }: { boardId: string, digest: string }) => {
      if (eventBoardId === boardId) {
        try {
          const parsedDigest = JSON.parse(digestStr) as WeeklyDigest;
          setDigest(parsedDigest);
          setGenerating(false);
          addToast('New weekly digest generated', 'success');
        } catch (e) {
          console.error("Failed to parse digest", e);
        }
      }
    };
    
    socket.on('ai:digest', onDigestGenerated);
    return () => {
      socket.off('ai:digest', onDigestGenerated);
    };
  }, [isOpen, boardId, addToast]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await api.post(`/ai/digest/${boardId}/generate`);
    } catch (err: unknown) {
      setGenerating(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate digest';
      addToast(errorMessage, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-floating border border-strong w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-accent" /> Weekly AI Digest
          </h2>
          <div className="flex items-center gap-3">
            {canGenerate && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-primary text-inverse px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Now'}
              </button>
            )}
            <button onClick={onClose} className="text-muted hover:text-primary font-bold text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-elevated transition-colors">&times;</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12 text-muted">Loading digest...</div>
          ) : !digest ? (
            <div className="text-center py-12 text-muted">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-secondary">No digest generated yet.</p>
              {canGenerate && <p className="mt-1 text-sm">Click "Generate Now" to create one.</p>}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-xs text-muted text-right">
                Generated: {new Date(digest.generatedAt).toLocaleString()}
              </div>

              {/* Stat Cards — neutral surface, coloured left border only */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DigestStatCard
                  label="Velocity"
                  value={`${digest.currentVelocity.toFixed(1)}`}
                  unit="cards/day"
                  sub={`Trend: ${digest.velocityTrend}`}
                  accentClass="border-l-primary"
                />
                <DigestStatCard
                  label="Completed"
                  value={String(digest.cardsCompleted)}
                  sub="Last 7 days"
                  accentClass="border-l-status-success"
                />
                <DigestStatCard
                  label="Created"
                  value={String(digest.cardsCreated)}
                  sub="Last 7 days"
                  accentClass="border-l-primary"
                />
                <DigestStatCard
                  label="Active WIP"
                  value={String(digest.currentWIP)}
                  sub="Unfinished tasks"
                  accentClass="border-l-status-warning"
                />
              </div>

              {digest.recommendations && digest.recommendations.length > 0 && (
                <div>
                  <h3 className="font-bold text-primary mb-3 flex items-center gap-2 text-sm">
                    <Lightbulb className="w-4 h-4 text-status-warning" /> AI Recommendations
                  </h3>
                  <div className="bg-elevated border border rounded-xl p-4 space-y-3">
                    {digest.recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-primary-accent shrink-0 mt-0.5 font-bold">&bull;</span>
                        <p className="text-secondary text-sm leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat card with neutral bg — readable in light & dark mode
function DigestStatCard({
  label, value, unit, sub, accentClass
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accentClass: string;
}) {
  return (
    <div className={`bg-surface p-4 rounded-xl border-l-2 border border ${accentClass} shadow-subtle`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">{label}</div>
      <div className="text-xl font-black text-primary">
        {value}
        {unit && <span className="text-sm font-normal text-secondary ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
