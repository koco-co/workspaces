import ReactMarkdown from "react-markdown";

export function AssistantText({ text }: { text: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-2">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
