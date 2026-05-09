import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client"; // Adjust path as needed
import { toast } from "sonner"; // Assuming sonner is used for toasts

interface AgentFormValues {
  name: string;
  slug: string;
  emoji: string;
  subtitle: string;
  role: string;
  type: string;
  status: string;
  accent_color: string;
  bio: string;
  skills: string;
}

interface Agent {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  subtitle: string;
  role: string;
  type: string;
  status: string;
  accent_color: string;
  bio: string;
  skills: string[]; // Expecting array from DB, but form handles string
}

interface AgentFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  agent?: Agent | null; // null/undefined = create mode
}

export function AgentFormDialog({ open, onClose, onSaved, agent }: AgentFormDialogProps) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AgentFormValues>({
    defaultValues: {
      name: "",
      slug: "",
      emoji: "",
      subtitle: "",
      role: "",
      type: "assistant", // Default value
      status: "active", // Default value
      accent_color: "#6366f1", // Default value
      bio: "",
      skills: "",
    },
  });

  const name = watch("name");

  // Auto-slug generation
  useEffect(() => {
    if (name && !agent && !watch("slug")) { // Only auto-slug if in create mode and slug is empty
      setValue("slug", name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ''));
    }
  }, [name, agent, watch, setValue]);

  // Populate form when agent prop changes (edit mode)
  useEffect(() => {
    if (agent) {
      reset({
        name: agent.name || "",
        slug: agent.slug || "",
        emoji: agent.emoji || "",
        subtitle: agent.subtitle || "",
        role: agent.role || "",
        type: agent.type || "assistant",
        status: agent.status || "active",
        accent_color: agent.accent_color || "#6366f1",
        bio: agent.bio || "",
        skills: agent.skills?.join(", ") || "", // Join array to string for input
      });
    } else {
      reset(); // Reset to defaults if no agent (create mode)
    }
  }, [agent, reset]);

  const onSubmit = async (data: AgentFormValues) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      toast.error("User not authenticated.");
      return;
    }

    // Prepare skills array
    const skillsArray = data.skills.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      name: data.name,
      slug: data.slug,
      emoji: data.emoji,
      subtitle: data.subtitle,
      role: data.role,
      type: data.type,
      status: data.status,
      accent_color: data.accent_color,
      bio: data.bio,
      skills: skillsArray,
      user_id: userId, // Assuming user_id needs to be set
    };

    try {
      let result;
      if (agent && agent.id) { // Edit mode
        result = await supabase.from("agents").update(payload).eq("id", agent.id);
         if (result.error) throw result.error;
        toast.strong("Agent updated successfully!");
      } else { // Create mode
        result = await supabase.from("agents").insert(payload);
         if (result.error) throw result.error;
        toast.strong("Agent created successfully!");
      }
      onSaved();
      onClose();
    } catch (error: any) {
      console.error("Error submitting agent form:", error);
      if (error.code === '23505') { // Likely slug uniqueness error
        toast.error("Slug already exists. Please choose a unique slug.");
        errors.slug = { type: "manual", message: "Slug already exists." };
      } else {
        toast.error(`Error: ${error.message || 'Failed to save agent.'}`);
      }
    }
  };

  const handleClose = () => {
    reset(); // Clear form on close
    onClose();
  };

  // Get agent status options
  const statusOptions = ["active", "inactive", "beta"];
  const typeOptions = ["assistant", "specialist", "tool"]; // Assuming some types

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? null : handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit Agent" : "Add New Agent"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Controller
                name="name"
                control={control}
                rules={{ required: "Name is required" }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="name"
                    className="col-span-3"
                    error={!!errors.name}
                  />
                )}
              />
              {errors.name && <p className="text-red-500 text-xs col-span-3 col-start-2">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="slug" className="text-right">Slug</Label>
              <Controller
                name="slug"
                control={control}
                rules={{
                  required: "Slug is required",
                  pattern: {
                    value: /^[a-z0-9-]+$/,
                    message: "Slug must be lowercase alphanumeric with hyphens",
                  },
                }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="slug"
                    className="col-span-3"
                    error={!!errors.slug}
                  />
                )}
              />
              {errors.slug && <p className="text-red-500 text-xs col-span-3 col-start-2">{errors.slug.message}</p>}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="emoji" className="text-right">Emoji</Label>
              <Controller
                name="emoji"
                control={control}
                rules={{ maxLength: 2, message: "Max 2 characters" }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="emoji"
                    className="col-span-3"
                    maxLength={2}
                    error={!!errors.emoji}
                  />
                )}
              />
               {errors.emoji && <p className="text-red-500 text-xs col-span-3 col-start-2">{errors.emoji.message}</p>}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subtitle" className="text-right">Subtitle</Label>
              <Controller
                name="subtitle"
                control={control}
                render={({ field }) => (
                  <Input {...field} id="subtitle" className="col-span-3" />
                )}
              />
            </div>

             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Role</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Input {...field} id="role" className="col-span-3" />
                )}
              />
            </div>

             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Controller
                    name="type"
                    control={control}
                    rules={{ required: "Type is required" }}
                    render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select agent type" />
                        </SelectTrigger>
                        <SelectContent>
                        {typeOptions.map((type) => (
                            <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    )}
                />
                {errors.type && <p className="text-red-500 text-xs col-span-3 col-start-2">{errors.type.message}</p>}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
               <Controller
                  name="status"
                  control={control}
                  rules={{ required: "Status is required" }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select agent status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.status && <p className="text-red-500 text-xs col-span-3 col-start-2">{errors.status.message}</p>}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="accent_color" className="text-right">Accent Color</Label>
              <Controller
                name="accent_color"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="accent_color"
                    type="color"
                    className="col-span-3 h-10 p-1" // Adjust height/padding for color input
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bio" className="text-right">Bio</Label>
              <Controller
                name="bio"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="bio"
                    className="col-span-3 min-h-[100px]"
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="skills" className="text-right">Skills</Label>
              <Controller
                name="skills"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="skills"
                    placeholder="Comma-separated skills"
                    className="col-span-3"
                  />
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : (agent ? "Update Agent" : "Add Agent")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
