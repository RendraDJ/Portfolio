import { experiences as base, type Experience } from '../signs/content';
import palletlensImage from '../assets/experiences/palletlens.svg';
import classifierImage from '../assets/experiences/the-classifier.svg';
import postureImage from '../assets/experiences/phantom-posture.svg';
import qtImage from '../assets/experiences/first-contact.svg';
import ur10Image from '../assets/experiences/convergence.svg';

/**
 * ★ Everything the Experiences page shows (see experiences.ts): the
 * experiences themselves (signs/content.ts) with their picture, domains and
 * key numbers, the skills by domain, and the profile. Written from the
 * reports and the CVs in ../experiences and ../cv — edit freely.
 */

export type Domain = 'ai' | 'software' | 'robotics';

export const DOMAINS: Record<Domain, { label: string; colour: string; blurb: string }> = {
  ai: { label: 'AI & Vision', colour: '#b18cff', blurb: 'NLP, computer vision and the data pipelines that feed them.' },
  software: { label: 'Software', colour: '#5ab4ff', blurb: 'Full-stack apps, real-time back ends, data and tooling.' },
  robotics: { label: 'Robotics', colour: '#ff8a3a', blurb: 'Kinematics, control, drones, embedded sensors and simulation.' },
};

export interface Metric {
  value: string;
  label: string;
}

export interface Project extends Experience {
  /** A picture of the work itself (a figure from the report when there is one). */
  image: string;
  /** Where to keep the picture's focus when it is cropped (CSS object-position). */
  focus: string;
  /** What the picture shows, and where it comes from. */
  caption: string;
  /** Short line under the title, from the tapes. */
  tagline: string;
  domains: Domain[];
  /** Kind of work, shown as chips. */
  tags: string[];
  metrics: Metric[];
  /** Start and end, for the timeline (YYYY-MM). */
  start: string;
  end: string;
}

const EXTRA: Record<string, Omit<Project, keyof Experience>> = {
  palletlens: {
    image: palletlensImage,
    focus: '50% 50%',
    caption: 'The drone flying the rack in serpentine order, aligned on slot B3, reading its tag: OCR and barcode, with confidence.',
    tagline: 'Some systems never sleep.',
    domains: ['robotics', 'ai', 'software'],
    tags: ['Internship', 'Drones', 'Computer vision', 'Simulation'],
    metrics: [
      { value: '0.08 m', label: 'positioning precision' },
      { value: '1.5 m/s', label: 'nominal speed' },
      { value: '3 × 4', label: 'rack slots per mission' },
      { value: '2 × 1080p', label: 'cameras, 20° and 90°' },
      { value: '24', label: 'auto-annotated variants per slot' },
    ],
    start: '2026-03',
    end: '2026-08',
  },
  'phantom-posture': {
    image: postureImage,
    focus: '50% 50%',
    caption: 'A chest IMU and a webcam, over MQTT, drive the Blender twin: the slouch shows on the avatar and on the live chart.',
    tagline: 'Same human. Greater insights.',
    domains: ['robotics', 'software', 'ai'],
    tags: ['Internship', 'IoT', 'Digital twin', 'Real-time data'],
    metrics: [
      { value: '3', label: 'joints tracked: head, torso, shoulders' },
      { value: '1 h', label: 'continuous validation' },
      { value: '0', label: 'major communication loss over 1 h' }, // the report: "no major communication loss"
      { value: '5', label: 'services in the pipeline' },
    ],
    start: '2025-10',
    end: '2026-02',
  },
  'the-classifier': {
    image: classifierImage,
    focus: '50% 50%',
    caption: 'The inbox, each e-mail embedded by MiniLM and sorted into its category: RFQ, tech inquiries, collab, spam.',
    tagline: 'Same data. Greater meaning.',
    domains: ['ai', 'software'],
    tags: ['Internship', 'NLP', 'Full-stack', 'Singapore'],
    metrics: [
      { value: '7', label: 'e-mail categories' },
      { value: '3', label: 'models compared: SVM, RF, BERT' },
      { value: '1 click', label: 'retraining from the app' },
      { value: 'OAuth2', label: 'secure Outlook access' },
    ],
    start: '2025-05',
    end: '2025-07',
  },
  'first-contact': {
    image: qtImage,
    focus: '40% 50%',
    caption: 'A touch on QT’s head, its signal, and the gesture recognised: a stroke.',
    tagline: 'A more human tomorrow.',
    domains: ['robotics', 'ai'],
    tags: ['Project', 'Social robotics', 'Signal processing'],
    metrics: [
      { value: 'QT', label: 'social robot platform' },
      { value: 'ML', label: 'to detect physical interactions' },
    ],
    start: '2024-11',
    end: '2025-01',
  },
  convergence: {
    image: ur10Image,
    focus: '50% 50%',
    caption: 'The UR10 driving its tool in a straight line onto the target, the pose error dying out in about 2 s.',
    tagline: 'Control. Learn. Adapt. Converge.',
    domains: ['robotics', 'software'],
    tags: ['Academic project', 'ROS2', 'Control'],
    metrics: [
      { value: '6 DOF', label: 'UR10 arm' },
      { value: '≈ 2 s', label: 'error convergence' },
      { value: 'Kp = 16', label: 'proportional gains' },
      { value: 'λ = 0.001', label: 'damped pseudo-inverse' },
    ],
    start: '2024-09',
    end: '2025-06',
  },
};

/** Most recent first. */
export const projects: Project[] = base.map((e) => ({ ...e, ...EXTRA[e.slug] })).sort((a, b) => b.start.localeCompare(a.start));

export interface Skill {
  name: string;
  /** Slugs of the projects it was used in (none: known, not shown in a project here). */
  usedIn: string[];
}

export const SKILLS: Record<Domain, { group: string; skills: Skill[] }[]> = {
  ai: [
    {
      group: 'Natural language',
      skills: [
        { name: 'BERT / MiniLM embeddings', usedIn: ['the-classifier'] },
        { name: 'Supervised classification (SVM, Random Forest)', usedIn: ['the-classifier'] },
        { name: 'Active learning, in-app retraining', usedIn: ['the-classifier'] },
        { name: 'Text cleaning & translation pipeline', usedIn: ['the-classifier'] },
      ],
    },
    {
      group: 'Computer vision',
      skills: [
        { name: 'OpenCV', usedIn: ['palletlens', 'phantom-posture'] },
        { name: 'OCR & barcode reading', usedIn: ['palletlens'] },
        { name: 'Pose estimation (MediaPipe)', usedIn: ['phantom-posture'] },
        { name: 'Object detection (YOLO)', usedIn: [] },
        { name: 'Synthetic data & auto-annotation', usedIn: ['palletlens'] },
      ],
    },
    {
      group: 'Machine learning',
      skills: [
        { name: 'scikit-learn', usedIn: ['the-classifier'] },
        { name: 'PyTorch · TensorFlow', usedIn: [] },
        { name: 'Signal processing for interaction detection', usedIn: ['first-contact'] },
        { name: 'At-risk posture classification', usedIn: ['phantom-posture'] },
      ],
    },
  ],
  software: [
    {
      group: 'Languages',
      skills: [
        { name: 'Python', usedIn: ['palletlens', 'the-classifier', 'phantom-posture', 'convergence', 'first-contact'] },
        { name: 'C / C++', usedIn: [] },
        { name: 'JavaScript · TypeScript', usedIn: ['palletlens', 'the-classifier'] },
        { name: 'Java · C#', usedIn: [] },
      ],
    },
    {
      group: 'Apps & APIs',
      skills: [
        { name: 'FastAPI (async, modular back ends)', usedIn: ['palletlens', 'the-classifier'] },
        { name: 'React supervision interfaces', usedIn: ['palletlens', 'the-classifier'] },
        { name: 'Streamlit', usedIn: ['phantom-posture'] },
        { name: 'OAuth2 · Microsoft Graph', usedIn: ['the-classifier'] },
        { name: 'Low-latency video: UDP / MJPEG, Pixel Streaming', usedIn: ['palletlens'] },
        { name: 'REST · WebSockets', usedIn: [] },
      ],
    },
    {
      group: 'Data & tooling',
      skills: [
        { name: 'MQTT · Telegraf · InfluxDB · Grafana', usedIn: ['phantom-posture'] },
        { name: 'Docker', usedIn: ['phantom-posture'] },
        { name: 'PostgreSQL', usedIn: [] },
        { name: 'Git · CI/CD · unit tests · CMake', usedIn: [] },
      ],
    },
  ],
  robotics: [
    {
      group: 'Manipulation & control',
      skills: [
        { name: 'ROS2', usedIn: ['convergence'] },
        { name: 'Kinematics: modified Denavit–Hartenberg, Jacobian', usedIn: ['convergence', 'phantom-posture'] },
        { name: 'Closed-loop Cartesian control, damped least squares', usedIn: ['convergence'] },
        { name: 'Quintic trajectory generation', usedIn: ['convergence'] },
        { name: 'PID control', usedIn: ['palletlens'] },
      ],
    },
    {
      group: 'Autonomous systems',
      skills: [
        { name: 'UAV / drone missions', usedIn: ['palletlens'] },
        { name: 'Social robots (QT)', usedIn: ['first-contact'] },
        { name: 'SLAM · sensor fusion (Kalman)', usedIn: [] },
      ],
    },
    {
      group: 'Embedded & simulation',
      skills: [
        { name: 'ESP32 · IMU (MPU6050)', usedIn: ['phantom-posture'] },
        { name: 'Unreal Engine · AirSim', usedIn: ['palletlens'] },
        { name: 'Blender digital twins', usedIn: ['phantom-posture'] },
        { name: 'Gazebo · Isaac Sim · NVIDIA Jetson · CUDA', usedIn: [] },
      ],
    },
  ],
};

export const PROFILE = {
  name: 'Rendra Djunaedi',
  role: 'Robotics Software Engineer',
  education: [
    { title: 'Master’s, Computer Science & Robotics', where: 'Université de Montpellier', when: '2024 — 2026' },
    { title: 'Bachelor’s, Computer Science', where: 'Université de Montpellier', when: '2020 — 2024' },
  ],
  location: 'Paris · open to relocation',
  languages: 'French (native) · English (C1)',
  links: [
    { label: 'LinkedIn', href: 'https://linkedin.com/in/rendra-djunaedi' },
    { label: 'GitHub', href: 'https://github.com/RendraDJ' },
  ],
};
