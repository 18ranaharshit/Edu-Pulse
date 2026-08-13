import { api } from './api.js';
import { render3DSubjectChart } from './three-charts.js';

export async function initDashboard() {
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get('id') || 1;

  const headerEl = document.getElementById('studentHeader');
  const interventionEl = document.getElementById('interventionBanner');
  const nbaEl = document.getElementById('nextBestActionSection');
  const summaryEl = document.getElementById('summarySection');
  const weakTopicsEl = document.getElementById('weakTopicsSection');
  const studyOptimizerEl = document.getElementById('studyOptimizerSection');
  const subjectsEl = document.getElementById('subjectsGridSection');

  try {
    const [insights, scores] = await Promise.all([
      api.getStudentInsights(studentId),
      api.getStudentScores(studentId)
    ]);

    // Group scores by subject
    const scoresBySubject = {};
    scores.forEach(s => {
      if (!scoresBySubject[s.subject_name]) {
        scoresBySubject[s.subject_name] = [];
      }
      scoresBySubject[s.subject_name].push(s);
    });

    // ------------------------------------------------------------------
    // Header
    // ------------------------------------------------------------------
    headerEl.innerHTML = `
      <span class="mono-eyebrow">Academic Health Profile</span>
      <h1>${escapeHtml(insights.student_name)}</h1>
      <div class="profile-badge-row">
        ${insights.cluster ? `
          <span class="mono-tag tag-purple">
            <span class="pulse-dot"></span> PROFILE: ${escapeHtml(insights.cluster.cluster_label.toUpperCase())}
          </span>
        ` : ''}
        <span class="mono-tag tag-indigo">STUDENT ID #${insights.student_id}</span>
      </div>
    `;

    // ------------------------------------------------------------------
    // Stretch 6: Early Intervention Banner
    // ------------------------------------------------------------------
    const decliningForecasts = (insights.trend_forecasts || []).filter(f => f.trend_label === 'Declining');
    if (decliningForecasts.length > 0 && interventionEl) {
      const bannersHtml = decliningForecasts.map(f => {
        const subjScores = scoresBySubject[f.subject_name] || [];
        const scoreSeqStr = subjScores.length > 0
          ? subjScores.map(s => `${Math.round((s.score / s.max_score) * 100)}%`).join(' → ')
          : 'recent tests';

        return `
          <div class="intervention-banner">
            <div class="intervention-icon">⚠️</div>
            <div class="intervention-content">
              <strong>Early intervention recommended</strong>
              <p style="margin-top: 2px; font-size: 0.95rem;">
                <strong>${escapeHtml(f.subject_name)}</strong> has declined across recent tests (${scoreSeqStr}).
                Predicted next score: <strong style="color: var(--color-rose);">${f.predicted_next_score}%</strong>.
              </p>
            </div>
          </div>
        `;
      }).join('');
      interventionEl.innerHTML = bannersHtml;
    } else if (interventionEl) {
      interventionEl.innerHTML = '';
    }

    // ------------------------------------------------------------------
    // Core 3 & 4: Next Best Action Card + What-If Simulator Widget
    // ------------------------------------------------------------------
    const nba = insights.next_best_action;
    if (nba && nbaEl) {
      const tagClass = nba.priority_level === 'High' ? 'tag-rose' :
                       nba.priority_level === 'Medium' ? 'tag-amber' : 'tag-indigo';

      nbaEl.innerHTML = `
        <div class="nba-card">
          <div class="nba-header">
            <div>
              <span class="mono-eyebrow" style="color: var(--color-purple);">🎯 Next Best Action</span>
              <h2 class="nba-subject-title">${escapeHtml(nba.subject_name)} Focus Area</h2>
            </div>
            <span class="mono-tag ${tagClass}" style="font-size: 0.85rem; padding: 0.35rem 0.85rem;">
              <span class="pulse-dot"></span> ${nba.priority_level.toUpperCase()} PRIORITY
            </span>
          </div>

          <p class="nba-reason">${escapeHtml(nba.reason)}</p>

          <div class="why-matters-block">
            <span class="why-matters-label">Why this matters:</span>
            <div class="why-matters-grid">
              <div class="why-matters-item">
                <div class="why-matters-val">${nba.current_avg}%</div>
                <div class="why-matters-sub">Current Avg</div>
              </div>
              <div class="why-matters-item">
                <div class="why-matters-val">${nba.class_avg}%</div>
                <div class="why-matters-sub">Class Avg</div>
              </div>
              <div class="why-matters-item">
                <div class="why-matters-val" style="color: var(--color-indigo);">${nba.predicted_next_score}%</div>
                <div class="why-matters-sub">Likely Next Score</div>
              </div>
            </div>
          </div>

          <!-- What-If Simulator Widget -->
          <div class="whatif-container">
            <div class="whatif-header">
              <div>
                <strong style="font-size: 1.05rem; color: var(--color-ink);">🔮 What-If Simulator</strong>
                <p style="font-size: 0.88rem; color: var(--color-ink-muted);">
                  Simulate how improving your average in <strong>${escapeHtml(nba.subject_name)}</strong> impacts your overall projected average:
                </p>
              </div>
            </div>

            <div class="slider-row">
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--color-ink-muted);">0%</span>
              <input type="range" id="whatIfSlider" class="whatif-slider" min="0" max="100" value="${Math.round(nba.current_avg)}" step="1">
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--color-indigo);"><span id="sliderValDisplay">${Math.round(nba.current_avg)}</span>%</span>
            </div>

            <div id="whatIfResult" class="whatif-result-box">
              <span class="mono-tag tag-indigo" style="font-size: 0.72rem;">SIMULATION READY</span>
              <p style="margin-top: 4px; font-size: 0.95rem; color: var(--color-ink);">
                Drag the slider to calculate your projected overall score.
              </p>
            </div>
          </div>
        </div>
      `;

      // Set up debounced slider event listener
      setupWhatIfSlider(studentId, nba.subject_name, nba.current_avg);
    } else if (nbaEl) {
      nbaEl.innerHTML = '';
    }

    // ------------------------------------------------------------------
    // Summary Section (Jargon Cleanup: "Diagnostic Summary")
    // ------------------------------------------------------------------
    summaryEl.innerHTML = `
      <div class="summary-banner">
        <span class="mono-eyebrow" style="color: var(--color-indigo);">Diagnostic Summary</span>
        <p>${escapeHtml(insights.summary.replace(/—/g, '-'))}</p>
        ${insights.cluster ? `
          <p style="margin-top: 0.75rem; font-size: 0.92rem; color: var(--color-ink-muted);">
            <strong style="color: var(--color-purple);">Cluster Profile:</strong> ${escapeHtml(insights.cluster.description.replace(/—/g, '-'))}
          </p>
        ` : ''}
      </div>
    `;

    // ------------------------------------------------------------------
    // Weak Topics Section (Jargon Cleanup: "Priority Focus Areas")
    // ------------------------------------------------------------------
    if (insights.weak_topics && insights.weak_topics.length > 0) {
      weakTopicsEl.innerHTML = `
        <div class="section-block" style="border-left: 4px solid var(--color-rose);">
          <span class="mono-eyebrow" style="color: var(--color-rose);">⚠️ Priority Focus Areas</span>
          <span style="display: block; font-size: 0.78rem; color: var(--color-ink-faint); margin-top: -4px; margin-bottom: 12px;">Identified by rules engine benchmark analysis</span>
          <div style="display: flex; flex-direction: column; gap: var(--space-3);">
            ${insights.weak_topics.map(wt => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(225, 29, 72, 0.06); padding: var(--space-4); border-radius: var(--radius-sm); border: 1px solid rgba(225, 29, 72, 0.2);">
                <div>
                  <strong style="font-size: 1.15rem; color: var(--color-ink);">${escapeHtml(wt.subject_name)}</strong>
                  <span style="font-size: 0.88rem; color: var(--color-ink-muted); margin-left: 0.75rem;">Subject Avg: <strong>${wt.subject_avg}%</strong> vs Overall: <strong>${wt.overall_avg}%</strong></span>
                </div>
                <span class="mono-tag tag-rose">${wt.gap}% GAP BELOW AVG</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      weakTopicsEl.innerHTML = `
        <div class="section-block" style="border-left: 4px solid var(--color-emerald);">
          <span class="mono-eyebrow" style="color: var(--color-emerald);">✅ All Subjects Balanced</span>
          <p style="color: var(--color-ink-muted);">No weak topic anomalies detected. Performance remains balanced across all registered subjects.</p>
        </div>
      `;
    }

    // ------------------------------------------------------------------
    // Stretch 7: Study Time Optimizer Widget
    // ------------------------------------------------------------------
    if (insights.subject_priorities && insights.subject_priorities.length > 0 && studyOptimizerEl) {
      renderStudyOptimizer(insights.subject_priorities, studyOptimizerEl);
    } else if (studyOptimizerEl) {
      studyOptimizerEl.innerHTML = '';
    }

    // ------------------------------------------------------------------
    // Subjects Grid (Jargon Cleanup pass)
    // ------------------------------------------------------------------
    if (!insights.class_comparisons || insights.class_comparisons.length === 0) {
      subjectsEl.innerHTML = `<p class="state-box">No subject scores recorded yet for this student.</p>`;
      return;
    }

    const cardsHtml = insights.class_comparisons.map(cc => {
      const subjectName = cc.subject_name;
      const forecast = insights.trend_forecasts.find(f => f.subject_name === subjectName);
      const consistency = insights.consistency_flags.find(c => c.subject_name === subjectName);
      const subjScores = scoresBySubject[subjectName] || [];

      const isWeak = insights.weak_topics.some(w => w.subject_name === subjectName);
      const trendTagClass = forecast?.trend_label === 'Improving' ? 'tag-emerald' :
                           forecast?.trend_label === 'Declining' ? 'tag-rose' : 'tag-amber';

      return `
        <div class="subject-card" data-tilt data-tilt-max="8" data-tilt-glare="true" data-tilt-max-glare="0.15" data-tilt-scale="1.02">
          <div class="subject-card-head">
            <div>
              <h3 class="subject-name">${escapeHtml(subjectName)}</h3>
              ${isWeak ? `<span class="mono-tag tag-rose" style="margin-top: 4px;">WEAK AREA</span>` : ''}
            </div>
            ${consistency ? `
              <div style="text-align: right;">
                <span class="mono-tag ${consistency.label === 'Volatile' ? 'tag-amber' : 'tag-indigo'}">
                  ${consistency.label === 'Volatile' ? 'INCONSISTENT' : 'STABLE'}
                </span>
                <span style="display: block; font-size: 0.72rem; color: var(--color-ink-faint); margin-top: 2px;">
                  ±${consistency.std_dev}% std dev
                </span>
              </div>
            ` : ''}
          </div>

          <div class="metric-row">
            <div>
              <div class="metric-value" style="color: var(--color-indigo);">${cc.student_avg}%</div>
              <div class="metric-label">Your Avg</div>
            </div>
            <div>
              <div class="metric-value">${cc.class_avg}%</div>
              <div class="metric-label">Class Avg</div>
            </div>
            <div>
              <div class="metric-value" style="color: ${cc.delta >= 0 ? 'var(--color-emerald)' : 'var(--color-rose)'}">
                ${cc.delta >= 0 ? '+' : ''}${cc.delta}%
              </div>
              <div class="metric-label">vs Class</div>
              <div style="font-size: 0.68rem; color: var(--color-ink-faint); font-family: var(--font-mono);">${cc.percentile}th pctl</div>
            </div>
          </div>

          ${forecast ? `
            <div class="prediction-box">
              <div class="prediction-info">
                <span class="prediction-desc" style="font-size: 0.95rem; font-weight: 700; color: var(--color-ink);">
                  🔮 Likely next score: <strong style="color: var(--color-indigo);">${forecast.predicted_next_score}%</strong>
                </span>
                <span class="prediction-title" style="margin-top: 3px;">
                  Based on recent score trend · Powered by Linear Regression
                </span>
              </div>
              <span class="mono-tag ${trendTagClass}">${forecast.trend_label.toUpperCase()}</span>
            </div>
          ` : ''}

          <div>
            <span class="mono-eyebrow" style="font-size: 0.68rem; color: var(--color-ink-faint); margin-bottom: 4px;">Score History</span>
            <div class="chart-container" data-chart-subject="${escapeHtml(subjectName)}" data-chart-trend="${forecast?.trend_label || 'Stable'}">
              ${renderSVGSparkline(subjScores, forecast?.trend_label)}
            </div>
          </div>
        </div>
      `;
    }).join('');

    subjectsEl.innerHTML = `
      <h2 class="section-title" style="grid-column: 1 / -1;">Subject Performance & Forecasts</h2>
      <div class="subject-grid">
        ${cardsHtml}
      </div>
    `;

    if (window.VanillaTilt) {
      VanillaTilt.init(document.querySelectorAll('.subject-card[data-tilt]'), {
        max: 8,
        speed: 300,
        glare: true,
        'max-glare': 0.15,
        scale: 1.02
      });
    }

    // Phase 3: Replace SVG sparklines with 3D bar charts (desktop only)
    if (window.THREE && window.innerWidth >= 600) {
      document.querySelectorAll('.chart-container[data-chart-subject]').forEach(container => {
        const subjectName = container.getAttribute('data-chart-subject');
        const trendLabel = container.getAttribute('data-chart-trend');
        const subjScores = scoresBySubject[subjectName] || [];
        if (subjScores.length > 0) {
          render3DSubjectChart(container, subjScores, trendLabel);
        }
      });
    }

    // GSAP staggered reveal for subject cards
    if (window.gsap && window.ScrollTrigger) {
      const cards = document.querySelectorAll('.subject-card');
      cards.forEach((card, i) => {
        gsap.fromTo(card,
          { opacity: 0, y: 30, rotateX: -5 },
          {
            opacity: 1, y: 0, rotateX: 0,
            duration: 0.6,
            delay: i * 0.1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 92%',
              toggleActions: 'play none none none',
            }
          }
        );
      });
    }

  } catch (err) {
    headerEl.innerHTML = `<h1 style="color: var(--color-rose);">Error Loading Dashboard</h1>`;
    summaryEl.innerHTML = `<p>Could not fetch insights for student ID ${escapeHtml(studentId)}. Confirm backend server status.</p>`;
  }
}

// ------------------------------------------------------------------
// What-If Slider Handler (Debounced API call)
// ------------------------------------------------------------------
function setupWhatIfSlider(studentId, subjectName, initialAvg) {
  const slider = document.getElementById('whatIfSlider');
  const valDisplay = document.getElementById('sliderValDisplay');
  const resultBox = document.getElementById('whatIfResult');

  if (!slider || !resultBox) return;

  let debounceTimer = null;

  const updateSimulation = async (targetValue) => {
    try {
      const res = await api.getWhatIf(studentId, subjectName, targetValue);
      const deltaSign = res.delta >= 0 ? '+' : '';
      const deltaColor = res.delta >= 0 ? 'var(--color-emerald)' : 'var(--color-rose)';

      resultBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="mono-tag tag-purple" style="font-size: 0.72rem;">PROJECTED SIMULATION</span>
          <span style="font-family: var(--font-mono); font-weight: 700; color: ${deltaColor}; font-size: 0.9rem;">
            ${deltaSign}${res.delta} pts overall
          </span>
        </div>
        <p style="margin-top: 6px; font-size: 1rem; color: var(--color-ink); line-height: 1.5;">
          If you reach <strong>${res.target_score}%</strong> in ${escapeHtml(subjectName)}, your 
          <strong>projected overall average</strong> becomes 
          <strong style="color: var(--color-indigo); font-size: 1.1rem;">${res.projected_overall_avg}%</strong> 
          (<span style="color: ${deltaColor}; font-weight: 700;">${deltaSign}${res.delta}%</span>).
        </p>
      `;
    } catch (err) {
      resultBox.innerHTML = `
        <p style="color: var(--color-rose); font-size: 0.88rem;">Failed to calculate what-if projection.</p>
      `;
    }
  };

  slider.addEventListener('input', (e) => {
    const val = e.target.value;
    if (valDisplay) valDisplay.textContent = val;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateSimulation(val);
    }, 250);
  });

  // Initial calculation call
  updateSimulation(Math.round(initialAvg));
}

// ------------------------------------------------------------------
// Stretch 7: Study Time Optimizer Renderer
// ------------------------------------------------------------------
function renderStudyOptimizer(priorities, container) {
  container.innerHTML = `
    <div class="section-block" style="border-left: 4px solid var(--color-indigo);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span class="mono-eyebrow" style="color: var(--color-indigo);">⏱️ Study Time Optimizer</span>
          <h2 class="section-title" style="font-size: 1.5rem; margin-bottom: 4px;">Recommended Weekly Schedule</h2>
          <p style="font-size: 0.88rem; color: var(--color-ink-muted);">
            Time allocated proportionally to how urgent and how weak each subject is.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--color-paper-muted); padding: 0.5rem 1rem; border-radius: var(--radius-pill); border: 1px solid var(--color-border);">
          <label for="studyHoursInput" style="font-weight: 700; font-size: 0.9rem; color: var(--color-ink);">Total Study Time:</label>
          <input type="number" id="studyHoursInput" value="10" min="1" max="60" style="width: 60px; padding: 4px 8px; font-weight: 700; font-size: 0.95rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border); text-align: center;">
          <span style="font-size: 0.88rem; font-weight: 600; color: var(--color-ink-muted);">hrs/wk</span>
        </div>
      </div>

      <div id="studyGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; margin-top: 1.25rem;"></div>
    </div>
  `;

  const hoursInput = document.getElementById('studyHoursInput');
  const gridEl = document.getElementById('studyGrid');

  const updateAllocation = () => {
    const totalHours = Math.max(1, parseFloat(hoursInput.value) || 10);
    const sumPriority = priorities.reduce((acc, p) => acc + (p.combined_priority > 0 ? p.combined_priority : 0.5), 0);

    const itemsHtml = priorities.map(p => {
      const weight = p.combined_priority > 0 ? p.combined_priority : 0.5;
      const allocated = (weight / sumPriority) * totalHours;
      const hoursStr = allocated < 1 ? `${Math.round(allocated * 60)} min` : `${allocated.toFixed(1)} hrs`;

      const barClass = p.priority_level === 'High' ? 'background: var(--color-rose);' :
                       p.priority_level === 'Medium' ? 'background: var(--color-amber);' : 'background: var(--color-indigo);';

      return `
        <div style="background: var(--color-paper-muted); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="font-size: 0.95rem; color: var(--color-ink);">${escapeHtml(p.subject_name)}</strong>
            <span style="font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem; color: var(--color-indigo);">${hoursStr}</span>
          </div>
          <div style="width: 100%; height: 5px; background: rgba(15,23,42,0.1); border-radius: 99px; overflow: hidden; margin-top: 6px;">
            <div style="height: 100%; width: ${Math.min(100, Math.max(12, (allocated / totalHours) * 250))}%; ${barClass}"></div>
          </div>
        </div>
      `;
    }).join('');

    gridEl.innerHTML = itemsHtml;
  };

  hoursInput.addEventListener('input', updateAllocation);
  updateAllocation();
}

function renderSVGSparkline(scores, trendLabel) {
  if (!scores || scores.length === 0) {
    return `<div style="text-align: center; color: var(--color-ink-faint); font-size: 0.8rem; padding-top: 25px;">No historical score points</div>`;
  }

  const width = 320;
  const height = 70;
  const padding = 12;

  const pcts = scores.map(s => (s.score / s.max_score) * 100);
  const minVal = Math.min(...pcts, 40);
  const maxVal = Math.max(...pcts, 100);

  const points = pcts.map((val, idx) => {
    const x = padding + (idx / Math.max(pcts.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - ((val - minVal) / Math.max(maxVal - minVal, 1)) * (height - 2 * padding);
    return { x, y, val };
  });

  const polylineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const areaPath = `
    M ${points[0].x.toFixed(1)} ${height - padding}
    L ${polylineStr}
    L ${points[points.length - 1].x.toFixed(1)} ${height - padding}
    Z
  `;

  const strokeColor = trendLabel === 'Improving' ? 'var(--color-emerald)' :
                      trendLabel === 'Declining' ? 'var(--color-rose)' : 'var(--color-indigo)';

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(15,23,42,0.1)" stroke-width="1" />
      <path d="${areaPath}" fill="url(#chartGradient)" />
      <polyline fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${polylineStr}" />
      
      ${points.map(p => `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#ffffff" stroke="${strokeColor}" stroke-width="2.5" />
      `).join('')}
    </svg>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}
