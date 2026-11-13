export const MAX_FRAME_BYTES = 1_048_576;
export const FRAME_BUDGET_BYTES = MAX_FRAME_BYTES - 8_192;
export const MAX_ATTACHMENTS = 5;
export const IMAGE_MAX_SIDE = 1568;
export const MAX_PROMPT_REFS = 5;
export const FILE_SEARCH_MAX = 50;
export const MAX_PENDING_PER_THREAD = 10;
export const MAX_LINK_TARGETS = 32;
export const MAX_READ_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_KIT_ENTRIES = 2000;
export const MAX_CYCLE_DOCUMENTS = 64;
export const MAX_CONFIG_BYTES = 65_536;
export const GENERATION_CHUNK_MAX = 32_768;
export const GENERATION_BUFFER_BYTES = 4 * 1024 * 1024;
export const MAX_DIR_ENTRIES = 500;
export const WS_CLOSE_WORKSPACE_SWITCHED = 4010;
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
  'kit-index',
  'kit-tools',
  'rtk-gain',
  'project-wizard',
  'workspace-switch',
  'github',
  'kit-integrations',
] as const;
export const TEXT_ATTACHMENT_EXTENSIONS = [
  'txt', 'md', 'mdx', 'markdown', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'csv', 'log', 'diff', 'patch',
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'scss', 'html', 'xml', 'svg', 'sql', 'sh', 'py', 'java',
  'kt', 'go', 'rs', 'rb', 'php', 'c', 'h', 'cpp', 'cs', 'swift', 'gradle', 'properties',
] as const;
