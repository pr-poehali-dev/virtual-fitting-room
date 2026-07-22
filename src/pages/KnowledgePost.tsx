import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

const DB_QUERY = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

const SECTION_LABELS: Record<string, string> = {
  instruction: 'Инструкция',
  news: 'Новость',
  article: 'Статья',
};

type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'image-pair'; left: string; right: string; leftCaption?: string; rightCaption?: string }
  | { type: 'button'; text: string; url: string };

interface Post {
  id: number;
  section: string;
  title: string;
  slug: string;
  cover_url: string | null;
  excerpt: string | null;
  blocks: Block[];
  created_at: string;
}

function BlockButton({ block }: { block: Extract<Block, { type: 'button' }> }) {
  if (!block.text || !block.url) return null;
  const isInternal = block.url.startsWith('/');
  const inner = (
    <>
      {block.text}
      <Icon name="ArrowRight" size={18} className="ml-2" />
    </>
  );
  return (
    <div className="my-6">
      {isInternal ? (
        <Button asChild size="lg" className="text-base">
          <Link to={block.url}>{inner}</Link>
        </Button>
      ) : (
        <Button asChild size="lg" className="text-base">
          <a href={block.url} target="_blank" rel="noopener noreferrer">
            {inner}
          </a>
        </Button>
      )}
    </div>
  );
}

export default function KnowledgePost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(DB_QUERY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'knowledge_posts',
            action: 'select',
            where: { slug },
            limit: 1,
          }),
        });
        const data = await res.json();
        const rows: Post[] = Array.isArray(data) ? data : data.data || [];
        if (!active) return;
        if (rows.length === 0) {
          setNotFound(true);
        } else {
          const p = rows[0];
          p.blocks = Array.isArray(p.blocks) ? p.blocks : [];
          setPost(p);
        }
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10">
        <Link
          to="/knowledge"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <Icon name="ArrowLeft" size={18} />
          Назад в Базу знаний
        </Link>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name="Loader2" size={18} className="animate-spin" /> Загрузка...
          </div>
        ) : notFound || !post ? (
          <div className="py-16 text-center text-muted-foreground">
            <Icon name="FileQuestion" size={40} className="mx-auto mb-3 opacity-40" />
            <p className="mb-4">Статья не найдена или ещё не опубликована.</p>
            <Button asChild variant="outline">
              <Link to="/knowledge">Ко всем материалам</Link>
            </Button>
          </div>
        ) : (
          <article className="max-w-3xl mx-auto">
            <span className="inline-block text-xs px-2.5 py-1 rounded bg-purple-100 text-purple-700 mb-4">
              {SECTION_LABELS[post.section] || 'Статья'}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">{post.title}</h1>

            {post.cover_url && (
              <img
                src={post.cover_url}
                alt={post.title}
                className="w-full rounded-2xl mb-8 object-cover"
              />
            )}

            <div className="space-y-1">
              {post.blocks.map((block, i) => {
                if (block.type === 'heading')
                  return (
                    <h2 key={i} className="text-2xl font-bold mt-8 mb-3">
                      {block.text}
                    </h2>
                  );
                if (block.type === 'paragraph')
                  return (
                    <p key={i} className="text-base md:text-lg leading-relaxed text-foreground/90 mb-4 whitespace-pre-wrap">
                      {block.text}
                    </p>
                  );
                if (block.type === 'image')
                  return block.url ? (
                    <figure key={i} className="my-6">
                      <img src={block.url} alt={block.caption || ''} className="w-full rounded-xl" />
                      {block.caption && (
                        <figcaption className="text-lg text-muted-foreground text-center mt-2 mb-4">
                          {block.caption}
                        </figcaption>
                      )}
                    </figure>
                  ) : null;
                if (block.type === 'image-pair') {
                  if (!block.left && !block.right) return null;
                  const cells: { url: string; caption?: string }[] = [];
                  if (block.left) cells.push({ url: block.left, caption: block.leftCaption });
                  if (block.right) cells.push({ url: block.right, caption: block.rightCaption });
                  return (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 my-6">
                      {cells.map((cell, ci) => (
                        <figure key={ci}>
                          <img src={cell.url} alt={cell.caption || ''} className="w-full rounded-xl" />
                          {cell.caption && (
                            <figcaption className="text-base text-muted-foreground text-center mt-2">
                              {cell.caption}
                            </figcaption>
                          )}
                        </figure>
                      ))}
                    </div>
                  );
                }
                if (block.type === 'button') return <BlockButton key={i} block={block} />;
                return null;
              })}
            </div>
          </article>
        )}
      </div>
    </Layout>
  );
}