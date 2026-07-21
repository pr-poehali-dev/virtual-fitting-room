import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';

const DB_QUERY = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

type Section = 'all' | 'instruction' | 'news' | 'article';

const TABS: { id: Section; label: string; icon: string }[] = [
  { id: 'all', label: 'Всё', icon: 'LayoutGrid' },
  { id: 'instruction', label: 'Инструкции', icon: 'BookOpen' },
  { id: 'news', label: 'Новости', icon: 'Newspaper' },
  { id: 'article', label: 'Статьи', icon: 'PenLine' },
];

const SECTION_LABELS: Record<string, string> = {
  instruction: 'Инструкция',
  news: 'Новость',
  article: 'Статья',
};

interface PostCard {
  id: number;
  section: string;
  title: string;
  slug: string;
  cover_url: string | null;
  excerpt: string | null;
  created_at: string;
}

export default function Knowledge() {
  const [tab, setTab] = useState<Section>('all');
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(DB_QUERY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'knowledge_posts',
          action: 'select',
          columns: ['id', 'section', 'title', 'slug', 'cover_url', 'excerpt', 'created_at'],
          order_by: 'created_at DESC',
          limit: 100,
        }),
      });
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : data.data || []);
    } catch {
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const filtered = tab === 'all' ? posts : posts.filter((p) => p.section === tab);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-3xl mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">База знаний</h1>
          <p className="text-muted-foreground text-lg">
            Инструкции по сервисам, новости проекта и полезные статьи о стиле.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name="Loader2" size={18} className="animate-spin" /> Загрузка...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Icon name="BookText" size={40} className="mx-auto mb-3 opacity-40" />
            <p>Здесь пока нет материалов. Скоро появятся!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to={`/knowledge/${p.slug}`}
                className="group rounded-2xl overflow-hidden border border-border bg-card hover:shadow-lg transition-all"
              >
                <div className="aspect-video bg-muted overflow-hidden">
                  {p.cover_url ? (
                    <img
                      src={p.cover_url}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="Image" size={32} className="text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="inline-block text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 mb-2">
                    {SECTION_LABELS[p.section] || 'Статья'}
                  </span>
                  <h2 className="font-semibold text-lg mb-2 group-hover:text-purple-600 transition-colors line-clamp-2">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
