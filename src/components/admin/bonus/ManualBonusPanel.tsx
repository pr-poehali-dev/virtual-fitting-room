import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Icon from "@/components/ui/icon";

export interface BonusUser {
  id: string;
  email: string;
  name: string;
  balance: number;
  bonus_balance: number;
  own_balance: number;
  next_expiry: string | null;
}

interface Props {
  users: BonusUser[];
  search: string;
  onSearch: (value: string) => void;
  onGrant: (userId: string, amount: number, reason: string, days: number) => void;
  onRevoke: (userId: string, amount: number) => void;
  onClearAll: () => void;
  isBusy: boolean;
}

export default function ManualBonusPanel({
  users,
  search,
  onSearch,
  onGrant,
  onRevoke,
  onClearAll,
  isBusy,
}: Props) {
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("Начисление администратором");
  const [days, setDays] = useState(30);
  const [confirmClear, setConfirmClear] = useState(false);

  const fmtDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
        })
      : "—";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon name="Gift" size={20} />
            Начислить или списать вручную
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Почта или ID пользователя</Label>
              <Input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value.trim())}
                placeholder="Выберите из списка ниже или вставьте ID"
              />
            </div>
            <div>
              <Label>Сумма, ₽</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Причина</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Компенсация за неудобства"
              />
            </div>
            <div>
              <Label>Сгорают через, дней (0 — не сгорают)</Label>
              <Input
                type="number"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => onGrant(targetId, amount, reason, days)}
              disabled={!targetId || amount <= 0 || isBusy}
            >
              <Icon name="Plus" size={16} className="mr-2" />
              Начислить
            </Button>
            <Button
              variant="outline"
              onClick={() => onRevoke(targetId, amount)}
              disabled={!targetId || amount <= 0 || isBusy}
            >
              <Icon name="Minus" size={16} className="mr-2" />
              Списать бонусы
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Списываются только бонусные рубли. Собственные деньги человека не
            затрагиваются.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <Icon name="Users" size={20} />
              Люди с бонусами
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Поиск по почте или имени"
          />

          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Ни у кого сейчас нет бонусных рублей
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-4">Пользователь</th>
                    <th className="py-2 pr-4">Всего</th>
                    <th className="py-2 pr-4">Бонусных</th>
                    <th className="py-2 pr-4">Своих</th>
                    <th className="py-2 pr-4">Сгорает</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{u.name || "Без имени"}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.email}
                        </div>
                      </td>
                      <td className="py-2 pr-4">{u.balance.toFixed(2)} ₽</td>
                      <td className="py-2 pr-4 font-medium text-primary">
                        {u.bonus_balance.toFixed(2)} ₽
                      </td>
                      <td className="py-2 pr-4">{u.own_balance.toFixed(2)} ₽</td>
                      <td className="py-2 pr-4 text-xs">
                        {fmtDate(u.next_expiry)}
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setTargetId(u.id)}
                        >
                          Выбрать
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <Icon name="TriangleAlert" size={20} />
            Обнулить бонусы у всех
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Снимет все неизрасходованные бонусные рубли у всех пользователей.
            Собственные деньги останутся нетронутыми. Отменить нельзя.
          </p>
          {confirmClear ? (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="destructive"
                onClick={() => {
                  onClearAll();
                  setConfirmClear(false);
                }}
                disabled={isBusy}
              >
                Да, обнулить у всех
              </Button>
              <Button variant="outline" onClick={() => setConfirmClear(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="text-destructive border-destructive/40"
              onClick={() => setConfirmClear(true)}
            >
              Обнулить бонусы у всех
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
