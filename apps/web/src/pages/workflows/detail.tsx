import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { StepEditor } from '@/components/workflows/step-editor';
import {
  WORKFLOW_TIMEZONES,
  CRM_EVENTS,
  KB_EVENTS,
  TOOL_EVENTS,
  STATUS_LABELS,
  TRIGGER_LABELS,
  defaultSteps,
  type Workflow,
  type WorkflowStep,
} from '@/lib/workflows';
import { formatDate } from '@/lib/utils';

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: workflow, isLoading } = useQuery<Workflow>({
    queryKey: ['workflow', id],
    queryFn: () => api.get(`/v1/workflows/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [event, setEvent] = useState('');
  const [scheduleCron, setScheduleCron] = useState('');
  const [scheduleTimezone, setScheduleTimezone] = useState('UTC');
  const [isActive, setIsActive] = useState(false);
  const [steps, setSteps] = useState<WorkflowStep[]>(defaultSteps());

  useEffect(() => {
    if (!workflow) return;
    setName(workflow.name);
    setDescription(workflow.description ?? '');
    setEvent(String((workflow.triggerConfig as { event?: string })?.event ?? ''));
    setScheduleCron(workflow.scheduleCron ?? '');
    setScheduleTimezone(workflow.scheduleTimezone ?? 'UTC');
    setIsActive(workflow.isActive);
    const versionSteps = workflow.currentVersion?.steps;
    if (versionSteps?.length) {
      setSteps(
        versionSteps.map((s) => ({
          id: s.id,
          stepKey: s.stepKey,
          stepType: s.stepType,
          configuration: s.configuration ?? {},
          position: s.position,
        })),
      );
    }
  }, [workflow]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/v1/workflows/${id}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        triggerConfig: event ? { event } : {},
        scheduleCron: workflow?.triggerType === 'SCHEDULE' ? scheduleCron : undefined,
        scheduleTimezone: workflow?.triggerType === 'SCHEDULE' ? scheduleTimezone : undefined,
        isActive,
        steps: steps.map(({ stepKey, stepType, configuration, position }) => ({
          stepKey,
          stepType,
          configuration,
          position,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow', id] });
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const runMutation = useMutation({
    mutationFn: () => api.post(`/v1/workflows/${id}/run`, { triggerData: { manual: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-executions'] }),
  });

  const webhookUrl =
    workflow?.webhookToken && typeof window !== 'undefined'
      ? `${window.location.origin.replace(':5173', ':3000')}/api/v1/workflows/webhook/${workflow.webhookToken}`
      : null;

  if (isLoading || !workflow) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  }

  const eventOptions =
    workflow.triggerType === 'CRM_EVENT'
      ? CRM_EVENTS
      : workflow.triggerType === 'KB_EVENT'
        ? KB_EVENTS
        : workflow.triggerType === 'TOOL_EVENT'
          ? TOOL_EVENTS
          : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/workflows">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Назад
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{workflow.name}</h1>
            <p className="text-sm text-muted-foreground">
              {TRIGGER_LABELS[workflow.triggerType]} · v{workflow.currentVersion?.version ?? 1}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
            <Play className="h-4 w-4 mr-2" />
            Запустить
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Сохранить
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={isActive ? 'success' : 'outline'}>{isActive ? 'Активен' : STATUS_LABELS[workflow.status]}</Badge>
            <Badge variant="outline">{TRIGGER_LABELS[workflow.triggerType]}</Badge>
            <span className="text-xs text-muted-foreground self-center">Обновлён {formatDate(workflow.updatedAt)}</span>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Название</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Описание</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
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
          {workflow.triggerType === 'SCHEDULE' && (
            <>
              <div>
                <label className="text-sm text-muted-foreground">Cron</label>
                <Input value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} placeholder="0 9 * * *" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Часовой пояс</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={scheduleTimezone}
                  onChange={(e) => setScheduleTimezone(e.target.value)}
                >
                  {WORKFLOW_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {workflow.triggerType === 'WEBHOOK' && webhookUrl && (
            <div>
              <label className="text-sm text-muted-foreground">Webhook URL</label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(webhookUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Активировать workflow
          </label>
        </CardContent>
      </Card>

      <StepEditor steps={steps} onChange={setSteps} />

      {workflow.versions && workflow.versions.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Версии</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {workflow.versions.map((v) => (
                <li key={v.id}>
                  v{v.version} — {formatDate(v.createdAt)} {v.published ? '(текущая)' : ''}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
