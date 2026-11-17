import './style.css';
import { projects, skills } from './data';
import { SECTIONS, onSheet, type SectionKey } from './ui';

type Kind = 'project' | 'section' | 'skill' | 'bug';
interface Item {
    kind: Kind; key: string; label: string; color: string;
    x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number;
    w: number; h: number; dead: boolean;
    hint?: string;   // explains the item the first time its kind appears in a run
}
interface Half { item: Item; x: number; y: number; vx: number; vy: number; rot: number; vr: number; cut: number; side: 1 | -1 }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Splat { x: number; y: number; r: number; color: string; life: number }
interface Floater { x: number; y: number; text: string; color: string; life: number }
interface Point { x: number; y: number; t: number }

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const canvas = $<HTMLCanvasElement>('#game');
const ctx = canvas.getContext('2d')!;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONT = 'Outfit, system-ui, sans-serif';
const SKILL_COLORS = ['#4c8dff', '#ff5a5f', '#ffc23d', '#2ec27e'];
const BUG = '#ff4d5e';

// What can be found: every project plus the four sections.
const COLLECTIBLES = [
    ...projects.map((p) => ({ kind: 'project' as const, key: p.slug, ref: `project:${p.slug}`, label: p.title, color: p.color, image: p.image })),
    ...(Object.keys(SECTIONS) as SectionKey[]).map((k) => ({ kind: 'section' as const, key: k, ref: `section:${k}`, label: SECTIONS[k].label, color: SECTIONS[k].color, image: undefined as string | undefined })),
];
const byKey = new Map(COLLECTIBLES.map((c) => [c.key, c]));
const SUMMARIES: Record<string, string> = {
    ...Object.fromEntries(projects.map((p) => [p.slug, p.summary])),
    about: 'Who I am, what I do and where I studied.',
    experience: 'My work at Realo and my internship at Bizzy.',
    contact: 'Email, LinkedIn and GitHub, plus my CV.',
    cv: 'My one-page CV, ready to download.',
};
const HINTS: Record<Kind, string> = {
    project: 'Project · slice it to unlock',
    section: 'Page · slice it to open',
    skill: 'Skill · +10 points',
    bug: 'Bug · don’t slice it',
};

const images = new Map<string, HTMLImageElement>();
for (const c of COLLECTIBLES) if (c.image) { const img = new Image(); img.src = c.image; images.set(c.key, img); }
const imagePos = new Map(projects.map((p) => [p.slug, p.position ?? '50% 0%']));

const store = {
    get<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; } },
    set(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
};
const found = new Set<string>(store.get<string[]>('arno-slice-found', []).filter((k) => byKey.has(k)));
let best = store.get('arno-slice-best', 0);

// ---- Sizing ------------------------------------------------------------

let W = 0, H = 0, S = 1, G = 1300;
let background: CanvasGradient;
let dots: HTMLCanvasElement;
function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.max(0.7, Math.min(1.25, Math.min(W, H) / 760));
    // Gentle gravity: items hang in the air long enough to read their labels.
    G = Math.max(560, 820 * (H / 900));
    background = ctx.createRadialGradient(W / 2, H * 0.15, 0, W / 2, H * 0.4, Math.max(W, H));
    background.addColorStop(0, '#1d2333');
    background.addColorStop(1, '#0a0c11');
    // A faint dot grid gives the board some depth without competing with the items.
    dots = document.createElement('canvas');
    dots.width = canvas.width; dots.height = canvas.height;
    const d = dots.getContext('2d')!;
    d.scale(dpr, dpr);
    for (let y = 14; y < H; y += 28) for (let x = 14; x < W; x += 28) {
        const fade = 1 - Math.min(1, Math.hypot(x - W / 2, y - H * 0.35) / Math.max(W, H));
        d.fillStyle = `rgba(255,255,255,${0.07 * fade})`;
        d.fillRect(x, y, 1.5, 1.5);
    }
}
addEventListener('resize', resize);
resize();

// ---- State ---------------------------------------------------------------

type Mode = 'menu' | 'play' | 'over';
let mode: Mode = 'menu';
let zen = false, lives = 3, score = 0, elapsed = 0, spawnIn = 0.5;
let paused = false, timeScale = 1, slowFor = 0, shake = 0, flash = 0;
const items: Item[] = [], halves: Half[] = [], parts: Particle[] = [], splats: Splat[] = [], floaters: Floater[] = [];
let trail: Point[] = [];
let swipeHits: number[] = [];
const seenKinds = new Set<Kind>();
let firstThrow = true;

const rand = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

// Throws an item up from below the screen so it peaks somewhere in the upper half.
function launch(kind: Kind, key: string, label: string, color: string, delay = 0): Item {
    ctx.font = `600 ${Math.round(15 * S)}px ${FONT}`;
    let r = { project: 50, section: 44, skill: 0, bug: 36 }[kind] * S, w = 2 * r, h = 2 * r;
    if (kind === 'skill') { w = ctx.measureText(label).width + 30 * S; h = 34 * S; r = Math.max(w * 0.42, h * 0.6); }
    const x = W * (0.15 + Math.random() * 0.7);
    const y = H + r + delay;
    const apex = H * (0.1 + Math.random() * 0.35);
    const vy = -Math.sqrt(2 * G * (y - apex));
    const flight = (2 * -vy) / G;
    const tx = W * (0.3 + Math.random() * 0.4);
    return {
        kind, key, label, color, x, y, vx: (tx - x) / flight, vy, r,
        rot: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * (kind === 'skill' ? 0.8 : 1.6), w, h, dead: false,
    };
}

function pick(delay: number): Item {
    if (mode !== 'play') { const s = rand(skills); return launch('skill', s, s, rand(SKILL_COLORS), delay); }
    // The first throw of a run is always something to unlock, and bugs only join after a calm start.
    if (firstThrow) {
        firstThrow = false;
        const c = rand(COLLECTIBLES.filter((x) => x.kind === 'project' && !found.has(x.key)).concat(COLLECTIBLES.filter((x) => x.kind === 'project')).slice(0, 4));
        return launch(c.kind, c.key, c.label, c.color, delay);
    }
    const bugChance = zen || elapsed < 12 ? 0 : Math.min(0.1 + (elapsed - 12) / 400, 0.22);
    const roll = Math.random();
    if (roll < bugChance) return launch('bug', 'bug', 'Bug', BUG, delay);
    if (roll < bugChance + 0.38) {
        const missing = COLLECTIBLES.filter((c) => !found.has(c.key));
        const c = rand(missing.length && Math.random() < 0.7 ? missing : COLLECTIBLES);
        return launch(c.kind, c.key, c.label, c.color, delay);
    }
    const s = rand(skills);
    return launch('skill', s, s, rand(SKILL_COLORS), delay);
}

// One item at a time for the first 20 seconds, then up to three.
function spawnWave() {
    const count = mode === 'play' && elapsed > 20 ? 1 + Math.floor(Math.random() * Math.min(3, 1 + (elapsed - 20) / 25)) : 1;
    for (let i = 0; i < count; i++) {
        const it = pick(i * 90 * S);
        if (mode === 'play' && !seenKinds.has(it.kind)) { seenKinds.add(it.kind); it.hint = HINTS[it.kind]; }
        items.push(it);
    }
}

// ---- Slicing ------------------------------------------------------------

function segDist(px: number, py: number, a: Point, b: Point) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2)) : 0;
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function burst(x: number, y: number, color: string, angle: number, count: number) {
    for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * 2.4 + (Math.random() < 0.5 ? Math.PI : 0);
        const v = (120 + Math.random() * 380) * S;
        const max = 0.45 + Math.random() * 0.4;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * S, life: max, max, color, size: (2 + Math.random() * 4) * S });
    }
}

const float = (x: number, y: number, text: string, color = '#fff') => floaters.push({ x, y, text, color, life: 1 });

function cut(it: Item, angle: number) {
    it.dead = true;
    const nx = Math.cos(angle + Math.PI / 2), ny = Math.sin(angle + Math.PI / 2), push = 150 * S;
    for (const side of [1, -1] as const) {
        halves.push({
            item: it, x: it.x, y: it.y,
            vx: it.vx * 0.5 + nx * push * side, vy: Math.min(it.vy, 0) * 0.3 + ny * push * side - 100 * S,
            rot: it.rot, vr: it.vr + side * 2.5, cut: angle - it.rot, side,
        });
    }
    burst(it.x, it.y, it.color, angle, it.kind === 'skill' ? 8 : 20);
    if (it.kind !== 'skill') splats.push({ x: it.x, y: it.y, r: it.r * 1.5, color: it.color, life: 1 });
    if (mode !== 'play') return;

    if (it.kind === 'bug') {
        lives--;
        renderLives();
        if (!reduce) shake = 0.4;
        flash = 0.5;
        float(it.x, it.y, lives > 0 ? 'Bug! −1 life' : 'Bug!', BUG);
        if (lives <= 0) setTimeout(gameOver, 700);
        return;
    }

    const now = performance.now();
    swipeHits = swipeHits.filter((t) => now - t < 350);
    swipeHits.push(now);
    if (swipeHits.length >= 3) {
        const bonus = swipeHits.length * 10;
        score += bonus;
        float(it.x, it.y - 46 * S, `Combo ×${swipeHits.length}  +${bonus}`, '#ffc23d');
    }

    if (it.kind === 'skill') {
        score += 10;
        float(it.x, it.y, `+10 ${it.label}`);
    } else {
        const first = !found.has(it.key);
        found.add(it.key);
        store.set('arno-slice-found', [...found]);
        score += first ? 100 : 25;
        float(it.x, it.y, `+${first ? 100 : 25}`, it.color);
        renderShelf(it.key);
        reveal(it.key, first);
        if (!reduce) slowFor = 0.9;
        if (first && found.size === COLLECTIBLES.length) {
            setTimeout(() => toast('You found everything. Thanks for playing!', 'section:contact', '#2ec27e'), 900);
        }
    }
    renderScore();
}

// Menu rings are real buttons; swiping through one counts as pressing it.
function sliceRings(a: Point, b: Point) {
    for (const ring of document.querySelectorAll<HTMLButtonElement>('.overlay:not([hidden]) .ring')) {
        const box = ring.getBoundingClientRect();
        if (segDist(box.left + box.width / 2, box.top + box.height / 2, a, b) < box.width / 2) ring.click();
    }
}

function onMove(e: PointerEvent) {
    if (paused) return;
    // With a mouse you slice by dragging, so simply moving towards a button never cuts anything.
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { trail = []; return; }
    const coalesced = e.getCoalescedEvents?.();
    for (const ev of coalesced?.length ? coalesced : [e]) {
        const p = { x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
        const prev = trail[trail.length - 1];
        trail.push(p);
        if (!prev) continue;
        const dt = p.t - prev.t, d = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (dt <= 0 || d < 3 || d / dt < 0.35) continue;   // too slow to count as a swipe
        const angle = Math.atan2(p.y - prev.y, p.x - prev.x);
        if (mode !== 'play') sliceRings(prev, p);
        for (const it of items) if (!it.dead && segDist(it.x, it.y, prev, p) < it.r) cut(it, angle);
    }
}
addEventListener('pointermove', onMove);
addEventListener('pointerdown', (e) => { trail = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]; });

// ---- Game flow -----------------------------------------------------------

const hud = $('#hud'), menu = $('#menu'), over = $('#over'), pauseOverlay = $('#paused');

function start(zenMode: boolean) {
    for (const ring of document.querySelectorAll('.ring.cut')) ring.classList.remove('cut');
    mode = 'play'; zen = zenMode; lives = 3; score = 0; elapsed = 0; spawnIn = 0.8;
    seenKinds.clear(); firstThrow = true;
    menu.hidden = true; over.hidden = true; hud.hidden = false;
    $('#lives').hidden = zen;
    renderScore(); renderLives();
}

function gameOver() {
    if (mode !== 'play') return;
    mode = 'over';
    best = Math.max(best, score);
    store.set('arno-slice-best', best);
    $('#final-score').textContent = String(score);
    $('#final-best').textContent = String(best);
    $('#final-found').textContent = `You’ve found ${found.size} of ${COLLECTIBLES.length}. Everything you found stays in the bar below.`;
    over.hidden = false;
}

function toMenu() {
    // Leaving mid-round still counts the score towards the best.
    if (mode === 'play') { best = Math.max(best, score); store.set('arno-slice-best', best); }
    setPaused(false);
    mode = 'menu'; hud.hidden = true; over.hidden = true; menu.hidden = false;
}

for (const ring of document.querySelectorAll<HTMLButtonElement>('.ring')) {
    ring.addEventListener('click', () => {
        if (ring.classList.contains('cut')) return;
        ring.classList.add('cut');
        const box = ring.getBoundingClientRect();
        burst(box.left + box.width / 2, box.top + box.height / 2, ring.style.getPropertyValue('--c') || '#fff', 0, 22);
        setTimeout(() => start(ring.dataset.start === 'zen'), reduce ? 0 : 260);
    });
}
$('#to-menu').addEventListener('click', toMenu);
$('#paused-home').addEventListener('click', toMenu);

function setPaused(value: boolean) {
    paused = value;
    pauseOverlay.hidden = !paused || (document.querySelector('dialog.sheet') as HTMLDialogElement | null)?.open === true;
    trail = [];
}
$('#pause').addEventListener('click', () => setPaused(!paused));
$('#resume').addEventListener('click', () => setPaused(false));
addEventListener('keydown', (e) => {
    if ((e.key === 'p' || e.key === 'P') && mode === 'play') setPaused(!paused);
});
onSheet((open) => { setPaused(open); if (open) $('#reveal').hidden = true; });

// ---- HUD -----------------------------------------------------------------

const renderScore = () => { $('#score').textContent = String(score); };
const HEART = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3 4.5 6.6 4.5c2 0 3.6 1.1 5.4 3.1 1.8-2 3.4-3.1 5.4-3.1 3.6 0 5.8 3.7 4.2 7.3C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>';
function renderLives() {
    const el = $('#lives');
    el.innerHTML = [0, 1, 2].map((i) => `<span class="${i < lives ? 'on' : ''}">${HEART}</span>`).join('');
    el.setAttribute('aria-label', `${lives} lives left`);
}

function renderShelf(fresh?: string) {
    $('#shelf').innerHTML = COLLECTIBLES.map((c) => found.has(c.key)
        ? `<button type="button" class="slot found${c.key === fresh ? ' fresh' : ''}" style="--c:${c.color}" data-open="${c.ref}" aria-label="${c.label}" title="${c.label}">
            ${c.image ? `<img src="${c.image}" alt="" style="object-position:${imagePos.get(c.key) ?? '50% 0%'}">` : `<b>${c.label[0]}</b>`}</button>`
        : `<span class="slot" style="--c:${c.color}" title="Slice it to unlock"><b aria-hidden="true">?</b><span class="sr">Not found yet</span></span>`).join('');
    $('#count').textContent = `${found.size}/${COLLECTIBLES.length} found`;
}

// The card that tells you what you just unlocked. The game slows down while it slides in.
let revealTimer = 0;
function reveal(key: string, first: boolean) {
    const c = byKey.get(key)!;
    const el = $('#reveal');
    el.style.setProperty('--c', c.color);
    el.innerHTML = `
        ${c.image ? `<img src="${c.image}" alt="" style="object-position:${imagePos.get(key) ?? '50% 0%'}">` : `<span class="face">${c.label[0]}</span>`}
        <div>
            <b>${c.label}</b>
            <span class="meta">${first ? (c.kind === 'project' ? 'New project' : 'New page') : 'Found again'} · ${found.size}/${COLLECTIBLES.length} found</span>
            <p>${SUMMARIES[key] ?? ''}</p>
            <button type="button" data-open="${c.ref}">Read more</button>
        </div>`;
    el.hidden = false;
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => { el.hidden = true; }, 6000);
}

function toast(text: string, ref: string | undefined, color: string) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--c', color);
    el.innerHTML = `<i aria-hidden="true"></i><span>${text}</span>${ref ? `<button type="button" data-open="${ref}">View</button>` : ''}`;
    $('#toasts').append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3400);
}

// ---- Loop ----------------------------------------------------------------

function update(dt: number) {
    if (mode === 'play') elapsed += dt;
    spawnIn -= dt;
    if (spawnIn <= 0) {
        spawnWave();
        spawnIn = mode === 'play' ? Math.max(1.1, 2.1 - elapsed / 80) + Math.random() * 0.5 : 1.6 + Math.random() * 0.6;
    }
    for (const it of items) { it.vy += G * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt; }
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.dead || (it.vy > 0 && it.y - it.r > H)) items.splice(i, 1);
    }
    for (const h of halves) { h.vy += G * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; }
    for (let i = halves.length - 1; i >= 0; i--) if (halves[i].y - halves[i].item.r * 2 > H) halves.splice(i, 1);
    for (const p of parts) { p.vy += G * 0.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
    for (const s of splats) s.life -= dt / 3.5;
    for (let i = splats.length - 1; i >= 0; i--) if (splats[i].life <= 0) splats.splice(i, 1);
    for (const f of floaters) { f.y -= 50 * S * dt; f.life -= dt / 1.1; }
    for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].life <= 0) floaters.splice(i, 1);
}

function circle(r: number) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); }

function drawCover(img: HTMLImageElement, r: number, position: string) {
    const scale = Math.max((2 * r) / img.naturalWidth, (2 * r) / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    const [fx, fy] = position.split(' ').map((v) => parseFloat(v) / 100);
    ctx.drawImage(img, -r + (2 * r - dw) * fx, -r + (2 * r - dh) * fy, dw, dh);
}

function fitText(text: string, maxWidth: number, size: number, weight = 700) {
    let s = size;
    do { ctx.font = `${weight} ${Math.round(s)}px ${FONT}`; s -= 1; } while (ctx.measureText(text).width > maxWidth && s > 9);
}

// Draws an item centred on the origin; the caller has already translated and rotated.
function drawBody(it: Item) {
    const r = it.r;
    if (it.kind === 'project') {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20 * S; ctx.shadowOffsetY = 8 * S;
        circle(r + 5 * S); ctx.fillStyle = it.color; ctx.fill();
        ctx.restore();
        ctx.save();
        circle(r); ctx.clip();
        const img = images.get(it.key);
        if (img?.complete && img.naturalWidth) drawCover(img, r, imagePos.get(it.key) ?? '50% 0%');
        else {
            ctx.fillStyle = it.color; ctx.fillRect(-r, -r, 2 * r, 2 * r);
            ctx.fillStyle = '#fff'; fitText(it.label[0], r, r * 0.9); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.label[0], 0, 2);
        }
        const gloss = ctx.createLinearGradient(0, -r, 0, r);
        gloss.addColorStop(0, 'rgba(255,255,255,.3)'); gloss.addColorStop(0.45, 'rgba(255,255,255,0)');
        ctx.fillStyle = gloss; ctx.fillRect(-r, -r, 2 * r, 2 * r);
        ctx.restore();
        circle(r); ctx.lineWidth = 2.5 * S; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
    } else if (it.kind === 'section') {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20 * S; ctx.shadowOffsetY = 8 * S;
        const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, it.color); g.addColorStop(1, shade(it.color, -0.35));
        circle(r); ctx.fillStyle = g; ctx.fill();
        ctx.restore();
        ctx.fillStyle = it.key === 'cv' ? '#2a1f00' : '#fff';
        fitText(it.label, r * 1.5, r * 0.46);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.label, 0, 2 * S);
    } else if (it.kind === 'skill') {
        ctx.beginPath(); ctx.roundRect(-it.w / 2, -it.h / 2, it.w, it.h, it.h / 2);
        ctx.fillStyle = '#1b202b'; ctx.fill();
        ctx.lineWidth = 2 * S; ctx.strokeStyle = it.color; ctx.stroke();
        ctx.fillStyle = '#f3f5f9'; ctx.font = `600 ${Math.round(15 * S)}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.label, 0, 1);
    } else {
        circle(r); ctx.fillStyle = '#26090e'; ctx.fill();
        ctx.lineWidth = 3 * S; ctx.strokeStyle = BUG; ctx.stroke();
        ctx.strokeStyle = BUG; ctx.fillStyle = BUG; ctx.lineWidth = 2.4 * S; ctx.lineCap = 'round';
        for (const side of [-1, 1]) {
            for (const k of [-1, 0, 1]) {
                ctx.beginPath(); ctx.moveTo(side * r * 0.22, r * (0.12 + k * 0.2)); ctx.lineTo(side * r * 0.62, r * (0.02 + k * 0.32)); ctx.stroke();
            }
            ctx.beginPath(); ctx.moveTo(side * r * 0.08, -r * 0.5); ctx.lineTo(side * r * 0.3, -r * 0.72); ctx.stroke();
        }
        ctx.beginPath(); ctx.ellipse(0, r * 0.12, r * 0.3, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -r * 0.38, r * 0.17, 0, Math.PI * 2); ctx.fill();
    }
}

function shade(hex: string, amount: number) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c: number) => Math.round(Math.max(0, Math.min(255, c + 255 * amount)));
    return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function drawItem(it: Item) {
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); drawBody(it); ctx.restore();
    if (it.kind === 'project') {
        ctx.font = `600 ${Math.round(14 * S)}px ${FONT}`;
        const w = ctx.measureText(it.label).width + 18 * S, y = it.y + it.r + 18 * S;
        ctx.beginPath(); ctx.roundRect(it.x - w / 2, y - 12 * S, w, 24 * S, 12 * S);
        ctx.fillStyle = 'rgba(10,12,17,.75)'; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.label, it.x, y + 1);
    }
    if (it.hint) drawHint(it);
}

// A callout above the first item of each kind: what it is and what to do with it.
function drawHint(it: Item) {
    ctx.font = `600 ${Math.round(14 * S)}px ${FONT}`;
    const w = ctx.measureText(it.hint!).width + 40 * S, h = 30 * S;
    const x = Math.max(8, Math.min(W - w - 8, it.x - w / 2)), y = it.y - Math.max(it.r, it.h / 2) - h - 16 * S;
    const accent = it.kind === 'bug' ? BUG : it.color;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2);
    ctx.fillStyle = '#f3f5f9'; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(it.x - 7 * S, y + h - 1); ctx.lineTo(it.x + 7 * S, y + h - 1); ctx.lineTo(it.x, y + h + 8 * S); ctx.closePath();
    ctx.fillStyle = '#f3f5f9'; ctx.fill();
    ctx.beginPath(); ctx.arc(x + 14 * S, y + h / 2, 4 * S, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
    ctx.fillStyle = '#12151c'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(it.hint!, x + 24 * S, y + h / 2 + 1);
}

function drawHalf(h: Half) {
    const R = Math.max(h.item.r, h.item.w) * 1.2;
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(h.rot);
    ctx.rotate(h.cut);
    ctx.beginPath(); ctx.rect(-R, h.side > 0 ? 0 : -R, 2 * R, R); ctx.clip();
    ctx.rotate(-h.cut);
    drawBody(h.item);
    ctx.restore();
}

function drawBlade(now: number) {
    trail = trail.filter((p) => now - p.t < 110);
    if (trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = '#9ec5ff'; ctx.shadowBlur = 16;
    for (let i = 1; i < trail.length; i++) {
        const k = i / trail.length;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.75 * k})`;
        ctx.lineWidth = (1 + 9 * k) * S;
        ctx.stroke();
    }
    ctx.restore();
}

function draw(now: number) {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 18 * shake, (Math.random() - 0.5) * 18 * shake);
    ctx.fillStyle = background; ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.drawImage(dots, 0, 0, W, H);
    for (const s of splats) {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        g.addColorStop(0, s.color); g.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.22 * s.life; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const h of halves) drawHalf(h);
    for (const it of items) drawItem(it);
    for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of floaters) {
        ctx.globalAlpha = Math.min(1, f.life * 1.6);
        ctx.font = `700 ${Math.round(20 * S)}px ${FONT}`;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    drawBlade(now);
    if (flash > 0) { ctx.fillStyle = `rgba(255,77,94,${flash * 0.25})`; ctx.fillRect(0, 0, W, H); }
}

let last = performance.now();
function frame(now: number) {
    const real = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (!paused) {
        slowFor = Math.max(0, slowFor - real);
        timeScale += ((slowFor > 0 ? 0.3 : 1) - timeScale) * Math.min(1, real * 10);
        update(real * timeScale);
        shake = Math.max(0, shake - real);
        flash = Math.max(0, flash - real);
    }
    draw(now);
    requestAnimationFrame(frame);
}

renderShelf();
renderLives();
requestAnimationFrame(frame);
