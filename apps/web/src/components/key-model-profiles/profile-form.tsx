import {
  ModelChainPicker,
  type ChainItem,
  type ModelOption,
  useModelsCatalog,
} from '@/components/api-keys/model-chain-picker';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface ProfileFormValues {
  name: string;
  slug: string;
  description: string;
  pricePerMillionRub: string;
  modelChain: ChainItem[];
  sellPrices: Record<string, string>;
}

interface ProfileFormProps {
  values: ProfileFormValues;
  onChange: (values: ProfileFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  isPending?: boolean;
}

export function ProfileForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: ProfileFormProps) {
  const patch = (partial: Partial<ProfileFormValues>) =>
    onChange({ ...values, ...partial });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Наименование</Label>
          <Input
            value={values.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Быстрая модель для парсера"
          />
        </div>
        <div className="space-y-2">
          <Label>Slug (для API)</Label>
          <Input
            value={values.slug}
            onChange={(e) => patch({ slug: e.target.value })}
            placeholder="auto-generated-from-name"
          />
          <p className="text-xs text-muted-foreground">
            Используется в API: <code>model: "slug"</code>
          </p>
        </div>
        <div className="space-y-2">
          <Label>Стоимость за 1 000 000 токенов (₽)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={values.pricePerMillionRub}
            onChange={(e) => patch({ pricePerMillionRub: e.target.value })}
            placeholder="150.00"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Описание</Label>
          <Input
            value={values.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Для чего используется эта конфигурация"
          />
        </div>
      </div>

      <ModelChainPicker
        value={values.modelChain}
        onChange={(modelChain) => patch({ modelChain })}
        sellPrices={values.sellPrices}
        onSellPricesChange={(sellPrices) => patch({ sellPrices })}
      />

      <div className="flex gap-2 pt-2">
        <Button
          onClick={onSubmit}
          disabled={
            !values.name ||
            !values.pricePerMillionRub ||
            !values.modelChain.length ||
            isPending
          }
        >
          {submitLabel}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

export function emptyProfileForm(): ProfileFormValues {
  return {
    name: '',
    slug: '',
    description: '',
    pricePerMillionRub: '',
    modelChain: [],
    sellPrices: {},
  };
}

export function profileToPayload(
  values: ProfileFormValues,
  models: ModelOption[] = [],
) {
  const defaultPrice = Number(values.pricePerMillionRub) || 0;
  return {
    name: values.name,
    slug: values.slug.trim() || undefined,
    description: values.description || undefined,
    pricePerMillionRub: defaultPrice,
    modelChain: values.modelChain,
    pricing: values.modelChain.map((c) => {
      const model = models.find((m) => m.id === c.modelId);
      const costPrice = Number(model?.inputPrice ?? 0);
      const sellPrice = Number(values.sellPrices[c.modelId] || defaultPrice || costPrice);
      return { modelId: c.modelId, costPrice, sellPrice };
    }),
  };
}

export function apiProfileToForm(profile: {
  name: string;
  slug: string;
  description?: string;
  pricePerMillionRub: number | string;
  modelChain?: Array<{
    modelId: string;
    priority: number;
    model?: { id: string };
  }>;
  pricing?: Array<{ modelId: string; sellPrice: number | string }>;
}): ProfileFormValues {
  const sellPrices: Record<string, string> = {};
  for (const p of profile.pricing ?? []) {
    sellPrices[p.modelId] = String(p.sellPrice);
  }
  return {
    name: profile.name,
    slug: profile.slug,
    description: profile.description ?? '',
    pricePerMillionRub: String(profile.pricePerMillionRub),
    modelChain: (profile.modelChain ?? []).map((c) => ({
      modelId: c.modelId ?? c.model?.id ?? '',
      priority: c.priority,
    })),
    sellPrices,
  };
}

export function useModelsForProfilePayload() {
  const { data } = useModelsCatalog();
  return (data?.data ?? []) as ModelOption[];
}
