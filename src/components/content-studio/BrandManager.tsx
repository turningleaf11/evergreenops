import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useContentBrands, type ContentBrand } from "@/hooks/useContentStudio";
import { toast } from "sonner";

export function BrandManager() {
  const { brands, loading, create, update, remove } = useContentBrands();
  const [openId, setOpenId] = useState<string | null>(null);

  const addBrand = async () => {
    await create({
      name: "New Brand",
      color: "#3b82f6",
      audience: "",
      voice: "",
      mission: "",
      seeds: [],
      canva_kit_id: null,
    });
    toast.success("Brand added");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Edit voice, audience, and seeds — these shape every generated post.</p>
        <Button onClick={addBrand} size="sm"><Plus className="h-4 w-4 mr-1" /> Add brand</Button>
      </div>

      {brands.map((b) => (
        <BrandRow
          key={b.id}
          brand={b}
          open={openId === b.id}
          onToggle={() => setOpenId(openId === b.id ? null : b.id)}
          onUpdate={(patch) => update(b.id, patch)}
          onDelete={() => { if (confirm(`Delete "${b.name}"?`)) remove(b.id); }}
        />
      ))}
    </div>
  );
}

function BrandRow({ brand, open, onToggle, onUpdate, onDelete }: {
  brand: ContentBrand;
  open: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<ContentBrand>) => void;
  onDelete: () => void;
}) {
  const [seedsText, setSeedsText] = useState(brand.seeds.join("\n"));

  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: brand.color }} />
          <span className="font-semibold">{brand.name}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Brand name</Label>
              <Input value={brand.name} onChange={(e) => onUpdate({ name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Accent color (hex)</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={brand.color}
                  onChange={(e) => onUpdate({ color: e.target.value })}
                  className="w-14 p-1 h-10"
                />
                <Input value={brand.color} onChange={(e) => onUpdate({ color: e.target.value })} />
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Audience</Label>
            <Input value={brand.audience} onChange={(e) => onUpdate({ audience: e.target.value })} placeholder="who you're talking to" />
          </div>
          <div>
            <Label className="text-xs">Mission / goal</Label>
            <Input value={brand.mission} onChange={(e) => onUpdate({ mission: e.target.value })} placeholder="what this brand exists to do" />
          </div>
          <div>
            <Label className="text-xs">Voice & examples</Label>
            <Textarea
              value={brand.voice}
              onChange={(e) => onUpdate({ voice: e.target.value })}
              className="min-h-[120px]"
              placeholder="Describe tone, length, do's and don'ts. Add 2-3 example phrases in quotes."
            />
          </div>
          <div>
            <Label className="text-xs">Seed prompts (one per line)</Label>
            <Textarea
              value={seedsText}
              onChange={(e) => setSeedsText(e.target.value)}
              onBlur={() => onUpdate({ seeds: seedsText.split("\n").map((s) => s.trim()).filter(Boolean) })}
              className="min-h-[100px]"
              placeholder="quick post ideas you reuse"
            />
          </div>
          <div>
            <Label className="text-xs">Canva brand kit ID (optional)</Label>
            <Input
              value={brand.canva_kit_id || ""}
              onChange={(e) => onUpdate({ canva_kit_id: e.target.value || null })}
              placeholder="kAG_XUelwe4"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete brand
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
