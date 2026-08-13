import { api } from './api.js';

export async function initUploadPage() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const uploadBtn = document.getElementById('uploadBtn');
  const resultContainer = document.getElementById('resultContainer');

  let selectedFile = null;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelection(fileInput.files[0]);
    }
  });

  function handleFileSelection(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a valid .csv file.');
      return;
    }
    selectedFile = file;
    fileInfo.innerHTML = `
      <strong style="color: var(--color-indigo);">${escapeHtml(file.name)}</strong> 
      (${Math.round(file.size / 1024)} KB)
    `;
    uploadBtn.disabled = false;
  }

  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      alert('Please select a CSV file to upload.');
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<div class="spinner" style="width: 16px; height: 16px; margin: 0;"></div> Processing CSV...`;
    resultContainer.innerHTML = '';

    try {
      const response = await api.uploadScoresCSV(null, selectedFile);

      const isSuccess = (response.inserted > 0 || response.updated > 0);
      resultContainer.innerHTML = `
        <div class="summary-banner" style="border-left-color: ${isSuccess ? 'var(--color-emerald)' : 'var(--color-rose)'};">
          <span class="mono-eyebrow" style="color: ${isSuccess ? 'var(--color-emerald)' : 'var(--color-rose)'};">
            ${isSuccess ? 'UPLOAD COMPLETED' : 'UPLOAD FAILED'}
          </span>
          <p><strong>${escapeHtml(response.message.replace(/—/g, '-'))}</strong></p>
          <p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--color-ink-muted);">
            Inserted: ${response.inserted} row(s), Updated: ${response.updated || 0} row(s).
          </p>
          ${isSuccess ? `
            <a href="roster.html?source=csv" class="btn btn-secondary" style="margin-top: 1rem;">
              View Uploaded CSV Roster ->
            </a>
          ` : ''}
        </div>

        ${response.errors && response.errors.length > 0 ? `
          <div class="error-list-container">
            <span class="mono-eyebrow" style="color: var(--color-rose);">PER-ROW VALIDATION ERRORS (${response.errors.length})</span>
            <table class="error-table">
              <thead>
                <tr>
                  <th>Row #</th>
                  <th>Validation Error Reason</th>
                </tr>
              </thead>
              <tbody>
                ${response.errors.map(err => `
                  <tr>
                    <td class="error-row-num">Row ${err.row_number}</td>
                    <td>${escapeHtml(err.error.replace(/—/g, '-'))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      `;
    } catch (err) {
      resultContainer.innerHTML = `
        <div class="summary-banner" style="border-left-color: var(--color-rose);">
          <span class="mono-eyebrow" style="color: var(--color-rose);">SERVER ERROR</span>
          <p>${escapeHtml(err.message || 'An unexpected error occurred during CSV parsing.')}</p>
        </div>
      `;
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload & Ingest Scores';
    }
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}
