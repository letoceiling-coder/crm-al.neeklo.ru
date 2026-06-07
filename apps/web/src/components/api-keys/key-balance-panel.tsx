import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';

interface BalanceSnapshot {
  balanceRub: number;
  spentRub: number;
  remainingRub: number;
  percentUsed: number;
  isExhausted: boolean;
}

interface TopUpRow {
  id: string;
  amountRub: number | string;
  balanceBefore: number | string;
  balanceAfter: number | string;
  type: string;
  comment?: string | null;
  createdAt: string;
}

export function KeyBalancePanel({ apiKeyId }: { apiKeyId: string }) {
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const { data: balance, isLoading: balanceLoading } = useQuery<BalanceSnapshot>({
    queryKey: ['api-key-balance', apiKeyId],
    queryFn: () => api.get(`/api-keys/${apiKeyId}/balance`).then((r) => r.data),
  });

  const { data: topUps } = useQuery<{ data: TopUpRow[] }>({
    queryKey: ['api-key-top-ups', apiKeyId],
    queryFn: () =>
      api.get(`/api-keys/${apiKeyId}/top-ups`, { params: { limit: 15 } }).then((r) => r.data),
  });

  const topUpMutation = useMutation({
    mutationFn: () =>
      api.post(`/api-keys/${apiKeyId}/top-up`, {
        amountRub: Number(amount),
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      setAmount('');
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['api-key-balance', apiKeyId] });
      queryClient.invalidateQueries({ queryKey: ['api-key-top-ups', apiKeyId] });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  return (
    <div className="rounded-lg border border-border p-4 space-y-4 mb-4 bg-muted/20">
      <div>
        <h4 className="text-sm font-medium mb-2">Баланс ключа</h4>
        {balanceLoading || !balance ? (
          <p className="text-xs text-muted-foreground">Загрузка…</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div>
              <span className="text-muted-foreground">Начислено</span>
              <p className="font-medium">{formatCurrency(Number(balance.balanceRub))}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Потрачено</span>
              <p className="font-medium">{formatCurrency(Number(balance.spentRub))}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Остаток</span>
              <p className="font-medium text-primary">
                {formatCurrency(Number(balance.remainingRub))}
              </p>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Расход списывается по API-запросам. «Сохранить» настройки ключа баланс не меняет — только
          пополнение ниже.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 items-end">
        <div className="space-y-2">
          <Label>Пополнить (₽)</Label>
          <Input
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
          />
        </div>
        <div className="space-y-2">
          <Label>Комментарий (необязательно)</Label>
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Пополнение от клиента"
          />
        </div>
        <Button
          className="sm:col-span-2"
          disabled={!amount || Number(amount) <= 0 || topUpMutation.isPending}
          onClick={() => topUpMutation.mutate()}
        >
          {topUpMutation.isPending ? 'Начисление…' : 'Пополнить баланс'}
        </Button>
      </div>

      {topUps?.data?.length ? (
        <div>
          <h4 className="text-sm font-medium mb-2">История пополнений</h4>
          <div className="max-h-40 overflow-y-auto rounded border border-border text-xs">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Дата</th>
                  <th className="text-right p-2 font-medium">Сумма</th>
                  <th className="text-right p-2 font-medium">После</th>
                  <th className="text-left p-2 font-medium">Тип</th>
                </tr>
              </thead>
              <tbody>
                {topUps.data.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="p-2 text-muted-foreground">{formatDate(row.createdAt)}</td>
                    <td className="p-2 text-right">+{formatCurrency(Number(row.amountRub))}</td>
                    <td className="p-2 text-right">
                      {formatCurrency(Number(row.balanceAfter))}
                    </td>
                    <td className="p-2">{row.type === 'INITIAL' ? 'Создание' : 'Пополнение'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">История пополнений пуста.</p>
      )}
    </div>
  );
}
