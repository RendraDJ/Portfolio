/**
 * ★ The experiences — the computers in the HQ (hq/hq.ts), one each.
 * Titles are the reports' own, shortened.
 * Written from the internship reports and CVs in ../experiences and ../cv.
 * Edit freely: the panel that opens on click is built from these fields.
 */
import { publicUrl } from '../url';
import qtPoster from '../assets/experiences/qt-poster.webp';

/** The object on the pole that stands for the experience (see build.ts). */
export type SignKind = 'drone' | 'desk' | 'mailbox' | 'robot' | 'arm';

export interface Experience {
  slug: string;
  /** Which object on the pole stands for it. */
  kind: SignKind;
  title: string;
  /** Company / lab, place. */
  where: string;
  when: string;
  role: string;
  /** Who it was done with (omit for solo work). */
  team?: string;
  summary: string;
  highlights: readonly string[];
  stack: readonly string[];
  /** Honest note on scope/limits, if any. */
  note?: string;
  /** The report, as a file in public/ (omit when there is none). */
  report?: string;
  /** The project's poster, as an image (omit when there is none). */
  poster?: string;
}

export const experiences: readonly Experience[] = [
  {
    slug: 'palletlens',
    kind: 'drone',
    title: 'Drone-Based Logistics Inspection',
    report: publicUrl('/reports/Audensiel.pdf'),
    where: 'Audensiel — R&D Innovation Lab, Boulogne-Billancourt',
    when: 'Mar — Aug 2026',
    role: 'Software & Robotics Engineer (internship)',
    summary:
      'A simulation and visual-analysis platform for drone-based warehouse inspection: from rack selection to drone positioning, image capture, tag reading and result storage, in one web supervision app.',
    highlights: [
      'Turned an initial Unreal Engine / AirSim scene into an end-to-end, testable inspection demonstrator.',
      'Generic rack mission (3 levels × 4 slots, serpentine order) with a smoothed 3D PID velocity controller to align the drone before each capture.',
      'Two inspection cameras (1920×1080, 20° and 90° FOV) streamed live over UDP/MJPEG with latest-frame priority, plus Pixel Streaming for the global view.',
      'Logistics-tag detection, OCR and barcode reading shown live with confidence scores.',
      'Automatic annotation from segmentation masks — up to 24 lighting/orientation variants per slot — replacing manual labelling.',
      'Modular async FastAPI back end with a mock mode for testing without the simulator; React supervision interface.',
    ],
    stack: ['Unreal Engine 4.27', 'AirSim', 'Python', 'FastAPI', 'React', 'OpenCV', 'OCR', 'UDP / MJPEG', 'Pixel Streaming'],
    note: 'A research and demonstration platform: functional validation done, quantitative benchmarks are the next step.',
  },
  {
    slug: 'phantom-posture',
    kind: 'desk',
    title: 'Digital Twin for Posture Prevention',
    report: publicUrl('/reports/LIRMM.pdf'),
    where: 'LIRMM, Montpellier',
    when: 'Oct 2025 — Feb 2026',
    role: 'Robotics & IoT Engineer',
    team: 'With Mehdi Kais — supervised by Yassine Haddab',
    summary:
      'A digital twin of the upper body for posture prevention: sensors and a webcam drive a 3D avatar in real time, with live monitoring and replay of recorded sessions.',
    highlights: [
      'Inertial sensing with ESP32 + MPU6050 (calibrated) for torso inclination.',
      'Camera-based pose estimation with MediaPipe and OpenCV for head and shoulder angles.',
      'Real-time pipeline: MQTT (Mosquitto) → Telegraf → InfluxDB → Grafana, all under Docker.',
      'Blender avatar driven by Denavit–Hartenberg kinematics, synchronized live over MQTT.',
      'Streamlit control interface with monitoring and simulation (replay) modes.',
      'Validated over a continuous one-hour session with stable signals and no major data loss.',
    ],
    stack: ['ESP32', 'MPU6050', 'MediaPipe', 'OpenCV', 'MQTT', 'InfluxDB', 'Grafana', 'Docker', 'Blender', 'Streamlit'],
  },
  {
    slug: 'the-classifier',
    kind: 'mailbox',
    title: 'Automatic E-mail Classification',
    report: publicUrl('/reports/ESCO.pdf'),
    where: 'ESCO Lifesciences, Singapore',
    when: 'May — Jul 2025',
    role: 'AI / NLP Software Engineer (internship)',
    team: 'With Teddy Harbulot',
    summary:
      'Automatic sorting of the company’s incoming e-mails into categories and sub-categories, in a web mailbox where people can correct the AI and retrain it.',
    highlights: [
      'Compared SVM, Random Forest and BERT; BERT embeddings gave the best accuracy and F1-score.',
      'Sentence embeddings (MiniLM) + supervised classifiers, with dedicated models for sub-categories (e.g. RFQ: Lab / Healthcare / Medical sales).',
      'Secure Outlook access through Microsoft Graph and OAuth2 (Azure AD app), after a Gmail prototype.',
      'Cleaning pipeline: HTML to text, signature and disclaimer removal, automatic translation to English.',
      'React + FastAPI app: inbox, statistics, manual reclassification, new categories and one-click retraining.',
    ],
    stack: ['Python', 'BERT / MiniLM', 'scikit-learn', 'FastAPI', 'React', 'Microsoft Graph', 'OAuth2', 'BeautifulSoup'],
  },
  {
    slug: 'first-contact',
    kind: 'robot',
    title: 'QT Robot — Physical Interaction',
    poster: qtPoster,
    where: 'LIRMM, Montpellier — QT Robot',
    when: 'Nov 2024 — Jan 2025',
    role: 'Project',
    summary:
      'Sensory interaction features for the QT social robot: detecting physical interactions with signal processing and machine learning.',
    highlights: ['Sensory interaction features for a robotics platform.', 'Signal processing and machine learning to detect physical interactions.'],
    stack: ['Python', 'Signal processing', 'Machine learning'],
  },
  {
    slug: 'convergence',
    kind: 'arm',
    title: 'UR10 Kinematic Control',
    report: publicUrl('/reports/UR10.pdf'),
    where: 'Master’s project — Manipulation Robotics',
    when: '2024 — 2025',
    role: 'Academic project',
    summary:
      'Kinematic control of a 6-DOF UR10 arm: moving its tool from a start to a target pose along a smooth trajectory, controlled in both position and orientation.',
    highlights: [
      'Forward kinematics with modified Denavit–Hartenberg parameters and a tool offset; geometric Jacobian with tool-offset correction.',
      'Closed-loop control with proportional gains and a damped least-squares pseudo-inverse to stay stable near singularities.',
      'Quintic (5th-order) trajectories in position and axis-angle orientation: joint velocities start and end at zero.',
      'Position and orientation errors converge in about 2 s; tested in simulation and on the physical robot.',
    ],
    stack: ['ROS2', 'Python', 'Kinematics', 'Jacobian', 'Trajectory generation'],
  },
];
