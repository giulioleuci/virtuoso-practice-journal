import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Keep the scroll cues outside the viewport so they never cover an option. */
export function ScrollList({ children, className }: { children: ReactNode; className?: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ above: false, below: false });
  const measure = () => {
    const node = viewport.current;
    if (node) setEdges({ above: node.scrollTop > 1, below: node.scrollTop + node.clientHeight < node.scrollHeight - 1 });
  };
  useLayoutEffect(() => {
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    if (viewport.current) observer?.observe(viewport.current);
    if (content.current) observer?.observe(content.current);
    return () => observer?.disconnect();
  }, [children]);
  return <div className="min-h-0">
    <div aria-hidden="true" data-scroll-cue="above" className={cn((edges.above || edges.below) ? "flex h-5 items-center justify-center text-primary" : "hidden", !edges.above && "invisible")}><ChevronUp className="h-4 w-4" /></div>
    <div ref={viewport} tabIndex={0} onScroll={measure} className={cn("max-h-[min(16rem,40dvh,calc(var(--radix-popover-content-available-height,100dvh)_-_4rem))] overflow-y-auto overscroll-contain", className)}>
      <div ref={content}>{children}</div>
    </div>
    <div aria-hidden="true" data-scroll-cue="below" className={cn((edges.above || edges.below) ? "flex h-5 items-center justify-center text-primary" : "hidden", !edges.below && "invisible")}><ChevronDown className="h-4 w-4" /></div>
  </div>;
}
