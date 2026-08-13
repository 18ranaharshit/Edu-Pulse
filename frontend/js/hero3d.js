(function () {
  const container = document.getElementById('hero3d');
  if (!container || typeof THREE === 'undefined') {
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  // 1. Scene & Camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
  camera.position.set(0, 0, 9.5);

  // 2. Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // 3. Main Group
  const group = new THREE.Group();
  scene.add(group);

  // Palette: Indigo (#4f46e5), Purple (#7c3aed), Cyan (#0ea5e9)
  const hexColors = [0x4f46e5, 0x7c3aed, 0x0ea5e9];
  const colors = hexColors.map((c) => new THREE.Color(c));

  // 4. Fibonacci Sphere Points
  const N = 260;
  const baseRadius = 6.4;
  const pointPositions = [];
  const pointColors = [];
  const pointVecs = [];

  for (let i = 0; i < N; i++) {
    const phi = Math.acos(-1 + (2 * i) / N);
    const theta = Math.sqrt(N * Math.PI) * phi;
    const jitter = 0.9 + Math.random() * 0.5; // 0.9 to 1.4
    const r = baseRadius * jitter;

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    pointPositions.push(x, y, z);
    pointVecs.push(new THREE.Vector3(x, y, z));

    const color = colors[i % 3];
    pointColors.push(color.r, color.g, color.b);
  }

  const pointsGeometry = new THREE.BufferGeometry();
  pointsGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(pointPositions, 3)
  );
  pointsGeometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(pointColors, 3)
  );

  const pointsMaterial = new THREE.PointsMaterial({
    size: 0.135,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const pointsMesh = new THREE.Points(pointsGeometry, pointsMaterial);
  group.add(pointsMesh);

  // 5. Connecting Edge Lines
  const linePositions = [];
  const lineColors = [];
  let lineCount = 0;

  for (let i = 0; i < N; i++) {
    if (lineCount >= 900) break;
    const v1 = pointVecs[i];
    const c1 = colors[i % 3];

    for (let j = i + 1; j < N; j++) {
      const v2 = pointVecs[j];
      const dist = v1.distanceTo(v2);

      if (dist < 2.05) {
        linePositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
        lineColors.push(c1.r, c1.g, c1.b, c1.r, c1.g, c1.b);
        lineCount++;
        if (lineCount >= 900) break;
      }
    }
  }

  const linesGeometry = new THREE.BufferGeometry();
  linesGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(linePositions, 3)
  );
  linesGeometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(lineColors, 3)
  );

  const linesMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });

  const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
  group.add(linesMesh);

  // 6. Core Wireframe Element
  const coreGeometry = new THREE.IcosahedronGeometry(1.15, 1);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x4f46e5,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  group.add(coreMesh);

  // 7. Mouse Parallax Tracking
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

  // 8. Resize Handler
  window.addEventListener('resize', function () {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // 9. Animation Loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // Damped parallax rotation + constant Y auto-rotation
    group.rotation.y += (targetRotY - group.rotation.y) * 0.04 + 0.0022;
    group.rotation.x += (targetRotX - group.rotation.x) * 0.04;

    // Independent core rotation
    coreMesh.rotation.y = elapsedTime * 0.15;
    coreMesh.rotation.x = elapsedTime * 0.1;

    // Subtle pulse size modulation
    pointsMaterial.size = 0.135 + Math.sin(elapsedTime * 0.8) * 0.01;

    renderer.render(scene, camera);
  }

  animate();
})();
