import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Copy, Eye, EyeOff, Trash2, Plus, Key, Info } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "./ui/card";
import { Skeleton } from "./ui/Skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader as DialogHeaderUI,
  DialogTitle as DialogTitleUI,
  DialogDescription as DialogDescriptionUI,
} from "./ui/dialog";

const ApiKeysManagement = () => {
  const [apiKeys, setApiKeys] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<Record<string, any> | null>(
    null
  );
  const [showKey, setShowKey] = useState<{ [key: string]: boolean }>({});
  const [showHowToUse, setShowHowToUse] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for your API key");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_api_key", {
        key_name_param: newKeyName.trim(),
      });
      if (error) throw error;
      if (data && data.length > 0) {
        setGeneratedKey(data[0]);
        setNewKeyName("");
        setShowCreateForm(false);
        fetchApiKeys();
        toast.success("API key created successfully!");
        setShowHowToUse(true);
      }
    } catch (error) {
      console.error("Error creating API key:", error);
      toast.error("Failed to create API key. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    setRevokeKeyId(keyId);
  };

  const confirmDeleteApiKey = async () => {
    if (!revokeKeyId) return;
    try {
      const { error } = await supabase.rpc("revoke_api_key", {
        key_id_param: revokeKeyId,
      });
      if (error) throw error;
      fetchApiKeys();
      toast.success("API key revoked successfully");
    } catch (error) {
      console.error("Error revoking API key:", error);
      toast.error("Failed to revoke API key. Please try again.");
    } finally {
      setRevokeKeyId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy");
    }
  };

  const toggleShowKey = (keyId: string) => {
    setShowKey((prev) => ({
      ...prev,
      [keyId]: !prev[keyId],
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card className="my-6">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Key className="w-6 h-6" /> API Keys
            </div>
          </CardTitle>
          <CardDescription>Loading your API keys...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/4 mb-4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="my-6">
      <Dialog open={showHowToUse} onOpenChange={setShowHowToUse}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Key className="w-6 h-6" /> API Keys
            </CardTitle>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 cursor-pointer"
                title="How to use API Keys"
                onClick={() => setShowHowToUse(true)}
              >
                <Info className="w-5 h-5" />
              </Button>
            </DialogTrigger>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            variant="default"
            className="cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create API Key
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generated Key Display moved to modal */}
          {/* Create Form */}
          {showCreateForm && (
            <Card className="bg-muted/50">
              <CardContent className="py-4">
                <div className="text-lg font-medium mb-4">
                  Create New API Key
                </div>
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      htmlFor="keyName"
                    >
                      Key Name *
                    </label>
                    <Input
                      id="keyName"
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Claude MCP Access"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={createApiKey}
                      disabled={creating}
                      variant="default"
                      className="cursor-pointer"
                    >
                      {creating ? "Creating..." : "Create Key"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowCreateForm(false)}
                      className="cursor-pointer"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* API Keys List */}
          <div>
            {apiKeys.filter((key) => key.is_active !== false).length === 0 ? (
              <div className="text-center py-8">
                <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <div className="text-lg font-medium mb-2">No API Keys</div>
                <div className="text-muted-foreground">
                  Create your first API key to get started with Claude MCP
                  integration.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys
                  .filter((key) => key.is_active !== false)
                  .map((key) => (
                    <Card
                      key={key.id}
                      className={`border ${
                        !key.is_active
                          ? "border-destructive/30 bg-destructive/10"
                          : "border-border bg-card"
                      }`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="font-medium text-card-foreground">
                                {key.key_name}
                              </div>
                              <span
                                className={`px-2 py-1 text-xs rounded-full font-semibold ${
                                  !key.is_active
                                    ? "bg-destructive text-destructive"
                                    : "bg-success/20 text-success"
                                }`}
                              >
                                {!key.is_active ? "Revoked" : "Active"}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>Created: {formatDate(key.created_at)}</div>
                              {key.last_used_at && (
                                <div>
                                  Last used: {formatDate(key.last_used_at)}
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                {showKey[key.id]
                                  ? key.api_key_plain
                                  : "sk_••••••••••••••••••••••••"}
                              </span>
                              <Button
                                variant="ghost"
                                onClick={() => toggleShowKey(key.id)}
                                className="cursor-pointer"
                              >
                                {showKey[key.id] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  copyToClipboard(key.api_key_plain)
                                }
                                title="Copy API Key"
                                className="cursor-pointer"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {key.is_active && (
                              <Button
                                variant="ghost"
                                onClick={() => deleteApiKey(key.id)}
                                className="cursor-pointer"
                                title="Delete API Key"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </CardContent>
        {/* Modal for new API key and instructions */}
        <DialogContent>
          {generatedKey && (
            <div className="mb-6">
              <div className="text-lg font-medium mb-2 text-success">
                🎉 API Key Created Successfully!
              </div>
              <div className="text-sm mb-3 text-success-foreground">
                Please copy and save this API key now.
              </div>
              <div className="bg-background border rounded-lg p-3 font-mono text-sm flex items-center justify-between">
                <span className="text-card-foreground break-all">
                  {generatedKey.api_key}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => copyToClipboard(generatedKey.api_key)}
                  className="ml-2 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogHeaderUI>
            <DialogTitleUI>
              MCP Server Configuration for Claude Desktop
            </DialogTitleUI>
            <DialogDescriptionUI>
              <div className="space-y-2 pt-2">
                <p>
                  Use this structure in your{" "}
                  <code>claude_desktop_config.json</code> or{" "}
                  <code>mcp.json</code> file. Replace{" "}
                  <code>YOUR_API_KEY_HERE</code> with your actual API key.
                </p>
                <pre className="bg-muted rounded p-3 text-xs overflow-x-auto mt-1 mb-2">
                  <code>{`{
  "mcpServers": {
    "spenny-ai": {
      "command": "node",
      "args": ["/path/to/your/spenny-mcp-server.js"],
      "env": {
        "NODE_ENV": "production",
        "SPENNY_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}`}</code>
                </pre>
              </div>
            </DialogDescriptionUI>
          </DialogHeaderUI>
        </DialogContent>
      </Dialog>
      {/* Revoke confirmation modal */}
      <Dialog
        open={!!revokeKeyId}
        onOpenChange={(open) => !open && setRevokeKeyId(null)}
      >
        <DialogContent>
          <DialogHeaderUI>
            <DialogTitleUI>Delete API Key</DialogTitleUI>
            <DialogDescriptionUI>
              Are you sure you want to delete this API key? This action cannot
              be undone.
            </DialogDescriptionUI>
          </DialogHeaderUI>
          <div className="flex gap-3 justify-end mt-4">
            <Button
              className="cursor-pointer"
              variant="secondary"
              onClick={() => setRevokeKeyId(null)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              variant="destructive"
              onClick={confirmDeleteApiKey}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ApiKeysManagement;
