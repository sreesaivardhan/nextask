import { useEffect, useState } from 'react';
import { Loader2, Plus, LogIn, ExternalLink, AlertCircle } from 'lucide-react';
import { authService, boardService, cardService, Board, Column, User, WEB_APP_URL } from '../services/api';
import { generateTitleFromSelection } from '../utils/extraction';
import { storage } from '../utils/storage';

export default function Popup() {
  const [status, setStatus] = useState<'loading' | 'unauthenticated' | 'authenticated' | 'error' | 'success'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const addError = (msg: string) => {
    setStatus('error');
    setErrorMsg(msg);
  };

  // Page Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');

  // Form State
  const [boards, setBoards] = useState<Board[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function initExtension() {
    try {
      const session = await authService.getSession();
      setUser(session);
      setStatus('authenticated');

      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB_INFO' }, (response) => {
          if (response && !response.error) {
            setReferenceUrl(response.url || '');
            if (response.selection) {
              setDescription(response.selection);
              setTitle(generateTitleFromSelection(response.selection) || response.title || 'New Task');
            } else {
              setTitle(response.title || 'New Task');
              setDescription(`Source: ${response.url || ''}`);
            }
          }
        });
      }

      const allBoards = await boardService.getBoards();
      setBoards(allBoards);
      const savedBoardId = await storage.get('lastBoardId');
      if (allBoards.length > 0) {
        const boardToSelect = allBoards.find(b => b.id === savedBoardId) ? savedBoardId : allBoards[0].id;
        setSelectedBoard(boardToSelect);
      }
    } catch (error: any) {
      if (error.response) {
        if (error.response.status === 401 || error.response.status === 403) {
          setStatus('unauthenticated');
        } else {
          setStatus('error');
          setErrorMsg(`Server error: ${error.response.status}`);
        }
      } else {
        setStatus('error');
        setErrorMsg('Network or timeout error');
      }
    }
  }

  useEffect(() => {
    initExtension();
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchColumns(boardId: string) {
      try {
        const cols = await boardService.getColumns(boardId);
        if (!active) return;
        setColumns(cols);
        const savedColId = await storage.get(`lastColumnId_${boardId}`);
        if (!active) return;
        
        if (cols.length > 0) {
          // If we already have a selected column that is valid for this board, keep it (prevents race condition resets)
          setSelectedColumn(prev => {
            if (prev && cols.some(c => c.id === prev)) return prev;
            return cols.find(c => c.id === savedColId) ? savedColId : cols[0].id;
          });
        } else {
          setSelectedColumn('');
        }
      } catch (err) {
        if (!active) return;
        setColumns([]);
        setSelectedColumn('');
        addError('Failed to load columns. The board might have been deleted.');
      }
    }

    if (selectedBoard) {
      fetchColumns(selectedBoard);
      storage.set('lastBoardId', selectedBoard);
    }

    return () => {
      active = false;
    };
  }, [selectedBoard]);

  const handleColumnChange = (colId: string) => {
    setSelectedColumn(colId);
    storage.set(`lastColumnId_${selectedBoard}`, colId);
  };

  const handleCreate = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await cardService.createCard({
        boardId: selectedBoard,
        columnId: selectedColumn,
        title,
        description,
        referenceUrl,
        creationSource: 'Chrome Extension',
      });
      // Success animation before close
      setStatus('success');
      setTimeout(() => window.close(), 1000);
    } catch (error: any) {
      console.error('Failed to create card:', error);
      setIsSubmitting(false);
      
      if (!error.response) {
        addError('Network error. Is the backend offline?');
        return;
      }
      
      const status = error.response.status;
      if (status === 401 || status === 403) {
        setStatus('unauthenticated');
      } else if (status === 404) {
        addError('Board or column not found. It may have been deleted.');
      } else if (status === 500) {
        addError('Server error (500). Please try again later.');
      } else {
        addError(error.response?.data?.error || 'Failed to create card.');
      }
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <span className="mt-2 text-sm text-textMuted">Loading NexTask...</span>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
        <div className="w-12 h-12 bg-surface-elevated rounded-full flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6 text-textMuted" />
        </div>
        <h2 className="text-textPrimary font-semibold mb-1">Not Authenticated</h2>
        <p className="text-sm text-textMuted mb-4">You are not logged in to NexTask.</p>
        <button
          onClick={() => window.open(`${WEB_APP_URL}/login`, '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-[#131313] rounded-[12px] text-sm font-medium hover:bg-accent-hover text-[#131313] dark:text-[#131313] text-white dark:text-[#131313] transition"
        >
          <LogIn className="w-4 h-4" />
          Open NexTask
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
        <AlertCircle className="w-8 h-8 text-danger mb-2" />
        <p className="text-sm text-danger">{errorMsg}</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-48 px-6 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-textPrimary font-bold text-lg">Task Created!</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 border-b border-subtle bg-surface flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-accent text-[#131313] rounded-[8px] flex items-center justify-center">
            <span className="text-textPrimary text-xs font-bold">N</span>
          </div>
          <span className="font-semibold text-textPrimary">NexTask</span>
        </div>
        <div className="text-xs text-textMuted truncate max-w-[120px]" title={user?.email}>
          {user?.displayName || user?.email}
        </div>
      </header>

      <main className="p-4 flex flex-col gap-4">
        {/* Title */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-textSecondary">Task Title</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-divider rounded-[12px] text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="E.g. Implement OAuth login"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-textSecondary flex items-center justify-between">
            <span>Description</span>
            {referenceUrl && (
              <a href={referenceUrl} target="_blank" rel="noreferrer" className="text-accent flex items-center gap-1 hover:underline">
                <ExternalLink className="w-3 h-3" />
                Source URL
              </a>
            )}
          </label>
          <textarea
            className="w-full px-3 py-2 border border-divider rounded-[12px] text-sm resize-none h-28 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Task description or selected text..."
          />
        </div>

        {/* Board & Column */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-medium text-textSecondary">Board</label>
            <select
              className="w-full px-2 py-2 border border-divider rounded-[12px] text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
            >
              {boards.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-medium text-textSecondary">Column</label>
            <select
              className="w-full px-2 py-2 border border-divider rounded-[12px] text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
              value={selectedColumn}
              onChange={(e) => handleColumnChange(e.target.value)}
              disabled={columns.length === 0}
            >
              {columns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!title || !selectedBoard || !selectedColumn || isSubmitting}
          className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 bg-accent text-[#131313] rounded-[12px] text-sm font-medium hover:bg-accent-hover text-[#131313] dark:text-[#131313] text-white dark:text-[#131313] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {isSubmitting ? 'Preparing...' : 'Create Card'}
        </button>
      </main>
    </div>
  );
}
