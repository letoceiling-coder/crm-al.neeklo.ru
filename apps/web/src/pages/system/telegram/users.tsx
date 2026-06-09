import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { telegramApi } from '@/lib/telegram';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TelegramUserRow = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  PENDING: 'Ожидает',
  APPROVED: 'Одобрен',
  REJECTED: 'Отклонён',
};

export function TelegramUsersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['telegram-users'],
    queryFn: () => telegramApi.listUsers(),
  });

  const approve = useMutation({
    mutationFn: (id: string) => telegramApi.approveUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['telegram-users'] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => telegramApi.rejectUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['telegram-users'] }),
  });

  const displayName = (u: TelegramUserRow) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пользователи</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded bg-muted" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-2 pr-2">Имя</th>
                <th className="pb-2 pr-2">Username</th>
                <th className="pb-2 pr-2">Telegram ID</th>
                <th className="pb-2 pr-2">Дата</th>
                <th className="pb-2 pr-2">Статус</th>
                <th className="pb-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {(data as TelegramUserRow[] | undefined)?.map((u) => (
                <tr key={u.id} className="border-b border-border">
                  <td className="py-2 pr-2">{displayName(u)}</td>
                  <td className="py-2 pr-2">{u.username ? `@${u.username}` : '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{u.telegramId}</td>
                  <td className="py-2 pr-2">{new Date(u.createdAt).toLocaleString('ru-RU')}</td>
                  <td className="py-2 pr-2">{statusLabel[u.status] ?? u.status}</td>
                  <td className="py-2">
                    {u.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => approve.mutate(u.id)} disabled={approve.isPending}>
                          Одобрить
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reject.mutate(u.id)}
                          disabled={reject.isPending}
                        >
                          Отклонить
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && !(data as TelegramUserRow[])?.length && (
          <p className="text-muted-foreground py-4">Пользователей пока нет. Отправьте /start боту.</p>
        )}
      </CardContent>
    </Card>
  );
}
