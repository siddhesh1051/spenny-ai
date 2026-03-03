import { cn } from "@/lib/utils";
import type { ChartConfig, UiNode } from "./types";
import { CategoryChart, ExpenseLoggedSection, ExpenseTableSection, InsightBox } from "./widgets";

export function renderUiNode(
    node: UiNode,
    chartFromResponse?: ChartConfig | null,
    key?: React.Key,
    onUndoLoggedExpenses?: (ids: string[]) => Promise<void>,
): React.ReactNode {
    switch (node.kind) {
        case "column":
            return (
                <div key={key} className="space-y-4">
                    {node.children.map((child: UiNode, idx: number) =>
                        renderUiNode(child, chartFromResponse, idx, onUndoLoggedExpenses)
                    )}
                </div>
            );
        case "row":
            return (
                <div key={key} className="grid gap-3 md:grid-cols-3">
                    {node.children.map((child: UiNode, idx: number) => renderUiNode(child, chartFromResponse, idx, onUndoLoggedExpenses))}
                </div>
            );
        case "summary":
            return (
                <div
                    key={node.id}
                    className="rounded-xl border bg-card/80 backdrop-blur-sm p-3 flex flex-col gap-1"
                >
                    <div className="text-xs text-muted-foreground truncate">{node.heading}</div>
                    <div className="text-base font-bold leading-tight">{node.primary}</div>
                    {node.secondary && (
                        <div
                            className={cn(
                                "text-xs",
                                node.sentiment === "up"
                                    ? "text-emerald-500"
                                    : node.sentiment === "down"
                                        ? "text-orange-500"
                                        : "text-muted-foreground"
                            )}
                        >
                            {node.secondary}
                        </div>
                    )}
                </div>
            );
        case "block":
            if (node.style === "subheading") {
                return (
                    <p
                        key={key}
                        className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                    >
                        {node.text}
                    </p>
                );
            }
            if (node.style === "insight") {
                return <InsightBox key={key} text={node.text} />;
            }
            return (
                <p key={key} className="text-sm text-muted-foreground leading-relaxed">
                    {node.text}
                </p>
            );
        case "visual": {
            const chart: ChartConfig =
                chartFromResponse && chartFromResponse.data.length
                    ? chartFromResponse
                    : {
                        kind: node.variant === "donut" ? "category_pie" : "category_bar",
                        xKey: node.x,
                        yKey: node.y,
                        data: node.points.map((p) => ({
                            name: p.label,
                            value: p.value,
                            percentage: p.share ?? undefined,
                        })),
                    };
            return <CategoryChart key={key} chart={chart} />;
        }
        case "table": {
            if (node.variant === "records") {
                return <ExpenseTableSection key={key} expenses={node.rows} />;
            }
            return null;
        }
        case "collection": {
            return (
                <ExpenseLoggedSection
                    key={key}
                    loggedExpenses={node.items}
                    text={node.text}
                    onUndo={onUndoLoggedExpenses}
                />
            );
        }
        default:
            return null;
    }
}