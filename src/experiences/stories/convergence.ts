import type { Story } from '../story';

export const story: Story = {
  slug: 'convergence',
  hook: 'Closed-loop kinematic control of a 6-DOF UR10: quintic trajectories, damped least squares, errors converging in about 2 s.',
  chapters: [
    {
      tag: 'context',
      title: 'Move the tool, precisely',
      text: 'The UR10 is a six-joint industrial arm. The goal: drive its end effector from an initial pose to a desired final pose, tracking a trajectory in both position and orientation. Control happens at the velocity level, closing the loop on the Cartesian error and mapping it back to the joints through the inverse kinematic model.',
      points: [
        '6 revolute joints, modified Denavit–Hartenberg model',
        'Position and orientation tracked simultaneously',
        'Proportional correction plus velocity feedforward',
        'Damped pseudo-inverse to stay stable near singularities',
      ],
    },
    {
      tag: 'demo',
      title: 'Watch it converge',
      text: 'The arm follows a smooth reference toward the target pose. The Cartesian error spikes at the start, then is driven to zero by the control loop while joint velocities rise and fall without jerks.',
      visual: { type: 'demo' },
    },
    {
      tag: 'architecture',
      title: 'The control loop',
      text: 'Every control step runs the same chain. A quintic profile produces the desired pose and velocity, the current pose comes from forward kinematics, and the error between them is corrected proportionally. The resulting Cartesian twist is mapped to joint velocities with a regularised Jacobian inverse, then integrated into joint positions.',
      points: [
        'Reference: x_d(t), R_d(t) and their velocities',
        'Error: position difference plus axis-based orientation error',
        'Output: q̇, integrated as q ← q + q̇·dt',
      ],
      visual: {
        type: 'pipeline',
        steps: [
          { label: 'Target pose', detail: 'x_f, R_f from x_i, R_i', kind: 'data' },
          { label: 'Quintic trajectory', detail: 'r(τ) = 10τ³ − 15τ⁴ + 6τ⁵', kind: 'software' },
          { label: 'Pose error', detail: 'e_p = x_d − x · e_O from R, R_d', kind: 'software' },
          { label: 'Control law', detail: 'v = [ẋ_d + K_p e_p ; u_orient]', kind: 'software' },
          { label: 'Damped pseudo-inverse', detail: 'q̇ = Jᵀ(JJᵀ + λ²I)⁻¹ v', kind: 'software' },
          { label: 'Joint velocities', detail: 'q ← q + q̇·dt', kind: 'data' },
          { label: 'UR10', detail: 'Simulation and physical robot', kind: 'hardware' },
        ],
      },
    },
    {
      tag: 'robotics',
      title: 'Forward kinematics and Jacobian',
      text: 'Each joint contributes a homogeneous transform built with the modified Denavit–Hartenberg convention. Chaining them gives T₀₆, from which the tool position and orientation are read, accounting for a tool offset d₇. The geometric Jacobian, built from each joint axis Zᵢ and position vector Pᵢ₆, links joint velocities to the end-effector twist: V = J(q)q̇.',
      plain: 'Knowing every joint angle, you can compute exactly where the tool is and which way it points. The Jacobian answers the reverse question for small motions: if each joint turns a little, how does the tool move?',
      visual: {
        type: 'steps',
        items: [
          { title: 'Per-joint transform', text: 'dh_modified builds T(j−1, j) from the modified DH parameters of joint j.' },
          { title: 'Chain the frames', text: 'T₀₆ = T₀₁ · T₁₂ · … · T₅₆ gives the wrist pose in the base frame.' },
          { title: 'Add the tool', text: 'The tool offset d₇ moves the controlled point to the actual tool tip.' },
          { title: 'Geometric Jacobian', text: 'Columns from the joint axes Zᵢ and vectors Pᵢ₆: rotation and translation per joint.' },
          { title: 'Tool correction', text: 'A matrix M carrying the d₇ terms shifts the Jacobian to the tool point.' },
        ],
      },
    },
    {
      tag: 'algorithm',
      title: 'Control law, damped inverse',
      text: 'The commanded twist combines the reference velocity with proportional correction: K_p·e_p for position, K_O·e_O for orientation through an intermediate matrix L. Near a singularity, det(J) → 0 and a plain inverse explodes. Damped least squares adds λ²I so JJᵀ + λ²I is always invertible; with λ = 0.001, precision is preserved away from singularities.',
      plain: 'The robot constantly measures how far it is from where it should be and pushes harder the bigger the gap. A small safety term stops the maths from asking the motors for absurd speeds in awkward arm configurations.',
      points: [
        'Diagonal gains: K_P = K_O = diag(16, 16, 16) in the code',
        'Higher gain (40) converges faster; too high oscillates',
        'λ too large would damp motion even far from singularities',
      ],
      visual: {
        type: 'code',
        lang: 'python',
        caption: 'Simplified — one control step (NumPy)',
        code: `import numpy as np

def orientation_error(R, Rd):
    n, s, a = R.T            # columns of current orientation
    nd, sd, ad = Rd.T        # columns of desired orientation
    return 0.5 * (np.cross(n, nd) + np.cross(s, sd) + np.cross(a, ad))

def control_step(q, x, R, xd, xd_dot, Rd, wd, L, J, dt,
                 Kp=16.0, Ko=16.0, lam=1e-3):
    e_p = xd - x
    e_o = orientation_error(R, Rd)
    u_orient = np.linalg.solve(L, L.T @ wd + Ko * e_o)
    v = np.hstack([xd_dot + Kp * e_p, u_orient])
    # damped least squares: stays finite when det(J) -> 0
    q_dot = J.T @ np.linalg.solve(J @ J.T + lam**2 * np.eye(6), v)
    return q + q_dot * dt`,
      },
    },
    {
      tag: 'algorithm',
      title: 'Quintic trajectory generation',
      text: 'The reference uses a fifth-order time scaling r(τ) = 10τ³ − 15τ⁴ + 6τ⁵ with τ = t/t_f. It goes from 0 to 1 with zero velocity and zero acceleration at both ends, so the arm starts and stops without jerks. Position is interpolated linearly along r; orientation rotates about a fixed axis u by an angle r·θ.',
      plain: 'Instead of jumping toward the target, the robot eases in, speeds up through the middle, and eases out, the way a person moves a glass of water.',
      visual: {
        type: 'steps',
        items: [
          { title: 'Normalise time', text: 'τ = t / t_f, with t_f = 10 s for the tested motion.' },
          { title: 'Progress profile', text: 'r(τ) = 10τ³ − 15τ⁴ + 6τ⁵: zero velocity and acceleration at τ = 0 and 1.' },
          { title: 'Position', text: 'x_d(t) = x_i + r(t)·(x_f − x_i), a straight line in Cartesian space.' },
          { title: 'Orientation', text: 'R_d(t) = R_i · R(u, r(t)·θ): axis-angle rotation about a fixed axis u.' },
          { title: 'Velocity shape', text: 'Joint speeds start at zero, peak near t_f / 2, return to zero.' },
        ],
      },
    },
    {
      tag: 'results',
      title: 'Converged, and where it breaks',
      text: 'Over a 10 s trajectory, position and orientation errors show an initial peak, then converge to zero and settle in about 2 s. Actual Cartesian positions track the quintic reference closely and reach the target. The Jacobian determinant never crossed zero along the tested path, confirming the regularised solution stayed stable.',
      points: [
        'Joint velocities peak around t = 5 s, then return to zero',
        'Physical tests showed jerks when dt was too large',
        'Gain is a trade-off: faster convergence versus overshoot',
        'Stability validated on one tested trajectory, not the whole workspace',
      ],
      visual: {
        type: 'stats',
        items: [
          { value: '6 DOF', label: 'UR10 arm, revolute joints' },
          { value: '≈ 2 s', label: 'position and orientation error convergence' },
          { value: '10 s', label: 'trajectory duration t_f' },
          { value: '0.001', label: 'damping factor λ' },
        ],
      },
    },
  ],
};
