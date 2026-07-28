import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';

const DB_QUERY = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

const PAGE_SIZE = 12;

type Section = 'all' | 'instruction' | 'news' | 'article' | 'prompts';

const TABS: { id: Section; label: string; icon: string }[] = [
  { id: 'all', label: 'Всё', icon: 'LayoutGrid' },
  { id: 'instruction', label: 'Инструкции', icon: 'BookOpen' },
  { id: 'news', label: 'Новости', icon: 'Newspaper' },
  { id: 'article', label: 'Статьи', icon: 'PenLine' },
  { id: 'prompts', label: 'Промпты', icon: 'Sparkles' },
];

const SECTION_LABELS: Record<string, string> = {
  instruction: 'Инструкция',
  news: 'Новость',
  article: 'Статья',
  prompts: 'Промпт',
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

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('ellipsis');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

export default function Knowledge() {
  const [tab, setTab] = useState<Section>('all');
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPosts = useCallback(async (activeTab: Section, activePage: number) => {
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = {
        table: 'knowledge_posts',
        action: 'select',
        columns: ['id', 'section', 'title', 'slug', 'cover_url', 'excerpt', 'created_at'],
        order_by: 'created_at DESC',
        limit: PAGE_SIZE,
        offset: (activePage - 1) * PAGE_SIZE,
        with_count: true,
      };
      if (activeTab !== 'all') {
        body.where = { section: activeTab };
      }
      const res = await fetch(DB_QUERY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      const payload = json?.data ?? json;
      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];
      setPosts(rows);
      setTotal(typeof payload?.total === 'number' ? payload.total : rows.length);
    } catch {
      setPosts([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(tab, page);
  }, [fetchPosts, tab, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const changeTab = (id: Section) => {
    if (id === tab) return;
    setTab(id);
    setPage(1);
  };

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
              onClick={() => changeTab(t.id)}
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
        ) : posts.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Icon name="BookText" size={40} className="mx-auto mb-3 opacity-40" />
            <p>Здесь пока нет материалов. Скоро появятся!</p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((p) => (
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

            {totalPages > 1 && (
              <Pagination className="mt-10">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationLink
                      size="icon"
                      aria-label="Предыдущая страница"
                      className={page === 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                      onClick={() => goToPage(page - 1)}
                    >
                      <Icon name="ChevronLeft" size={16} />
                    </PaginationLink>
                  </PaginationItem>

                  {getPageNumbers(page, totalPages).map((p, i) =>
                    p === 'ellipsis' ? (
                      <PaginationItem key={`e-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === page}
                          className="cursor-pointer"
                          onClick={() => goToPage(p)}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}

                  <PaginationItem>
                    <PaginationLink
                      size="icon"
                      aria-label="Следующая страница"
                      className={
                        page === totalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer'
                      }
                      onClick={() => goToPage(page + 1)}
                    >
                      <Icon name="ChevronRight" size={16} />
                    </PaginationLink>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}