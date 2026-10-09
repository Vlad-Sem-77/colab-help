import { Fragment, type ReactNode } from "react";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";

hljs.registerLanguage("python", python);

type HighlightNode = {
  children: Array<string | HighlightNode>;
  scope?: string;
};

type HighlightRoot = {
  rootNode: HighlightNode;
};

function scopeClassNames(scope: string): string {
  const [base, ...modifiers] = scope.split(".");
  return [
    `hljs-${base}`,
    ...modifiers.map((modifier) => `${modifier}_`),
  ].join(" ");
}

function renderPlainCode(text: string, keyPrefix: string): ReactNode {
  const identifierPattern = /[\p{L}_][\p{L}\p{N}_]*/gu;
  const pieces: ReactNode[] = [];
  let lastIndex = 0;
  let partIndex = 0;

  for (const match of text.matchAll(identifierPattern)) {
    const identifier = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      pieces.push(text.slice(lastIndex, start));
    }

    const isFunctionCall = /^\s*\(/.test(text.slice(start + identifier.length));
    pieces.push(
      <span
        key={`${keyPrefix}-identifier-${partIndex}`}
        className={isFunctionCall ? "hljs-function-call" : "hljs-variable"}
      >
        {identifier}
      </span>,
    );

    lastIndex = start + identifier.length;
    partIndex += 1;
  }

  if (lastIndex < text.length) {
    pieces.push(text.slice(lastIndex));
  }

  return pieces.length > 0
    ? <Fragment key={keyPrefix}>{pieces}</Fragment>
    : text;
}

function renderHighlightNode(
  node: string | HighlightNode,
  key: string,
  highlightIdentifiers = true,
): ReactNode {
  if (typeof node === "string") {
    return highlightIdentifiers ? renderPlainCode(node, key) : node;
  }

  const highlightChildren = !node.scope || node.scope === "params";
  const children = node.children.map((child, index) =>
    renderHighlightNode(child, `${key}-${index}`, highlightChildren),
  );

  if (!node.scope) {
    return <Fragment key={key}>{children}</Fragment>;
  }

  return (
    <span key={key} className={scopeClassNames(node.scope)}>
      {children}
    </span>
  );
}

export function PythonCode({ source }: { source: string }) {
  const highlighted = hljs.highlight(source, {
    language: "python",
    ignoreIllegals: true,
  });
  const rootNode = (
    highlighted._emitter as unknown as HighlightRoot
  ).rootNode;

  return (
    <pre className="notebook-code-source text-sm font-mono p-4 rounded bg-muted/50 overflow-x-auto whitespace-pre-wrap break-words text-blue-100">
      <code className="language-python">
        {rootNode.children.map((node, index) =>
          renderHighlightNode(node, `token-${index}`),
        )}
      </code>
    </pre>
  );
}
