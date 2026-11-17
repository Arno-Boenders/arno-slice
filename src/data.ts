// Everything personal in the game comes from this file. It mirrors the content of the main portfolio
// (Chrome-portfolio/src/data/profile.ts and projects.ts); update both when something changes.

export interface Project {
    slug: string;
    title: string;
    year?: string;
    summary: string;
    description: string;
    tech: string[];
    live?: string;
    repo?: string;
    image?: string;
    position?: string;   // CSS object-position for the screenshot
    color: string;
}

export interface Job {
    company: string;
    role: string;
    period: string;
    about: string;
    highlights: string[];
    tech: string[];
    color: string;
}

const GH = 'https://github.com/Arno-Boenders';

export const profile = {
    name: 'Arno Boenders',
    role: 'Fullstack Developer',
    location: 'Ghent, Belgium',
    email: 'arnoboenders@gmail.com',
    linkedin: 'https://www.linkedin.com/in/arno-boenders-816117228/',
    github: GH,
    photo: '/arno-portrait.jpg',
    cv: '/Arno-Boenders-CV.pdf',
    openToWork: true,
    bio:
        'I’m a fullstack developer from Ghent, Belgium. Since September 2025 I work at Realo, part of Immoweb, across PHP, MySQL and the new Next.js and TypeScript front end. ' +
        'Before that I did my internship at Bizzy and graduated in Programming at Arteveldehogeschool. On the side I build my own products, like Pickly and Munto.',
    education: [
        { title: 'Graduate in Programming', school: 'Arteveldehogeschool, Ghent', period: '2023 – 2025' },
        { title: 'Electronics & ICT (not completed)', school: 'Odisee', period: '2020 – 2023' },
    ],
};

export const experience: Job[] = [
    {
        company: 'Realo',
        role: 'Fullstack Developer',
        period: 'Sept 2025 – now',
        about: 'Belgian real-estate platform, part of Immoweb',
        highlights: [
            'Built the address detail pages in the Next.js and TypeScript rewrite: price history, photos, map, paywall, parcel pages and print/PDF output.',
            'Delivered Realo Pro self-upgrade across three repositories: self-service seat booking, seat counting from subscriptions, and handover to sales through Slack and email.',
            'Integrated federated government sign-in (CSAM) over OIDC for white-label sites, rolled out behind a feature flag.',
            'Own the lifecycle and transactional email system: onboarding, reactivation, renewal and lead emails in Dutch, French and English.',
            'Extended valuation reports with rent graphs and regional price evolution; traced a PDF timeout to oversized images and fixed the cause.',
            'Added two-factor authentication for Google sign-in and passkeys, and optimised MySQL queries behind dashboard filters.',
        ],
        tech: ['PHP', 'MySQL', 'Next.js', 'TypeScript', 'React'],
        color: '#ff7a45',
    },
    {
        company: 'Bizzy',
        role: 'Fullstack Developer Intern',
        period: 'Apr – Jun 2025',
        about: 'B2B business intelligence company in Ghent',
        highlights: [
            'Built a HubSpot sync for contacts, legal entities and vacancies in a React, TypeScript and GraphQL codebase.',
            'Added tracking of where new users come from, and worked on product sidebars and a lead feedback page, in a Jira and stand-up workflow.',
        ],
        tech: ['React', 'TypeScript', 'GraphQL', 'HubSpot'],
        color: '#f5c518',
    },
];

export const projects: Project[] = [
    {
        slug: 'pickly',
        title: 'Pickly',
        year: '2026',
        summary: 'Group polls by link. Everyone votes without an account and results update live.',
        description:
            'Make a poll, share it in the group chat and everyone votes without an account. Ranked, score, swipe and multi-select voting; options can be places on a map, dates, times or images, and results update live. ' +
            'It also works as a remote MCP server, so Claude can create polls and read results from a chat.',
        tech: ['Next.js', 'Cloudflare Workers', 'Postgres', 'Drizzle', 'MCP'],
        live: 'https://usepickly.com',
        image: '/projects/pickly.jpg',
        position: '50% 50%',
        color: '#2bb6a3',
    },
    {
        slug: 'munto',
        title: 'Munto',
        year: '2026',
        summary: 'Local-first budgeting for Belgian bank accounts, shipped as a desktop app.',
        description:
            'It pulls transactions over PSD2 through Enable Banking into a SQLite file on your own machine, sorts them with rules plus AI suggestions from Claude, and shows budgets, savings, subscriptions and where to cut.',
        tech: ['Next.js', 'Electron', 'Node.js', 'SQLite', 'Claude'],
        image: '/projects/munto.jpg',
        position: '0% 0%',
        color: '#8a5cf5',
    },
    {
        slug: 'chrome-portfolio',
        title: 'Chrome Portfolio',
        year: '2026',
        summary: 'My main portfolio: a site that behaves like a browser, with tabs, search and results pages.',
        description:
            'Pages open in tabs, the address bar searches, results pages are filled with project data pulled live from the GitHub API, and a few searches set off easter eggs.',
        tech: ['Next.js', 'TypeScript', 'Tailwind CSS'],
        repo: `${GH}/Chrome-portfolio`,
        image: '/projects/chrome-portfolio.jpg',
        position: '0% 0%',
        color: '#4c8dff',
    },
    {
        slug: 'wings-of-belgium',
        title: 'Wings of Belgium',
        year: '2024',
        summary: 'Recruitment game for the Belgian Air Force, built in a team of four.',
        description:
            'Built for the @Work 2 course at Arteveldehogeschool. Players learn about the jobs inside the Air Force by assembling the right team for each mission and then playing its mini-games. It also has a news feed with the latest Defence updates.',
        tech: ['React', 'GraphQL', 'Hygraph', 'Material UI'],
        live: 'https://wings-of-belgium.onrender.com/',
        repo: `${GH}/wings-of-belgium`,
        image: '/projects/wings-of-belgium.jpg',
        position: '50% 0%',
        color: '#f29d38',
    },
    {
        slug: 'flappy-teachers',
        title: 'Flappy Teachers',
        summary: 'Flappy Bird-style arcade game starring our teachers.',
        description: 'Steer between the pipes with the space bar or arrow key. Every pipe plays a sound and the game gets harder the further you go.',
        tech: ['JavaScript', 'HTML', 'CSS'],
        live: 'https://pgmgent-atwork2.github.io/project-1-workshop-start-2-code-daria-arno/',
        repo: `${GH}/Flappy-teachers`,
        image: '/projects/flappy-teachers.jpg',
        position: '50% 45%',
        color: '#38bdf8',
    },
    {
        slug: 'camping-in-vr',
        title: 'Camping in VR',
        summary: 'VR game in Unity, first designed for a non-profit working with people with disabilities.',
        description:
            'It grew into a game with objectives, activities and scenic viewpoints to explore. Built with C# and the XR Interaction Toolkit; assets from the Unity Asset Store plus some modelled in Blender.',
        tech: ['Unity', 'C#', 'XR Toolkit', 'Blender'],
        image: '/projects/kamperen-in-vr.jpg',
        position: '50% 30%',
        color: '#5fb85a',
    },
    {
        slug: 'pgm-learning-app',
        title: 'PGM Learning App',
        summary: 'Quiz app for mobile.',
        description: 'Quiz app for mobile, built with React Native and Expo.',
        tech: ['React Native', 'Expo', 'TypeScript'],
        repo: `${GH}/PGM-Learning-App`,
        color: '#ef5f6b',
    },
    {
        slug: 'studio-clean',
        title: 'Studio Clean',
        summary: 'An agency design rebuilt as a static site with Eleventy and Nunjucks.',
        description: 'UX Prototyping school project: rebuilding a given agency design as faithfully as possible as a static site.',
        tech: ['Eleventy', 'Nunjucks', 'Markdown', 'CSS'],
        repo: `${GH}/Clean`,
        image: '/projects/studio-clean.jpg',
        position: '0% 0%',
        color: '#e879a6',
    },
];

export const skills = [
    'PHP', 'TypeScript', 'JavaScript', 'SQL', 'Next.js', 'React', 'Node.js', 'Laravel',
    'React Native', 'Vue', 'MySQL', 'PostgreSQL', 'GraphQL', 'Docker', 'Git', 'Electron',
];
