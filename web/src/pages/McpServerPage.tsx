import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import ApiKeysManagement from "../components/ApiKeysManagement";

export default function McpServerPage() {
  return (
    <div className="w-full p-4">
      <Card className="w-full">
        <CardHeader>
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
