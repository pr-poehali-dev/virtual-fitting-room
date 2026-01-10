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

interface DataContextType {
  lookbooks: Lookbook[];
  history: HistoryItem[];
  colorTypeHistory: ColorTypeHistory[];
  isLoading: boolean;
  refetchLookbooks: () => Promise<void>;
  refetchHistory: () => Promise<void>;
  refetchColorTypeHistory: () => Promise<void>;
  refetchAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [colorTypeHistory, setColorTypeHistory] = useState<ColorTypeHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedLookbooks, setHasFetchedLookbooks] = useState(false);
  const [hasFetchedHistory, setHasFetchedHistory] = useState(false);
  const [hasFetchedColorTypeHistory, setHasFetchedColorTypeHistory] = useState(false);

  const fetchLookbooks = async () => {
    if (!user?.id) {
      setLookbooks([]);
      return;
    }

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'select',
          where: { user_id: user.id },
          order_by: 'created_at DESC',
          limit: 100
        })
      });
      const result = await response.json();
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      setLookbooks(Array.isArray(data) ? data : []);
      setHasFetchedLookbooks(true);
    } catch (error) {
      console.error('Error fetching lookbooks:', error);
      setLookbooks([]);
    }
  };

  const fetchHistory = async () => {
    if (!user?.id) {
      setHistory([]);
      return;
    }

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          table: 'try_on_history',
          action: 'select',
          where: { user_id: user.id },
          order_by: 'created_at DESC',
          limit: 100
        })
      });
      const result = await response.json();
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      setHistory(Array.isArray(data) ? data : []);
      setHasFetchedHistory(true);
    } catch (error) {
      console.error('Error fetching history:', error);
      setHistory([]);
    }
  };

  const refetchLookbooks = async () => {
    await fetchLookbooks();
  };

  const fetchColorTypeHistory = async () => {
    if (!user?.id) {
      setColorTypeHistory([]);
      return;
    }

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          table: 'color_type_history',
          action: 'select',
          columns: ['id', 'cdn_url', 'color_type', 'result_text', 'created_at', 'status'],
          where: { user_id: user.id, status: 'completed' },
          order_by: 'created_at DESC',
          limit: 100
        })
      });
      const result = await response.json();
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      setColorTypeHistory(Array.isArray(data) ? data : []);
      setHasFetchedColorTypeHistory(true);
    } catch (error) {
      console.error('Error fetching color type history:', error);
      setColorTypeHistory([]);
    }
  };

  const refetchHistory = async () => {
    await fetchHistory();
  };

  const refetchColorTypeHistory = async () => {
    await fetchColorTypeHistory();
  };

  const refetchAll = async () => {
    await Promise.all([fetchLookbooks(), fetchHistory(), fetchColorTypeHistory()]);
  };

  useEffect(() => {
    if (user) {
      const loadInitialData = async () => {
        setIsLoading(true);
        await Promise.all([fetchLookbooks(), fetchHistory(), fetchColorTypeHistory()]);
        setIsLoading(false);
      };
      
      if (!hasFetchedLookbooks || !hasFetchedHistory || !hasFetchedColorTypeHistory) {
        loadInitialData();
      } else {
        setIsLoading(false);
      }
    } else {
      setLookbooks([]);
      setHistory([]);
      setColorTypeHistory([]);
      setHasFetchedLookbooks(false);
      setHasFetchedHistory(false);
      setHasFetchedColorTypeHistory(false);
      setIsLoading(false);
    }
  }, [user?.id]);

  return (
    <DataContext.Provider
      value={{
        lookbooks,
        history,
        colorTypeHistory,
        isLoading,
        refetchLookbooks,
        refetchHistory,
        refetchColorTypeHistory,
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