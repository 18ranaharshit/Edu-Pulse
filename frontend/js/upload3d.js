(function () {
  const container = document.getElementById('upload3d');
  if (!container || typeof THREE === 'undefined') return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
  camera.position.set(0, 0, 14);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  // 1. Ingestion Funnel Conical Geometry
  const funnelGeom = new THREE.CylinderGeometry(4.8, 1.2, 7, 32, 12, true);
  const funnelMat = new THREE.MeshBasicMaterial({
    color: 0x7c3aed,
    wireframe: true,
    transparent: true,
    opacity: 0.25,
  });
  const funnelMesh = new THREE.Mesh(funnelGeom, funnelMat);
  funnelMesh.rotation.x = Math.PI / 6;
  group.add(funnelMesh);

  // 2. Swirling Ingestion Particles
  const pCount = 200;
  const pGeom = new THREE.BufferGeometry();
  const pPositions = [];
  const pColors = [];
  const pVelocities = [];

  const hexColors = [0x4f46e5, 0x7c3aed, 0x0ea5e9, 0x34d399];
  const colors = hexColors.map((c) => new THREE.Color(c));

  for (let i = 0; i < pCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 8;
    const radius = 1.2 + ((y + 4) / 8) * 3.8;

    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    pPositions.push(x, y, z);
    pVelocities.push(angle, y, radius);

    const col = colors[i % colors.length];
    pColors.push(col.r, col.g, col.b);
  }

  pGeom.setAttribute('position', new THREE.Float32BufferAttribute(pPositions, 3));
  pGeom.setAttribute('color', new THREE.Float32BufferAttribute(pColors, 3));

  const pMat = new THREE.PointsMaterial({
    size: 0.14,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
  });

  const pMesh = new THREE.Points(pGeom, pMat);
  group.add(pMesh);

  // 3. Mouse Parallax
  let targetRotX = 0;
  let targetRotY = 0;

  window.addEventListener(
    'mousemove',
    function (e) {
      const rect = container.getBoundingClientRect();
      const pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetRotY = pointerX * 0.55;
      targetRotX = pointerY * 0.35;
    },
    { passive: true }
  );

  window.addEventListener('resize', function () {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    group.rotation.y += (targetRotY - group.rotation.y) * 0.04 + 0.003;
    group.rotation.x += (targetRotX - group.rotation.x) * 0.04;

    funnelMesh.rotation.y = elapsedTime * 0.2;

    // Swirl particles down the vortex
    const pos = pGeom.attributes.position.array;
    for (let i = 0; i < pCount; i++) {
      let angle = pVelocities[i * 3] + 0.02;
      let y = pVelocities[i * 3 + 1] - 0.03;

      if (y < -4) y = 4; // Loop back up

      const radius = 1.2 + ((y + 4) / 8) * 3.8;

      pos[i * 3] = radius * Math.cos(angle);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = radius * Math.sin(angle);

      pVelocities[i * 3] = angle;
      pVelocities[i * 3 + 1] = y;
    }
    pGeom.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();
})();
