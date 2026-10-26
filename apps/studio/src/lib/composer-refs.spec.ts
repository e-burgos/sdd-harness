import { MAX_PROMPT_REFS } from '@sdd-studio/protocol';
import { extractRefs, FIXED_COMMANDS, leadingSkillRef, mentionedAgents, resolveSlash } from './composer-refs';
import { PROMPT_COMMANDS } from './slash';

const agentIds = ['sdd-planner', 'sdd-reviewer', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];

describe('mentionedAgents', () => {
  it('finds tokens at the start, after spaces and before punctuation', () => {
    expect(mentionedAgents('@sdd-planner revisá esto con @sdd-reviewer, gracias', agentIds)).toEqual(['sdd-planner', 'sdd-reviewer']);
    expect(mentionedAgents('hola @sdd-planner.', agentIds)).toEqual(['sdd-planner']);
    expect(mentionedAgents('(@sdd-planner)', agentIds)).toEqual([]);
    expect(mentionedAgents('mirá @sdd-planner?\n@sdd-reviewer', agentIds)).toEqual(['sdd-planner', 'sdd-reviewer']);
  });

  it('ignores emails, embedded tokens, file-like suffixes and unknown ids', () => {
    expect(mentionedAgents('mail a@sdd-planner x', agentIds)).toEqual([]);
    expect(mentionedAgents('ver @sdd-planner.md', agentIds)).toEqual([]);
    expect(mentionedAgents('@nadie y @sdd-plannerx', agentIds)).toEqual([]);
  });

  it('dedupes and caps at five', () => {
    expect(mentionedAgents('@a1 @a1 @a1', agentIds)).toEqual(['a1']);
    expect(mentionedAgents('@a1 @a2 @a3 @a4 @a5 @a6', agentIds)).toHaveLength(MAX_PROMPT_REFS);
  });
});

describe('skills and resolution order', () => {
  const skillIds = ['sdd-planner', 'generate:react', 'gate'];

  it('takes the leading /id when it is a catalog skill and not a fixed command', () => {
    expect(leadingSkillRef('/generate:react con props', skillIds)).toBe('generate:react');
    expect(leadingSkillRef('  /sdd-planner', skillIds)).toBe('sdd-planner');
    expect(leadingSkillRef('/gate x', skillIds)).toBeNull();
    expect(leadingSkillRef('/inexistente', skillIds)).toBeNull();
    expect(leadingSkillRef('texto /sdd-planner', skillIds)).toBeNull();
  });

  it('resolves fixed command, then skill, then parseSlash', () => {
    expect(resolveSlash('/gate spec-1', skillIds)).toBe('fixed-command');
    expect(resolveSlash('/review', skillIds)).toBe('fixed-command');
    expect(resolveSlash('/generate:react', skillIds)).toBe('skill');
    expect(resolveSlash('/nada', skillIds)).toBe('parse-slash');
    expect(resolveSlash('hola', skillIds)).toBe('parse-slash');
  });

  it('derives fixed commands from the existing slash exports', () => {
    expect(FIXED_COMMANDS).toEqual(['gate', 'validate', ...Object.keys(PROMPT_COMMANDS)]);
  });
});

describe('extractRefs', () => {
  it('combines agents and the leading skill', () => {
    expect(extractRefs('/generate:react para @sdd-planner', { agentIds, skillIds: ['generate:react'] })).toEqual({
      agents: ['sdd-planner'],
      skills: ['generate:react'],
    });
  });

  it('is empty for plain text', () => {
    expect(extractRefs('hola', { agentIds, skillIds: [] })).toEqual({ agents: [], skills: [] });
  });
});
