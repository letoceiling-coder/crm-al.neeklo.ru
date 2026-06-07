import { PromptRenderService } from './prompt-render.service';

describe('PromptRenderService', () => {
  let service: PromptRenderService;

  beforeEach(() => {
    service = new PromptRenderService();
  });

  it('renders {{company_name}} and standard variables', () => {
    const rendered = service.render(
      'Hello from {{company_name}} — call {{phone}} or visit {{website}}.',
      {
        company_name: 'Acme Corp',
        phone: '+1-555-0100',
        website: 'https://acme.example',
      },
    );
    expect(rendered).toBe(
      'Hello from Acme Corp — call +1-555-0100 or visit https://acme.example.',
    );
  });

  it('replaces missing variables with empty string', () => {
    const rendered = service.render('CRM: {{crm_url}}', {});
    expect(rendered).toBe('CRM: ');
  });

  it('reports missing placeholders in renderSystemPrompt', () => {
    const result = service.renderSystemPrompt(
      'Hi {{company_name}}, email {{email}}',
      { company_name: 'Acme' },
    );
    expect(result.rendered).toBe('Hi Acme, email ');
    expect(result.missing).toEqual(['email']);
  });

  it('extracts unique placeholders', () => {
    expect(service.extractPlaceholders('{{a}} and {{b}} and {{a}}')).toEqual(['a', 'b']);
  });
});
