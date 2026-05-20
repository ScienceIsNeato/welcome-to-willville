# Art Prompts

Source-controlled prompts for Willville image generation.

Goals:

- Keep every major image generation prompt reviewable and editable.
- Make animation/mask requirements explicit in the prompt instead of inferred after the fact.
- Track style direction separately from generated image files.
- Prefer versioned prompts (`willville-town-v2-*`) over overwriting old prompt text.

Workflow:

1. Edit a prompt in this folder.
2. Generate a draft image from the exact prompt text.
3. Save selected project-bound image assets under `public/art/`.
4. If the prompt includes chroma-key animation regions, extract masks from the generated image before compositing animated layers.
