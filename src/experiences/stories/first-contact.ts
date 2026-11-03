import type { Story } from '../story';

export const story: Story = {
  slug: 'first-contact',
  hook: 'Teaching the QT social robot to feel a touch: signal processing and machine learning to detect physical interaction.',
  chapters: [
    {
      tag: 'context',
      title: 'A robot that notices touch',
      text: 'QT is a social robot designed to interact with people. At LIRMM, I worked on its sensory interaction features: detecting when and how someone physically interacts with it. Raw sensor readings say little on their own; they have to be turned into events the robot can understand and respond to.',
      points: [
        'Platform: QT social robot, LIRMM Montpellier',
        'Goal: detect physical interactions from sensor signals',
        'Tools: Python, signal processing, machine learning',
      ],
    },
    {
      tag: 'demo',
      title: 'Touch it yourself',
      text: 'Tap, stroke or press QT on its head, arms or body. The demo extracts simple features from the touch (duration, energy, motion), labels the gesture with a confidence, and QT reacts. It is an illustration of the approach, not the original system.',
      visual: { type: 'demo' },
    },
    {
      tag: 'ai',
      title: 'From signal to gesture',
      text: 'Detection follows a classic signal-processing and machine-learning pipeline. The continuous sensor stream is cleaned, cut into short time windows, and each window is summarised by descriptive features. A supervised classifier maps those features to an interaction type, and the decision triggers a behaviour on the robot.',
      plain: 'A touch leaves a trace in the sensor data, like a fingerprint in time. The system measures the shape of that trace — how long, how strong, how much it moves — and learns which shapes mean a tap, a stroke or a press.',
      visual: {
        type: 'steps',
        items: [
          { title: 'Acquire the signal', text: 'Read the robot’s sensor stream continuously, sample by sample.' },
          { title: 'Filter and window', text: 'Remove noise, then cut the stream into short, overlapping time windows.' },
          { title: 'Extract features', text: 'Summarise each window: duration, energy, amplitude, motion and similar descriptors.' },
          { title: 'Classify', text: 'A supervised model trained on labelled examples names the interaction.' },
          { title: 'React', text: 'The detected event drives the robot’s response: expression, speech or gesture.' },
        ],
      },
    },
    {
      tag: 'software',
      title: 'Closing the loop on QT',
      text: 'Detection is only useful if the robot acts on it. The interaction features were built for the QT platform in Python, turning sensor input into events that its behaviours can consume. A recognised contact can then drive a visible response, so the person knows the robot felt it.',
      points: [
        'Python components for signal processing and classification',
        'Detected interactions exposed as events for robot behaviours',
        'A visible reaction confirms the touch was recognised',
      ],
    },
    {
      tag: 'results',
      title: 'What I learned',
      text: 'Working on physical human–robot interaction with a real social robot showed how much of the problem sits before the model: a clean signal, a sensible window and the right features matter as much as the classifier itself. It also showed that detection is only half the job: the robot’s reaction is what makes the interaction feel real.',
      points: [
        'Well-chosen features make the classifier’s job far easier',
        'Windowing trades reaction speed against reliable recognition',
        'Human–robot interaction needs fast, legible robot responses',
        'Real sensor data is noisy; filtering is not optional',
      ],
    },
  ],
};
