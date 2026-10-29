"""
Smart Energy Solutions — studio renders of the brand's 3D objects.

Each object is a signed distance function (SDF), ray-marched with numpy,
shaded with a fake photo studio (environment + softboxes + key/rim/fill),
rendered at 2x and downsampled with premultiplied alpha so the edges sit
cleanly on any background.

Usage:  python _src/tools/render3d.py [out_dir] [name ...]
Output: assets/img/obj/obj-<name>.webp  (520x520, transparent)
"""
import os
import sys
import numpy as np
from PIL import Image

# ------------------------------------------------------------------ palette
GREEN_F0 = np.array([0.05, 0.66, 0.30])   # anodised brand green  (#00A254 family)
LIME_F0 = np.array([0.62, 0.82, 0.20])    # logo lime             (#A8CC3C family)
SILVER_F0 = np.array([0.92, 0.93, 0.95])
CHARCOAL = np.array([0.030, 0.032, 0.034])  # logo charcoal lacquer (#303030 family)
CELL = np.array([0.010, 0.016, 0.030])      # PV cell glass

# ------------------------------------------------------------------ math helpers
def norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)

def dot(a, b):
    return np.sum(a * b, axis=-1)

def rot(x, y, z):
    x, y, z = np.radians([x, y, z])
    rx = np.array([[1, 0, 0], [0, np.cos(x), -np.sin(x)], [0, np.sin(x), np.cos(x)]])
    ry = np.array([[np.cos(y), 0, np.sin(y)], [0, 1, 0], [-np.sin(y), 0, np.cos(y)]])
    rz = np.array([[np.cos(z), -np.sin(z), 0], [np.sin(z), np.cos(z), 0], [0, 0, 1]])
    return rz @ ry @ rx

def len2(x, y):
    return np.sqrt(x * x + y * y)

def rbox2(qx, qy, bx, by, r):
    """Rounded 2D box."""
    dx, dy = np.abs(qx) - bx + r, np.abs(qy) - by + r
    return np.minimum(np.maximum(dx, dy), 0) + len2(np.maximum(dx, 0), np.maximum(dy, 0)) - r

def rbox3(p, b, r):
    q = np.abs(p) - (np.array(b) - r)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(axis=-1), 0) - r

def poly2(px, py, pts):
    """Exact SDF of a 2D polygon (Inigo Quilez)."""
    pts = np.asarray(pts, float)
    d = (px - pts[0, 0]) ** 2 + (py - pts[0, 1]) ** 2
    s = np.ones_like(px)
    n = len(pts)
    for i in range(n):
        j = i - 1
        ex, ey = pts[j, 0] - pts[i, 0], pts[j, 1] - pts[i, 1]
        wx, wy = px - pts[i, 0], py - pts[i, 1]
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1)
        bx, by = wx - ex * t, wy - ey * t
        d = np.minimum(d, bx * bx + by * by)
        c1 = py >= pts[i, 1]
        c2 = py < pts[j, 1]
        c3 = ex * wy > ey * wx
        flip = (c1 & c2 & c3) | (~c1 & ~c2 & ~c3)
        s = np.where(flip, -s, s)
    return s * np.sqrt(d)

# ------------------------------------------------------------------ shapes
# Each shape: sdf(p_local) -> distance, and material(p_local, n_local) -> id array
# material ids: 0 green metal, 1 charcoal lacquer, 2 pearl, 3 pv cell glass,
#               4 silver, 5 lime metal, 6 lime glow

def sdf_ring(p):
    # energy ring: rounded-rect band swept round a circle
    qx = len2(p[..., 0], p[..., 2]) - 1.0
    return rbox2(qx, p[..., 1], 0.30, 0.17, 0.10)

def mat_ring(p, n):
    r = len2(p[..., 0], p[..., 2])
    inner = (r < 0.86) & (np.abs(n[..., 1]) < 0.75)
    return np.where(inner, 1, 0)

def sdf_orb(p):
    return np.linalg.norm(p, axis=-1) - 1.0

def mat_orb(p, n):
    # pearl body with green inlay lines (latitude/longitude) — the sun as a globe
    lat = np.arcsin(np.clip(p[..., 1], -1, 1))
    lon = np.arctan2(p[..., 2], p[..., 0])
    lat_line = np.abs(((lat / (np.pi / 7)) % 1) - 0.5) > 0.47
    lon_line = (np.abs(((lon / (np.pi / 6)) % 1) - 0.5) > 0.475) & (np.abs(lat) < 1.15)
    return np.where(lat_line | lon_line, 0, 2)

def sdf_panel(p):
    # PV module: thin rounded slab
    return rbox3(p, (1.25, 0.07, 0.86), 0.05)

def mat_panel(p, n):
    top = n[..., 1] > 0.6
    frame = (np.abs(p[..., 0]) > 1.12) | (np.abs(p[..., 2]) > 0.73)
    # 6 x 4 cells with thin busbar gaps
    cx = (p[..., 0] + 1.12) / (2.24 / 6)
    cz = (p[..., 2] + 0.73) / (1.46 / 4)
    gap = (np.abs((cx % 1) - 0.5) > 0.465) | (np.abs((cz % 1) - 0.5) > 0.45)
    fingers = np.abs(((cx * 6) % 1) - 0.5) > 0.47
    m = np.full(p.shape[:-1], 1)
    m = np.where(top & ~frame, np.where(gap, 4, np.where(fingers, 7, 3)), m)
    m = np.where(frame & (n[..., 1] > -0.2), 0, m)
    return m

def sdf_battery(p):
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    body = rbox2(len2(x, z), y, 0.62, 0.95, 0.14)
    nub = rbox2(len2(x, z), y - 1.0, 0.22, 0.14, 0.05)
    return np.minimum(body, nub)

def mat_battery(p, n):
    y = p[..., 1]
    cap = y > 0.62
    bars = np.zeros_like(y, bool)
    for c in (-0.52, -0.18, 0.16):
        bars |= np.abs(y - c) < 0.12
    face = len2(p[..., 0], p[..., 2]) > 0.55
    m = np.where(cap, 0, 1)
    m = np.where(bars & face & ~cap, 6, m)
    return m

BOLT = np.array([[0.18, 1.15], [-0.62, -0.08], [-0.06, -0.08], [-0.30, -1.15],
                 [0.62, 0.20], [0.06, 0.20], [0.40, 1.15]])

def sdf_bolt(p):
    d2 = poly2(p[..., 0], p[..., 1], BOLT[::-1]) + 0.06
    w = np.abs(p[..., 2]) - 0.16
    return np.minimum(np.maximum(d2, w), 0) + len2(np.maximum(d2, 0), np.maximum(w, 0)) - 0.07

def mat_bolt(p, n):
    side = np.abs(n[..., 2]) < 0.55
    return np.where(side, 1, 0)

def sdf_ribbon(p):
    # flat strip swept round a circle with a half twist (closes on itself)
    a = np.arctan2(p[..., 2], p[..., 0])
    qx = len2(p[..., 0], p[..., 2]) - 1.0
    qy = p[..., 1]
    c, s = np.cos(a / 2), np.sin(a / 2)
    rx, ry = c * qx - s * qy, s * qx + c * qy
    return rbox2(rx, ry, 0.36, 0.05, 0.04) * 0.55

def mat_ribbon(p, n):
    a = np.arctan2(p[..., 2], p[..., 0])
    qx = len2(p[..., 0], p[..., 2]) - 1.0
    qy = p[..., 1]
    c, s = np.cos(a / 2), np.sin(a / 2)
    ry = s * qx + c * qy
    return np.where(ry > 0, 0, 1)

def sdf_leafdisc(p):
    # sun disc: a thick lens with a leaf-shaped cut — reads as sun + leaf (logo mark)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    disc = rbox2(len2(x, y), z, 1.0, 0.16, 0.14)
    # leaf: intersection of two circles, rotated 40°
    c, s = np.cos(0.7), np.sin(0.7)
    lx, ly = c * x - s * y, s * x + c * y
    leaf = np.maximum(len2(lx, ly - 0.45) - 0.78, len2(lx, ly + 0.45) - 0.78)
    groove = np.maximum(leaf, -(z - 0.08))  # carve only the front face
    return np.maximum(disc, -groove)

def mat_leafdisc(p, n):
    x, y = p[..., 0], p[..., 1]
    c, s = np.cos(0.7), np.sin(0.7)
    lx, ly = c * x - s * y, s * x + c * y
    leaf = np.maximum(len2(lx, ly - 0.45) - 0.78, len2(lx, ly + 0.45) - 0.78)
    m = np.where(leaf < 0.02, 5, 2)
    m = np.where((len2(x, y) > 0.9) & (np.abs(n[..., 2]) < 0.7), 0, m)
    return m

def _rotz(x, y, a):
    c, s = np.cos(a), np.sin(a)
    return c * x + s * y, -s * x + c * y

def _leaf(p, base, ang, yaw, roll=0.0):
    """Pointed, cupped leaf: a lens in its own xz plane, base at the stem."""
    x, y, z = p[..., 0] - base[0], p[..., 1] - base[1], p[..., 2] - base[2]
    c, s = np.cos(yaw), np.sin(yaw)
    x, z = c * x - s * z, s * x + c * z
    x, y = _rotz(x, y, ang)
    cr, sr = np.cos(roll), np.sin(roll)
    y, z = cr * y - sr * z, sr * y + cr * z
    x = x * 0.86 - 0.46
    lens = np.maximum(len2(x, z - 0.42), len2(x, z + 0.42)) - 0.62
    cup = np.abs(y - 0.22 * z * z + 0.04 * x) - 0.022
    return np.maximum(lens, cup) - 0.012, x, z

def _sprout_parts(p):
    p = p + np.array([0.0, 0.45, 0.0])
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    pellet = np.minimum(rbox2(len2(x, z), y + 0.14, 0.5, 0.16, 0.1), len2(len2(x, z), y + 0.1) - 0.3)
    sx = x - 0.07 * np.sin(np.clip(y, 0, 1.05) * 2.4)
    yc = np.clip(y, 0.0, 0.98)
    stem = len2(len2(sx, z), y - yc) - 0.05
    l1, l1x, l1z = _leaf(p, (0.05, 0.98, 0.0), np.radians(30), np.radians(0), np.radians(-62))
    l2, l2x, l2z = _leaf(p, (0.02, 0.62, 0.0), np.radians(150), np.radians(0), np.radians(62))
    return pellet, stem, l1, l2, (l1x, l1z), (l2x, l2z)

def sdf_sprout(p):
    pellet, stem, l1, l2, _, _ = _sprout_parts(p)
    return np.minimum(np.minimum(pellet, stem), np.minimum(l1, l2))

def mat_sprout(p, n):
    pellet, stem, l1, l2, (ax, az), (bx, bz) = _sprout_parts(p)
    d = np.stack([pellet, stem, l1, l2])
    k = d.argmin(axis=0)
    m = np.select([k == 0, k == 1, k == 2, k == 3], [1, 0, 5, 0])
    vein = ((k == 2) & (np.abs(az) < 0.018)) | ((k == 3) & (np.abs(bz) < 0.018))
    return np.where(vein, 6, m)

SHAPES = {
    #  name      sdf          material      pose (x,y,z)        scale step
    "ring":    (sdf_ring,    mat_ring,    (58, 18, -22),     1.00, 1.0),
    "orb":     (sdf_orb,     mat_orb,     (20, -30, -14),    0.92, 1.0),
    "panel":   (sdf_panel,   mat_panel,   (52, -32, -16),    1.02, 1.0),
    "battery": (sdf_battery, mat_battery, (14, -20, -16),    0.95, 1.0),
    "bolt":    (sdf_bolt,    mat_bolt,    (-12, 34, -8),     1.00, 0.9),
    "ribbon":  (sdf_ribbon,  mat_ribbon,  (64, 18, -30),     1.05, 0.9),
    "leaf":    (sdf_leafdisc, mat_leafdisc, (-6, 26, 4),     0.98, 0.9),
    "sprout":  (sdf_sprout,  mat_sprout,  (12, -18, -4),     1.10, 0.6),
}

# ------------------------------------------------------------------ studio
LIGHTS = [  # direction, sharpness, strength, colour
    (norm(np.array([-0.55, 0.75, 0.65])), 22, 4.2, np.array([1.0, 0.98, 0.95])),
    (norm(np.array([0.85, 0.25, -0.45])), 10, 1.6, np.array([0.80, 1.0, 0.86])),   # green-cool rim
    (norm(np.array([0.0, 1.0, 0.1])), 6, 0.6, np.array([1.0, 1.0, 1.0])),
    (norm(np.array([0.6, -0.4, 0.7])), 9, 0.5, np.array([1.0, 0.92, 0.70])),       # warm fill
]
KEY = LIGHTS[0][0]

def env(d):
    y = d[..., 1:2]
    sky, hor, floor = np.array([0.95, 0.97, 0.96]), np.array([0.30, 0.33, 0.32]), np.array([0.04, 0.10, 0.06])
    up = hor + (sky - hor) * np.clip(y, 0, 1) ** 0.6
    dn = hor + (floor - hor) * np.clip(-y * 3, 0, 1)
    c = np.where(y > 0, up, dn)
    c = c * (0.75 + 0.25 * np.clip(d[..., 0:1] + 0.6, 0, 1))          # darker on the left
    c = c * (0.6 + 0.4 * np.clip(d[..., 2:3] + 0.6, 0, 1))            # darker behind
    c = c + 1.6 * np.exp(-((d[..., 1:2] - 0.18) / 0.06) ** 2) * (d[..., 2:3] > -0.2)
    c = c + 1.1 * np.exp(-((d[..., 0:1] - 0.75) / 0.08) ** 2) * (d[..., 2:3] > -0.3)
    for L, k, s, col in LIGHTS:
        c = c + col * s * 0.08 * np.clip(dot(d, L), 0, 1)[..., None] ** k
    return c

def fresnel(F0, nv):
    return F0 + (1 - F0) * (1 - nv)[..., None] ** 5

def shade(mat, n, v, ao):
    nv = np.clip(dot(n, v), 0, 1)
    r = norm(2 * nv[..., None] * n - v)
    e = env(r)
    nl = np.clip(dot(n, KEY), 0, 1)[..., None]
    h = norm(KEY + v)
    nh = np.clip(dot(n, h), 0, 1)[..., None]
    out = np.zeros(n.shape)

    def metal(F0, warm=np.array([1, 1, 1])):
        F = fresnel(F0, nv)
        return (e * F * 0.95 + F0 * 0.12 * nl + 2.2 * nh ** 120 * np.array([1, 0.98, 0.92])) * warm

    def lacquer(base, glow=np.array([0.0, 0.25, 0.12]), spec=1.4):
        return (base * (0.35 + 0.9 * nl) + e * fresnel(np.array([0.04] * 3), nv) * 0.75
                + spec * nh ** 90 + glow * (1 - nv)[..., None] ** 3 * 0.35)

    def pearl():
        t = (n[..., 1:2] + 1) / 2
        body = np.array([0.62, 0.70, 0.66]) * (1 - t) + np.array([1.0, 1.0, 0.98]) * t
        return (body * (0.35 + 0.85 * nl) * 0.82 + np.array([0.66, 0.90, 0.30]) * (1 - nv)[..., None] ** 2.5 * 0.28
                + e * fresnel(np.array([0.04] * 3), nv) * 0.9 + 2.0 * nh ** 220 + 0.18 * nh ** 10)

    table = {
        0: lambda: metal(GREEN_F0, np.array([0.92, 1.04, 0.96])),
        1: lambda: lacquer(CHARCOAL),
        2: pearl,
        3: lambda: lacquer(CELL, glow=np.array([0.05, 0.15, 0.35]), spec=1.8),
        4: lambda: metal(SILVER_F0) * 0.8,
        5: lambda: metal(LIME_F0),
        6: lambda: lacquer(np.array([0.30, 0.62, 0.06]), glow=np.array([0.5, 0.9, 0.2])) + np.array([0.18, 0.34, 0.02]),
        7: lambda: lacquer(CELL * 2.5 + 0.015, glow=np.array([0.05, 0.15, 0.35]), spec=1.8),
    }
    for mid, fn in table.items():
        sel = mat == mid
        if sel.any():
            out[sel] = fn()[sel]
    return out * ao[..., None]

# ------------------------------------------------------------------ render
def render(name, size=520, ss=2):
    sdf_l, mat_l, pose, scale, step = SHAPES[name]
    R = rot(*pose)
    Rt = R.T

    def sdf_w(pw):
        return sdf_l((pw @ R) / scale) * scale  # pw @ R == (Rt @ pw^T)^T

    N = size * ss
    ys, xs = np.mgrid[0:N, 0:N]
    u = (xs + 0.5) / N * 2 - 1
    w = 1 - (ys + 0.5) / N * 2
    f = 0.33
    ro = np.array([0.0, 0.0, 5.0])
    rd = norm(np.stack([u * f, w * f, -np.ones_like(u)], -1)).reshape(-1, 3)

    t = np.full(len(rd), 2.5)
    hit = np.zeros(len(rd), bool)
    alive = np.ones(len(rd), bool)
    for _ in range(260):
        idx = np.nonzero(alive)[0]
        if len(idx) == 0:
            break
        d = sdf_w(ro + rd[idx] * t[idx, None])
        h = d < 0.0008
        hit[idx[h]] = True
        alive[idx[h]] = False
        t[idx[~h]] += d[~h] * step
        far = t > 7.5
        alive &= ~far

    idx = np.nonzero(hit)[0]
    p = ro + rd[idx] * t[idx, None]
    e = 0.0015
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    n = norm(sum(k[i] * sdf_w(p + k[i] * e)[:, None] for i in range(4)))
    # ambient occlusion along the normal
    ao = np.ones(len(idx))
    occ = np.zeros(len(idx))
    for i in range(1, 6):
        hh = 0.06 * i
        occ += (hh - sdf_w(p + n * hh)) * 0.5 ** i * 2.4
    ao = np.clip(1 - occ, 0.35, 1)

    pl = (p @ R) / scale
    nl = n @ R
    mat = mat_l(pl, nl)
    col = shade(mat, n, -rd[idx], ao)
    col = 1 - np.exp(-1.75 * col)

    img = np.zeros((N * N, 4))
    img[idx, :3] = col
    img[idx, 3] = 1
    img = img.reshape(N, N, 4)
    # premultiplied-alpha downsample
    img[..., :3] *= img[..., 3:4]
    img = img.reshape(size, ss, size, ss, 4).mean(axis=(1, 3))
    a = img[..., 3:4]
    img[..., :3] = np.where(a > 0, img[..., :3] / np.maximum(a, 1e-6), 0)
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA")

def crop_square(im, pad=16, out=520):
    bb = im.getbbox()
    im = im.crop(bb)
    s = max(im.size) + pad * 2
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    return sq.resize((out, out), Image.LANCZOS)

if __name__ == "__main__":
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "assets/img/obj"
    names = sys.argv[2:] or list(SHAPES)
    os.makedirs(out_dir, exist_ok=True)
    for nm in names:
        im = crop_square(render(nm, size=560))
        path = os.path.join(out_dir, f"obj-{nm}.webp")
        im.save(path, "WEBP", quality=90, method=6)
        print("wrote", path, os.path.getsize(path) // 1024, "KB")
