/* Smart Energy Solutions — main.js
   Loader → hero choreography → scroll motion → charts, calculator, map. */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const fmt = (n, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

  /* ---------------------------------------------------------------- loader */
  const loader = $(".loader");
  const startHero = () => {
    document.body.classList.remove("is-loading");
    $$(".hero").forEach((h) => h.classList.add("is-in"));
  };
  if (loader && !sessionStorageGet("ses-seen")) {
    const count = $(".loader-count", loader);
    let n = 0;
    const t0 = performance.now();
    const tick = (t) => {
      n = Math.min(100, Math.round(((t - t0) / 1500) * 100));
      if (count) count.textContent = String(n).padStart(3, "0");
      if (n < 100) requestAnimationFrame(tick);
      else {
        loader.classList.add("is-done");
        setTimeout(startHero, 350);
        setTimeout(() => loader.remove(), 1300);
        sessionStorageSet("ses-seen", "1");
      }
    };
    requestAnimationFrame(tick);
  } else {
    loader && loader.remove();
    requestAnimationFrame(() => setTimeout(startHero, 60));
  }
  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch {} }

  /* ---------------------------------------------------------- Harare clock */
  const clock = $(".clock");
  if (clock) {
    const tEl = $(".clock-time", clock), dEl = $(".clock-date", clock), sEl = $(".clock-status b", clock);
    const upd = () => {
      const now = new Date();
      const opt = { timeZone: "Africa/Harare" };
      tEl.textContent = now.toLocaleTimeString("en-US", { ...opt, hour: "numeric", minute: "2-digit" });
      dEl.textContent = now.toLocaleDateString("en-US", { ...opt, weekday: "long", month: "short", day: "numeric" });
      const h = +now.toLocaleString("en-US", { ...opt, hour: "numeric", hour12: false });
      if (sEl) sEl.textContent = h >= 6 && h < 18 ? "Panels generating" : "Running on battery";
    };
    upd();
    setInterval(upd, 15000);
  }

  /* ------------------------------------------------------------ nav / menu */
  const floatNav = $(".float-nav");
  const hero = $(".hero");
  if (floatNav && hero) {
    new IntersectionObserver(([e]) => floatNav.classList.toggle("is-on", !e.isIntersecting), { rootMargin: "-120px 0px 0px 0px" }).observe(hero);
  }
  const menu = $(".menu");
  const openMenu = (open) => {
    if (!menu) return;
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
    $$(".nav-toggle").forEach((b) => b.setAttribute("aria-expanded", String(open)));
    if (open) $(".menu-close", menu).focus();
  };
  $$(".nav-toggle").forEach((b) => b.addEventListener("click", () => openMenu(true)));
  menu && $(".menu-close", menu).addEventListener("click", () => openMenu(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && openMenu(false));

  /* ----------------------------------------------------------- reveal on in */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        e.target.dispatchEvent(new CustomEvent("inview"));
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  $$("[data-reveal], .line-mask[data-in], .media--reveal, .chart, .footer, [data-count]").forEach((el) => io.observe(el));

  /* split headings into masked lines: <h2 data-lines>Line one|Line two</h2> */
  $$("[data-lines]").forEach((h) => {
    const parts = h.innerHTML.split("|");
    h.innerHTML = parts.map((p, i) => `<span class="line-mask"><span style="--d:${(i * 0.09).toFixed(2)}s">${p.trim()}</span></span>`).join("");
    const lio = new IntersectionObserver(([e]) => { if (e.isIntersecting) { h.classList.add("is-in"); lio.disconnect(); } }, { threshold: 0.3 });
    lio.observe(h);
  });

  /* ------------------------------------------------- statement word scrub */
  $$(".statement[data-scrub]").forEach((st) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) frag.appendChild(document.createTextNode(w));
            else { const s = document.createElement("span"); s.className = "w" + (node.classList && node.classList.contains("hl") ? " hl" : ""); s.textContent = w; frag.appendChild(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains("chip-img")) walk(n);
      });
    };
    walk(st);
    $$(".hl .w", st).forEach((w) => w.classList.add("hl"));
    st._words = $$(".w", st);
  });

  /* ------------------------------------------------------ scroll-driven fx */
  const parallax = $$("[data-parallax]");
  const scrubs = $$(".statement[data-scrub]");
  const heroImg = $(".hero-media img");
  const heroTitle = $(".hero-title");
  let ticking = false;
  const onScroll = () => {
    const vh = innerHeight;
    if (!reduce) {
      parallax.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        const amt = parseFloat(el.dataset.parallax) || 0.12;
        const img = el.tagName === "IMG" ? el : el.querySelector("img");
        if (img) img.style.transform = `translate3d(0, ${(-p * amt * 100).toFixed(2)}px, 0) scale(${1 + amt})`;
      });
      if (heroImg && hero && hero.classList.contains("is-in")) {
        const y = Math.min(scrollY, vh);
        heroImg.style.transform = `translate3d(0, ${y * 0.18}px, 0) scale(1)`;
        if (heroTitle) heroTitle.style.transform = `translate3d(0, ${y * -0.12}px, 0)`;
      }
    }
    scrubs.forEach((st) => {
      const r = st.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const n = Math.round(p * st._words.length);
      st._words.forEach((w, i) => w.classList.toggle("on", i < n));
    });
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
  hero && hero.addEventListener("transitionend", onScroll, { once: true });

  /* ----------------------------------------- touch: mirror hover in view */
  if (!fine) {
    const mio = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("is-inview", e.isIntersecting)), { rootMargin: "-38% 0px -38% 0px" });
    $$(".service-item").forEach((el) => mio.observe(el));
  }

  /* -------------------------------------------------------------- counters */
  $$("[data-count]").forEach((el) => {
    el.addEventListener("inview", () => {
      const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
      if (reduce) { el.textContent = fmt(end, dec); return; }
      const t0 = performance.now(), dur = 2000;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = fmt(end * e, dec);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  /* ---------------------------------------------------------- live widgets */
  $$("[data-live-battery]").forEach((w) => {
    const v = $(".w-v b", w), bar = $(".battery-bar", w);
    let lvl = 68 + Math.random() * 10;
    const upd = () => {
      lvl = Math.min(98, Math.max(55, lvl + (Math.random() - 0.35) * 2));
      v.textContent = Math.round(lvl);
      bar.style.setProperty("--lvl", lvl + "%");
    };
    upd(); setInterval(upd, 2600);
  });
  $$("[data-live-power]").forEach((w) => {
    const v = $(".w-v b", w), path = $(".spark .ln", w), fill = $(".spark .fill", w);
    const pts = Array.from({ length: 24 }, (_, i) => 3 + Math.sin(i / 3) * 0.6 + Math.random() * 0.6);
    const draw = () => {
      const max = Math.max(...pts) * 1.1, min = Math.min(...pts) * 0.8;
      const d = pts.map((p, i) => `${i ? "L" : "M"}${(i / 23) * 200},${34 - ((p - min) / (max - min)) * 30}`).join("");
      path.setAttribute("d", d); fill.setAttribute("d", d + "L200,34L0,34Z");
      v.textContent = pts[23].toFixed(1);
    };
    draw();
    setInterval(() => { pts.shift(); pts.push(Math.max(1.5, pts[22] + (Math.random() - 0.48) * 0.5)); draw(); }, 1800);
  });

  /* ---------------------------------------------------------- testimonials */
  $$(".testi").forEach((t) => {
    const slides = $$(".testi-slide", t), dots = $$(".testi-dots button", t);
    let i = 0, timer;
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle("is-active", k === i));
      dots.forEach((d, k) => d.setAttribute("aria-current", String(k === i)));
    };
    const auto = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => go(i + 1), 7000); };
    dots.forEach((d, k) => d.addEventListener("click", () => { go(k); auto(); }));
    $$("[data-testi]", t).forEach((b) => b.addEventListener("click", () => { go(i + +b.dataset.testi); auto(); }));
    go(0); auto();
  });

  /* ---------------------------------------------------- horizontal gallery */
  $$(".h-scroll").forEach((hs) => {
    const tr = $(".h-track", hs);
    $$("[data-dir]", hs).forEach((b) => b.addEventListener("click", () => tr.scrollBy({ left: +b.dataset.dir * tr.clientWidth * 0.6, behavior: "smooth" })));
    let down = false, sx = 0, sl = 0, moved = false;
    tr.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = tr.scrollLeft; });
    addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; tr.classList.add("is-drag"); } tr.scrollLeft = sl - dx; });
    addEventListener("pointerup", () => { down = false; tr.classList.remove("is-drag"); });
    tr.addEventListener("click", (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
    tr.addEventListener("dragstart", (e) => e.preventDefault());
  });

  /* -------------------------------------------------------------- filters */
  $$("[data-filter-group]").forEach((g) => {
    const items = $$(g.dataset.filterGroup);
    $$("button", g).forEach((b) => b.addEventListener("click", () => {
      $$("button", g).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const f = b.dataset.filter;
      items.forEach((it) => it.classList.toggle("is-hidden", f !== "all" && !it.dataset.cat.split(" ").includes(f)));
    }));
  });

  /* ---------------------------------------------------------------- cursor */
  if (fine && !reduce) {
    const c = document.createElement("div");
    c.className = "cursor"; c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    let x = 0, y = 0, cx = 0, cy = 0;
    addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; });
    const loop = () => { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; c.style.translate = `${cx}px ${cy}px`; requestAnimationFrame(loop); };
    loop();
    $$("[data-cursor]").forEach((el) => {
      el.addEventListener("pointerenter", () => { c.textContent = el.dataset.cursor; c.classList.add("on"); });
      el.addEventListener("pointerleave", () => c.classList.remove("on"));
    });
  }

  /* ------------------------------------------------------------------ forms */
  $$("form[data-demo]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const note = $(".form-note", f);
    if (!f.checkValidity()) { f.reportValidity(); return; }
    if (note) note.textContent = "Thank you. An energy specialist will contact you within one business day.";
    f.reset();
  }));

  /* footer word split */
  $$(".footer-word").forEach((w) => {
    w.innerHTML = [...w.textContent].map((ch, i) => `<span style="transition-delay:${i * 0.06}s">${ch}</span>`).join("");
  });

  /* ======================================================================
     CHARTS — hand-built SVG, two series max, direct labels + legend,
     crosshair tooltip, table view.
     ====================================================================== */
  const C = { ink: "#3a3a3a", green: "#00a254", lime: "#a8cc3c" };

  function tipFor(wrap) {
    let tip = $(".tip", wrap);
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("role", "status"); wrap.appendChild(tip); }
    return tip;
  }
  function tableFor(card, head, rows) {
    let btn = $(".table-toggle", card), tbl = $(".data-table", card);
    if (!btn) {
      btn = document.createElement("button"); btn.className = "table-toggle"; btn.type = "button"; btn.textContent = "Show data table";
      card.appendChild(btn);
      btn.addEventListener("click", () => { const t = $(".data-table", card); t.hidden = !t.hidden; btn.textContent = t.hidden ? "Show data table" : "Hide data table"; });
    }
    if (tbl) tbl.remove();
    tbl = document.createElement("table"); tbl.className = "data-table"; tbl.hidden = btn.textContent.startsWith("Show");
    tbl.innerHTML = `<thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`;
    card.appendChild(tbl);
  }
  const niceMax = (v) => { const st = v / 4, p = Math.pow(10, Math.floor(Math.log10(st))), m = st / p; return 4 * p * [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((k) => m <= k); };
  const sizeOf = (wrap, h) => { const W = Math.max(300, Math.round(wrap.clientWidth || 760)); return { W, H: Math.round(Math.min(h, Math.max(240, W * 0.5))), small: W < 560 }; };
  const redraw = [];
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => redraw.forEach((f) => f()), 200); });

  /* line chart: {labels, series:[{name,color,values,area?}], yFmt, annotate(fn)} */
  function lineChart(wrap, cfg) {
    if (!wrap._cfg) redraw.push(() => lineChart(wrap, wrap._cfg));
    wrap._cfg = cfg;
    wrap.querySelector("svg")?.remove();
    const { W, H, small } = sizeOf(wrap, 360), m = { t: 44, r: 16, b: 30, l: small ? 40 : 54 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": cfg.aria });
    wrap.prepend(svg);
    const all = cfg.series.flatMap((s) => s.values);
    const ymax = niceMax(Math.max(...all) * 1.05), n = cfg.labels.length;
    const x = (i) => m.l + (i / (n - 1)) * iw, y = (v) => m.t + ih - (v / ymax) * ih;
    const g = svgEl("g", { class: "grid" }, svg), ax = svgEl("g", { class: "axis" }, svg);
    for (let k = 0; k <= 4; k++) {
      const v = (ymax / 4) * k;
      svgEl("line", { x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v) }, g);
      svgEl("text", { x: m.l - 10, y: y(v) + 4, "text-anchor": "end" }, ax).textContent = cfg.yFmt(v);
    }
    const every = Math.ceil(n / (small ? 5 : 8));
    cfg.labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) svgEl("text", { x: x(i), y: H - 10, "text-anchor": "middle" }, ax).textContent = l; });
    const smooth = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    cfg.series.forEach((s) => {
      if (s.area) {
        const grad = svgEl("linearGradient", { id: "ga" + s.key, x1: 0, y1: 0, x2: 0, y2: 1 }, svgEl("defs", {}, svg));
        svgEl("stop", { offset: 0, "stop-color": s.color, "stop-opacity": 0.32 }, grad);
        svgEl("stop", { offset: 1, "stop-color": s.color, "stop-opacity": 0.02 }, grad);
        svgEl("path", { d: smooth(s.values) + `L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`, fill: `url(#ga${s.key})`, class: "fade" }, svg);
      }
      const p = svgEl("path", { d: smooth(s.values), fill: "none", stroke: s.color, "stroke-width": 2.25, "stroke-linejoin": "round", "stroke-linecap": "round", class: "draw", ...(s.dash ? { "stroke-dasharray": s.dash } : {}) }, svg);
      if (!s.dash) { const len = p.getTotalLength(); p.style.setProperty("--len", len); }
      const li = s.labelAt ?? n - 1, lv = s.values[li];
      const anchor = li === n - 1 ? "end" : li === 0 ? "start" : "middle";
      const ly = y(lv) - 26;
      svgEl("text", { x: x(li), y: ly, "text-anchor": anchor, class: "lbl-direct fade" }, svg).textContent = s.name;
      svgEl("text", { x: x(li), y: ly + 14, "text-anchor": anchor, class: "lbl-muted fade" }, svg).textContent = cfg.yFmt(lv, true);
    });
    cfg.annotate && cfg.annotate(svg, x, y, svgEl);
    // hover layer
    const hl = svgEl("line", { class: "hover-line", y1: m.t, y2: m.t + ih }, svg);
    const dots = cfg.series.map((s) => svgEl("circle", { r: 5, fill: s.color, stroke: "#fff", "stroke-width": 2, class: "hover-dot" }, svg));
    const hit = svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);
    const tip = tipFor(wrap);
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
      hl.setAttribute("x1", x(i)); hl.setAttribute("x2", x(i));
      cfg.series.forEach((s, k) => { dots[k].setAttribute("cx", x(i)); dots[k].setAttribute("cy", y(s.values[i])); });
      wrap.classList.add("is-hover");
      tip.innerHTML = `<b>${cfg.tipTitle ? cfg.tipTitle(i) : cfg.labels[i]}</b>` + cfg.series.map((s) => `<div class="r"><span><i style="--c:${s.color}"></i>${s.name}</span><em>${cfg.yFmt(s.values[i], true)}</em></div>`).join("");
      tip.style.left = (x(i) / W) * r.width + "px";
      tip.style.top = (y(Math.max(...cfg.series.map((s) => s.values[i]))) / H) * r.height + "px";
      tip.classList.add("on");
    };
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", () => { wrap.classList.remove("is-hover"); tip.classList.remove("on"); });
    if (wrap.classList.contains("is-in")) { wrap.classList.remove("is-in"); requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("is-in"))); }
  }

  /* bar chart: {labels, values, color, yFmt, highlight} */
  function barChart(wrap, cfg) {
    if (!wrap._cfg) redraw.push(() => barChart(wrap, wrap._cfg));
    wrap._cfg = cfg;
    wrap.querySelector("svg")?.remove();
    const { W, H, small } = sizeOf(wrap, 340), m = { t: 26, r: 8, b: 30, l: small ? 40 : 54 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b, n = cfg.values.length;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": cfg.aria });
    wrap.prepend(svg);
    const ymax = niceMax(Math.max(...cfg.values) * 1.08);
    const y = (v) => m.t + ih - (v / ymax) * ih;
    const g = svgEl("g", { class: "grid" }, svg), ax = svgEl("g", { class: "axis" }, svg);
    for (let k = 0; k <= 4; k++) {
      const v = (ymax / 4) * k;
      svgEl("line", { x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v) }, g);
      svgEl("text", { x: m.l - 10, y: y(v) + 4, "text-anchor": "end" }, ax).textContent = cfg.yFmt(v);
    }
    const slot = iw / n, bw = Math.min(46, slot * 0.62);
    const tip = tipFor(wrap);
    const maxI = cfg.values.indexOf(Math.max(...cfg.values));
    cfg.values.forEach((v, i) => {
      const cx = m.l + slot * i + slot / 2;
      const h = Math.max(2, y(0) - y(v));
      const col = i === maxI || (cfg.highlight && cfg.highlight(i)) ? cfg.accent || C.green : cfg.color;
      // rounded top, square base
      const r = 4, x0 = cx - bw / 2, y0 = y(v);
      const d = `M${x0},${y(0)}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${y(0)}Z`;
      const bar = svgEl("path", { d, fill: col, class: "grow", style: `transition-delay:${(i * 0.05).toFixed(2)}s` }, svg);
      if (!small || i % 2 === 0) svgEl("text", { x: cx, y: H - 10, "text-anchor": "middle" }, ax).textContent = cfg.labels[i];
      if (i === maxI) svgEl("text", { x: cx, y: y0 - 8, "text-anchor": "middle", class: "lbl-direct fade" }, svg).textContent = cfg.yFmt(v, true);
      const hit = svgEl("rect", { x: m.l + slot * i, y: m.t, width: slot, height: ih, fill: "transparent" }, svg);
      const show = () => {
        const rr = svg.getBoundingClientRect();
        tip.innerHTML = `<b>${cfg.tipTitle ? cfg.tipTitle(i) : cfg.labels[i]}</b><div class="r"><span><i style="--c:${col}"></i>${cfg.name}</span><em>${cfg.yFmt(v, true)}</em></div>`;
        tip.style.left = (cx / W) * rr.width + "px"; tip.style.top = (y0 / H) * rr.height + "px"; tip.classList.add("on");
        bar.style.opacity = 0.85;
      };
      hit.addEventListener("pointerenter", show); hit.addEventListener("pointerdown", show);
      hit.addEventListener("pointerleave", () => { tip.classList.remove("on"); bar.style.opacity = ""; });
    });
  }

  /* -------------------------------------------- savings calculator (home) */
  const calc = $("[data-calc]");
  if (calc) {
    const range = $("input[type=range]", calc), out = $("output", calc);
    const segs = $$(".seg button", calc);
    const chartWrap = $("#savings-chart");
    const card = chartWrap.closest(".chart-card");
    // Indicative model — tune these with the Smart Energy team.
    const PROFILES = {
      home:     { capex: 1150, offset: 0.85, label: "Home" },      // USD per kWp incl. lithium storage
      business: { capex: 820,  offset: 0.72, label: "Business" },
      farm:     { capex: 900,  offset: 0.80, label: "Farm" },
    };
    const TARIFF = 0.17, PSH = 5.6, PR = 0.78, ESC = 0.07, YEARS = 10;
    let profile = "home";
    const run = () => {
      const bill = +range.value;
      range.style.setProperty("--p", ((bill - range.min) / (range.max - range.min)) * 100 + "%");
      out.textContent = "$" + fmt(bill);
      const P = PROFILES[profile];
      const kwhMonth = bill / TARIFF;
      const kwp = Math.max(1.5, (kwhMonth * P.offset) / (PSH * 30 * PR));
      const capex = kwp * P.capex;
      const grid = [0], solar = [capex];
      for (let yr = 1; yr <= YEARS; yr++) {
        const yearBill = bill * 12 * Math.pow(1 + ESC, yr - 1);
        grid.push(grid[yr - 1] + yearBill);
        solar.push(solar[yr - 1] + yearBill * (1 - P.offset) + capex * 0.01);
      }
      let payback = YEARS;
      for (let yr = 1; yr <= YEARS; yr++) if (solar[yr] <= grid[yr]) {
        const a = grid[yr - 1] - solar[yr - 1], b = grid[yr] - solar[yr];
        payback = yr - 1 + -a / (b - a); break;
      }
      $("[data-o=kwp]", calc).innerHTML = fmt(kwp, 1) + "<small>kWp</small>";
      $("[data-o=save]", calc).innerHTML = "$" + fmt(bill * P.offset) + "<small>/mo</small>";
      $("[data-o=payback]", calc).innerHTML = fmt(payback, 1) + "<small>yrs</small>";
      $("[data-o=total]", calc).innerHTML = "$" + fmt((grid[YEARS] - solar[YEARS]) / 1000, 1) + "<small>k</small>";
      const labels = Array.from({ length: YEARS + 1 }, (_, i) => (i === 0 ? "Now" : "Y" + i));
      const money = (v, full) => (full ? "$" + fmt(v) : "$" + fmt(v / 1000, v % 1000 ? 1 : 0) + "k");
      lineChart(chartWrap, {
        aria: `Cumulative energy spend over ${YEARS} years: grid and generator versus Smart solar`,
        labels,
        yFmt: money,
        tipTitle: (i) => (i === 0 ? "Today" : `End of year ${i}`),
        series: [
          { key: "g", name: "Grid + generator", color: C.ink, values: grid },
          { key: "s", name: "Smart solar", color: C.green, values: solar, area: true },
        ],
        annotate: (svg, x, y) => {
          if (payback >= YEARS) return;
          const px = x(payback), lo = Math.floor(payback);
          const vy = solar[lo] + (solar[lo + 1] - solar[lo]) * (payback - lo);
          const gg = svgEl("g", { class: "fade" }, svg);
          svgEl("line", { x1: px, x2: px, y1: y(vy) - 70, y2: y(vy), stroke: C.lime, "stroke-width": 1.5, "stroke-dasharray": "3 3" }, gg);
          svgEl("circle", { cx: px, cy: y(vy), r: 6, fill: C.lime, stroke: "#fff", "stroke-width": 2 }, gg);
          const t = svgEl("text", { x: px + 8, y: y(vy) - 60, class: "lbl-direct" }, gg); t.textContent = `Payback ≈ ${fmt(payback, 1)} yrs`;
          svgEl("line", { x1: px, x2: px, y1: y(vy) - 70, y2: y(vy) - 70 }, gg);
        },
      });
      tableFor(card, ["Year", "Grid + generator", "Smart solar"], labels.map((l, i) => [l, "$" + fmt(grid[i]), "$" + fmt(solar[i])]));
    };
    range.addEventListener("input", run);
    segs.forEach((b) => b.addEventListener("click", () => { profile = b.dataset.profile; segs.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); run(); }));
    run();
  }

  /* ----------------------------------------- daily load profile (services) */
  const daily = $("#daily-chart");
  if (daily) {
    const hrs = Array.from({ length: 25 }, (_, h) => h);
    const gen = hrs.map((h) => (h < 6 || h > 18.5 ? 0 : 6.2 * Math.pow(Math.sin((Math.PI * (h - 6)) / 12.5), 1.35)));
    const use = hrs.map((h) => 0.6 + 1.6 * Math.exp(-((h - 7) ** 2) / 2) + 2.4 * Math.exp(-((h - 19.5) ** 2) / 3.5) + 0.7 * Math.exp(-((h - 13) ** 2) / 8));
    const kw = (v, full) => fmt(v, 1) + (full ? " kW" : "");
    lineChart(daily, {
      aria: "Typical home: solar generation versus household demand across 24 hours",
      labels: hrs.map((h) => String(h).padStart(2, "0") + ":00"),
      yFmt: kw,
      series: [
        { key: "gen", name: "Solar generation", color: C.green, values: gen, area: true, labelAt: 12 },
        { key: "use", name: "Home demand", color: C.ink, values: use, labelAt: 20 },
      ],
      annotate: (svg, x, y) => {
        const g = svgEl("g", { class: "fade" }, svg);
        const small = x(24) - x(0) < 480;
        [[10, 15, small ? "Charging" : "Battery charging from surplus"], [18.6, 23.5, small ? "Battery" : "Battery powers the evening"]].forEach(([a, b, t]) => {
          svgEl("rect", { x: x(a), y: y(0) - 6, width: x(b) - x(a), height: 6, rx: 3, fill: "rgba(168,204,60,.55)" }, g);
          const tx = svgEl("text", { x: (x(a) + x(b)) / 2, y: y(0) - 12, "text-anchor": "middle", class: "lbl-muted" }, g); tx.textContent = t;
        });
      },
    });
    tableFor(daily.closest(".chart-card"), ["Hour", "Solar (kW)", "Demand (kW)"], hrs.map((h) => [h + ":00", fmt(gen[h], 1), fmt(use[h], 1)]));
  }

  /* ---------------------------------------- monthly generation (projects) */
  const monthly = $("#monthly-chart");
  if (monthly) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const psh = [5.5, 5.6, 5.8, 5.7, 5.4, 5.0, 5.3, 6.1, 6.7, 6.9, 6.3, 5.6];
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const kwp = 120, pr = 0.79;
    const vals = psh.map((p, i) => Math.round(kwp * p * days[i] * pr));
    barChart(monthly, {
      aria: "Monthly energy generated by the 120 kWp Fitment Centre rooftop",
      name: "Generated", labels: months, values: vals, color: "#cfd8c9", accent: C.green,
      yFmt: (v, full) => (full ? fmt(v) + " kWh" : fmt(v / 1000) + "k"),
      tipTitle: (i) => months[i] + " (modelled)",
    });
    tableFor(monthly.closest(".chart-card"), ["Month", "kWh"], months.map((m, i) => [m, fmt(vals[i])]));
  }

  /* ------------------------------------------------- CO2 avoided (about) */
  const co2 = $("#co2-chart");
  if (co2) {
    const yrs = ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
    const vals = [140, 290, 520, 860, 1340, 1920, 2610, 3380];
    barChart(co2, {
      aria: "Tonnes of CO2 avoided per year by systems Smart Energy has installed",
      name: "CO₂ avoided", labels: yrs, values: vals, color: "#cfd8c9", accent: C.green,
      yFmt: (v, full) => (full ? fmt(v) + " t" : fmt(v)),
      tipTitle: (i) => yrs[i] + (i === yrs.length - 1 ? " (projected)" : ""),
    });
    tableFor(co2.closest(".chart-card"), ["Year", "Tonnes CO₂"], yrs.map((yv, i) => [yv, fmt(vals[i])]));
  }

  /* ======================================================================
     ZIMBABWE DOT MAP
     ====================================================================== */
  const mapEl = $("#zim-map");
  if (mapEl) {
    const ZWE = [[31.191,-22.252],[30.66,-22.152],[30.323,-22.272],[29.839,-22.102],[29.432,-22.091],[28.795,-21.639],[28.021,-21.486],[27.727,-20.852],[27.725,-20.499],[27.297,-20.392],[26.165,-19.293],[25.85,-18.714],[25.649,-18.536],[25.264,-17.737],[26.382,-17.846],[26.707,-17.961],[27.044,-17.938],[27.598,-17.291],[28.468,-16.468],[28.826,-16.39],[28.947,-16.043],[29.517,-15.645],[30.274,-15.508],[30.339,-15.881],[31.173,-15.861],[31.636,-16.072],[31.852,-16.319],[32.328,-16.392],[32.848,-16.713],[32.85,-17.979],[32.655,-18.672],[32.612,-19.419],[32.773,-19.716],[32.66,-20.304],[32.509,-20.395],[32.245,-21.116],[31.191,-22.252]];
    const K = 92, COS = Math.cos((19 * Math.PI) / 180), OX = 25.1, OY = 15.35, PAD = 20;
    const px = (lon) => PAD + (lon - OX) * K * COS, py = (lat) => PAD + (-lat - OY) * K;
    const W = Math.ceil(px(33.0) + PAD + 80), H = Math.ceil(py(-22.35) + PAD);
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "map-svg", role: "img", "aria-label": "Map of Zimbabwe showing Smart Energy project sites" });
    mapEl.appendChild(svg);
    const poly = ZWE.map(([a, b]) => [px(a), py(b)]);
    const inside = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    const dotsG = svgEl("g", {}, svg);
    const dots = [];
    const S = 11;
    for (let y = PAD; y < H; y += S) for (let x = PAD; x < W; x += S) if (inside(x, y)) dots.push(svgEl("circle", { cx: x, cy: y, r: 2.6, class: "dot" }, dotsG));
    svgEl("path", { d: "M" + poly.map((p) => p.join(",")).join("L") + "Z", class: "outline" }, svg);

    const sites = $$(".site-card").map((c) => ({ card: c, ...JSON.parse(c.dataset.site) }));
    const hq = sites.find((s) => s.hq) || sites[0];
    const routes = svgEl("g", {}, svg);
    const pinG = svgEl("g", {}, svg);
    const detail = $(".map-detail");
    sites.forEach((s) => {
      s.x = px(s.lon); s.y = py(s.lat);
      if (s !== hq) {
        const mx = (s.x + hq.x) / 2, my = Math.min(s.y, hq.y) - 50;
        svgEl("path", { d: `M${hq.x},${hq.y}Q${mx},${my} ${s.x},${s.y}`, class: "route" }, routes);
      }
      const g = svgEl("g", { class: "pin" + (s.hq ? " hq" : ""), tabindex: 0, role: "button", "aria-label": s.name }, pinG);
      svgEl("circle", { cx: s.x, cy: s.y, r: 10, class: "halo" }, g);
      svgEl("circle", { cx: s.x, cy: s.y, r: s.hq ? 7 : 5.5, class: "core" }, g);
      if (s.hq || s.city !== hq.city) { const t = svgEl("text", { x: s.x + 12, y: s.y + 4 }, g); t.textContent = s.city; }
      s.pin = g;
      const act = () => select(s);
      g.addEventListener("click", act);
      g.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), act()));
      s.card.addEventListener("click", act);
    });
    function select(s) {
      sites.forEach((o) => { o.pin.classList.toggle("is-active", o === s); o.card.classList.toggle("is-active", o === s); o.card.setAttribute("aria-pressed", String(o === s)); });
      dots.forEach((d) => d.classList.toggle("lit", Math.hypot(d.cx.baseVal.value - s.x, d.cy.baseVal.value - s.y) < 46));
      if (detail) {
        $("img", detail).src = s.img; $("img", detail).alt = s.alt || s.name;
        $("h4", detail).textContent = s.name;
        $("[data-d=size]", detail).textContent = s.size;
        $("[data-d=type]", detail).textContent = s.type;
      }
    }
    select(sites.find((s) => !s.hq) || hq);
  }
})();
