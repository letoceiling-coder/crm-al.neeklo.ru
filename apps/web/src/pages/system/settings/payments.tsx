import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { systemSettingsApi } from '@/lib/system-settings';

import { Button } from '@/components/ui/button';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Input } from '@/components/ui/input';

import { useEffect, useState } from 'react';



type YooKassaProvider = {

  provider: string;

  name: string;

  isEnabled: boolean;

  isDefault: boolean;

  testMode: boolean;

  shopId: string;

  hasSecretKey: boolean;

  webhookUrl: string;

  returnUrl: string;

};



export function SettingsPaymentsPage() {

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({

    queryKey: ['settings-payments'],

    queryFn: systemSettingsApi.getPayments,

  });



  const provider = (data as YooKassaProvider[] | undefined)?.find((p) => p.provider === 'YOOKASSA');



  const [shopId, setShopId] = useState('');

  const [secretKey, setSecretKey] = useState('');

  const [testMode, setTestMode] = useState(true);

  const [enabled, setEnabled] = useState(false);

  const [msg, setMsg] = useState('');



  useEffect(() => {

    if (provider) {

      setShopId(provider.shopId ?? '');

      setTestMode(provider.testMode ?? true);

      setEnabled(provider.isEnabled ?? false);

    }

  }, [provider]);



  const save = useMutation({

    mutationFn: () =>

      systemSettingsApi.updatePayment('YOOKASSA', {

        isEnabled: enabled,

        testMode,

        shopId,

        secretKey: secretKey || undefined,

      }),

    onSuccess: () => {

      qc.invalidateQueries({ queryKey: ['settings-payments'] });

      qc.invalidateQueries({ queryKey: ['system-launch'] });

      setSecretKey('');

      setMsg('Сохранено');

    },

  });



  const testConn = useMutation({

    mutationFn: () => systemSettingsApi.testPayment('YOOKASSA'),

    onSuccess: (r) => {

      setMsg(r.ok ? r.message : `Ошибка: ${r.message}`);

      if (r.ok) qc.invalidateQueries({ queryKey: ['system-launch'] });

    },

  });



  const testPayment = useMutation({

    mutationFn: () => systemSettingsApi.createTestPayment(),

    onSuccess: (r) => {

      if (r.ok && r.confirmationUrl) {

        setMsg(`${r.message}. Откройте ссылку для оплаты.`);

        window.open(r.confirmationUrl, '_blank', 'noopener,noreferrer');

        qc.invalidateQueries({ queryKey: ['system-launch'] });

      } else {

        setMsg(r.ok ? r.message : `Ошибка: ${r.message}`);

      }

    },

  });



  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;



  return (

    <div className="space-y-4">

      <h2 className="text-lg font-semibold">Платежи — YooKassa</h2>

      <Card>

        <CardHeader>

          <CardTitle className="text-lg">YooKassa</CardTitle>

        </CardHeader>

        <CardContent className="space-y-4 max-w-2xl">

          <div className="grid gap-4 sm:grid-cols-2">

            <div className="space-y-2">

              <label className="text-sm font-medium">Shop ID</label>

              <Input value={shopId} onChange={(e) => setShopId(e.target.value)} />

            </div>

            <div className="space-y-2">

              <label className="text-sm font-medium">

                Secret Key {provider?.hasSecretKey && '(установлен)'}

              </label>

              <Input

                type="password"

                placeholder="••••••••"

                value={secretKey}

                onChange={(e) => setSecretKey(e.target.value)}

              />

            </div>

          </div>

          <div className="space-y-1 text-sm text-muted-foreground">

            <p>

              Webhook: <code className="text-xs">{provider?.webhookUrl}</code>

            </p>

            <p>

              Return URL: <code className="text-xs">{provider?.returnUrl}</code>

            </p>

          </div>

          <label className="flex items-center gap-2 text-sm">

            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />

            Включено

          </label>

          <label className="flex items-center gap-2 text-sm">

            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />

            Тестовый режим

          </label>

          <div className="flex flex-wrap gap-2">

            <Button onClick={() => save.mutate()} disabled={save.isPending}>

              Сохранить

            </Button>

            <Button variant="outline" onClick={() => testConn.mutate()} disabled={testConn.isPending}>

              Проверить подключение

            </Button>

            <Button

              variant="secondary"

              onClick={() => testPayment.mutate()}

              disabled={testPayment.isPending || testMode}

            >

              Создать тестовый платеж

            </Button>

          </div>

          {testMode && (

            <p className="text-xs text-muted-foreground">

              Отключите Test Mode для создания реального тестового платежа 1 ₽.

            </p>

          )}

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

        </CardContent>

      </Card>

    </div>

  );

}


