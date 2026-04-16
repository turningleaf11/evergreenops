import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { GripVertical, RotateCcw, PanelLeft, PanelRight } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WIDGET_REGISTRY, type WidgetConfig } from "./widgetRegistry";

interface WidgetCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets: WidgetConfig[];
  onSave: (widgets: WidgetConfig[]) => void;
  onReset: () => void;
}

function SortableItem({ widget, onToggle, onColumnToggle }: { widget: WidgetConfig; onToggle: () => void; onColumnToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const meta = WIDGET_REGISTRY.find((w) => w.id === widget.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 rounded-xl border bg-card"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{meta?.label || widget.id}</p>
        <p className="text-[10px] text-muted-foreground">{meta?.description || ""}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onColumnToggle}
        title={widget.column === "left" ? "Move to right column" : "Move to left column"}
      >
        {widget.column === "left" ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelRight className="h-3.5 w-3.5" />}
      </Button>
      <Switch checked={widget.visible} onCheckedChange={onToggle} />
    </div>
  );
}

export function WidgetCustomizer({ open, onOpenChange, widgets, onSave, onReset }: WidgetCustomizerProps) {
  const [local, setLocal] = useState<WidgetConfig[]>(widgets);

  useEffect(() => {
    setLocal(widgets);
  }, [widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = local.findIndex((w) => w.id === active.id);
    const newIdx = local.findIndex((w) => w.id === over.id);
    const reordered = arrayMove(local, oldIdx, newIdx).map((w, i) => ({ ...w, sort_order: i }));
    setLocal(reordered);
    onSave(reordered);
  };

  const toggleWidget = (id: string) => {
    const updated = local.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
    setLocal(updated);
    onSave(updated);
  };

  const toggleColumn = (id: string) => {
    const updated = local.map((w) =>
      w.id === id ? { ...w, column: w.column === "left" ? "right" as const : "left" as const } : w
    );
    setLocal(updated);
    onSave(updated);
  };

  const leftWidgets = local.filter((w) => w.column === "left");
  const rightWidgets = local.filter((w) => w.column === "right");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Customize Home</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <PanelLeft className="h-3 w-3" /> Left Column — My Day
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={leftWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {leftWidgets.map((w) => (
                    <SortableItem
                      key={w.id}
                      widget={w}
                      onToggle={() => toggleWidget(w.id)}
                      onColumnToggle={() => toggleColumn(w.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <PanelRight className="h-3 w-3" /> Right Column — Company
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rightWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {rightWidgets.map((w) => (
                    <SortableItem
                      key={w.id}
                      widget={w}
                      onToggle={() => toggleWidget(w.id)}
                      onColumnToggle={() => toggleColumn(w.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <Button variant="ghost" size="sm" className="w-full gap-1.5 text-muted-foreground" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
