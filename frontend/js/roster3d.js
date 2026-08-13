(function () {
  const container = document.getElementById('roster3d');
  if (!container || typeof THREE === 'undefined') return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 100);
  camera.position.set(0, 0, 16);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  // 1. Large Cohort Orbital Rings
  const ringColors = [0x4f46e5, 0x7c3aed, 0x0ea5e9];
  const ringRaddi = [4.2, 6.5, 8.8];

  ringRaddi.forEach((radius, idx) => {
    const geom = new THREE.TorusGeometry(radius, 0.035, 16, 100);
    const mat = new THREE.MeshBasicMaterial({
      color: ringColors[idx % ringColors.length],
      transparent: true,
      opacity: 0.28,
      wireframe: true,
    });
    const ring = new THREE.Mesh(geom, mat);
    ring.rotation.x = Math.PI / 3 + idx * 0.2;
    ring.rotation.y = idx * 0.4;
    group.add(ring);

    // Add floating cohort spheres on each ring
    const sphereCount = 8 + idx * 4;
    const sphereGeom = new THREE.SphereGeometry(0.18, 16, 16);
    for (let i = 0; i < sphereCount; i++) {
      const angle = (i / sphereCount) * Math.PI * 2;
      const sMat = new THREE.MeshBasicMaterial({
        color: ringColors[(i + idx) % ringColors.length],
        transparent: true,
        opacity: 0.85,
      });
      const sMesh = new THREE.Mesh(sphereGeom, sMat);
      sMesh.position.x = radius * Math.cos(angle);
      sMesh.position.y = radius * Math.sin(angle) * 0.5;
      sMesh.position.z = Math.sin(angle * 2) * 1.5;
      group.add(sMesh);
    }
  });

  // 2. Central Multi-Facet Geometry
  const coreGeom = new THREE.OctahedronGeometry(1.6, 2);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x7c3aed,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  const coreMesh = new THREE.Mesh(coreGeom, coreMat);
  group.add(coreMesh);

  // 3. Mouse Parallax
  let targetRotX = 0;
  let targetRotY = 0;

  window.addEventListener(
    'mousemove',
    function (e) {
      const rect = container.getBoundingClientRect();
      const pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetRotY = pointerX * 0.5;
      targetRotX = pointerY * 0.3;
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

    coreMesh.rotation.y = -elapsedTime * 0.2;
    coreMesh.rotation.z = elapsedTime * 0.15;

    renderer.render(scene, camera);
  }

  animate();
})();
