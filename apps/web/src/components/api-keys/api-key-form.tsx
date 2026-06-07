import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ModelChainPicker,
  type ChainItem,
  type ModelOption,
  useModelsCatalog,
} from './model-chain-picker';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export type KeyRoutingMode = 'profile' | 'custom';

export interface ApiKeyFormValues {
  name: string;
  comment: string;
  allowedIps: string;
  allowedDomains: string;
  balanceRub: string;
  pricePerMillionRub: string;
  routingMode: KeyRoutingMode;
  modelProfileId: string;
  modelChain: ChainItem[];
  sellPrices: Record<string, string>;
}

interface ApiKeyFormProps {
  values: ApiKeyFormValues;
  onChange: (values: ApiKeyFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  isPending?: boolean;
  /** При редактировании баланс меняется только через «Пополнить» */
  isEdit?: boolean;
}

export function ApiKeyForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
  isEdit,
}: ApiKeyFormProps) {
  const patch = (partial: Partial<ApiKeyFormValues>) =>
    onChange({ ...values, ...partial });

  const { data: profiles } = useQuery({
    queryKey: ['key-model-profiles'],
    queryFn: () => api.get('/key-model-profiles').then((r) => r.data),
  });

  const selectedProfile = profiles?.find(
    (p: { id: string }) => p.id === values.modelProfileId,
  );

  useEffect(() => {
    if (!profiles?.length || values.routingMode !== 'profile' || values.modelProfileId) {
      return;
    }
    const auto = profiles.find((p: { slug: string }) => p.slug === 'auto');
    if (!auto) return;
    onChange({
      ...values,
      modelProfileId: auto.id,
      pricePerMillionRub: values.pricePerMillionRub || String(auto.pricePerMillionRub),
    });
  }, [profiles, values.routingMode, values.modelProfileId]);

  const onSelectProfile = (profileId: string) => {
    const p = profiles?.find((x: { id: string }) => x.id === profileId);
    patch({
      modelProfileId: profileId,
      pricePerMillionRub: p ? String(p.pricePerMillionRub) : values.pricePerMillionRub,
    });
  };

  const useProfile = values.routingMode === 'profile';
  const canSubmit =
    values.name &&
    (useProfile
      ? !!values.pricePerMillionRub || !!values.modelProfileId
      : values.modelChain.length > 0
        ? !!values.pricePerMillionRub
        : true);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Название</Label>
          <Input
            value={values.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Production Key"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Комментарий</Label>
          <Input
            value={values.comment}
            onChange={(e) => patch({ comment: e.target.value })}
            placeholder="Описание или домен проекта"
          />
        </div>
        {!isEdit && (
          <div className="space-y-2">
            <Label>Начальный баланс (₽)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={values.balanceRub}
              onChange={(e) => patch({ balanceRub: e.target.value })}
              placeholder="1000"
            />
            <p className="text-xs text-muted-foreground">
              Начисление при создании. Дальше — только через «Пополнить».
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label>Стоимость за 1 000 000 токенов (₽)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={values.pricePerMillionRub}
            onChange={(e) => patch({ pricePerMillionRub: e.target.value })}
            placeholder="150.00"
            disabled={useProfile && !!selectedProfile}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Разрешённые IP (через запятую)</Label>
          <Input
            value={values.allowedIps}
            onChange={(e) => patch({ allowedIps: e.target.value })}
            placeholder="192.168.1.1, 10.0.0.0"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Разрешённые домены (через запятую)</Label>
          <Input
            value={values.allowedDomains}
            onChange={(e) => patch({ allowedDomains: e.target.value })}
            placeholder="example.com, app.example.com"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Настройка моделей</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => patch({ routingMode: 'profile' })}
            className={cn(
              'flex-1 rounded-lg border px-4 py-3 text-sm text-left transition-colors',
              useProfile
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-accent',
            )}
          >
            <span className="font-medium">Готовая модель</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Выбрать созданный профиль с цепочкой
            </p>
          </button>
          <button
            type="button"
            onClick={() => patch({ routingMode: 'custom' })}
            className={cn(
              'flex-1 rounded-lg border px-4 py-3 text-sm text-left transition-colors',
              !useProfile
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-accent',
            )}
          >
            <span className="font-medium">Своя цепочка</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Собрать fallback вручную из каталога
            </p>
          </button>
        </div>
      </div>

      {useProfile ? (
        <div className="space-y-2">
          <Label>Модель для ключа</Label>
          {profiles?.length ? (
            <select
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
              value={values.modelProfileId}
              onChange={(e) => onSelectProfile(e.target.value)}
            >
              <option value="">Выберите модель...</option>
              {profiles.map((p: { id: string; name: string; slug: string; pricePerMillionRub: number }) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.slug}) — {p.pricePerMillionRub} ₽/1M
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted-foreground">
              Нет созданных моделей.{' '}
              <a href="/key-models" className="text-primary underline">
                Создайте в разделе «Модели для ключей»
              </a>
            </p>
          )}
          {!values.modelProfileId && profiles?.some((p: { slug: string }) => p.slug === 'auto') && (
            <p className="text-xs text-muted-foreground">
              Если модель не выбрана, для ключа используется профиль <strong>auto</strong> (2000 ₽/1M).
            </p>
          )}
          {selectedProfile && (
            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p>
                API: <code>model: "auto"</code> или <code>model: "{selectedProfile.slug}"</code>
              </p>
              <p>Цепочка: {selectedProfile.modelChain?.length ?? 0} моделей</p>
            </div>
          )}
        </div>
      ) : (
        <ModelChainPicker
          value={values.modelChain}
          onChange={(modelChain) => patch({ modelChain })}
          sellPrices={values.sellPrices}
          onSellPricesChange={(sellPrices) => patch({ sellPrices })}
        />
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={onSubmit} disabled={!canSubmit || isPending}>
          {submitLabel}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

export function emptyFormValues(): ApiKeyFormValues {
  return {
    name: '',
    comment: '',
    allowedIps: '',
    allowedDomains: '',
    balanceRub: '',
    pricePerMillionRub: '',
    routingMode: 'profile',
    modelProfileId: '',
    modelChain: [],
    sellPrices: {},
  };
}

export function parseListField(value: string): string[] | undefined {
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

export function joinListField(items?: string[]): string {
  return items?.join(', ') ?? '';
}

export function formToPayload(
  values: ApiKeyFormValues,
  models: ModelOption[] = [],
  options?: { isEdit?: boolean },
) {
  const payload: Record<string, unknown> = {
    name: values.name,
    comment: values.comment || undefined,
    allowedIps: parseListField(values.allowedIps),
    allowedDomains: parseListField(values.allowedDomains),
    pricePerMillionRub: values.pricePerMillionRub
      ? Number(values.pricePerMillionRub)
      : 0,
    routingMode: values.routingMode,
  };

  if (!options?.isEdit) {
    payload.balanceRub = values.balanceRub ? Number(values.balanceRub) : 0;
  }

  if (values.routingMode === 'profile') {
    payload.modelProfileId = values.modelProfileId;
    payload.modelChain = [];
  } else {
    payload.modelChain = values.modelChain;
    if (values.modelChain.length > 0) {
      const defaultPrice = Number(values.pricePerMillionRub) || 0;
      payload.pricing = values.modelChain.map((c) => {
        const model = models.find((m) => m.id === c.modelId);
        const costPrice = Number(model?.inputPrice ?? 0);
        const sellPrice = Number(
          values.sellPrices[c.modelId] || defaultPrice || costPrice,
        );
        return {
          modelId: c.modelId,
          costPrice,
          sellPrice,
          margin: sellPrice - costPrice,
        };
      });
    }
  }

  return payload;
}

export function keyToFormValues(
  key: {
    name: string;
    comment?: string;
    allowedIps?: string[];
    allowedDomains?: string[];
    balanceRub?: string | number;
    pricePerMillionRub?: string | number;
    routingMode?: string;
    modelProfileId?: string | null;
    modelProfile?: { id: string; pricePerMillionRub?: number | string };
    modelChain?: Array<{
      priority: number;
      model: { id: string };
    }>;
    pricing?: Array<{
      modelId: string;
      sellPrice: string | number;
    }>;
  },
): ApiKeyFormValues {
  const sellPrices: Record<string, string> = {};
  for (const p of key.pricing ?? []) {
    sellPrices[p.modelId] = String(p.sellPrice);
  }
  let pricePerMillionRub =
    key.pricePerMillionRub != null && key.pricePerMillionRub !== ''
      ? String(key.pricePerMillionRub)
      : '';
  if (!pricePerMillionRub && key.pricing?.length) {
    pricePerMillionRub = String(key.pricing[0].sellPrice);
  }
  if (!pricePerMillionRub && key.modelProfile?.pricePerMillionRub != null) {
    pricePerMillionRub = String(key.modelProfile.pricePerMillionRub);
  }

  const routingMode: KeyRoutingMode =
    key.routingMode === 'PROFILE' || key.routingMode === 'profile' || key.modelProfileId
      ? 'profile'
      : 'custom';

  return {
    name: key.name,
    comment: key.comment ?? '',
    allowedIps: joinListField(key.allowedIps),
    allowedDomains: joinListField(key.allowedDomains),
    balanceRub: '',
    pricePerMillionRub,
    routingMode,
    modelProfileId: key.modelProfileId ?? key.modelProfile?.id ?? '',
    modelChain: (key.modelChain ?? [])
      .sort((a, b) => a.priority - b.priority)
      .map((c) => ({ modelId: c.model.id, priority: c.priority })),
    sellPrices,
  };
}

export function useModelsForPayload() {
  const { data } = useModelsCatalog();
  return (data?.data ?? []) as ModelOption[];
}
