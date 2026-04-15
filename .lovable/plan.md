

# Fix Dark Mode Animation + Evolve Crystal Style Direction

## Problems
1. **Distracting animation in dark mode**: The `mesh-drift` keyframe animation moves gradient blobs around every 20s. In dark mode where contrast is higher, this creates visible, distracting color shifts.
2. **Crystal style needs a clearer identity**: You've identified styles you like — minimalism, material design, aurora/ethereal, and spatial. Crystal should lean into the aurora/ethereal direction while staying clean and professional.

## Changes

### 1. Remove the animation, keep static gradients (`src/index.css`)
- Delete the `mesh-drift` keyframe animation entirely
- Keep the gradient blobs but make them **static** — fixed position, no movement
- In dark mode, reduce blob opacity further (8-10%) so they're ambient atmosphere, not attention-grabbing
- In light mode, keep them slightly more visible (12-16%) for warmth

### 2. Refine the aurora/ethereal feel
- Shift from harsh accent-colored blobs to **softer, wider gradients** with more spread (larger ellipses, lower opacity)
- Use a **two-tone palette** — primary + a complementary cool tone — instead of monochrome blobs
- This gives the "aurora" feel: soft color washes at the edges of the viewport, not concentrated blobs

### 3. No component changes needed
Pure CSS edit in `src/index.css`.

## Files

| Action | File |
|--------|------|
| Edit | `src/index.css` — Remove animation, refine static gradients for aurora feel |

