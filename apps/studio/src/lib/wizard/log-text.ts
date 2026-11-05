import type { GenerationOutputChunk } from '@sdd-studio/protocol';

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');

export const stripAnsi = (text: string): string => text.replace(ANSI, '');

export const joinLog = (chunks: readonly GenerationOutputChunk[]): string => chunks.map((chunk) => stripAnsi(chunk.chunk)).join('');
