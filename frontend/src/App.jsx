import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import OverviewPage from './components/OverviewPage';
import AskPage from './components/AskPage';
import CaseLibraryPage from './components/CaseLibraryPage';
import ResearchPage from './components/ResearchPage';
import CaseDetail from './components/CaseDetail';
import UploadDialog from './components/UploadDialog';
import CommandPalette from './components/CommandPalette';
import Toast from './components/Toast';
import { CASE_BY_ID } from './data/library';
import {
  PROFILE,
  TEST_PROFILE,
  DEFAULT_COLLECTIONS,
  EMPTY_ACTIVITY,
  EMPTY_RESEARCH,
  TEST_MOCK_ACTIVITY,
  TEST_MOCK_RESEARCH,
} from './data/workspace';
import { askLegal, checkHealth } from './lib/api';
import { loadJSON, saveJSON, uid } from './lib/storage';

function shortQuestion(question) {
  return question.length > 52 ? `${question.slice(0, 52).trimEnd()}…` : question;
}

export default function App() {
  /* ── Navigation & overlays ─────────────────────────────────── */
  const [page, setPage] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [researchFocus, setResearchFocus] = useState(null);
  const [toast, setToast] = useState('');

  /* ── Test Mode Switch ───────────────────────────────────────── */
  // Default is false (Live Mode = zero dummy data)
  const [testMode, setTestMode] = useState(() => loadJSON('testMode', false));

  /* ── Workspace data (Clean live by default, mock in test mode) ─ */
  const [collections, setCollections] = useState(() => loadJSON('collections', DEFAULT_COLLECTIONS));
  const [activeCollection, setActiveCollection] = useState(null);
  const [liveSaved, setLiveSaved] = useState(() => loadJSON('research_live', EMPTY_RESEARCH));
  const [liveActivity, setLiveActivity] = useState(() => loadJSON('activity_live', EMPTY_ACTIVITY));
  const [promoVisible, setPromoVisible] = useState(() => loadJSON('promoVisible', true));
  const [mode, setMode] = useState(() => loadJSON('mode', 'auto'));

  // Active data derived from testMode toggle
  const saved = useMemo(() => (testMode ? TEST_MOCK_RESEARCH : liveSaved), [testMode, liveSaved]);
  const activity = useMemo(() => (testMode ? TEST_MOCK_ACTIVITY : liveActivity), [testMode, liveActivity]);
  const profile = useMemo(() => (testMode ? TEST_PROFILE : PROFILE), [testMode]);

  /* ── Research thread ───────────────────────────────────────── */
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [savedMessageIds, setSavedMessageIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');

  /* ── Persistence ───────────────────────────────────────────── */
  useEffect(() => {
    saveJSON('testMode', testMode);
  }, [testMode]);
  useEffect(() => {
    saveJSON('collections', collections);
  }, [collections]);
  useEffect(() => {
    saveJSON('research_live', liveSaved);
  }, [liveSaved]);
  useEffect(() => {
    saveJSON('activity_live', liveActivity);
  }, [liveActivity]);
  useEffect(() => {
    saveJSON('promoVisible', promoVisible);
  }, [promoVisible]);
  useEffect(() => {
    saveJSON('mode', mode);
  }, [mode]);

  /* ── API health ────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    const probe = () => {
      checkHealth().then((result) => {
        if (alive) setApiStatus(result.ok ? 'online' : 'offline');
      });
    };
    probe();
    const interval = setInterval(probe, 6000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  /* ── Toast auto-dismiss ────────────────────────────────────── */
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  /* ── Keyboard shortcuts ────────────────────────────────────── */
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setUploadOpen(false);
        setSelectedCaseId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ── Helpers ───────────────────────────────────────────────── */
  const showToast = useCallback((message) => setToast(message), []);

  const toggleTestMode = useCallback(() => {
    setTestMode((prev) => {
      const next = !prev;
      showToast(
        next
          ? 'Switched to Test UI Mode (Showing demo cards & mock scenario fallback)'
          : 'Switched to Clean Live Mode (Real backend connection with clean workspace)'
      );
      return next;
    });
  }, [showToast]);

  const recordActivity = useCallback((kind, { text, emphasis, caseId }) => {
    const item = { id: uid(), kind, text, emphasis, caseId, time: 'Just now', at: Date.now() };
    setLiveActivity((previous) => [item, ...previous].slice(0, 24));
  }, []);

  const navigate = useCallback((nextPage) => {
    setPage(nextPage);
    if (nextPage !== 'research') setActiveCollection(null);
    setSidebarOpen(false);
    setPaletteOpen(false);
  }, []);

  const openCase = useCallback(
    (caseId) => {
      const caseItem = CASE_BY_ID[caseId];
      if (!caseItem) return;
      setSelectedCaseId(caseId);
      recordActivity('opened', { text: 'Opened', emphasis: caseItem.title, caseId });
    },
    [recordActivity],
  );

  const openResearchItem = useCallback((id) => {
    setResearchFocus(id);
    setPage('research');
    setSidebarOpen(false);
  }, []);

  /* ── Ask InLeagle ──────────────────────────────────────────── */
  const ask = useCallback(
    async (rawQuestion) => {
      const question = String(rawQuestion ?? '').trim();

      if (!question) {
        setPage('ask');
        setPaletteOpen(false);
        setSidebarOpen(false);
        return;
      }

      if (loading) return;

      setPage('ask');
      setPaletteOpen(false);
      setSidebarOpen(false);

      const userMessageId = uid();
      const botMessageId = uid();
      const priorHistory = history;

      setMessages((previous) => [
        ...previous,
        { id: userMessageId, role: 'user', text: question },
        {
          id: botMessageId,
          role: 'bot',
          text: '',
          citations: [],
          sources: [],
          mode,
          pending: true,
        },
      ]);
      setHistory([...priorHistory, { role: 'user', content: question }]);
      setLoading(true);
      recordActivity('search', { text: 'Asked InLeagle', emphasis: `“${shortQuestion(question)}”` });

      try {
        const result = await askLegal({
          query: question,
          mode,
          history: priorHistory,
          isTestMode: testMode,
        });
        const answer = result.answer?.trim();

        setMessages((previous) =>
          previous.map((message) =>
            message.id === botMessageId
              ? {
                  ...message,
                  text: answer || 'InLeagle returned an empty answer. Try rephrasing the question.',
                  citations: result.citations ?? [],
                  sources: result.sources ?? [],
                  mode: result.mode,
                  pending: false,
                  error: !answer,
                }
              : message,
          ),
        );
        setHistory((previous) => [...previous, { role: 'assistant', content: result.answer }]);
      } catch (error) {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === botMessageId
              ? { ...message, text: error.message, pending: false, error: true, citations: [], sources: [] }
              : message,
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [history, loading, mode, recordActivity, testMode],
  );

  /* ── Saving ────────────────────────────────────────────────── */
  const saveMessage = useCallback(
    (message) => {
      if (savedMessageIds.includes(message.id)) return;

      const index = messages.findIndex((entry) => entry.id === message.id);
      const question =
        [...messages.slice(0, index)].reverse().find((entry) => entry.role === 'user')?.text ??
        'Saved answer';

      const newItem = {
        id: uid(),
        question,
        answer: message.text,
        citations: message.citations ?? [],
        status: 'saved',
        mode: message.mode ?? mode,
        collectionId: activeCollection ?? null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setLiveSaved((previous) => [newItem, ...previous]);
      setSavedMessageIds((previous) => [...previous, message.id]);
      recordActivity('saved', { text: 'Saved', emphasis: `“${shortQuestion(question)}”` });
      showToast('Saved to My Research');
    },
    [activeCollection, messages, mode, recordActivity, savedMessageIds, showToast],
  );

  const saveCase = useCallback(
    (caseItem) => {
      if (saved.some((item) => item.caseId === caseItem.id)) return;

      const newItem = {
        id: uid(),
        caseId: caseItem.id,
        question: `Holding in ${caseItem.title}`,
        answer: `${caseItem.summary}\n\nKey provisions: ${caseItem.provisions.join(', ')}`,
        citations: [caseItem.citation, ...caseItem.provisions],
        status: 'saved',
        mode: 'legal',
        collectionId: activeCollection ?? null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setLiveSaved((previous) => [newItem, ...previous]);
      recordActivity('saved', { text: 'Saved landmark case', emphasis: caseItem.title, caseId: caseItem.id });
      showToast('Case saved to My Research');
    },
    [activeCollection, recordActivity, saved, showToast],
  );

  const deleteSaved = useCallback(
    (id) => {
      setLiveSaved((previous) => previous.filter((item) => item.id !== id));
      showToast('Removed from research');
    },
    [showToast],
  );

  const createCollection = useCallback(
    (name) => {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || uid();
      if (collections.some((c) => c.id === id)) {
        showToast('A collection with this name already exists');
        return;
      }
      setCollections((previous) => [...previous, { id, name }]);
      showToast(`Created collection “${name}”`);
    },
    [collections, showToast],
  );

  const resetConversation = useCallback(() => {
    setMessages([]);
    setHistory([]);
    setSavedMessageIds([]);
    showToast('Conversation cleared');
  }, [showToast]);

  /* ── Recent items for the overview ─────────────────────────── */
  const recent = useMemo(() => {
    const fromSaved = saved.slice(0, 3).map((item) => ({
      id: item.id,
      kind: 'research',
      label: item.status === 'draft' ? 'Draft' : 'Research',
      title: item.question,
      meta: `${item.citations?.length ?? 0} citations`,
      item,
    }));
    return fromSaved;
  }, [saved]);

  const selectedCase = selectedCaseId ? CASE_BY_ID[selectedCaseId] : null;
  const caseSaved = selectedCase ? saved.some((item) => item.caseId === selectedCase.id) : false;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        page={page}
        onNavigate={navigate}
        collections={collections}
        activeCollection={activeCollection}
        onOpenCollection={(id) => {
          setActiveCollection(id);
          setPage('research');
          setResearchFocus(null);
          setSidebarOpen(false);
        }}
        onCreateCollection={createCollection}
        promoVisible={promoVisible}
        onDismissPromo={() => setPromoVisible(false)}
      />

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <TopBar
          onOpenSearch={() => setPaletteOpen(true)}
          onMenuOpen={() => setSidebarOpen(true)}
          apiStatus={apiStatus}
          testMode={testMode}
          onToggleTestMode={toggleTestMode}
          profile={profile}
        />

        <main className="min-h-0 flex-1 overflow-hidden">
          {page === 'overview' && (
            <div className="h-full overflow-y-auto">
              <OverviewPage
                profile={profile}
                activity={activity}
                recent={recent}
                onAsk={ask}
                onUpload={() => setUploadOpen(true)}
                onOpenCase={openCase}
                onOpenResearch={openResearchItem}
                onViewHistory={() => navigate('research')}
                onClearActivity={() => {
                  setLiveActivity([]);
                  showToast('Activity cleared');
                }}
              />
            </div>
          )}

          {page === 'ask' && (
            <AskPage
              messages={messages}
              loading={loading}
              mode={mode}
              onModeChange={setMode}
              onAsk={ask}
              onSave={saveMessage}
              onReset={resetConversation}
              savedIds={savedMessageIds}
            />
          )}

          {page === 'library' && (
            <div className="h-full overflow-y-auto">
              <CaseLibraryPage onOpenCase={openCase} />
            </div>
          )}

          {page === 'research' && (
            <div className="h-full overflow-y-auto">
              <ResearchPage
                items={saved}
                collections={collections}
                activeCollection={activeCollection}
                focusId={researchFocus}
                onFocusHandled={() => setResearchFocus(null)}
                onFilterCollection={(id) => {
                  setActiveCollection(id);
                  setResearchFocus(null);
                }}
                onOpenItem={(id) => setResearchFocus(id)}
                onAsk={ask}
                onDelete={deleteSaved}
                onBrowseLibrary={() => navigate('library')}
              />
            </div>
          )}
        </main>
      </div>

      {selectedCase && (
        <CaseDetail
          caseItem={selectedCase}
          saved={caseSaved}
          onClose={() => setSelectedCaseId(null)}
          onSaveCase={saveCase}
          onAskAboutCase={(caseItem) => {
            setSelectedCaseId(null);
            ask(`What does ${caseItem.title} decide, and what does it mean for a borrower today?`);
          }}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAsk={ask}
        onOpenCase={openCase}
        onNavigate={navigate}
      />

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <Toast message={toast} />
    </div>
  );
}
