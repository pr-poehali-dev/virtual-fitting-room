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

const SERVICES = [
  {
    key: "outfit",
    label: "Образы",
    title: "Мои анкеты для образов",
    hint: "Сохранённые анкеты для быстрого заполнения формы подбора образа",
    action: "Подобрать образ",
    path: "/outfit-selection",
  },
  {
    key: "wedding",
    label: "Свадьба",
    title: "Мои анкеты для свадебных образов",
    hint: "Сохранённые анкеты для быстрого заполнения формы свадебного образа",
    action: "Подобрать свадебный образ",
    path: "/wedding-selection",
  },
  {
    key: "gift",
    label: "Подарки",
    title: "Мои анкеты для подарков",
    hint: "Сохранённые анкеты для быстрого заполнения формы подбора подарка",
    action: "Подобрать подарок",
    path: "/gift-selection",
  },
  {
    key: "perfume",
    label: "Ароматы",
    title: "Мои анкеты для ароматов",
    hint: "Сохранённые анкеты для быстрого заполнения формы подбора аромата",
    action: "Подобрать аромат",
    path: "/perfume-selection",
  },
];

function summarize(fp: OutfitFormParams): string {
  const parts: string[] = [];
  const p = fp as OutfitFormParams & Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : "");
  const rel = str(p.relation);
  const recipient = str(p.recipient_gender);
  const role = str(p.role);

  if (role) parts.push(role);
  else if (rel) parts.push(rel);
  else if (recipient) parts.push(recipient);
  else if (fp.gender) parts.push(fp.gender);

  const weddingStyle = str(p.wedding_style);
  if (weddingStyle) parts.push(`стиль: ${weddingStyle}`);
  const venue = str(p.venue);
  if (venue) parts.push(venue);

  if (fp.archetypes?.length) parts.push(`архетип: ${fp.archetypes.join(", ")}`);
  if (fp.kibbe) parts.push(`типаж: ${fp.kibbe}`);
  if (fp.occasion) parts.push(`повод: ${fp.occasion}`);

  const budget = str(p.budget_max);
  if (budget) parts.push(`бюджет до ${budget} ₽`);

  const notes = Array.isArray(p.favorite_notes) ? p.favorite_notes : [];
  if (notes.length) parts.push(`ноты: ${notes.slice(0, 3).join(", ")}`);

  if (fp.style_age) parts.push(`возраст: ${fp.style_age}`);
  return parts.join(" · ");
}

export default function ProfileOutfitProfiles() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<OutfitProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [service, setService] = useState("outfit");
  const current = SERVICES.find((s) => s.key === service) || SERVICES[0];

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchOutfitProfiles(service)
      .then(setProfiles)
      .catch(() => toast.error("Не удалось загрузить анкеты"))
      .finally(() => setLoading(false));
  }, [user, service]);

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
                <h1 className="text-3xl font-bold mb-2">{current.title}</h1>
                <p className="text-muted-foreground">{current.hint}</p>
              </div>
              <Button onClick={() => navigate(current.path)}>
                <Icon name="Sparkles" size={18} className="mr-2" />
                {current.action}
              </Button>
            </div>

            <div className="flex gap-2 mb-6 flex-wrap">
              {SERVICES.map((s) => (
                <Button
                  key={s.key}
                  variant={s.key === service ? "default" : "outline"}
                  size="sm"
                  onClick={() => setService(s.key)}
                >
                  {s.label}
                </Button>
              ))}
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
                    У вас пока нет сохранённых анкет в этом разделе. Заполните
                    форму подбора и нажмите «Сохранить анкету».
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate(current.path)}
                  >
                    {current.action}
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