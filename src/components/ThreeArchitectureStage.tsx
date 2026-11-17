import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type ArchitectureStagePreset =
  | 'overview'
  | 'debate_ring'
  | 'load_balancer'
  | 'ai_core';

interface ThreeArchitectureStageProps {
  activePreset?: ArchitectureStagePreset;
  onPresetChange?: (preset: ArchitectureStagePreset) => void;
  customNodes?: Array<{ id: string; label: string; kind: string }>;
  compact?: boolean;
}

const PRESET_CAMERAS: Record<
  ArchitectureStagePreset,
  { pos: [number, number, number]; lookAt: [number, number, number]; label: string; summary: string }
> = {
  overview: {
    pos: [0, 7.2, 13.5],
    lookAt: [0, 0.6, 0],
    label: 'Full System & 10-Seat Ring',
    summary:
      '10 orbital speaker stations connected via optical conduits to the central distributed system topology and AI evaluation core.',
  },
  debate_ring: {
    pos: [-8.5, 5.4, 9.2],
    lookAt: [0, 0.4, 0],
    label: '10-Seat Debate Queue',
    summary:
      'Active speaker node transmits live voice-to-text packets while 9 listener stations queue cross-questions and clarifications.',
  },
  load_balancer: {
    pos: [6.4, 4.2, 7.6],
    lookAt: [0.8, 1.1, -0.5],
    label: 'Rate Limiter & HA Cluster',
    summary:
      'Multi-tier ingress router, token-bucket rate limiter, Redis quorum, and primary/replica database shards under simulated load.',
  },
  ai_core: {
    pos: [0, 3.3, 6.2],
    lookAt: [0, 1.4, 0],
    label: 'Evidence Verification Core',
    summary:
      'Synthesizes attributed speaker transcripts into Best Approach, Questioning Back, Clarification, and Trade-Off Defense points.',
  },
};

export function ThreeArchitectureStage({
  activePreset = 'overview',
  onPresetChange,
  customNodes,
  compact = false,
}: ThreeArchitectureStageProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [selectedPreset, setSelectedPreset] =
    useState<ArchitectureStagePreset>(activePreset);
  const [explodedFactor, setExplodedFactor] = useState(0.15);
  const [finishMode, setFinishMode] = useState<'titanium' | 'obsidian' | 'gold'>(
    'titanium'
  );
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [webglFallback, setWebglFallback] = useState(false);

  const targetPresetRef = useRef<ArchitectureStagePreset>(activePreset);
  const explodedRef = useRef<number>(explodedFactor);
  const finishRef = useRef<'titanium' | 'obsidian' | 'gold'>(finishMode);

  useEffect(() => {
    setSelectedPreset(activePreset);
    targetPresetRef.current = activePreset;
  }, [activePreset]);

  useEffect(() => {
    explodedRef.current = explodedFactor;
  }, [explodedFactor]);

  useEffect(() => {
    finishRef.current = finishMode;
  }, [finishMode]);

  const handleSelectPreset = (preset: ArchitectureStagePreset) => {
    setSelectedPreset(preset);
    targetPresetRef.current = preset;
    onPresetChange?.(preset);
  };

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // Detect software WebGL from GPU renderer string per threejs skill directive
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFallback(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, compact ? 320 : 480);
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFallback(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    const bgHex = 0x090d15;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.032);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    camera.position.set(0, 7.2, 13.5);

    // Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.85);
    hemiLight.position.set(0, 18, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1db, 2.4);
    keyLight.position.set(8, 14, 9);
    keyLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 35;
      const d = 10;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-10, 8, -9);
    scene.add(rimLight);

    // Procedural Ground Grid & Contact Shadow Plane
    const createGridTexture = () => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#090d15';
        ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 512; i += 32) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 512);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(512, i);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
        ctx.beginPath();
        ctx.arc(256, 256, 200, 0, Math.PI * 2);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    const gridTex = createGridTexture();
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      map: gridTex,
      roughness: 0.75,
      metalness: 0.2,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Contact shadow grounding plane
    const contactCanvas = document.createElement('canvas');
    contactCanvas.width = 256;
    contactCanvas.height = 256;
    const cctx = contactCanvas.getContext('2d');
    if (cctx) {
      const grad = cctx.createRadialGradient(128, 128, 16, 128, 128, 124);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      cctx.fillStyle = grad;
      cctx.fillRect(0, 0, 256, 256);
    }
    const contactTex = new THREE.CanvasTexture(contactCanvas);
    const contactGeo = new THREE.PlaneGeometry(14, 14);
    const contactMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadow = new THREE.Mesh(contactGeo, contactMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.02;
    scene.add(contactShadow);

    // Shared PBR Materials
    const primaryMetalMat = new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8,
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.4,
      anisotropy: 0.7,
    });

    const darkChassisMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.48,
    });

    const copperAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.88,
      roughness: 0.22,
    });

    const cyanAccentMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      metalness: 0.5,
      roughness: 0.25,
    });

    const glassShellMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: isSoftwareGl ? 0.32 : 0.88,
      transmission: isSoftwareGl ? 0 : 0.9,
      ior: 1.52,
      roughness: 0.1,
      metalness: 0.05,
      depthWrite: false,
    });

    // Root Composite Group (8+ distinct sub-assemblies)
    const rootAssembly = new THREE.Group();
    scene.add(rootAssembly);

    // 1. Primary Silhouette: Multi-tiered Consensus Platform & Core Plinth
    const basePlinthGroup = new THREE.Group();
    const lowerPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 0.32, 32),
      darkChassisMat
    );
    lowerPlinth.position.y = 0.16;
    lowerPlinth.castShadow = true;
    lowerPlinth.receiveShadow = true;
    basePlinthGroup.add(lowerPlinth);

    const midBevelRing = new THREE.Mesh(
      new THREE.CylinderGeometry(2.65, 2.95, 0.24, 24),
      primaryMetalMat
    );
    midBevelRing.position.y = 0.44;
    midBevelRing.castShadow = true;
    basePlinthGroup.add(midBevelRing);

    const opticalBusRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.75, 0.055, 16, 64),
      cyanAccentMat
    );
    opticalBusRing.rotation.x = Math.PI / 2;
    opticalBusRing.position.y = 0.56;
    basePlinthGroup.add(opticalBusRing);
    rootAssembly.add(basePlinthGroup);

    // 2. Central AI Evaluation & Rubric Synthesis Core (Multi-part Group)
    const aiCoreGroup = new THREE.Group();
    aiCoreGroup.position.set(0, 1.45, 0);

    const innerPolyhedron = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.68, 1),
      copperAccentMat
    );
    innerPolyhedron.castShadow = true;
    aiCoreGroup.add(innerPolyhedron);

    const outerGlassDome = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.02, 2),
      glassShellMat
    );
    outerGlassDome.renderOrder = 2;
    aiCoreGroup.add(outerGlassDome);

    const gyroRingA = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.04, 16, 64),
      primaryMetalMat
    );
    const gyroRingB = new THREE.Mesh(
      new THREE.TorusGeometry(1.42, 0.035, 16, 64),
      copperAccentMat
    );
    gyroRingB.rotation.x = Math.PI / 3;
    aiCoreGroup.add(gyroRingA);
    aiCoreGroup.add(gyroRingB);
    rootAssembly.add(aiCoreGroup);

    // 3. Distributed Architecture Cluster Towers (6 composite server nodes around the core)
    const clusterGroup = new THREE.Group();
    const clusterRadius = 2.25;
    const nodeCount = 6;
    const clusterTowers: THREE.Group[] = [];

    for (let i = 0; i < nodeCount; i += 1) {
      const angle = (i / nodeCount) * Math.PI * 2;
      const tower = new THREE.Group();
      tower.position.set(
        Math.cos(angle) * clusterRadius,
        0.56,
        Math.sin(angle) * clusterRadius
      );

      // Tower hull
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.92, 0.62),
        darkChassisMat
      );
      hull.position.y = 0.46;
      hull.castShadow = true;
      tower.add(hull);

      // Brushed metal top cap
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.12, 0.68),
        primaryMetalMat
      );
      cap.position.y = 0.96;
      tower.add(cap);

      // Status collar
      const collar = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.06, 0.66),
        i % 2 === 0 ? cyanAccentMat : copperAccentMat
      );
      collar.position.y = 0.72;
      tower.add(collar);

      // Optical conduit tube to center core
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.5, 0),
        new THREE.Vector3(
          -Math.cos(angle) * 0.9,
          0.85,
          -Math.sin(angle) * 0.9
        ),
        new THREE.Vector3(
          -Math.cos(angle) * clusterRadius,
          0.95,
          -Math.sin(angle) * clusterRadius
        ),
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.025, 8, false);
      const tubeMesh = new THREE.Mesh(tubeGeo, cyanAccentMat);
      tower.add(tubeMesh);

      clusterTowers.push(tower);
      clusterGroup.add(tower);
    }
    rootAssembly.add(clusterGroup);

    // 4. 10-Seat Orbital Debate Speaker Ring (10 composite speaker pods)
    const debateRingGroup = new THREE.Group();
    const ringRadius = 4.65;
    const seatCount = 10;

    // Outer debate ring track
    const outerTrack = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 0.045, 12, 96),
      darkChassisMat
    );
    outerTrack.rotation.x = Math.PI / 2;
    outerTrack.position.y = 0.18;
    debateRingGroup.add(outerTrack);

    for (let s = 0; s < seatCount; s += 1) {
      const theta = (s / seatCount) * Math.PI * 2;
      const pod = new THREE.Group();
      pod.position.set(
        Math.cos(theta) * ringRadius,
        0,
        Math.sin(theta) * ringRadius
      );
      pod.lookAt(0, 0, 0);

      // Pod pedestal
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.36, 0.28, 16),
        darkChassisMat
      );
      pedestal.position.y = 0.14;
      pedestal.castShadow = true;
      pod.add(pedestal);

      // Console desk
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.1, 0.34),
        primaryMetalMat
      );
      desk.position.set(0, 0.34, 0.08);
      desk.rotation.x = -0.25;
      pod.add(desk);

      // Speaker mic/beacon indicator (Seat 0 is active speaker, others are listeners)
      const isSpeaker = s === 0 || s === 4;
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.24, 12),
        isSpeaker ? copperAccentMat : cyanAccentMat
      );
      beacon.position.set(0, 0.48, 0);
      pod.add(beacon);

      debateRingGroup.add(pod);
    }
    rootAssembly.add(debateRingGroup);

    // 5. Instanced Data Packets orbiting between the 10-seat ring and the core
    const packetCount = 30;
    const packetGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const packetInstanced = new THREE.InstancedMesh(
      packetGeo,
      packetMat,
      packetCount
    );
    packetInstanced.frustumCulled = false;
    const dummyMatrix = new THREE.Matrix4();
    const dummyPos = new THREE.Vector3();
    const dummyQuat = new THREE.Quaternion();
    const dummyScale = new THREE.Vector3(1, 1, 1);
    const dummyColor = new THREE.Color();

    for (let i = 0; i < packetCount; i += 1) {
      dummyColor.setHex(i % 3 === 0 ? 0xf59e0b : 0x38bdf8);
      packetInstanced.setColorAt(i, dummyColor);
    }
    packetInstanced.instanceColor?.needsUpdate;
    rootAssembly.add(packetInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Reusable vectors for zero-GC animation loop
    const currentLookAt = new THREE.Vector3(0, 0.6, 0);
    const targetCamPos = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();
    const startTimeMs = performance.now();
    let prevTimeMs = startTimeMs;

    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min((nowMs - prevTimeMs) * 0.001, 0.1);
      prevTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) * 0.001;

      // Apply finish swatch smoothly
      const currentFinish = finishRef.current;
      if (currentFinish === 'titanium') {
        primaryMetalMat.color.setHex(0x94a3b8);
        primaryMetalMat.roughness = 0.18;
      } else if (currentFinish === 'obsidian') {
        primaryMetalMat.color.setHex(0x1e293b);
        primaryMetalMat.roughness = 0.12;
      } else {
        primaryMetalMat.color.setHex(0xd97706);
        primaryMetalMat.roughness = 0.2;
      }

      // Smooth camera interpolation toward selected preset
      const presetCfg = PRESET_CAMERAS[targetPresetRef.current];
      targetCamPos.set(
        presetCfg.pos[0] + Math.sin(elapsed * 0.25) * 0.35,
        presetCfg.pos[1],
        presetCfg.pos[2] + Math.cos(elapsed * 0.25) * 0.35
      );
      targetLookAt.set(
        presetCfg.lookAt[0],
        presetCfg.lookAt[1],
        presetCfg.lookAt[2]
      );

      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        targetCamPos.x,
        4.2,
        dt
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        targetCamPos.y,
        4.2,
        dt
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        targetCamPos.z,
        4.2,
        dt
      );

      currentLookAt.x = THREE.MathUtils.damp(
        currentLookAt.x,
        targetLookAt.x,
        5.0,
        dt
      );
      currentLookAt.y = THREE.MathUtils.damp(
        currentLookAt.y,
        targetLookAt.y,
        5.0,
        dt
      );
      currentLookAt.z = THREE.MathUtils.damp(
        currentLookAt.z,
        targetLookAt.z,
        5.0,
        dt
      );
      camera.lookAt(currentLookAt);

      // Smooth exploded-view separation
      const exp = explodedRef.current;
      aiCoreGroup.position.y = THREE.MathUtils.damp(
        aiCoreGroup.position.y,
        1.45 + exp * 1.4,
        6.0,
        dt
      );
      clusterGroup.position.y = THREE.MathUtils.damp(
        clusterGroup.position.y,
        exp * 0.55,
        6.0,
        dt
      );
      debateRingGroup.scale.setScalar(
        THREE.MathUtils.damp(debateRingGroup.scale.x, 1 + exp * 0.16, 6.0, dt)
      );

      // Rotate AI core gyroscopes
      innerPolyhedron.rotation.y = elapsed * 0.55;
      innerPolyhedron.rotation.x = elapsed * 0.3;
      gyroRingA.rotation.z = elapsed * 0.45;
      gyroRingA.rotation.x = Math.sin(elapsed * 0.4) * 0.5;
      gyroRingB.rotation.y = -elapsed * 0.6;

      // Update orbital data packets
      for (let i = 0; i < packetCount; i += 1) {
        const seatIdx = i % seatCount;
        const baseAngle = (seatIdx / seatCount) * Math.PI * 2;
        const progress = (elapsed * 0.45 + i * 0.13) % 1;
        const r = THREE.MathUtils.lerp(ringRadius, 0.4, progress);
        const y =
          Math.sin(progress * Math.PI) * (1.2 + exp * 0.8) +
          0.35 +
          progress * 0.8;
        dummyPos.set(Math.cos(baseAngle) * r, y, Math.sin(baseAngle) * r);
        dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
        packetInstanced.setMatrixAt(i, dummyMatrix);
      }
      packetInstanced.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!container || disposed) return;
      const nextW = Math.max(container.clientWidth, 320);
      const nextH = Math.max(container.clientHeight, compact ? 320 : 480);
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      floorGeo.dispose();
      floorMat.dispose();
      gridTex.dispose();
      contactGeo.dispose();
      contactMat.dispose();
      contactTex.dispose();
      primaryMetalMat.dispose();
      darkChassisMat.dispose();
      copperAccentMat.dispose();
      cyanAccentMat.dispose();
      glassShellMat.dispose();
      packetGeo.dispose();
      packetMat.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, [compact]);

  const activePresetMeta = PRESET_CAMERAS[selectedPreset];

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-800 bg-[#090D15] ${
        compact ? 'h-[380px]' : 'h-[540px]'
      }`}
    >
      {/* Dedicated WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        className="h-full w-full"
        aria-label="Interactive 3D Distributed Architecture and 10-Seat Debate Stage"
      />

      {webglFallback ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090D15] p-6 text-center">
          <p className="font-display text-base font-semibold text-white">
            3D System Topology &amp; 10-Seat Debate Ring
          </p>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            {activePresetMeta.summary}
          </p>
        </div>
      ) : null}

      {/* Minimal Top-Left Spec Overlay (Zero Center Occlusion) */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-sm rounded-lg border border-slate-800/90 bg-[#0B0F17]/90 px-4 py-3">
        <p className="font-mono text-[11px] text-blue-400 tabular-nums">
          3D SPATIAL STAGE · {activePresetMeta.label}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {activePresetMeta.summary}
        </p>
        {customNodes && customNodes.length > 0 ? (
          <p className="mt-1.5 font-mono text-[11px] text-amber-300 tabular-nums">
            Active Room Lab Nodes: {customNodes.length} synced
          </p>
        ) : null}
      </div>

      {/* Collapsible Bottom Control Dock (Per Three.js Skill Section 5) */}
      <div className="
        pointer-events-auto absolute bottom-4 left-1/2 z-10 w-[94%] max-w-[860px] -translate-x-1/2
      ">
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="rounded-md border border-slate-800 bg-[#0B0F17]/95 px-3 py-1 text-[11px] font-medium text-slate-300 hover:border-slate-600 hover:text-white whitespace-nowrap shrink-0"
          >
            {dockCollapsed ? '▴ Show 3D Stage Controls' : '▾ Hide Controls'}
          </button>
        </div>

        {!dockCollapsed ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0B0F17]/95 px-4 py-3">
            {/* Camera View Presets */}
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'overview', label: 'Overview' },
                  { id: 'debate_ring', label: '10-Seat Ring' },
                  { id: 'load_balancer', label: 'Rate Limiter Cluster' },
                  { id: 'ai_core', label: 'AI Evidence Core' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectedPreset === preset.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Exploded View Slider */}
            <div className="flex items-center gap-2.5">
              <label
                htmlFor="exploded-slider"
                className="text-xs text-slate-400 whitespace-nowrap shrink-0"
              >
                Exploded View:{' '}
                <span className="font-mono text-slate-200 tabular-nums">
                  {Math.round(explodedFactor * 100)}%
                </span>
              </label>
              <input
                id="exploded-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={explodedFactor}
                onChange={(e) => setExplodedFactor(Number(e.target.value))}
                className="h-1.5 w-24 cursor-pointer accent-blue-500"
              />
            </div>

            {/* Material Finish Selector */}
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'titanium', label: 'Titanium' },
                  { id: 'obsidian', label: 'Obsidian' },
                  { id: 'gold', label: 'Brushed Gold' },
                ] as const
              ).map((mat) => (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => setFinishMode(mat.id)}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    finishMode === mat.id
                      ? 'border border-amber-500/50 bg-amber-500/15 text-amber-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mat.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
