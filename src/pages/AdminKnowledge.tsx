import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';
const SAVE_IMAGE_API = 'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8';

const getAdminToken = () =>
  document.cookie.split('; ').find((c) => c.startsWith('admin_token='))?.split('=')[1] || '';

type Section = 'instruction' | 'news' | 'article';

const SECTION_LABELS: Record<Section, string> = {
  instruction: 'Инструкция',
  news: 'Новость',
  article: 'Статья',
};

type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'button'; text: string; url: string };

interface PostListItem {
  id: number;
  section: Section;
  title: string;
  slug: string;
  cover_url: string | null;
  excerpt: string | null;
  published: boolean;
  created_at: string;
}

interface PostFull extends PostListItem {
  blocks: Block[];
}

const emptyPost = (): PostFull => ({
  id: 0,
  section: 'article',
  title: '',
  slug: '',
  cover_url: null,
  excerpt: '',
  published: false,
  created_at: '',
  blocks: [],
});

export default function AdminKnowledge() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<PostFull | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | 'cover' | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const blockImageInputRef = useRef<HTMLInputElement>(null);
  const pendingBlockIndex = useRef<number | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${ADMIN_API}?action=knowledge_list`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (res.status === 401) {
        navigate('/vf-console');
        return;
      }
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      toast.error('Не удалось загрузить статьи');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const openEditor = async (id?: number) => {
    if (!id) {
      setEditing(emptyPost());
      return;
    }
    try {
      const res = await fetch(`${ADMIN_API}?action=knowledge_get&id=${id}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const data = await res.json();
      const post = data.post as PostFull;
      post.blocks = Array.isArray(post.blocks) ? post.blocks : [];
      setEditing(post);
    } catch {
      toast.error('Не удалось открыть статью');
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch(SAVE_IMAGE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: base64, folder: 'knowledge', user_id: 'admin' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  };

  const handleCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editing) return;
    setUploadingIndex('cover');
    const url = await uploadImage(file);
    setUploadingIndex(null);
    if (url) setEditing({ ...editing, cover_url: url });
    else toast.error('Ошибка загрузки обложки');
  };

  const handleBlockImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const idx = pendingBlockIndex.current;
    if (!file || !editing || idx === null) return;
    setUploadingIndex(idx);
    const url = await uploadImage(file);
    setUploadingIndex(null);
    if (url) updateBlock(idx, { type: 'image', url });
    else toast.error('Ошибка загрузки фото');
  };

  const addBlock = (type: Block['type']) => {
    if (!editing) return;
    let block: Block;
    if (type === 'heading') block = { type: 'heading', text: '' };
    else if (type === 'paragraph') block = { type: 'paragraph', text: '' };
    else if (type === 'image') block = { type: 'image', url: '' };
    else block = { type: 'button', text: '', url: '' };
    setEditing({ ...editing, blocks: [...editing.blocks, block] });
  };

  const updateBlock = (index: number, block: Block) => {
    if (!editing) return;
    const blocks = [...editing.blocks];
    blocks[index] = block;
    setEditing({ ...editing, blocks });
  };

  const removeBlock = (index: number) => {
    if (!editing) return;
    setEditing({ ...editing, blocks: editing.blocks.filter((_, i) => i !== index) });
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    if (!editing) return;
    const target = index + dir;
    if (target < 0 || target >= editing.blocks.length) return;
    const blocks = [...editing.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    setEditing({ ...editing, blocks });
  };

  const savePost = async (publish: boolean) => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.error('Введите заголовок');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${ADMIN_API}?action=knowledge_save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({
          id: editing.id || undefined,
          section: editing.section,
          title: editing.title,
          slug: editing.slug || undefined,
          cover_url: editing.cover_url,
          excerpt: editing.excerpt,
          blocks: editing.blocks,
          published: publish,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(publish ? 'Статья опубликована' : 'Черновик сохранён');
      setEditing(null);
      fetchPosts();
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePost = async (id: number) => {
    if (!confirm('Удалить статью безвозвратно?')) return;
    try {
      const res = await fetch(`${ADMIN_API}?action=knowledge_delete&id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!res.ok) throw new Error();
      toast.success('Статья удалена');
      fetchPosts();
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />

          <div className="flex-1 min-w-0">
            {!editing ? (
              <>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">База знаний</h1>
                    <p className="text-muted-foreground">Инструкции, новости и статьи сайта</p>
                  </div>
                  <Button onClick={() => openEditor()}>
                    <Icon name="Plus" size={18} className="mr-2" />
                    Новая статья
                  </Button>
                </div>

                {isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon name="Loader2" size={18} className="animate-spin" /> Загрузка...
                  </div>
                ) : posts.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Пока нет ни одной статьи. Нажмите «Новая статья».
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {posts.map((p) => (
                      <Card key={p.id}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-20 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                            {p.cover_url && (
                              <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                {SECTION_LABELS[p.section]}
                              </span>
                              {p.published ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                                  Опубликовано
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                  Черновик
                                </span>
                              )}
                            </div>
                            <p className="font-medium truncate">{p.title}</p>
                            <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button variant="outline" size="sm" onClick={() => openEditor(p.id)}>
                              <Icon name="Pencil" size={16} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => deletePost(p.id)}
                            >
                              <Icon name="Trash2" size={16} />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelected} />
                <input ref={blockImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleBlockImageSelected} />

                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => setEditing(null)}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name="ArrowLeft" size={18} />
                    Назад к списку
                  </button>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={isSaving} onClick={() => savePost(false)}>
                      Сохранить черновик
                    </Button>
                    <Button disabled={isSaving} onClick={() => savePost(true)}>
                      {isSaving ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : null}
                      Опубликовать
                    </Button>
                  </div>
                </div>

                <Card className="mb-6">
                  <CardContent className="p-6 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Раздел</label>
                        <Select
                          value={editing.section}
                          onValueChange={(v) => setEditing({ ...editing, section: v as Section })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instruction">Инструкция</SelectItem>
                            <SelectItem value="news">Новость</SelectItem>
                            <SelectItem value="article">Статья</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Адрес (slug), необязательно</label>
                        <Input
                          value={editing.slug}
                          onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                          placeholder="Сформируется из заголовка"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">Заголовок</label>
                      <Input
                        value={editing.title}
                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        placeholder="Заголовок статьи"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Краткое описание (для карточки на главной и в списке)
                      </label>
                      <Textarea
                        value={editing.excerpt || ''}
                        onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                        placeholder="1-2 предложения о статье"
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">Обложка (главное фото)</label>
                      <div className="flex items-center gap-3">
                        <div className="w-40 h-24 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {editing.cover_url && (
                            <img src={editing.cover_url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
                            {uploadingIndex === 'cover' ? (
                              <Icon name="Loader2" size={16} className="animate-spin mr-2" />
                            ) : (
                              <Icon name="Upload" size={16} className="mr-2" />
                            )}
                            Загрузить обложку
                          </Button>
                          {editing.cover_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => setEditing({ ...editing, cover_url: null })}
                            >
                              Убрать
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="mb-4">
                  <h2 className="text-lg font-semibold mb-1">Содержание статьи</h2>
                  <p className="text-sm text-muted-foreground">
                    Добавляйте блоки в нужном порядке: заголовки, текст, фото и кнопки-ссылки.
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  {editing.blocks.map((block, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {block.type === 'heading' && 'Заголовок'}
                            {block.type === 'paragraph' && 'Абзац текста'}
                            {block.type === 'image' && 'Фото'}
                            {block.type === 'button' && 'Кнопка-ссылка'}
                          </span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => moveBlock(index, -1)}>
                              <Icon name="ChevronUp" size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => moveBlock(index, 1)}>
                              <Icon name="ChevronDown" size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => removeBlock(index)}
                            >
                              <Icon name="Trash2" size={16} />
                            </Button>
                          </div>
                        </div>

                        {block.type === 'heading' && (
                          <Input
                            value={block.text}
                            onChange={(e) => updateBlock(index, { type: 'heading', text: e.target.value })}
                            placeholder="Текст заголовка"
                            className="text-lg font-semibold"
                          />
                        )}

                        {block.type === 'paragraph' && (
                          <Textarea
                            value={block.text}
                            onChange={(e) => updateBlock(index, { type: 'paragraph', text: e.target.value })}
                            placeholder="Текст абзаца"
                            rows={4}
                          />
                        )}

                        {block.type === 'image' && (
                          <div className="space-y-2">
                            {block.url ? (
                              <img src={block.url} alt="" className="max-h-64 rounded-lg" />
                            ) : (
                              <div className="h-32 rounded-lg bg-gray-100 flex items-center justify-center text-muted-foreground text-sm">
                                Фото не выбрано
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  pendingBlockIndex.current = index;
                                  blockImageInputRef.current?.click();
                                }}
                              >
                                {uploadingIndex === index ? (
                                  <Icon name="Loader2" size={16} className="animate-spin mr-2" />
                                ) : (
                                  <Icon name="Upload" size={16} className="mr-2" />
                                )}
                                {block.url ? 'Заменить фото' : 'Загрузить фото'}
                              </Button>
                            </div>
                            <Input
                              value={block.caption || ''}
                              onChange={(e) =>
                                updateBlock(index, { type: 'image', url: block.url, caption: e.target.value })
                              }
                              placeholder="Подпись к фото (необязательно)"
                            />
                          </div>
                        )}

                        {block.type === 'button' && (
                          <div className="grid sm:grid-cols-2 gap-2">
                            <Input
                              value={block.text}
                              onChange={(e) =>
                                updateBlock(index, { type: 'button', text: e.target.value, url: block.url })
                              }
                              placeholder="Текст кнопки (напр. Перейти в примерочную)"
                            />
                            <Input
                              value={block.url}
                              onChange={(e) =>
                                updateBlock(index, { type: 'button', text: block.text, url: e.target.value })
                              }
                              placeholder="Ссылка (напр. /virtualfitting)"
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => addBlock('heading')}>
                    <Icon name="Heading" size={16} className="mr-2" /> Заголовок
                  </Button>
                  <Button variant="outline" onClick={() => addBlock('paragraph')}>
                    <Icon name="Text" size={16} className="mr-2" /> Абзац
                  </Button>
                  <Button variant="outline" onClick={() => addBlock('image')}>
                    <Icon name="Image" size={16} className="mr-2" /> Фото
                  </Button>
                  <Button variant="outline" onClick={() => addBlock('button')}>
                    <Icon name="Link" size={16} className="mr-2" /> Кнопка-ссылка
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
