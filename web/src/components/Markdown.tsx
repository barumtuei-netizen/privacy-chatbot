import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="md-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderBlock(block: string, key: number): ReactNode {
  const trimmed = block.trim();

  if (trimmed.startsWith("```")) {
    const lines = trimmed.split("\n");
    const closingIdx = lines.length > 1 && lines[lines.length - 1].startsWith("```") ? lines.length - 1 : lines.length;
    const code = lines.slice(1, closingIdx).join("\n");
    return (
      <pre key={key} className="md-pre">
        <code>{code}</code>
      </pre>
    );
  }

  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
    return (
      <ul key={key} className="md-list">
        {lines.map((l, j) => (
          <li key={j}>{renderInline(l.trim().replace(/^[-*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }
  if (lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
    return (
      <ol key={key} className="md-list">
        {lines.map((l, j) => (
          <li key={j}>{renderInline(l.trim().replace(/^\d+\.\s+/, ""))}</li>
        ))}
      </ol>
    );
  }

  const rawLines = trimmed.split("\n");
  return (
    <p key={key} className="md-p">
      {rawLines.map((l, j) => (
        <span key={j}>
          {renderInline(l)}
          {j < rawLines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}

export default function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  return <>{blocks.map((block, i) => renderBlock(block, i))}</>;
}
