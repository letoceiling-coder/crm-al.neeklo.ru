import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  EDITABLE_STEP_TYPES,
  STEP_TYPE_LABELS,
  reorderSteps,
  type WorkflowStep,
  type WorkflowStepType,
} from '@/lib/workflows';

interface StepEditorProps {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
}

export function StepEditor({ steps, onChange }: StepEditorProps) {
  const middle = steps.filter((s) => s.stepType !== 'START' && s.stepType !== 'END');
  const start = steps.find((s) => s.stepType === 'START');
  const end = steps.find((s) => s.stepType === 'END');

  const updateMiddle = (nextMiddle: WorkflowStep[]) => {
    const ordered = reorderSteps([
      start ?? { stepKey: 'start', stepType: 'START', position: 0, configuration: {} },
      ...nextMiddle,
      end ?? { stepKey: 'end', stepType: 'END', position: nextMiddle.length + 1, configuration: {} },
    ]);
    onChange(ordered);
  };

  const addStep = () => {
    const key = `step_${Date.now()}`;
    updateMiddle([
      ...middle,
      { stepKey: key, stepType: 'ASSISTANT', position: middle.length, configuration: {} },
    ]);
  };

  const removeStep = (index: number) => {
    updateMiddle(middle.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= middle.length) return;
    const copy = [...middle];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    updateMiddle(copy);
  };

  const patchStep = (index: number, patch: Partial<WorkflowStep>) => {
    updateMiddle(middle.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Шаги сценария</h3>
        <Button type="button" variant="outline" size="sm" onClick={addStep}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить шаг
        </Button>
      </div>

      <Card className="border-dashed">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-muted-foreground">START — точка входа</CardTitle>
        </CardHeader>
      </Card>

      {middle.map((step, index) => (
        <Card key={step.stepKey}>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm">Шаг {index + 1}</CardTitle>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(index, 1)} disabled={index === middle.length - 1}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Ключ шага</label>
                <Input
                  value={step.stepKey}
                  onChange={(e) => patchStep(index, { stepKey: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Тип</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={step.stepType}
                  onChange={(e) => patchStep(index, { stepType: e.target.value as WorkflowStepType })}
                >
                  {EDITABLE_STEP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {STEP_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Конфигурация (JSON)</label>
              <textarea
                className="mt-1 min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                value={JSON.stringify(step.configuration ?? {}, null, 2)}
                onChange={(e) => {
                  try {
                    patchStep(index, { configuration: JSON.parse(e.target.value) });
                  } catch {
                    /* ignore invalid json while typing */
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="border-dashed">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-muted-foreground">END — завершение</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
