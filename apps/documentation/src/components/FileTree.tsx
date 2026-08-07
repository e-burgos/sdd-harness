import type { TreeNode } from '../data/content';

export function FileTree({ nodes }: { nodes: TreeNode[] }) {
  return (
    <div className="font-mono text-[12.5px] leading-[1.95]">
      {nodes.map((n) => (
        <TreeRow key={n.name} node={n} depth={0} />
      ))}
    </div>
  );
}

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const isDir = node.name.endsWith('/') || Boolean(node.children);
  return (
    <div>
      <div
        className="flex flex-wrap items-baseline gap-x-3"
        style={{ paddingLeft: `${depth * 1.15}rem` }}
      >
        <span
          className={
            node.accent
              ? 'text-accent-400'
              : isDir
                ? 'text-zinc-200'
                : 'text-zinc-400'
          }
        >
          {depth > 0 && <span className="mr-2 text-zinc-600">└</span>}
          {node.name}
        </span>
        {node.note && (
          <span className="text-[11px] tracking-wide text-zinc-500">
            {node.note}
          </span>
        )}
      </div>
      {node.children?.map((c) => (
        <TreeRow key={c.name} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}
