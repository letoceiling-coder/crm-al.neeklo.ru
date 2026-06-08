import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { organizationApi } from '@/lib/billing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function OrganizationMembersPage() {
  const { data: members } = useQuery({ queryKey: ['org-members'], queryFn: organizationApi.getMembers });
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: organizationApi.removeMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
  });

  return (
    <div className="space-y-6">
      <Link to="/organization" className="text-sm text-muted-foreground hover:text-foreground">← Организация</Link>
      <h1 className="text-2xl font-bold">Участники</h1>
      <Card>
        <CardContent className="pt-6 space-y-2">
          {(members ?? []).map((m: { id: string; role: string; user: { email: string; name?: string } }) => (
            <div key={m.id} className="flex items-center justify-between border-b border-border py-2 text-sm">
              <div>
                <div className="font-medium">{m.user.name ?? m.user.email}</div>
                <div className="text-muted-foreground">{m.user.email} · {m.role}</div>
              </div>
              {m.role !== 'OWNER' && (
                <Button variant="outline" size="sm" onClick={() => remove.mutate(m.id)}>Удалить</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function OrganizationInvitationsPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('OPERATOR');
  const qc = useQueryClient();
  const { data: invitations } = useQuery({ queryKey: ['org-invites'], queryFn: organizationApi.getInvitations });
  const invite = useMutation({
    mutationFn: () => organizationApi.invite(email, role),
    onSuccess: () => {
      setEmail('');
      qc.invalidateQueries({ queryKey: ['org-invites'] });
    },
  });

  return (
    <div className="space-y-6">
      <Link to="/organization" className="text-sm text-muted-foreground hover:text-foreground">← Организация</Link>
      <h1 className="text-2xl font-bold">Приглашения</h1>
      <Card>
        <CardHeader><CardTitle>Новое приглашение</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Роль</Label>
            <select className="h-10 rounded-lg border border-border px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              {['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending}>Пригласить</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 space-y-2 text-sm">
          {(invitations ?? []).map((i: { id: string; email: string; role: string; status: string; token: string }) => (
            <div key={i.id} className="border-b border-border py-2">
              <div>{i.email} · {i.role} · {i.status}</div>
              {i.status === 'PENDING' && <code className="text-xs text-muted-foreground">token: {i.token.slice(0, 16)}…</code>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
