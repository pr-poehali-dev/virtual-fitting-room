import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

const CLEANUP_API = 'https://functions.poehali.dev/79cd68c1-61c0-484a-9661-6a5d3e6f4133';

interface CleanupTableResult {
  table: string;
  column: string;
  cleaned: number;
  saved_bytes: number;
}

interface CleanupResult {
  success: boolean;
  tables: CleanupTableResult[];
  total_cleaned: number;
  total_saved_mb: number;
}

export default function AdminCleanup() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const runCleanup = async () => {
    setIsLoading(true);
    setShowConfirm(false);
    setResult(null);

    try {
      const response = await fetch(CLEANUP_API, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status === 401) {
        navigate('/vf-console');
        return;
      }

      if (!response.ok) throw new Error('Ошибка очистки');

      const data: CleanupResult = await response.json();
      setResult(data);
      
      if (data.total_cleaned > 0) {
        toast.success(`Очищено ${data.total_cleaned} записей, освобождено ~${data.total_saved_mb} МБ`);
      } else {
        toast.info('Нечего чистить — base64 данных не найдено');
      }
    } catch (error) {
      toast.error('Ошибка при очистке');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
  };

  const tableNames: Record<string, string> = {
    'nanobananapro_tasks': 'Задачи NanoBanana',
    'try_on_history': 'История примерок',
    'replicate_tasks': 'Задачи Replicate',
    'seedream_tasks': 'Задачи SeeDream',
    'color_type_history': 'История цветотипов'
  };

  const columnNames: Record<string, string> = {
    'person_image': 'Фото человека',
    'garments': 'Фото одежды (JSON)',
    'garment_image': 'Фото одежды',
    'template_data': 'Данные шаблона'
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />

          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Очистка базы данных</h1>
              <p className="text-muted-foreground">
                Удаление base64-копий картинок из завершённых задач. Картинки в облаке не затрагиваются.
              </p>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="ShieldCheck" size={20} />
                  Что будет очищено
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Icon name="Check" size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Base64-картинки из <strong>завершённых и неудачных</strong> задач (status = completed/failed)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="Check" size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Base64 из архива примерок (try_on_history) — все записи</span>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="X" size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Задачи в процессе (pending/processing) <strong>НЕ затрагиваются</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="X" size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Картинки в облаке (Yandex/CDN) <strong>НЕ удаляются</strong></span>
                </div>
              </CardContent>
            </Card>

            {!showConfirm && !isLoading && (
              <Button
                size="lg"
                onClick={() => setShowConfirm(true)}
                className="mb-6"
              >
                <Icon name="Trash2" size={18} className="mr-2" />
                Запустить очистку
              </Button>
            )}

            {showConfirm && !isLoading && (
              <Card className="mb-6 border-orange-300 bg-orange-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Icon name="AlertTriangle" size={24} className="text-orange-600" />
                    <span className="font-semibold text-orange-800">Подтверди очистку</span>
                  </div>
                  <p className="text-sm text-orange-700 mb-4">
                    Base64-данные в завершённых задачах будут заменены на «Удалено». Это действие необратимо.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={runCleanup} variant="destructive">
                      <Icon name="Trash2" size={16} className="mr-2" />
                      Да, очистить
                    </Button>
                    <Button onClick={() => setShowConfirm(false)} variant="outline">
                      Отмена
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Icon name="Loader2" className="animate-spin mx-auto mb-4" size={48} />
                  <p className="text-muted-foreground">Очистка базы данных...</p>
                </div>
              </div>
            )}

            {result && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon name="FileCheck" size={20} className="text-green-600" />
                    Результат очистки
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-blue-700">{result.total_cleaned}</p>
                      <p className="text-sm text-blue-600">записей очищено</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-green-700">{result.total_saved_mb} МБ</p>
                      <p className="text-sm text-green-600">освобождено</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Таблица</th>
                          <th className="text-left py-2 pr-4">Колонка</th>
                          <th className="text-right py-2 pr-4">Записей</th>
                          <th className="text-right py-2">Освобождено</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.tables.map((row, i) => (
                          <tr key={i} className={`border-b ${row.cleaned > 0 ? '' : 'text-muted-foreground'}`}>
                            <td className="py-2 pr-4">{tableNames[row.table] || row.table}</td>
                            <td className="py-2 pr-4">{columnNames[row.column] || row.column}</td>
                            <td className="text-right py-2 pr-4 font-medium">{row.cleaned}</td>
                            <td className="text-right py-2 font-medium">{formatBytes(row.saved_bytes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
