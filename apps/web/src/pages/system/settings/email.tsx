import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { systemSettingsApi } from '@/lib/system-settings';

import { Button } from '@/components/ui/button';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Input } from '@/components/ui/input';

import { useEffect, useState } from 'react';



export function SettingsEmailPage() {

  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['settings-email'], queryFn: systemSettingsApi.getEmail });

  const [form, setForm] = useState({

    host: '',

    port: 587,

    secure: true,

    username: '',

    fromEmail: '',

    password: '',

  });

  const [testTo, setTestTo] = useState('');

  const [msg, setMsg] = useState('');



  useEffect(() => {

    if (data) {

      setForm((f) => ({

        ...f,

        host: data.host ?? '',

        port: data.port ?? 587,

        secure: data.secure ?? data.tls ?? true,

        username: data.username ?? data.user ?? '',

        fromEmail: data.fromEmail ?? data.from ?? '',

      }));

    }

  }, [data]);



  const save = useMutation({

    mutationFn: () =>

      systemSettingsApi.updateEmail({

        host: form.host,

        port: form.port,

        tls: form.secure,

        user: form.username,

        from: form.fromEmail,

        password: form.password || undefined,

      }),

    onSuccess: () => {

      qc.invalidateQueries({ queryKey: ['settings-email'] });

      qc.invalidateQueries({ queryKey: ['system-launch'] });

      setForm((f) => ({ ...f, password: '' }));

      setMsg('Сохранено');

    },

  });



  const testConn = useMutation({

    mutationFn: () => systemSettingsApi.testEmailConnection(),

    onSuccess: (r) => setMsg(r.ok ? r.message : `Ошибка: ${r.message}`),

  });



  const sendTest = useMutation({

    mutationFn: () => systemSettingsApi.sendTestEmail(testTo),

    onSuccess: () => {

      setMsg('Тестовое письмо отправлено');

      qc.invalidateQueries({ queryKey: ['system-launch'] });

    },

    onError: (e: Error) => setMsg(e.message),

  });



  return (

    <Card>

      <CardHeader>

        <CardTitle>Email (SMTP)</CardTitle>

      </CardHeader>

      <CardContent className="space-y-4 max-w-xl">

        <div className="grid gap-4 sm:grid-cols-2">

          <div className="space-y-2">

            <label className="text-sm font-medium">Host</label>

            <Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />

          </div>

          <div className="space-y-2">

            <label className="text-sm font-medium">Port</label>

            <Input
              type="number"
              value={form.port}
              onChange={(e) => {
                const port = Number(e.target.value);
                setForm({ ...form, port, secure: port === 465 ? true : form.secure });
              }}
            />

          </div>

          <div className="space-y-2">

            <label className="text-sm font-medium">Username</label>

            <Input

              value={form.username}

              onChange={(e) => setForm({ ...form, username: e.target.value })}

            />

          </div>

          <div className="space-y-2">

            <label className="text-sm font-medium">

              Password {data?.hasPassword && '(установлен)'}

            </label>

            <Input

              type="password"

              value={form.password}

              onChange={(e) => setForm({ ...form, password: e.target.value })}

            />

          </div>

          <div className="space-y-2 sm:col-span-2">

            <label className="text-sm font-medium">From Email</label>

            <Input

              value={form.fromEmail}

              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}

            />

          </div>

        </div>

        <label className="flex items-center gap-2 text-sm">

          <input

            type="checkbox"

            checked={form.secure}

            onChange={(e) => setForm({ ...form, secure: e.target.checked })}

          />

          Secure (TLS / SSL — use for port 465 smtp.beget.com)

        </label>

        {data?.lastSuccessAt && (

          <p className="text-sm text-green-600">Последняя успешная отправка: {data.lastSuccessAt}</p>

        )}

        {data?.lastError && (

          <p className="text-sm text-destructive">

            Последняя ошибка ({data.lastError.at}): {data.lastError.message}

          </p>

        )}

        <div className="flex flex-wrap gap-2">

          <Button onClick={() => save.mutate()} disabled={save.isPending}>

            Save

          </Button>

          <Button variant="outline" onClick={() => testConn.mutate()} disabled={testConn.isPending}>

            Test Connection

          </Button>

        </div>

        <div className="flex gap-2 items-end pt-2 border-t">

          <div className="space-y-2 flex-1">

            <label className="text-sm font-medium">Получатель теста</label>

            <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />

          </div>

          <Button

            variant="secondary"

            onClick={() => sendTest.mutate()}

            disabled={!testTo || sendTest.isPending}

          >

            Отправить

          </Button>

        </div>

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      </CardContent>

    </Card>

  );

}


