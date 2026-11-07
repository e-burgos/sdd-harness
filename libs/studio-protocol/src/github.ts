import { z } from 'zod';

export const MAX_GITHUB_CYCLES = 64;

const RepoName = z.string().min(1).max(100).regex(/^[A-Za-z0-9._-]+$/);

export const GithubRemote = z.object({ url: z.string().min(1).max(512), owner: RepoName, name: RepoName });
export type GithubRemote = z.infer<typeof GithubRemote>;

export const GithubStatus = z.object({
  gh: z.object({ installed: z.boolean(), authenticated: z.boolean(), user: z.string().max(100).nullable() }),
  git: z.object({ repo: z.boolean(), branch: z.string().max(256).nullable(), hasCommits: z.boolean() }),
  remote: GithubRemote.nullable(),
  workflow: z.boolean(),
});
export type GithubStatus = z.infer<typeof GithubStatus>;

export const GithubConnectRequest = z.object({
  generationId: z.string().min(1).max(64).optional(),
  name: RepoName.optional(),
  owner: RepoName.optional(),
  visibility: z.enum(['private', 'public']),
  protect: z.boolean(),
});
export type GithubConnectRequest = z.infer<typeof GithubConnectRequest>;

export const GithubConnectResult = z.object({
  ok: z.boolean(),
  remote: GithubRemote.nullable(),
  protected: z.boolean(),
  error: z.string().max(2000).nullable(),
});
export type GithubConnectResult = z.infer<typeof GithubConnectResult>;

export const GithubChecks = z.enum(['success', 'failure', 'pending', 'none']);
export type GithubChecks = z.infer<typeof GithubChecks>;

export const CycleGithub = z.object({
  specId: z.string().min(1),
  cycle: z.string().regex(/^cycle-\d{2}$/),
  branch: z.string().min(1).max(256),
  pr: z
    .object({
      number: z.number().int().positive(),
      url: z.string().min(1).max(512),
      state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
      isDraft: z.boolean(),
    })
    .nullable(),
  checks: GithubChecks,
});
export type CycleGithub = z.infer<typeof CycleGithub>;

export const SnapshotGithub = z.object({
  remote: GithubRemote.nullable(),
  cycles: z.array(CycleGithub).max(MAX_GITHUB_CYCLES),
});
export type SnapshotGithub = z.infer<typeof SnapshotGithub>;
