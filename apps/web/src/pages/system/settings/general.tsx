import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { systemSettingsApi } from '@/lib/system-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';

export function SettingsGeneralPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings-general'], queryFn: systemSettingsApi.getGeneral });
  const [publicUrl, setPublicUrl] = useState('');
  useEffect(() => {
    if (data?.publicUrl) setPublicUrl(data.publicUrl);
  }, [data]);

  const save = useMutation({
    mutationFn: () => systemSettingsApi.updateGeneral({ publicUrl }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-general'] }),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Общие</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="publicUrl">Public URL</label>
          <Input id="publicUrl" value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)} />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Сохранить</Button>
      </CardContent>
    </Card>
  );
}
