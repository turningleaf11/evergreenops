import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles } from "lucide-react";
import { useAddonEnabled } from "@/hooks/useAddonEnabled";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ContentGenerator } from "@/components/content-studio/ContentGenerator";
import { ContentLibrary } from "@/components/content-studio/ContentLibrary";
import { BrandManager } from "@/components/content-studio/BrandManager";

export default function ContentStudioPage() {
  const enabled = useAddonEnabled("content-studio");
  const [tab, setTab] = useState("generator");

  if (!enabled) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Card className="p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Content Studio</h1>
          <p className="text-muted-foreground mb-6">
            AI-powered multi-brand content generator. Enable this add-on to start creating posts for Facebook, Instagram, TikTok, LinkedIn and blog outlines.
          </p>
          <Button asChild>
            <Link to="/settings">Enable in Settings → Add-ons</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Content Studio</h1>
          <p className="text-sm text-muted-foreground">Generate, save, and ship content across every channel.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="generator">Generate</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
        </TabsList>
        <TabsContent value="generator" className="mt-6">
          <ContentGenerator />
        </TabsContent>
        <TabsContent value="library" className="mt-6">
          <ContentLibrary />
        </TabsContent>
        <TabsContent value="brands" className="mt-6">
          <BrandManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
