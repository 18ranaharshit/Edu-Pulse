/* ==========================================================================
   EduPulse — 3D Subject Analytics Bar Charts (Three.js WebGL)
   Renders interactive 3D score bar charts per subject with trend-colored emissive glow.
   Includes hover raycaster tooltips and IntersectionObserver viewport optimization.
   ========================================================================== */

export function render3DSubjectChart(containerEl, scores, trendLabel) {
  if (!containerEl || !window.THREE || !scores || scores.length === 0) {
    return false;
  }

  // Mobile fallback (< 600px): return false to render 2D SVG fallback
  if (window.innerWidth < 600) {
    return false;
  }

  const THREE = window.THREE;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  containerEl.innerHTML = '';

  const width = containerEl.clientWidth || 320;
  const height = 120;

  // Color mapping based on trend_label
  const colorMap = {
    Improving: { color: 0x34d399, emissive: 0x059669 },
    Declining: { color: 0xfb7185, emissive: 0xe11d48 },
    Stable: { color: 0x818cf8, emissive: 0x4f46e5 },
  };

  const palette = colorMap[trendLabel] || colorMap.Stable;

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 3.2, 7.2);
  camera.lookAt(0, 1.2, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  containerEl.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const chartGroup = new THREE.Group();
  scene.add(chartGroup);

  // Base platform plane
  const baseGeom = new THREE.PlaneGeometry(scores.length * 1.2 + 0.5, 1.8);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const baseMesh = new THREE.Mesh(baseGeom, baseMat);
  baseMesh.rotation.x = Math.PI / 2;
  baseMesh.position.y = 0;
  chartGroup.add(baseMesh);

  // Bars
  const bars = [];
  const barWidth = 0.55;
  const barDepth = 0.55;
  const startX = -((scores.length - 1) * 1.1) / 2;

  scores.forEach((s, idx) => {
    const pct = (s.score / s.max_score) * 100;
    const barHeight = Math.max(0.2, (pct / 100) * 2.8);

    const geom = new THREE.BoxGeometry(barWidth, barHeight, barDepth);
    const mat = new THREE.MeshStandardMaterial({
      color: palette.color,
      emissive: palette.emissive,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(startX + idx * 1.1, barHeight / 2, 0);

    mesh.userData = {
      testName: s.test_name,
      score: pct.toFixed(0),
      originalHeight: barHeight,
    };

    chartGroup.add(mesh);
    bars.push(mesh);
  });

  // Tooltip overlay element
  let tooltip = containerEl.querySelector('.three-chart-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'three-chart-tooltip';
    containerEl.style.position = 'relative';
    containerEl.appendChild(tooltip);
  }

  // Raycaster for mouse hover
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let hoveredBar = null;

  const onMouseMove = (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(bars);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hoveredBar !== hit) {
        if (hoveredBar) hoveredBar.material.emissiveIntensity = 0.45;
        hoveredBar = hit;
        hoveredBar.material.emissiveIntensity = 0.9;
      }
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX - rect.left}px`;
      tooltip.style.top = `${e.clientY - rect.top - 32}px`;
      tooltip.innerHTML = `<strong>${hit.userData.testName}</strong>: ${hit.userData.score}%`;
    } else {
      if (hoveredBar) hoveredBar.material.emissiveIntensity = 0.45;
      hoveredBar = null;
      tooltip.style.display = 'none';
    }
  };

  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mouseleave', () => {
    if (hoveredBar) hoveredBar.material.emissiveIntensity = 0.45;
    hoveredBar = null;
    tooltip.style.display = 'none';
  });

  // Animation Loop with Viewport Optimization
  let isVisible = true;
  let animId = null;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      isVisible = entry.isIntersecting;
      if (isVisible && !animId) animate();
    });
  }, { threshold: 0.1 });

  observer.observe(containerEl);

  const animate = () => {
    if (!isVisible) {
      animId = null;
      return;
    }
    animId = requestAnimationFrame(animate);

    if (!reduceMotion) {
      chartGroup.rotation.y = Math.sin(Date.now() * 0.001) * 0.15;
    }

    renderer.render(scene, camera);
  };

  animate();
  return true;
}
