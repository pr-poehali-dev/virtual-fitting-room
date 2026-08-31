import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import AdminMenu from "@/components/AdminMenu";
import PromotionEditor, {
  emptyPromotion,
  type Promotion,
} from "@/components/admin/bonus/PromotionEditor";
import ManualBonusPanel, {
  type BonusUser,
} from "@/components/admin/bonus/ManualBonusPanel";
import func2url from "../../backend/func2url.json";

const BONUS_API = func2url["bonus-api"];

interface BonusStats {
  granted: number;
  spent: number;
  burned: number;
  active: number;
}

export default function AdminBonuses() {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [users, setUsers] = useState<BonusUser[]>([]);
  const [stats, setStats] = useState<BonusStats | null>(null);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [search, setSearch] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const adminToken =
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("admin_token="))
      ?.split("=")[1] || "";

  const call = useCallback(
    async (action: string, method: "GET" | "POST" = "GET", body?: unknown) => {
      const url =
        method === "GET"
          ? `${BONUS_API}?action=${action}${
              action === "users" && search
                ? `&search=${encodeURIComponent(search)}`
                : ""
            }`
          : `${BONUS_API}?action=${action}`;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken,
        },
        body: method === "POST" ? JSON.stringify(body || {}) : undefined,
      });

      if (res.status === 403 || res.status === 401) {
        navigate("/vf-console");
        throw new Error("Нет доступа");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка запроса");
      return data;
    },
    [adminToken, navigate, search],
  );

  const loadAll = useCallback(async () => {
    try {
      const [promoData, userData, statsData] = await Promise.all([
        call("admin_promotions"),
        call("users"),
        call("stats"),
      ]);
      setPromotions(promoData.promotions || []);
      setUsers(userData.users || []);
      setStats(statsData);
    } catch (e) {
      if ((e as Error).message !== "Нет доступа") {
        toast.error((e as Error).message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [call]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const savePromotion = async () => {
    if (!editing) return;
    setIsBusy(true);
    try {
      await call("save_promotion", "POST", editing);
      toast.success("Акция сохранена");
      setEditing(null);
      loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const togglePromotion = async (promo: Promotion, on: boolean) => {
    try {
      await call("toggle_promotion", "POST", { id: promo.id, is_active: on });
      setPromotions((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, is_active: on } : p)),
      );
      toast.success(on ? "Акция включена" : "Акция выключена");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removePromotion = async (promo: Promotion) => {
    if (!window.confirm(`Удалить акцию «${promo.title}»?`)) return;
    try {
      await call("remove_promotion", "POST", { id: promo.id });
      toast.success("Акция удалена. Начисленные бонусы у людей остались");
      loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const grantBonus = async (
    userId: string,
    amount: number,
    reason: string,
    days: number,
  ) => {
    setIsBusy(true);
    try {
      await call("grant", "POST", {
        user_id: userId,
        amount,
        reason,
        expires_days: days > 0 ? days : null,
      });
      toast.success(`Начислено ${amount} ₽ бонусами`);
      loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const revokeBonus = async (userId: string, amount: number) => {
    setIsBusy(true);
    try {
      const data = await call("revoke", "POST", { user_id: userId, amount });
      toast.success(`Списано ${data.revoked} ₽ бонусами`);
      loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const clearAll = async () => {
    setIsBusy(true);
    try {
      const data = await call("clear_all", "POST", { confirm: "CLEAR" });
      toast.success(`Обнулено ${data.cleared} ₽ у ${data.users} пользователей`);
      loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const runExpiry = async () => {
    setIsBusy(true);
    try {
      const data = await call("run_expiry", "POST", {});
      toast.success(
        data.grants > 0
          ? `Сгорело ${data.burned} ₽ в ${data.grants} начислениях`
          : "Просроченных бонусов нет",
      );
      loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const triggerLabel: Record<string, string> = {
    registration: "За регистрацию",
    topup: "За пополнение",
    custom: "Вручную",
    manual: "Вручную",
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Icon name="Gift" size={26} />
                Бонусные рубли
              </h1>
              <Button variant="outline" onClick={runExpiry} disabled={isBusy}>
                <Icon name="Flame" size={16} className="mr-2" />
                Проверить сгорание
              </Button>
            </div>

            {stats && (
              <div className="grid gap-4 md:grid-cols-4 mb-8">
                {[
                  {
                    label: "Начислено всего",
                    value: stats.granted,
                    icon: "Plus",
                  },
                  {
                    label: "Сейчас на счетах",
                    value: stats.active,
                    icon: "Wallet",
                  },
                  {
                    label: "Потрачено",
                    value: stats.spent,
                    icon: "ShoppingBag",
                  },
                  { label: "Сгорело", value: stats.burned, icon: "Flame" },
                ].map((card) => (
                  <Card key={card.label}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <Icon name={card.icon} size={16} />
                        {card.label}
                      </div>
                      <p className="text-2xl font-light">
                        {card.value.toFixed(2)} ₽
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Tabs defaultValue="promotions">
              <TabsList className="mb-6">
                <TabsTrigger value="promotions">Акции</TabsTrigger>
                <TabsTrigger value="manual">Ручное управление</TabsTrigger>
              </TabsList>

              <TabsContent value="promotions" className="space-y-5">
                {editing ? (
                  <PromotionEditor
                    value={editing}
                    onChange={setEditing}
                    onSave={savePromotion}
                    onCancel={() => setEditing(null)}
                    isSaving={isBusy}
                  />
                ) : (
                  <Button onClick={() => setEditing({ ...emptyPromotion })}>
                    <Icon name="Plus" size={16} className="mr-2" />
                    Новая акция
                  </Button>
                )}

                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Icon
                      name="Loader2"
                      size={28}
                      className="animate-spin mx-auto mb-2"
                    />
                    Загружаем
                  </div>
                ) : (
                  <div className="space-y-3">
                    {promotions.map((promo) => (
                      <Card key={promo.id}>
                        <CardContent className="pt-6">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1 min-w-[240px]">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-semibold">{promo.title}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                                  {triggerLabel[promo.trigger_type] || "Своё"}
                                </span>
                                {!promo.show_on_site && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                    скрыта на сайте
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {promo.description || "Без описания"}
                              </p>
                              <div className="flex flex-wrap gap-4 text-sm">
                                <span className="font-medium text-primary">
                                  +{promo.bonus_amount} ₽
                                </span>
                                {promo.trigger_type === "topup" && (
                                  <span>от {promo.min_amount} ₽</span>
                                )}
                                <span className="text-muted-foreground">
                                  {promo.expires_days
                                    ? `сгорают через ${promo.expires_days} дн.`
                                    : "не сгорают"}
                                </span>
                                {(promo.granted_count ?? 0) > 0 && (
                                  <span className="text-muted-foreground">
                                    выдано {promo.granted_total} ₽ (
                                    {promo.granted_count} раз)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <Switch
                                checked={promo.is_active}
                                onCheckedChange={(on) =>
                                  togglePromotion(promo, on)
                                }
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(promo)}
                              >
                                <Icon name="Pencil" size={16} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removePromotion(promo)}
                              >
                                <Icon
                                  name="Trash2"
                                  size={16}
                                  className="text-destructive"
                                />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual">
                <ManualBonusPanel
                  users={users}
                  search={search}
                  onSearch={setSearch}
                  onGrant={grantBonus}
                  onRevoke={revokeBonus}
                  onClearAll={clearAll}
                  isBusy={isBusy}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}
