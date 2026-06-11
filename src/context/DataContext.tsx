import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface Lookbook {
  id: string;
  name: string;
  person_name: string;
  photos: string[];
  color_palette: string[];
  is_public?: boolean;
  share_token?: string;
  created_at: string;
  updated_at: string;
}

interface HistoryItem {
  id: string;
  result_image: string;
  created_at: string;
  model_used?: string;
  saved_to_lookbook?: boolean;
  cost?: number;
}

interface ColorTypeHistory {
  id: string;
  cdn_url?: string;
  color_type: string;
  result_text: string;
  created_at: string;
  status: string;
}

interface KibbeHistory {
  id: string;
  user_name: string;
  height: number;
  dominance: string;
  winning_letter: string;
  kibbe_type: string;
  answers?: Record<string, string>;
  created_at: string;
  status: string;
}

interface DataContextType {
  lookbooks: Lookbook[];
  history: HistoryItem[];
  colorTypeHistory: ColorTypeHistory[];
  kibbeHistory: KibbeHistory[];
  isLoading: boolean;
  hasMoreHistory: boolean;
  isLoadingMoreHistory: boolean;
  hasMoreColorType: boolean;
  isLoadingMoreColorType: boolean;
  hasMoreKibbe: boolean;
  isLoadingMoreKibbe: boolean;
  hasMoreLookbooks: boolean;
  isLoadingMoreLookbooks: boolean;
  refetchLookbooks: () => Promise<void>;
  refetchHistory: () => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  loadMoreColorType: () => Promise<void>;
  loadMoreKibbe: () => Promise<void>;
  loadMoreLookbooks: () => Promise<void>;
  refetchColorTypeHistory: () => Promise<void>;
  refetchKibbeHistory: () => Promise<void>;
  refetchAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

const HISTORY_PAGE_SIZE = 15;
const COLOR_TYPE_PAGE_SIZE = 15;
const KIBBE_PAGE_SIZE = 15;
const LOOKBOOKS_PAGE_SIZE = 15;

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [colorTypeHistory, setColorTypeHistory] = useState<ColorTypeHistory[]>([]);
  const [kibbeHistory, setKibbeHistory] = useState<KibbeHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedLookbooks, setHasFetchedLookbooks] = useState(false);
  const [hasFetchedHistory, setHasFetchedHistory] = useState(false);
  const [hasFetchedColorTypeHistory, setHasFetchedColorTypeHistory] = useState(false);
  const [hasFetchedKibbeHistory, setHasFetchedKibbeHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMoreColorType, setHasMoreColorType] = useState(true);
  const [isLoadingMoreColorType, setIsLoadingMoreColorType] = useState(false);
  const [colorTypeOffset, setColorTypeOffset] = useState(0);
  const [hasMoreKibbe, setHasMoreKibbe] = useState(true);
  const [isLoadingMoreKibbe, setIsLoadingMoreKibbe] = useState(false);
  const [kibbeOffset, setKibbeOffset] = useState(0);
  const [hasMoreLookbooks, setHasMoreLookbooks] = useState(true);
  const [isLoadingMoreLookbooks, setIsLoadingMoreLookbooks] = useState(false);
  const [lookbooksOffset, setLookbooksOffset] = useState(0);

  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('session_token');
    
    if (!token) {
      console.error('[DataContext] Нет токена в localStorage при запросе данных!');
      throw new Error('Нет токена авторизации');
    }
    
    return {
      'Content-Type': 'application/json',
      'X-Session-Token': token
    };
  };

  const fetchLookbooks = async (reset = false) => {
    if (!user?.id) {
      setLookbooks([]);
      return;
    }

    const offset = reset ? 0 : lookbooksOffset;

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'select',
          where: { user_id: user.id },
          order_by: 'created_at DESC',
          limit: LOOKBOOKS_PAGE_SIZE + 1,
          offset: offset
        })
      });
      const result = await response.json();
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      
      const hasMore = data.length > LOOKBOOKS_PAGE_SIZE;
      const items = hasMore ? data.slice(0, LOOKBOOKS_PAGE_SIZE) : data;
      
      if (reset) {
        setLookbooks(items);
        setLookbooksOffset(LOOKBOOKS_PAGE_SIZE);
      } else {
        setLookbooks(prev => [...prev, ...items]);
        setLookbooksOffset(prev => prev + LOOKBOOKS_PAGE_SIZE);
      }
      
      setHasMoreLookbooks(hasMore);
      setHasFetchedLookbooks(true);
    } catch (error) {
      console.error('Error fetching lookbooks:', error);
      if (reset) {
        setLookbooks([]);
      }
    }
  };

  const fetchHistory = async (reset = false) => {
    if (!user?.id) {
      setHistory([]);
      return;
    }

    const offset = reset ? 0 : historyOffset;

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          table: 'try_on_history',
          action: 'select',
          columns: ['id', 'result_image', 'created_at', 'model_used', 'saved_to_lookbook', 'cost'],
          where: { user_id: user.id },
          order_by: 'created_at DESC',
          limit: HISTORY_PAGE_SIZE + 1,
          offset: offset
        })
      });
      const result = await response.json();
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      
      const hasMore = data.length > HISTORY_PAGE_SIZE;
      const items = hasMore ? data.slice(0, HISTORY_PAGE_SIZE) : data;
      
      if (reset) {
        setHistory(items);
        setHistoryOffset(HISTORY_PAGE_SIZE);
      } else {
        setHistory(prev => [...prev, ...items]);
        setHistoryOffset(prev => prev + HISTORY_PAGE_SIZE);
      }
      
      setHasMoreHistory(hasMore);
      setHasFetchedHistory(true);
    } catch (error) {
      console.error('Error fetching history:', error);
      if (reset) {
        setHistory([]);
      }
    }
  };

  const refetchLookbooks = async () => {
    await fetchLookbooks(true);
  };

  const loadMoreLookbooks = async () => {
    if (!hasMoreLookbooks || isLoadingMoreLookbooks) return;
    
    setIsLoadingMoreLookbooks(true);
    await fetchLookbooks(false);
    setIsLoadingMoreLookbooks(false);
  };

  const fetchColorTypeHistory = async (reset = false) => {
    if (!user?.id) {
      setColorTypeHistory([]);
      return;
    }

    const offset = reset ? 0 : colorTypeOffset;

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          table: 'color_type_history',
          action: 'select',
          columns: ['id', 'cdn_url', 'color_type', 'result_text', 'created_at', 'status'],
          where: { user_id: user.id, status: 'completed' },
          order_by: 'created_at DESC',
          limit: COLOR_TYPE_PAGE_SIZE + 1,
          offset: offset
        })
      });
      const result = await response.json();
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      
      const hasMore = data.length > COLOR_TYPE_PAGE_SIZE;
      const items = hasMore ? data.slice(0, COLOR_TYPE_PAGE_SIZE) : data;
      
      if (reset) {
        setColorTypeHistory(items);
        setColorTypeOffset(COLOR_TYPE_PAGE_SIZE);
      } else {
        setColorTypeHistory(prev => [...prev, ...items]);
        setColorTypeOffset(prev => prev + COLOR_TYPE_PAGE_SIZE);
      }
      
      setHasMoreColorType(hasMore);
      setHasFetchedColorTypeHistory(true);
    } catch (error) {
      console.error('Error fetching color type history:', error);
      if (reset) {
        setColorTypeHistory([]);
      }
    }
  };

  const refetchHistory = async () => {
    await fetchHistory(true);
  };

  const loadMoreHistory = async () => {
    if (!hasMoreHistory || isLoadingMoreHistory) return;
    
    setIsLoadingMoreHistory(true);
    await fetchHistory(false);
    setIsLoadingMoreHistory(false);
  };

  const refetchColorTypeHistory = async () => {
    await fetchColorTypeHistory(true);
  };

  const loadMoreColorType = async () => {
    if (!hasMoreColorType || isLoadingMoreColorType) return;
    
    setIsLoadingMoreColorType(true);
    await fetchColorTypeHistory(false);
    setIsLoadingMoreColorType(false);
  };

  const fetchKibbeHistory = async (reset = false) => {
    if (!user?.id) {
      setKibbeHistory([]);
      return;
    }

    const offset = reset ? 0 : kibbeOffset;

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          table: 'kibbe_test_history',
          action: 'select',
          columns: ['id', 'user_name', 'height', 'dominance', 'winning_letter', 'kibbe_type', 'created_at', 'status'],
          where: { user_id: user.id, status: 'completed' },
          order_by: 'created_at DESC',
          limit: KIBBE_PAGE_SIZE + 1,
          offset: offset
        })
      });
      const result = await response.json();
      const data = result.success && Array.isArray(result.data) ? result.data : [];

      const hasMore = data.length > KIBBE_PAGE_SIZE;
      const items = hasMore ? data.slice(0, KIBBE_PAGE_SIZE) : data;

      if (reset) {
        setKibbeHistory(items);
        setKibbeOffset(KIBBE_PAGE_SIZE);
      } else {
        setKibbeHistory(prev => [...prev, ...items]);
        setKibbeOffset(prev => prev + KIBBE_PAGE_SIZE);
      }

      setHasMoreKibbe(hasMore);
      setHasFetchedKibbeHistory(true);
    } catch (error) {
      console.error('Error fetching kibbe history:', error);
      if (reset) {
        setKibbeHistory([]);
      }
    }
  };

  const refetchKibbeHistory = async () => {
    await fetchKibbeHistory(true);
  };

  const loadMoreKibbe = async () => {
    if (!hasMoreKibbe || isLoadingMoreKibbe) return;

    setIsLoadingMoreKibbe(true);
    await fetchKibbeHistory(false);
    setIsLoadingMoreKibbe(false);
  };

  const refetchAll = async () => {
    await Promise.all([fetchLookbooks(), fetchHistory(), fetchColorTypeHistory(), fetchKibbeHistory()]);
  };

  useEffect(() => {
    if (user) {
      const loadInitialData = async () => {
        setIsLoading(true);
        await Promise.all([fetchLookbooks(), fetchHistory(), fetchColorTypeHistory(), fetchKibbeHistory()]);
        setIsLoading(false);
      };
      
      if (!hasFetchedLookbooks || !hasFetchedHistory || !hasFetchedColorTypeHistory || !hasFetchedKibbeHistory) {
        loadInitialData();
      } else {
        setIsLoading(false);
      }
    } else {
      setLookbooks([]);
      setHistory([]);
      setColorTypeHistory([]);
      setKibbeHistory([]);
      setHasFetchedLookbooks(false);
      setHasFetchedHistory(false);
      setHasFetchedColorTypeHistory(false);
      setHasFetchedKibbeHistory(false);
      setIsLoading(false);
    }
  }, [user?.id]);

  return (
    <DataContext.Provider
      value={{
        lookbooks,
        history,
        colorTypeHistory,
        kibbeHistory,
        isLoading,
        hasMoreHistory,
        isLoadingMoreHistory,
        hasMoreColorType,
        isLoadingMoreColorType,
        hasMoreKibbe,
        isLoadingMoreKibbe,
        hasMoreLookbooks,
        isLoadingMoreLookbooks,
        refetchLookbooks,
        refetchHistory,
        loadMoreHistory,
        loadMoreColorType,
        loadMoreKibbe,
        loadMoreLookbooks,
        refetchColorTypeHistory,
        refetchKibbeHistory,
        refetchAll
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}