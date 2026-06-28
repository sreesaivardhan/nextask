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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            📊 Weekly AI Digest
          </h2>
          <div className="flex items-center gap-3">
            {canGenerate && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Now'}
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-xl leading-none">&times;</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading digest...</div>
          ) : !digest ? (
            <div className="text-center py-8 text-gray-500">
              <p>No digest has been generated yet for this board.</p>
              {canGenerate && <p className="mt-2">Click "Generate Now" to create one.</p>}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-sm text-gray-500 text-right">
                Generated: {new Date(digest.generatedAt).toLocaleString()}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Velocity</div>
                  <div className="text-2xl font-black text-blue-900">{digest.currentVelocity.toFixed(1)} <span className="text-sm font-normal text-blue-700">cards/day</span></div>
                  <div className="text-xs text-blue-800 mt-1">Trend: <strong>{digest.velocityTrend}</strong></div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">Completed</div>
                  <div className="text-2xl font-black text-green-900">{digest.cardsCompleted}</div>
                  <div className="text-xs text-green-800 mt-1">Last 7 days</div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <div className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">Created</div>
                  <div className="text-2xl font-black text-purple-900">{digest.cardsCreated}</div>
                  <div className="text-xs text-purple-800 mt-1">Last 7 days</div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                  <div className="text-orange-600 text-xs font-bold uppercase tracking-wider mb-1">Active WIP</div>
                  <div className="text-2xl font-black text-orange-900">{digest.currentWIP}</div>
                  <div className="text-xs text-orange-800 mt-1">Unfinished tasks</div>
                </div>
              </div>

              {digest.recommendations && digest.recommendations.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    💡 AI Recommendations
                  </h3>
                  <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
                    {digest.recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-purple-500 shrink-0 mt-0.5">•</span>
                        <p className="text-gray-700 text-sm leading-relaxed">{rec}</p>
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
