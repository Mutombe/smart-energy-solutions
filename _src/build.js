/* Builds the static site: wraps each _src/pages/*.html in the shared layout.
   Usage:  node _src/build.js
   Page files start with a JSON comment:  <!--{"title":"…","desc":"…","nav":"home"}-->
   Inside a page, {{nav}} drops in the in-hero navigation and {{cta}} the closing CTA. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const PAGES = path.join(__dirname, "pages");

const LINKS = [
  ["home", "index.html", "Home"],
  ["solutions", "solutions.html", "Solutions"],
  ["projects", "projects.html", "Projects"],
  ["about", "about.html", "About"],
  ["contact", "contact.html", "Contact"],
];
const ARROW = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW_R = `<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9h12M10.5 4.5L15 9l-4.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const cur = (nav, key) => (nav === key ? ' aria-current="page"' : "");

const heroNav = (nav) => `
    <nav class="site-nav" aria-label="Primary">
      <a class="brand" href="index.html" aria-label="Smart Energy Solutions — home"><img src="assets/img/logo-white.webp" alt="Smart Energy Solutions" width="460" height="352"></a>
      <div class="nav-links">${LINKS.map(([k, h, t]) => `<a href="${h}"${cur(nav, k)}>${t}</a>`).join("")}</div>
      <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
    </nav>
    <div class="notch notch--tr">
      <a class="hero-cta" href="contact.html#quote" data-cursor="Let’s talk">Get a free quote <span class="circ">${ARROW}</span></a>
    </div>`;

const cta = (img, alt, obj = "obj-sprout") => `
<section class="section section--tight">
  <div class="cta" data-reveal="scale">
    <div class="cta-bg" data-parallax=".1"><img src="assets/img/photos/${img}.webp" alt="${alt}" loading="lazy"></div>
    <img class="obj" src="assets/img/obj/${obj}.webp" alt="" aria-hidden="true" loading="lazy">
    <div class="container cta-inner">
      <div>
        <span class="eyebrow" style="color:rgba(255,255,255,.7)">Free site survey · no obligation</span>
        <h2 class="h1" style="margin-top:20px" data-lines>Ready to switch|on the <span class="tone-grad">sun?</span></h2>
      </div>
      <a class="btn btn--light" href="contact.html#quote">Book a site survey <span class="btn-ico">${ARROW}</span></a>
    </div>
  </div>
</section>`;

const layout = (meta, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<script>document.documentElement.classList.add("js")</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta.title}</title>
<meta name="description" content="${meta.desc}">
<meta name="theme-color" content="#1b1d1c">
<meta property="og:title" content="${meta.title}">
<meta property="og:description" content="${meta.desc}">
<meta property="og:image" content="assets/img/photos/${meta.og || "home-roof-panels"}.webp">
<link rel="icon" type="image/png" href="assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
${meta.preload ? `<link rel="preload" as="image" href="assets/img/photos/${meta.preload}.webp">` : ""}
</head>
<body class="is-loading">
<a class="skip-link" href="#main">Skip to content</a>
${meta.nav === "home" ? `<div class="loader" aria-hidden="true"><div class="loader-inner">
  <svg class="loader-mark" viewBox="0 0 120 120"><g><line class="ray" x1="60" y1="6" x2="60" y2="24"/><line class="ray" x1="22" y1="22" x2="34" y2="34" style="animation-delay:.08s"/><line class="ray" x1="98" y1="22" x2="86" y2="34" style="animation-delay:.16s"/><line class="ray" x1="4" y1="62" x2="22" y2="62" style="animation-delay:.24s"/><line class="ray" x1="98" y1="62" x2="116" y2="62" style="animation-delay:.32s"/></g><path class="arc" d="M34 74a26 26 0 1 1 52 0"/><path class="leaf" d="M36 76c10-12 34-14 50-4-6 18-34 26-50 4z"/></svg>
  <span class="loader-count">000</span></div></div>` : ""}

<nav class="float-nav" aria-label="Quick">
  <a class="fn-mark" href="index.html" aria-label="Home"><img src="assets/img/mark.png" alt="" width="256" height="256"></a>
  ${LINKS.slice(1).map(([k, h, t]) => `<a class="fn-link" href="${h}"${cur(meta.nav, k)}>${t}</a>`).join("")}
  <a class="btn" href="contact.html#quote">Free quote <span class="btn-ico">${ARROW}</span></a>
  <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="menu" style="background:rgba(255,255,255,.1)"><span></span><span></span></button>
</nav>

<div class="menu" id="menu" aria-hidden="true">
  <button class="menu-close" aria-label="Close menu">×</button>
  <div class="menu-links">${LINKS.map(([k, h, t], i) => `<a href="${h}"${cur(meta.nav, k)}><span>0${i + 1}</span>${t}</a>`).join("")}</div>
  <div class="menu-foot"><a href="tel:+263770000000">+263 77 000 0000</a><a href="mailto:hello@smartenergy.co.zw">hello@smartenergy.co.zw</a><span>Harare, Zimbabwe</span></div>
</div>

<main id="main">
${body.replace("{{nav}}", heroNav(meta.nav)).replace(/\{\{cta:([^|}]+)\|([^|}]+)(?:\|([^}]+))?\}\}/g, (_, i, a, o) => cta(i, a, o))}
</main>

<footer class="footer">
  <div class="container">
    <div class="footer-top">
      <div>
        <a class="brand" href="index.html"><img src="assets/img/logo-white.webp" alt="Smart Energy Solutions" width="460" height="352" loading="lazy"></a>
        <p>Solar, storage and energy engineering for homes, businesses and farms across Zimbabwe. Clean power that keeps the lights on.</p>
        <form class="news" data-demo aria-label="Newsletter">
          <input type="email" required placeholder="Your email for energy tips" aria-label="Email address">
          <button type="submit">Subscribe</button>
        </form>
        <p class="form-note" style="margin-top:8px"></p>
      </div>
      <div>
        <h4>Solutions</h4>
        <ul>
          <li><a href="solutions.html#residential">Home solar</a></li>
          <li><a href="solutions.html#commercial">Commercial &amp; industrial</a></li>
          <li><a href="solutions.html#storage">Battery storage</a></li>
          <li><a href="solutions.html#agri">Agri-solar &amp; irrigation</a></li>
          <li><a href="solutions.html#developers">Developers &amp; utility</a></li>
          <li><a href="solutions.html#care">Care &amp; maintenance</a></li>
        </ul>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="projects.html">Projects</a></li>
          <li><a href="about.html#impact">Impact</a></li>
          <li><a href="contact.html">Contact</a></li>
          <li><a href="contact.html#faq">FAQ</a></li>
        </ul>
      </div>
      <div>
        <h4>Talk to us</h4>
        <ul>
          <li><a href="tel:+263770000000">+263 77 000 0000</a></li>
          <li><a href="mailto:hello@smartenergy.co.zw">hello@smartenergy.co.zw</a></li>
          <li>Harare, Zimbabwe</li>
          <li>Mon–Fri · 08:00–17:00</li>
        </ul>
        <div class="socials">
          <a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z"/></svg></a>
          <a href="#" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9h4v12H4zM6 3a2.2 2.2 0 110 4.4A2.2 2.2 0 016 3zm4.5 6h3.8v1.7c.6-1 1.9-2 3.9-2 4 0 4.8 2.6 4.8 6V21h-4v-5.5c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21h-4z"/></svg></a>
          <a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".8" fill="currentColor"/></svg></a>
          <a href="#" aria-label="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5a9.5 9.5 0 00-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1012 2.5zm0 17.3c-1.5 0-2.9-.4-4.1-1.1l-.3-.2-2.8.8.8-2.7-.2-.3A7.8 7.8 0 1112 19.8zm4.3-5.8c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.4 6.4 0 01-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 00-.7.3 2.8 2.8 0 00-.9 2.1 4.9 4.9 0 001 2.6 11.2 11.2 0 004.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 001.7-1.2 2.1 2.1 0 00.1-1.2c0-.1-.2-.2-.4-.3z"/></svg></a>
        </div>
      </div>
    </div>
  </div>
  <div class="footer-word" aria-hidden="true">Smart</div>
  <div class="container footer-bottom">
    <span>© <span data-year>2026</span> Smart Energy Solutions. All rights reserved.</span>
    <span>Designed for sunlight · Harare, Zimbabwe</span>
  </div>
</footer>
<script>document.querySelectorAll("[data-year]").forEach(e=>e.textContent=new Date().getFullYear())</script>
<script src="assets/js/main.js" defer></script>
</body>
</html>
`;

for (const f of fs.readdirSync(PAGES).filter((f) => f.endsWith(".html"))) {
  const src = fs.readFileSync(path.join(PAGES, f), "utf8");
  const m = src.match(/^<!--(\{[\s\S]*?\})-->\s*/);
  if (!m) throw new Error(`${f}: missing JSON meta comment`);
  const meta = JSON.parse(m[1]);
  fs.writeFileSync(path.join(ROOT, f), layout(meta, src.slice(m[0].length)));
  console.log("built", f);
}
