// The info sheet that opens when something is unlocked, plus the "see everything" list.
// Shared between the games: the markup is the same, each game styles it in its own style.css.
import { experience, profile, projects } from './data';

export const SECTIONS = {
    about: { label: 'About', color: '#4c8dff' },
    experience: { label: 'Work', color: '#ff5a5f' },
    contact: { label: 'Contact', color: '#2ec27e' },
    cv: { label: 'CV', color: '#ffc23d' },
} as const;
export type SectionKey = keyof typeof SECTIONS;

const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
const X_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const sheet = document.createElement('dialog');
sheet.className = 'sheet';
sheet.setAttribute('aria-labelledby', 'sheet-title');
sheet.innerHTML = `<button class="sheet-close" type="button" aria-label="Close">${X_ICON}</button><div class="sheet-body"></div>`;
document.body.append(sheet);
const body = sheet.querySelector<HTMLElement>('.sheet-body')!;
sheet.querySelector('.sheet-close')!.addEventListener('click', () => sheet.close());
// A click on the dimmed backdrop lands on the dialog itself.
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

const listeners: ((open: boolean) => void)[] = [];
/** Called with true when the sheet opens and false when it closes, so a game can pause. */
export const onSheet = (fn: (open: boolean) => void) => { listeners.push(fn); };
sheet.addEventListener('close', () => listeners.forEach((fn) => fn(false)));

function show(html: string) {
    body.innerHTML = html;
    body.scrollTop = 0;
    if (!sheet.open) {
        sheet.showModal();
        listeners.forEach((fn) => fn(true));
    }
}

// One listener for every opener on the page: [data-open="project:pickly"], [data-everything], [data-copy].
document.addEventListener('click', async (e) => {
    const target = e.target as Element;
    const opener = target.closest<HTMLElement>('[data-open]');
    if (opener) { e.preventDefault(); openRef(opener.dataset.open!); return; }
    if (target.closest('[data-everything]')) { showEverything(); return; }
    const copy = target.closest<HTMLButtonElement>('[data-copy]');
    if (copy) {
        try { await navigator.clipboard.writeText(copy.dataset.copy!); copy.textContent = 'Copied'; }
        catch { /* clipboard blocked: the address is on screen to select */ }
    }
});

/** "project:pickly", "job:0" or "section:contact". */
export function openRef(ref: string) {
    const [kind, key] = ref.split(':');
    if (kind === 'project') showProject(key);
    else if (kind === 'job') showJob(Number(key));
    else showSection(key as SectionKey);
}

const ext = (href: string, label: string, primary = false) =>
    `<a class="btn${primary ? ' primary' : ''}" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const tags = (items: string[]) => `<p class="tags">${items.map((t) => `<span>${t}</span>`).join('')}</p>`;
const cvButton = (primary = false) => `<a class="btn${primary ? ' primary' : ''}" href="${profile.cv}" download>Download CV (PDF)</a>`;

export function showProject(slug: string) {
    const p = projects.find((x) => x.slug === slug);
    if (!p) return;
    // The picture links to the live site, or to the code when there is no live version.
    const href = p.live ?? p.repo;
    const picture = p.image
        ? `<img class="shot" src="${p.image}" alt="${p.title} screenshot" style="object-position:${p.position ?? '50% 0%'}">`
        : `<div class="shot blank" aria-hidden="true">${p.title[0]}</div>`;
    show(`<article class="card" style="--c:${p.color}">
        ${href
            ? `<a class="shot-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${p.live ? 'Visit the live site of' : 'View the code of'} ${p.title}">${picture}<span class="shot-cta">${p.live ? 'Visit live site' : 'View on GitHub'}${ARROW}</span></a>`
            : picture}
        <h2 id="sheet-title">${p.title}</h2>
        <p class="meta">Project${p.year ? ` · ${p.year}` : ''}</p>
        <p class="lede">${p.summary}</p>
        <p>${p.description}</p>
        ${tags(p.tech)}
        <p class="actions">${p.live ? ext(p.live, 'Visit live site', true) : ''}${p.repo ? ext(p.repo, 'View code', !p.live) : ''}</p>
    </article>`);
}

function jobHtml(i: number, heading: 'h2' | 'h3' = 'h2') {
    const j = experience[i];
    return `<article class="card job" style="--c:${j.color}">
        <div class="job-head"><span class="logo" aria-hidden="true">${j.company[0]}</span><div>
            <${heading} ${heading === 'h2' ? 'id="sheet-title"' : ''}>${j.role}, ${j.company}</${heading}>
            <p class="meta">${j.period} · ${j.about}</p>
        </div></div>
        <ul class="bullets">${j.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>
        ${tags(j.tech)}
    </article>`;
}

export function showJob(i: number) {
    if (experience[i]) show(jobHtml(i));
}

const contactHtml = () => `
    <p class="big-mail">${profile.email}</p>
    <p class="actions">
        <button class="btn primary" type="button" data-copy="${profile.email}">Copy email</button>
        <a class="btn" href="mailto:${profile.email}">Open mail app</a>
        ${ext(profile.linkedin, 'LinkedIn')}${ext(profile.github, 'GitHub')}${cvButton()}
    </p>`;

export function showSection(key: SectionKey) {
    const color = SECTIONS[key].color;
    if (key === 'experience') {
        show(`<h2 id="sheet-title" class="section-title" style="--c:${color}">Work</h2>${experience.map((_, i) => jobHtml(i, 'h3')).join('')}`);
    } else if (key === 'about') {
        show(`<article class="card" style="--c:${color}">
            <div class="me"><img src="${profile.photo}" alt="${profile.name}"><div>
                <h2 id="sheet-title">${profile.name}</h2>
                <p class="meta">${profile.role} · ${profile.location}</p>
                ${profile.openToWork ? '<p class="pill"><i></i>Open to work</p>' : ''}
            </div></div>
            <p>${profile.bio}</p>
            <p class="meta">${profile.education.map((e) => `${e.title}, ${e.school} (${e.period})`).join('<br>')}</p>
            <p class="actions">${ext(profile.linkedin, 'LinkedIn')}${ext(profile.github, 'GitHub')}${cvButton()}</p>
        </article>`);
    } else if (key === 'contact') {
        show(`<article class="card" style="--c:${color}"><h2 id="sheet-title">Get in touch</h2>
            <p>Email is the fastest way to reach me${profile.openToWork ? '. I’m open to hearing about fullstack developer roles' : ''}.</p>${contactHtml()}</article>`);
    } else {
        show(`<article class="card" style="--c:${color}"><h2 id="sheet-title">My CV</h2>
            <p>One page: ${experience.map((j) => `${j.role} at ${j.company}`).join(', ')}, my projects, skills and education.</p>
            <p class="actions">${cvButton(true)}${ext(profile.cv, 'Open in a new tab')}</p></article>`);
    }
}

export function showEverything() {
    show(`<div class="everything">
        <div class="me"><img src="${profile.photo}" alt="${profile.name}"><div>
            <h2 id="sheet-title">${profile.name}</h2><p class="meta">${profile.role} · ${profile.location}</p>
        </div></div>
        <p>${profile.bio}</p>
        <h3>Work</h3>
        <div class="rows">${experience.map((j, i) => `<button type="button" class="row" data-open="job:${i}" style="--c:${j.color}"><b>${j.role}, ${j.company}</b><span>${j.period}</span></button>`).join('')}</div>
        <h3>Projects</h3>
        <div class="tiles">${projects.map((p) => `<button type="button" class="tile" data-open="project:${p.slug}" style="--c:${p.color}">
            ${p.image ? `<img src="${p.image}" alt="" style="object-position:${p.position ?? '50% 0%'}">` : `<span class="blank">${p.title[0]}</span>`}
            <b>${p.title}</b><span>${p.summary}</span></button>`).join('')}</div>
        <h3>Get in touch</h3>${contactHtml()}
    </div>`);
}
