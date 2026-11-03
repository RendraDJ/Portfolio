import type { Story } from '../story';

/** PalletLens — drone-based logistics inspection (Audensiel R&D Innovation Lab). Written from the internship report. */
export const story: Story = {
  slug: 'palletlens',
  hook: 'A simulated drone that flies a warehouse rack, aligns on every tag, reads it, and labels its own training data.',
  chapters: [
    {
      tag: 'context',
      title: 'From flying demo to inspector',
      text:
        'The starting point was an Unreal Engine scene with AirSim and a simulated drone that could fly, but no inspection workflow. The goal: turn it into a testable, end-to-end demonstrator linking rack selection, drone positioning, multi-camera capture, tag reading, web supervision and dataset generation, with every result traceable to its rack, slot, camera and timestamp.',
      points: [
        'Built on Unreal Engine 4.27 and Microsoft AirSim, the existing base.',
        'Racks of 3 levels (A, B, C) × 4 slots, defined in one JSON config.',
        'Synthetic, fictitious tags: no confidential supply-chain data exposed.',
        'Had to stay testable without the simulator, and never freeze the web server.',
      ],
      visual: {
        type: 'stats',
        items: [
          { value: '3 × 4', label: 'slots per rack' },
          { value: '2', label: 'inspection cameras (20° and 90° FOV)' },
          { value: '1920×1080', label: 'capture resolution' },
          { value: '1.5 m/s', label: 'nominal speed' },
        ],
      },
    },
    {
      tag: 'demo',
      title: 'One rack, start to finish',
      text:
        'The drone sweeps one rack in serpentine order, A1 to A4, back B4 to B1, then C1 to C4, so it never crosses the rack to change level. At each occupied slot it aligns on the tag with a PID controller, captures through its narrow 20° camera, then the tag is detected and its text and barcode are read. Empty slots are skipped.',
      visual: { type: 'demo' },
    },
    {
      tag: 'app',
      title: 'Inside the supervision app',
      text:
        'The operator never touches the scripts: everything goes through one React supervision workspace. Start a session, fly, pick a rack and launch the inspection, then follow the reads into the inventory, check each capture’s analysis and find past flights in the archives. Below is a working replica, driven by itself — each step says what happens behind the click.',
      points: [
        'Control: staged start-up — AirSim, cameras, flight controller, then Ready.',
        'Mission: rack choice, serpentine progress, PID error in real time.',
        'Inventory and Results: every read traced to rack, slot, camera, time.',
        'Archives: finished flights and the CSV export for logistics.',
      ],
      visual: { type: 'app' },
    },
    {
      tag: 'architecture',
      title: 'The end-to-end chain',
      text:
        'Each layer has one job. React expresses the operator’s action, FastAPI validates and orchestrates it, the mission script drives AirSim over RPC, and the specialised camera views come back as low-latency UDP streams re-served as MJPEG. The global scene reaches the browser through Pixel Streaming.',
      points: [
        'React → FastAPI over HTTP/JSON: session, rack selection, launch, status.',
        'FastAPI ↔ AirSim RPC: poses, flight commands, images, segmentation masks.',
        'Unreal Engine → Python stream server: UDP/JPEG fragments.',
        'Every capture keyed by rack, slot, camera and timestamp.',
      ],
      visual: {
        type: 'pipeline',
        steps: [
          { label: 'React supervision', detail: 'Session, rack selection, live views, results', kind: 'ui' },
          { label: 'FastAPI orchestrator', detail: 'ops · mission · flights · csv routers', kind: 'software' },
          { label: 'Mission script', detail: 'run_mission(rack_id), PID alignment', kind: 'software' },
          { label: 'AirSim + Unreal Engine 4.27', detail: 'Simulated multirotor, cam0 / cam1, Render Targets', kind: 'hardware' },
          { label: 'UDP → MJPEG streams', detail: 'Latest-frame priority, TTL cleanup', kind: 'data' },
          { label: 'Tag analysis', detail: 'Tag detection, OCR, barcode decoding', kind: 'ai' },
          { label: 'Dataset service', detail: 'RGB + masks + metadata → annotated sample', kind: 'data' },
        ],
      },
    },
    {
      tag: 'ai',
      title: 'Reading a logistics tag',
      text:
        'Once the drone is in position, the close-up cam0 image (20° FOV) is processed in stages. A detector boxes the complete tag, the region is cropped and enlarged, text detection finds character areas, text recognition turns them into strings, and barcodes follow a separate decoding path. Stages stay distinct because a well-located box can still yield a wrong OCR read.',
      plain:
        'The drone photographs the label, the software finds it in the picture, zooms in, and reads the printed text and the barcode, showing how sure it is about each one.',
      points: [
        'Recognised strings, barcode values and confidence scores overlaid live.',
        'The 90° cam1 view stays visible for pallet and spatial context.',
        'Each result linked to rack, slot, timestamp and camera.',
      ],
      visual: {
        type: 'steps',
        items: [
          { title: 'Tag detection', text: 'A bounding box locates the whole label in the wider cam0 image.' },
          { title: 'Crop and enlarge', text: 'The tag region is isolated so small print becomes readable.' },
          { title: 'Text detection', text: 'Finds the areas likely to contain characters.' },
          { title: 'Text recognition', text: 'Converts each text region into a string, with a confidence score.' },
          { title: 'Barcode decoding', text: 'Barcode regions follow their own decoding path.' },
          { title: 'Overlay', text: 'Values and scores drawn over the view for the operator to check.' },
        ],
      },
    },
    {
      tag: 'ai',
      title: 'Self-labelling synthetic data',
      text:
        'Manual bounding boxes were costly and inconsistent, so the simulator labels its own images. Before a segmentation capture every object is reset to ID 0 and only the target tag or pallet gets its own ID; AirSim then renders a target-only mask from cam0 and cam1, and the box is computed from the target’s pixels. It follows the real visible projection, including perspective and partial occlusion.',
      plain:
        'The simulator paints everything black except the object of interest, so the computer knows exactly where it is in the picture and can draw the box itself.',
      points: [
        'Variants per slot: tag tilt, light rotation, base / low / high lighting.',
        'Up to 12 RGB variants per camera, 24 per occupied slot.',
        'Photometric fallback (contrast, brightness, gamma) if lighting changes too little.',
        'Invalid responses or unmatched actors are reported, never silently saved.',
      ],
      visual: {
        type: 'compare',
        columns: ['Box source', 'Consistency', 'Handles occlusion'],
        rows: [
          { label: 'Manual framing', values: ['Costly, operator-dependent', 'By eye'] },
          { label: '3D dimensions only', values: ['Theoretical box', 'No'] },
          { label: 'Target-only segmentation mask', values: ['Pixel-exact, automatic', 'Yes, visible projection'], best: true },
        ],
        caption: 'Training pipeline (masks as ground truth) is separate from the inference pipeline.',
      },
    },
    {
      tag: 'software',
      title: 'Streaming without the lag',
      text:
        'UDP gives no delivery or ordering guarantee, so one JPEG frame arrives as fragments the Python receiver must reassemble. It keeps only the latest complete frame, rejects stale frame IDs and drops partial frames after a configurable TTL, favouring freshness over completeness. Blocking AirSim calls run in worker threads so the FastAPI event loop keeps answering status requests.',
      points: [
        'Already-JPEG payloads forwarded to MJPEG with no decode–encode cycle.',
        'Configurable target frame rate; send only when a new frame exists.',
        'Diagnostics: packets, bandwidth, FPS, drops, duplicates, stream resets.',
        'Staged init (connection, cameras, flight controller → Ready) gates missions.',
        'Mock Mode: a virtual drone state for testing without the simulator.',
      ],
      visual: {
        type: 'pipeline',
        steps: [
          { label: 'Unreal camera', detail: 'Render Target aligned with the AirSim camera', kind: 'hardware' },
          { label: 'UDP fragments', detail: 'Encoded JPEG split into packets', kind: 'data' },
          { label: 'Reassembly', detail: 'Frame IDs, duplicate filter, TTL purge', kind: 'software' },
          { label: 'Latest-frame slot', detail: 'Newest complete frame replaces the old one', kind: 'software' },
          { label: 'HTTP / MJPEG', detail: 'Rate-regulated stream to the browser', kind: 'ui' },
        ],
      },
    },
    {
      tag: 'algorithm',
      title: 'PID alignment on each tag',
      text:
        'The target comes from the live tag pose (simGetObjectPose), not a hard-coded slot: x stays on the inspection plane, y and z follow the tag, with a −0.47 m vertical offset for the camera, in AirSim’s NED frame. A 3D PID outputs a velocity command, smoothed with the previous one. Success is a position error under 0.08 m; after 20 s, a slower position command gets 6 more seconds.',
      plain:
        'The drone measures how far it is from the label and corrects its speed many times a second, slowing down as it gets close so it stops steady enough for a sharp photo.',
      points: [
        'Kp = 0.70, Ki = 0.02, Kd = 0.35, control step 0.1 s.',
        'Integral clipped to ±1.5 per axis against wind-up.',
        'Speed cap shrinks with remaining distance; then an 8 s settle before capture.',
      ],
      visual: {
        type: 'code',
        lang: 'python',
        code: `KP, KI, KD, DT = 0.70, 0.02, 0.35, 0.1

def align(drone, target, tol=0.08, timeout=20.0):
    integ, e_prev, v_prev, t = zeros(3), zeros(3), zeros(3), 0.0
    while t < timeout:
        e = target - drone.position()          # NED, metres
        if norm(e) < tol:
            return True
        integ = clip(integ + e * DT, -1.5, 1.5)  # anti wind-up
        v = KP * e + KI * integ + KD * (e - e_prev) / DT
        v = cap_norm(v, speed_limit(norm(e)))  # slower near the tag
        v = 0.8 * v_prev + 0.2 * v             # smooth the command
        drone.move_by_velocity(v, DT)
        e_prev, v_prev, t = e, v, t + DT
    # assistance phase: slower AirSim position command, up to 6 s
    return drone.move_to_position(target, slow=True, timeout=6.0)`,
        caption: 'Simplified from the mission script: 3D PID velocity control with smoothing and a fallback.',
      },
    },
    {
      tag: 'results',
      title: 'Validated end to end',
      text:
        'Every link of the chain was validated through functional scenarios in simulation: rack loading, PID positioning within threshold, dual-camera capture, tag analysis, automatic annotation and supervision from the web app. The validation is functional, not statistical: no OCR accuracy, UDP latency or PID performance bound is claimed yet.',
      points: [
        'Next: measure convergence time, overshoot, latency percentiles, OCR accuracy.',
        'Replace simulated pose resets with continuous navigation from a home position.',
        'Fixed 8 s settle does not re-check the 0.08 m threshold.',
        'One call inspects one rack; multi-rack needs orchestration.',
        'Sim-to-real gap not yet measured on real warehouse images.',
      ],
      visual: {
        type: 'stats',
        items: [
          { value: '6', label: 'end-to-end functions validated' },
          { value: '0.08 m', label: 'alignment threshold reached before capture' },
          { value: '24', label: 'auto-annotated RGB images per occupied slot' },
          { value: '12', label: 'slots swept per rack mission' },
        ],
      },
    },
  ],
};
