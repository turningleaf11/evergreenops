// Cover presets for the DocCover picker.
// `cover_url` uses a prefix convention to support non-image covers:
//  - "gradient:<css linear-gradient(...)>"  → rendered as background-image
//  - "color:#hex"                            → rendered as solid background-color
//  - anything else                           → treated as an image URL

export const GRADIENT_PRESETS: { id: string; value: string; label: string }[] = [
  { id: "g1",  label: "Sunset",     value: "gradient:linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)" },
  { id: "g2",  label: "Aurora",     value: "gradient:linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { id: "g3",  label: "Mint",       value: "gradient:linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)" },
  { id: "g4",  label: "Peach",      value: "gradient:linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)" },
  { id: "g5",  label: "Ocean",      value: "gradient:linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)" },
  { id: "g6",  label: "Berry",      value: "gradient:linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)" },
  { id: "g7",  label: "Forest",     value: "gradient:linear-gradient(135deg, #134e5e 0%, #71b280 100%)" },
  { id: "g8",  label: "Midnight",   value: "gradient:linear-gradient(135deg, #232526 0%, #414345 100%)" },
  { id: "g9",  label: "Coral",      value: "gradient:linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)" },
  { id: "g10", label: "Sky",        value: "gradient:linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
  { id: "g11", label: "Lavender",   value: "gradient:linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)" },
  { id: "g12", label: "Rose Gold",  value: "gradient:linear-gradient(135deg, #ffd1ff 0%, #fad0c4 100%)" },
];

export const COLOR_PRESETS: { id: string; value: string; label: string }[] = [
  { id: "c1",  label: "Sand",    value: "color:#fef3e6" },
  { id: "c2",  label: "Sage",    value: "color:#e7f0e6" },
  { id: "c3",  label: "Sky",     value: "color:#e1eefb" },
  { id: "c4",  label: "Lilac",   value: "color:#ece4f7" },
  { id: "c5",  label: "Blush",   value: "color:#fbe5ea" },
  { id: "c6",  label: "Slate",   value: "color:#e6e8ec" },
  { id: "c7",  label: "Charcoal",value: "color:#2c2f36" },
  { id: "c8",  label: "Forest",  value: "color:#1f3b2d" },
];

// Curated photo URLs (Unsplash CDN, no auth required for direct use).
// Sized to ~1600w for cover quality without huge payload.
export const PHOTO_PRESETS: { id: string; thumb: string; full: string; label: string }[] = [
  { id: "p1",  label: "Mountains",  thumb: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=400&q=70", full: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1600&q=85" },
  { id: "p2",  label: "Ocean",      thumb: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=70", full: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=85" },
  { id: "p3",  label: "Forest",     thumb: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=70", full: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&q=85" },
  { id: "p4",  label: "Desert",     thumb: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=400&q=70", full: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=85" },
  { id: "p5",  label: "City",       thumb: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400&q=70", full: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1600&q=85" },
  { id: "p6",  label: "Aurora",     thumb: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=400&q=70", full: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1600&q=85" },
  { id: "p7",  label: "Field",      thumb: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&q=70", full: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600&q=85" },
  { id: "p8",  label: "Mist",       thumb: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=400&q=70", full: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=1600&q=85" },
  { id: "p9",  label: "Workspace",  thumb: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=400&q=70", full: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=1600&q=85" },
  { id: "p10", label: "Architecture",thumb:"https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&q=70", full: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1600&q=85" },
  { id: "p11", label: "Texture",    thumb: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400&q=70", full: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1600&q=85" },
  { id: "p12", label: "Bloom",      thumb: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&q=70", full: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1600&q=85" },
];

export function parseCoverValue(value: string | null | undefined): {
  kind: "image" | "gradient" | "color" | "none";
  raw: string;
} {
  if (!value) return { kind: "none", raw: "" };
  if (value.startsWith("gradient:")) return { kind: "gradient", raw: value.slice("gradient:".length) };
  if (value.startsWith("color:"))    return { kind: "color",    raw: value.slice("color:".length) };
  return { kind: "image", raw: value };
}
