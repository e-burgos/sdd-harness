export const MAX_FRAME_BYTES = 1_048_576;
export const FRAME_BUDGET_BYTES = MAX_FRAME_BYTES - 8_192;
export const MAX_ATTACHMENTS = 5;
export const IMAGE_MAX_SIDE = 1568;
export const MAX_PROMPT_REFS = 5;
export const FILE_SEARCH_MAX = 50;
export const MAX_PENDING_PER_THREAD = 10;
export const MAX_LINK_TARGETS = 32;
export const BRIDGE_FEATURES = [
  'pending-messages',
  'thread-link',
  'always-rules',
  'attachments',
  'file-search',
  'catalog',
  'auth-subscription',
  'conversation-sessions',
  'session-title',
  'link-targets',
  'document-touched',
  'questions',
  'context-usage',
  'profile-set',
] as const;
export const TEXT_ATTACHMENT_EXTENSIONS = [
  'txt', 'md', 'mdx', 'markdown', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'csv', 'log', 'diff', 'patch',
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'scss', 'html', 'xml', 'svg', 'sql', 'sh', 'py', 'java',
  'kt', 'go', 'rs', 'rb', 'php', 'c', 'h', 'cpp', 'cs', 'swift', 'gradle', 'properties',
] as const;
