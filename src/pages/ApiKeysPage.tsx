import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import ApiKeysManagement from "../components/ApiKeysManagement";

export default function ApiKeysPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Manage your Spenny AI API keys for secure access and integration
            with Claude MCP and other tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeysManagement />
        </CardContent>
      </Card>
    </div>
  );
}
