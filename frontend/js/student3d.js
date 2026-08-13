(function () {
  const container = document.getElementById('student3d');
  if (!container || typeof THREE === 'undefined') return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
  camera.position.set(0, 0, 16);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  // 1. Gyroscope Diagnostic Rings
  const colors = [0x4f46e5, 0x7c3aed, 0x0ea5e9, 0x059669];
  const rings = [];

  for (let i = 0; i < 4; i++) {
    const radius = 3.2 + i * 1.4;
    const geom = new THREE.TorusGeometry(radius, 0.03, 16, 80);
    const mat = new THREE.MeshBasicMaterial({
      color: colors[i],
      transparent: true,
      opacity: 0.35 - i * 0.05,
      wireframe: true,
    });
    const ring = new THREE.Mesh(geom, mat);
    ring.rotation.x = Math.PI / 4 + i * 0.35;
    ring.rotation.y = i * 0.5;
    group.add(ring);
    rings.push({ mesh: ring, speed: (i % 2 === 0 ? 1 : -1) * (0.005 + i * 0.002) });
  }

  // 2. Central Diagnostic Pulse Core
  const coreGeom = new THREE.DodecahedronGeometry(1.4, 1);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x4f46e5,
    wireframe: true,
    transparent: true,
    opacity: 0.4,
  });
  const coreMesh = new THREE.Mesh(coreGeom, coreMat);
  group.add(coreMesh);

  // 3. Floating Telemetry Particles
  const pCount = 120;
  const pGeom = new THREE.BufferGeometry();
  const pPositions = [];
  const pColors = [];

  for (let i = 0; i < pCount; i++) {
    const r = 4.5 + Math.random() * 3.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;

    pPositions.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );

    const col = new THREE.Color(colors[i % colors.length]);
    pColors.push(col.r, col.g, col.b);
  }

  pGeom.setAttribute('position', new THREE.Float32BufferAttribute(pPositions, 3));
  pGeom.setAttribute('color', new THREE.Float32BufferAttribute(pColors, 3));

  const pMat = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });

  const pMesh = new THREE.Points(pGeom, pMat);
  group.add(pMesh);

  // 4. Mouse Parallax
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

    group.rotation.y += (targetRotY - group.rotation.y) * 0.04 + 0.002;
    group.rotation.x += (targetRotX - group.rotation.x) * 0.04;

    rings.forEach((r) => {
      r.mesh.rotation.z += r.speed;
      r.mesh.rotation.x += r.speed * 0.5;
    });

    coreMesh.rotation.y = elapsedTime * 0.25;
    coreMesh.rotation.x = elapsedTime * 0.18;

    renderer.render(scene, camera);
  }

  animate();
})();
