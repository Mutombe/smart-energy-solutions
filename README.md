# Smart Energy Solutions — website

Static site with no framework. Open `index.html` through any web server (for example `python -m http.server`).

## Structure
- `_src/pages/*.html`: page bodies. **Edit these**, then run `node _src/build.js` to regenerate the root `*.html` files with the shared nav, menu and footer.
- `assets/css/style.css`: the design system (tokens at the top: brand charcoal `#303030`, green `#00A254` and lime `#A8CC3C`, all sampled from the logo).
- `assets/js/main.js`: loader, hero choreography, live Harare clock, scroll reveals, charts, calculator and Zimbabwe dot map.
- `assets/img/photos`: every supplied photo, renamed by subject and converted to WebP.
- `assets/img/obj`: 3D objects ray-marched by `_src/tools/render3d.py` (`python _src/tools/render3d.py assets/img/obj [name…]`).

## Before launch, replace these placeholders
- Phone, email, address, hours and social links (footer, menu, contact page).
- Stats (4.8 MWp, 1,200+, 3,380 t, 78%, <24h), project names, sizes and locations, CO₂ chart data, and testimonials.
- Claims to confirm: SAZS standards, in-house crews, warranties, 6,000-cycle batteries, payment plans.
- Forms are front-end only (`data-demo`). Connect them to email or a CRM.
- **The iStock images are watermarked previews.** License them and drop the clean files in with the same names.
