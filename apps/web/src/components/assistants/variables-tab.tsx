import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Plus, Trash2, AlertTriangle, Braces } from 'lucide-react';

import { api } from '@/lib/api';

import { Button } from '@/components/ui/button';

import { Input, Label, Textarea, Badge } from '@/components/ui/input';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { AssistantEmptyState } from './empty-state';

import {

  STANDARD_VARIABLES,

  variableLabel,

  type AgentVariable,

  type RenderPromptResult,

} from '@/lib/assistants';



interface Props {

  assistantId: string;

  variables: AgentVariable[];

  systemPrompt: string;

}



export function AssistantVariablesTab({ assistantId, variables, systemPrompt }: Props) {

  const queryClient = useQueryClient();

  const [rows, setRows] = useState<Array<{ key: string; value: string }>>(

    variables.length

      ? variables.map((v) => ({ key: v.key, value: v.value }))

      : STANDARD_VARIABLES.map((k) => ({ key: k, value: '' })),

  );

  const [preview, setPreview] = useState<RenderPromptResult | null>(null);



  const hasSavedValues = variables.some((v) => v.value.trim());

  const showEmptyHint = !hasSavedValues && rows.every((r) => !r.value.trim());



  const saveMutation = useMutation({

    mutationFn: () =>

      api.post(`/v1/assistants/${assistantId}/variables`, {

        variables: rows.filter((r) => r.key.trim()),

      }),

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ['assistant', assistantId] });

    },

  });



  const renderMutation = useMutation({

    mutationFn: () =>

      api.post<RenderPromptResult>(`/v1/assistants/${assistantId}/render-prompt`, {}).then((r) => r.data),

    onSuccess: setPreview,

  });



  const deleteMutation = useMutation({

    mutationFn: (key: string) => api.delete(`/v1/assistants/${assistantId}/variables/${key}`),

    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assistant', assistantId] }),

  });



  const addRow = () => setRows([...rows, { key: '', value: '' }]);



  const updateRow = (index: number, field: 'key' | 'value', val: string) => {

    const next = [...rows];

    next[index] = { ...next[index], [field]: val };

    setRows(next);

  };



  const removeRow = (index: number) => {

    const key = rows[index]?.key;

    setRows(rows.filter((_, i) => i !== index));

    if (key && variables.some((v) => v.key === key)) {

      deleteMutation.mutate(key);

    }

  };



  return (

    <div className="space-y-6">

      {showEmptyHint && (

        <Card>

          <CardContent className="pt-6">

            <AssistantEmptyState

              icon={Braces}

              title="Нет переменных"

              description="Добавьте данные компании для подстановки в промпт: название, телефон, email и другие поля."

              action={

                <Button type="button" variant="outline" size="sm" onClick={addRow}>

                  <Plus className="h-4 w-4 mr-1" />

                  Добавить переменную

                </Button>

              }

            />

          </CardContent>

        </Card>

      )}



      <Card>

        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <CardTitle className="text-base">Переменные</CardTitle>

          <Button type="button" variant="outline" size="sm" onClick={addRow}>

            <Plus className="h-4 w-4 mr-1" />

            Добавить

          </Button>

        </CardHeader>

        <CardContent className="space-y-4">

          {rows.map((row, i) => (

            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] items-end">

              <div className="space-y-1 min-w-0">

                <Label>Ключ</Label>

                <Input

                  value={row.key}

                  onChange={(e) => updateRow(i, 'key', e.target.value)}

                  placeholder="company_name"

                  list="variable-keys"

                  className="font-mono text-xs"

                />

                {row.key && (

                  <p className="text-xs text-muted-foreground truncate">{variableLabel(row.key)}</p>

                )}

              </div>

              <div className="space-y-1 min-w-0">

                <Label>Значение</Label>

                <Input

                  value={row.value}

                  onChange={(e) => updateRow(i, 'value', e.target.value)}

                  placeholder="ООО «Пример»"

                  className="break-all"

                />

              </div>

              <Button type="button" variant="outline" size="icon" onClick={() => removeRow(i)}>

                <Trash2 className="h-4 w-4" />

              </Button>

            </div>

          ))}



          <datalist id="variable-keys">

            {STANDARD_VARIABLES.map((k) => (

              <option key={k} value={k}>

                {variableLabel(k)}

              </option>

            ))}

          </datalist>



          <div className="flex flex-wrap gap-2 pt-2">

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>

              {saveMutation.isPending ? 'Сохранение…' : 'Сохранить переменные'}

            </Button>

            <Button

              type="button"

              variant="outline"

              onClick={() => renderMutation.mutate()}

              disabled={renderMutation.isPending}

            >

              Предпросмотр промпта

            </Button>

          </div>

        </CardContent>

      </Card>



      {preview && (

        <Card>

          <CardHeader>

            <CardTitle className="text-base">Предпросмотр</CardTitle>

          </CardHeader>

          <CardContent className="space-y-4">

            {preview.missing.length > 0 && (

              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">

                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />

                <div>

                  <p className="font-medium">Не заполнены переменные:</p>

                  <div className="flex flex-wrap gap-1 mt-1">

                    {preview.missing.map((m) => (

                      <Badge key={m} variant="warning">

                        {`{{${m}}}`}

                      </Badge>

                    ))}

                  </div>

                </div>

              </div>

            )}

            <div className="space-y-1">

              <Label>Исходный промпт</Label>

              <Textarea

                readOnly

                value={systemPrompt}

                rows={4}

                className="font-mono text-xs max-h-48 overflow-y-auto break-words"

              />

            </div>

            <div className="space-y-1">

              <Label>Результат</Label>

              <Textarea

                readOnly

                value={preview.rendered}

                rows={6}

                className="font-mono text-xs max-h-72 overflow-y-auto break-words"

              />

            </div>

          </CardContent>

        </Card>

      )}

    </div>

  );

}


