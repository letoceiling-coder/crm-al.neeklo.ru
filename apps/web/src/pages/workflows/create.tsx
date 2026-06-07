import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { StepEditor } from '@/components/workflows/step-editor';
import {
  CRM_EVENTS,
  KB_EVENTS,
  TOOL_EVENTS,
  TRIGGER_LABELS,
  defaultSteps,
  type WorkflowStep,
  type WorkflowTriggerType,
} from '@/lib/workflows';

export function WorkflowsCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>('MANUAL');
  const [event, setEvent] = useState('');
  const [scheduleCron, setScheduleCron] = useState('0 9 * * *');
  const [steps, setSteps] = useState<WorkflowStep[]>(defaultSteps());

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/workflows', {
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
        triggerConfig: event ? { event } : {},
        scheduleCron: triggerType === 'SCHEDULE' ? scheduleCron : undefined,
        steps: steps.map(({ stepKey, stepType, configuration, position }) => ({
          stepKey,
          stepType,
          configuration,
          position,
        })),
      }),
    onSuccess: (res) => navigate(`/workflows/${res.data.id}`),
  });

  const eventOptions =
    triggerType === 'CRM_EVENT'
      ? CRM_EVENTS
      : triggerType === 'KB_EVENT'
        ? KB_EVENTS
        : triggerType === 'TOOL_EVENT'
          ? TOOL_EVENTS
          : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/workflows">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Новый workflow</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Название</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Новый лид → ассистент" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Описание</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Триггер</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={triggerType}
              onChange={(e) => {
                setTriggerType(e.target.value as WorkflowTriggerType);
                setEvent('');
              }}
            >
              {(Object.keys(TRIGGER_LABELS) as WorkflowTriggerType[]).map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {eventOptions.length > 0 && (
            <div>
              <label className="text-sm text-muted-foreground">Событие</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
              >
                <option value="">Любое</option>
                {eventOptions.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>
          )}
          {triggerType === 'SCHEDULE' && (
            <div>
              <label className="text-sm text-muted-foreground">Cron (например 0 9 * * *)</label>
              <Input value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      <StepEditor steps={steps} onChange={setSteps} />

      <Button disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
        Создать workflow
      </Button>
    </div>
  );
}
