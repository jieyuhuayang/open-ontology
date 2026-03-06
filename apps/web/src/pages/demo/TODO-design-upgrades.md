# Design Upgrades — Mid-term Todo

Items from Gemini/Codex design review that require significant new code or shader work.

1. **Fresnel Edge Light + Noise Vertex Displacement** — Add Fresnel rim glow and vertex noise displacement to star meshes for organic "alive" feel
2. **Drag Line → Glowing Solid + Flowing Energy Particles** — Replace dashed drag line with a glowing solid line and animated energy particles traveling along it
3. **Link Establishment Shockwave** — When a link is confirmed, emit a radial shockwave from both stars + blend background color tint momentarily
4. **Cinematic Camera Transitions** — Phase transitions (IDLE→ABSORBING→COMPLETE) use cinematic zoom-out with smooth lerp, not instant cuts
5. **Semantic Gravity Field** — Stars exert gravitational pull on nearby background star dust, creating localized swirl patterns
6. **Gravity Writing** — Particle orbit brush strokes that trace semantic relationships with confidence-based line weight
7. **Manual Mode Entry Ambience** — On entering manual mode, reduce background noise by 20% and add a subtle mouse-following gravity ring
