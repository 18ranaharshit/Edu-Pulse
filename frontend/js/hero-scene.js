/* ==========================================================================
   EduPulse — WebGL 3D Hero Constellation ("Academic Pulse")
   Three.js self-hosted 3D node network scene with mouse-parallax.
   ========================================================================== */

export function initHeroScene() {
  const container = document.getElementById('heroCanvasContainer');
  if (!container || !window.THREE) return;

  const THREE = window.THREE;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 8;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0x818cf8, 2, 20);
  pointLight.position.set(0, 0, 5);
  scene.add(pointLight);

  // Constellation group
  const group = new THREE.Group();
  scene.add(group);

  // Brand color palette
  const colors = [0x6366f1, 0xa78bfa, 0x38bdf8, 0x34d399, 0xfb7185];
  const numNodes = window.innerWidth < 600 ? 25 : 45;
  const maxDistance = 2.8;

  const nodes = [];
  const nodeGeom = new THREE.SphereGeometry(0.12, 16, 16);

  // Create nodes
  for (let i = 0; i < numNodes; i++) {
    const color = colors[i % colors.length];
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.2,
    });

    const mesh = new THREE.Mesh(nodeGeom, mat);
    mesh.position.x = (Math.random() - 0.5) * 7.5;
    mesh.position.y = (Math.random() - 0.5) * 3.8;
    mesh.position.z = (Math.random() - 0.5) * 3.5;

    // Velocity for subtle floating
    mesh.userData = {
      vx: (Math.random() - 0.5) * 0.003,
      vy: (Math.random() - 0.5) * 0.003,
      vz: (Math.random() - 0.5) * 0.003,
      baseX: mesh.position.x,
      baseY: mesh.position.y,
    };

    group.add(mesh);
    nodes.push(mesh);
  }

  // Create dynamic line connections
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x818cf8,
    transparent: true,
    opacity: 0.18,
  });

  const lineGeom = new THREE.BufferGeometry();
  const linePositions = new Float32Array(numNodes * numNodes * 6);
  lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineSegments = new THREE.LineSegments(lineGeom, lineMat);
  group.add(lineSegments);

  // Mouse Parallax tracking
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;

  const onMouseMove = (e) => {
    if (reduceMotion) return;
    const rect = container.getBoundingClientRect();
    targetMouseX = ((e.clientX - rect.left) / container.clientWidth - 0.5) * 2;
    targetMouseY = -((e.clientY - rect.top) / container.clientHeight - 0.5) * 2;
  };

  window.addEventListener('mousemove', onMouseMove);

  // Resize handler
  const onResize = () => {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };

  window.addEventListener('resize', onResize);

  // Animation Loop
  let reqId = null;

  const animate = () => {
    reqId = requestAnimationFrame(animate);

    if (!reduceMotion) {
      // Auto-rotation
      group.rotation.y += 0.002;
      group.rotation.x += 0.0008;

      // Smooth camera parallax
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      camera.position.x = mouseX * 1.2;
      camera.position.y = mouseY * 1.2;
      camera.lookAt(scene.position);

      // Subtle float node movement
      nodes.forEach((n) => {
        n.position.x += n.userData.vx;
        n.position.y += n.userData.vy;
        n.position.z += n.userData.vz;

        if (Math.abs(n.position.x - n.userData.baseX) > 0.8) n.userData.vx *= -1;
        if (Math.abs(n.position.y - n.userData.baseY) > 0.8) n.userData.vy *= -1;
      });
    }

    // Update connecting lines
    let vertexIdx = 0;
    const posAttr = lineGeom.attributes.position;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);
        if (dist < maxDistance) {
          posAttr.array[vertexIdx++] = nodes[i].position.x;
          posAttr.array[vertexIdx++] = nodes[i].position.y;
          posAttr.array[vertexIdx++] = nodes[i].position.z;

          posAttr.array[vertexIdx++] = nodes[j].position.x;
          posAttr.array[vertexIdx++] = nodes[j].position.y;
          posAttr.array[vertexIdx++] = nodes[j].position.z;
        }
      }
    }

    lineGeom.setDrawRange(0, vertexIdx / 3);
    posAttr.needsUpdate = true;

    renderer.render(scene, camera);
  };

  animate();
}
