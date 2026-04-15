---
name: Add-On Packs Architecture
description: SaaS-ready gating system with addon_packs catalog and workspace_addons enablement. useAddonEnabled hook for feature gating.
type: feature
---
Add-on packs provide modular feature gating for SaaS monetization:

- **addon_packs** table: slug, name, description, icon, price_tier, is_active
- **workspace_addons** junction: workspace_id, addon_id, enabled_by
- **useAddonEnabled(slug)** hook: returns boolean for conditional rendering
- **useAllAddons()** hook: lists all packs with toggle for Settings UI
- Settings → Add-Ons tab: marketplace-style grid with Switch toggles
- Sidebar/routing conditionally renders add-on pages based on workspace_addons
- Tables use `as any` cast since types auto-gen may lag behind migrations
