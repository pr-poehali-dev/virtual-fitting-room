import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import ProfileMenu from "@/components/ProfileMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  OutfitProfile,
  fetchOutfitProfiles,
  deleteOutfitProfile,
} from "@/lib/outfitProfiles";
import { OutfitFormParams } from "@/components/OutfitReport";

function summarize(fp: OutfitFormParams): string {
  const parts: string[] = [];
  if (fp.gender) parts.push(fp.gender);
  if (fp.archetypes?.length) parts.push(`архетип: ${fp.archetypes.join(", ")}`);
  if (fp.kibbe) parts.push(`типаж: ${fp.kibbe}`);
  if (fp.occasion) parts.push(`повод: ${fp.occasion}`);
  if (fp.style_age) parts.push(`возраст: ${fp.style_age}`);
  return parts.join(" · ");
}

export default function ProfileOutfitProfiles() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<OutfitProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchOutfitProfiles()
      .then(setProfiles)
      .catch(() => toast.error("Не удалось загрузить анкеты"))
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить эту анкету?")) return;
    setDeletingId(id);
    try {
      await deleteOutfitProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      toast.success("Анкета удалена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />

          <div className="flex-1">
            <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  Мои анкеты для образов
                </h1>
                <p className="text-muted-foreground">
                  Сохранённые анкеты для быстрого заполнения формы подбора
                  образа
                </p>
              </div>
              <Button onClick={() => navigate("/outfit-selection")}>
                <Icon name="Sparkles" size={18} className="mr-2" />
                Подобрать образ
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Icon name="Loader2" className="animate-spin" size={40} />
              </div>
            ) : profiles.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                  <Icon
                    name="Bookmark"
                    size={40}
                    className="mx-auto mb-4 opacity-50"
                  />
                  <p className="mb-4">
                    У вас пока нет сохранённых анкет. Заполните форму подбора
                    образа и нажмите «Сохранить анкету».
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/outfit-selection")}
                  >
                    Перейти к подбору образа
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {profiles.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-lg truncate">
                          {p.name}
                        </p>
                        {p.comment && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {p.comment}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {summarize(p.form_params)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? (
                          <Icon name="Loader2" size={18} className="animate-spin" />
                        ) : (
                          <Icon name="Trash2" size={18} />
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}