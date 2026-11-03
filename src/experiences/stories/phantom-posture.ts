import type { Story } from '../story';

export const story: Story = {
  slug: 'phantom-posture',
  hook: 'A chest-worn IMU and a webcam drive a 7-DOF Blender avatar of your upper body, live over MQTT.',
  chapters: [
    {
      tag: 'context',
      title: 'Posture, made visible',
      text:
        'Prolonged sitting and screen work push the upper body into poor posture, a path to musculoskeletal disorders and chronic pain. Wearables and pose estimation can measure it, but raw signals give little intuitive feedback. The answer here is a connected digital twin: a virtual upper body that evolves synchronously with real sensor and vision data, for live monitoring and replay of past sessions.',
      plain: 'Instead of reading numbers, you watch a 3D copy of yourself that slouches when you slouch.',
      points: [
        'Target: back slouching and leaning, head yaw/pitch/roll, shoulder movement',
        'Hybrid sensing: inertial (ESP32 + MPU6050) and vision (MediaPipe + OpenCV)',
        'Goals: real-time visualization, posture assessment, historical analysis',
      ],
    },
    {
      tag: 'demo',
      title: 'The twin in motion',
      text:
        'Watch the avatar mirror a seated user: the torso tilts with the chest-worn IMU, the head turns with the angles MediaPipe extracts from the webcam. Each new angle travels as an MQTT message and rotates the matching armature joint immediately, while the same stream is logged for later analysis.',
      visual: { type: 'demo' },
    },
    {
      tag: 'app',
      title: 'Inside the control center',
      text:
        'No command line: one Streamlit dashboard starts the services, shows their state and switches between Monitoring and Simulation. It reads InfluxDB for the live charts, embeds the Grafana panels and makes sure the Blender twin receives its MQTT streams. Below is a working replica, driven by itself — each step says what happens behind the click.',
      points: [
        'Sidebar: services, mode and alert limit; status indicators on top.',
        'Live monitoring: MediaPipe landmarks, angles against the reference posture, alerts.',
        'Digital twin: the DH armature and the MQTT messages that drive it.',
        'Grafana and History: the one-hour session, then a replay through MQTT.',
      ],
      visual: { type: 'app' },
    },
    {
      tag: 'architecture',
      title: 'From body to dashboard',
      text:
        'Two sensing modules publish to an Eclipse Mosquitto broker. Blender subscribes to drive the twin; Telegraf subscribes in parallel, parses the JSON payloads and writes them to InfluxDB, which Grafana queries for dashboards. Publishers and subscribers never talk directly, so each block can be swapped or added without touching the others.',
      points: [
        'ESP32 streams gyroscope data over Wi-Fi; webcam module publishes landmarks and joint angles',
        'QoS 0 or 1: low latency with sufficient delivery guarantees',
        'InfluxDB bucket "sensors" keeps every timestamped measurement',
      ],
      visual: {
        type: 'pipeline',
        steps: [
          { label: 'ESP32 + MPU6050', detail: 'Chest-worn IMU, gyroscope over I2C, Wi-Fi', kind: 'hardware' },
          { label: 'Webcam + MediaPipe', detail: 'Pose landmarks to head / shoulder angles', kind: 'ai' },
          { label: 'Mosquitto (MQTT)', detail: 'Pub/sub broker, QoS 0/1, in Docker', kind: 'data' },
          { label: 'Telegraf → InfluxDB', detail: 'JSON parsing into time-series bucket', kind: 'data' },
          { label: 'Blender twin', detail: 'Armature joints rotated on each message', kind: 'software' },
          { label: 'Grafana + Streamlit', detail: 'Dashboards, control center, two modes', kind: 'ui' },
        ],
      },
    },
    {
      tag: 'ai',
      title: 'Pose from a webcam',
      text:
        'OpenCV captures the frames, resizes and converts their colour space, then MediaPipe pose estimation detects anatomical landmarks (head, neck, shoulders, torso) as 3D vectors in the camera frame. Joining landmarks yields bone vectors such as shoulder-to-elbow or neck-to-head; the directional change between them quantifies bending, slouching or leaning against a reference posture.',
      plain:
        'The camera finds key points on your body, draws lines between them, and measures how those lines tilt compared to when you started.',
      points: [
        'Outputs head yaw, pitch and roll, plus shoulder and arm angles',
        'First captured frame is the reference posture',
        'Landmarks and vectors overlaid on the video for visual checking',
      ],
      visual: {
        type: 'steps',
        items: [
          { title: 'Capture', text: 'OpenCV grabs webcam frames, resizes them, converts colour.' },
          { title: 'Landmarks', text: 'MediaPipe returns (x, y, z) points: head, neck, shoulders, torso.' },
          { title: 'Bone vectors', text: 'Landmark pairs become segments: neck to head, shoulder to elbow.' },
          { title: 'Angles', text: 'Directional change between vectors gives bending and leaning.' },
          { title: 'Reference', text: 'Deviation measured against the first frame, then published over MQTT.' },
        ],
      },
    },
    {
      tag: 'robotics',
      title: 'A body as a kinematic chain',
      text:
        'The upper body is modelled with the Denavit–Hartenberg convention as rigid links joined by revolute joints, so every measured angle maps to a physically coherent bone rotation in the Blender armature. The head is a spherical joint (3 DOF), the spine has 2 DOF driven by the IMU, and each arm has 1 DOF, since a single 2D camera gives no 3D reconstruction.',
      points: [
        'Head: yaw, pitch, roll from MediaPipe',
        'Spine: roll and pitch from the MPU6050',
        'IMU zero-rate offsets removed by averaging a stationary capture',
        'MPU6050 on I2C: SDA GPIO 21, SCL GPIO 22, 3.3 V',
        'ESP32 and IMU housed in a SolidWorks case strapped to the chest',
      ],
      visual: {
        type: 'compare',
        columns: ['DOF', 'Joint angles', 'Source'],
        rows: [
          { label: 'Head', values: ['3', 'yaw, pitch, roll', 'Webcam (MediaPipe)'] },
          { label: 'Spine', values: ['2', 'roll, pitch', 'MPU6050 gyroscope'] },
          { label: 'Right arm', values: ['1', 'single rotation', 'Webcam (2D)'] },
          { label: 'Left arm', values: ['1', 'single rotation', 'Webcam (2D)'] },
          { label: 'Avatar total', values: ['7', 'DH chain', 'Hybrid'], best: true },
        ],
        caption: 'Degrees of freedom of the Denavit–Hartenberg model, per segment.',
      },
    },
    {
      tag: 'software',
      title: 'One stack, two modes',
      text:
        'Mosquitto, Telegraf, InfluxDB and Grafana run in Docker containers for portability and identical behaviour across machines. A Streamlit control center starts and stops services, shows their status and plots live values. Because the twin only listens to MQTT, Simulation mode can replay InfluxDB history by republishing it chronologically, and Blender treats it exactly like live data.',
      points: [
        'Monitoring: live stream, alerts possible beyond predefined angular limits',
        'Simulation: replay recorded sessions at adjustable speed, timing preserved',
        'Grafana panels embedded inside the Streamlit interface',
      ],
      visual: {
        type: 'pipeline',
        steps: [
          { label: 'Streamlit UI', detail: 'Pick mode and dataset, manage services', kind: 'ui' },
          { label: 'InfluxDB query', detail: 'Timestamps and joint angles of a session', kind: 'data' },
          { label: 'Chronological sync', detail: 'Signals re-ordered, replay speed adjustable', kind: 'software' },
          { label: 'Republish to MQTT', detail: 'Emulates a live sensor stream', kind: 'data' },
          { label: 'Blender twin', detail: 'Replays the past posture session', kind: 'software' },
        ],
      },
    },
    {
      tag: 'algorithm',
      title: 'From landmarks to joint angles',
      text:
        'The core loop is short: build a bone vector from two landmarks, measure its angle, subtract the reference captured on the first frame, and publish the deviation. On the IMU side, calibration is the same idea: average the gyroscope output while still, then subtract that offset from every later reading.',
      plain:
        'Measure how far each body segment has turned since the start, clean out sensor bias, and send the result to the avatar.',
      visual: {
        type: 'code',
        lang: 'python',
        caption: 'Simplified',
        code: `import numpy as np

def bone(lm, a, b):                      # segment vector between two landmarks
    return np.array([lm[b].x - lm[a].x, lm[b].y - lm[a].y, lm[b].z - lm[a].z])

def angle(v):                            # inclination of a segment
    return np.degrees(np.arctan2(v[0], -v[1]))

ref = None
for lm in pose_stream():                 # MediaPipe landmarks, frame by frame
    a = angle(bone(lm, NECK, HEAD))
    ref = a if ref is None else ref      # first frame = reference posture
    client.publish(TOPIC, json.dumps({"head_pitch": a - ref}))

def gyro_offset(samples):                # IMU kept still during calibration
    return np.mean(samples, axis=0)      # subtracted from every later reading`,
      },
    },
    {
      tag: 'results',
      title: 'Validated over an hour',
      text:
        'The twin reproduced upright, forward-slouching and lateral-leaning postures, following torso inclination from the MPU6050 and head and shoulder rotations from MediaPipe. A one-hour continuous Monitoring-mode run kept signals stable in Grafana, with consistent sampling and no major communication loss, while posture variations and corrections stayed clearly visible.',
      points: [
        'Validation was qualitative: no ground-truth angle error or latency figure measured',
        'Arms limited to 1 DOF by the single 2D camera',
        'Only gyroscope data used; accelerometer left unused',
        'Next: predictive analytics and intelligent posture correction',
      ],
      visual: {
        type: 'stats',
        items: [
          { value: '1 h', label: 'continuous monitoring run, stable signals' },
          { value: '7 DOF', label: 'Denavit–Hartenberg avatar' },
          { value: '3 postures', label: 'reproduced: upright, slouch, lateral lean' },
          { value: '2 modes', label: 'live monitoring and replay simulation' },
        ],
      },
    },
  ],
};
