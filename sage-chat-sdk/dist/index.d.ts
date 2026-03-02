import * as react_jsx_runtime from 'react/jsx-runtime';

type Intent = "expense" | "query" | "insights" | "conversation";
type UiBlock = "table" | "monthly_spend" | "daily_trend" | "category_breakdown" | "category_pie" | "metrics" | "insight_text" | "logged_table" | "empty_state";
interface UiPlan {
    blocks: UiBlock[];
}
interface DbExpense {
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
}
interface CategoryItem {
    category: string;
    total: number;
    count: number;
    percentage: number;
}
interface MetricItem {
    label: string;
    value: string;
    change?: string;
    positive?: boolean;
}
interface SageResponse {
    intent: Intent;
    title?: string;
    text: string;
    expenses?: DbExpense[];
    categoryBreakdown?: CategoryItem[];
    groupBy?: string | null;
    totalAmount?: number;
    metrics?: MetricItem[];
    loggedExpenses?: {
        id?: string;
        description: string;
        category: string;
        amount: number;
    }[];
    filters?: {
        startDate?: string | null;
        endDate?: string | null;
        category?: string | null;
    };
    uiPlan?: UiPlan;
}

type SageChatContainerMode = "light" | "dark";
type SageChatContainerProps = {
    response: SageResponse;
    mode?: SageChatContainerMode;
    className?: string;
    currencySymbol?: string;
};
declare function SageChatContainer({ response, mode: forcedMode, className, currencySymbol, }: SageChatContainerProps): react_jsx_runtime.JSX.Element;

export { type CategoryItem, type DbExpense, type Intent, type MetricItem, SageChatContainer, type SageChatContainerMode, type SageChatContainerProps, type SageResponse, type UiBlock, type UiPlan };
