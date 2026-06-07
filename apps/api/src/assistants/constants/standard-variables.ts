export const STANDARD_AGENT_VARIABLES = [
  'company_name',
  'phone',
  'email',
  'website',
  'crm_url',
] as const;

export type StandardAgentVariable = (typeof STANDARD_AGENT_VARIABLES)[number];

export const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
