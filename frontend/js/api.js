const getApiBaseUrl = () => {
  if (window.EDUPULSE_API_URL) return window.EDUPULSE_API_URL;
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  return localStorage.getItem('EDUPULSE_API_URL') || 'https://edupulse-1o5s.onrender.com';
};

const API_BASE_URL = getApiBaseUrl();

async function fetchJSON(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP Error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  async getStudents(source) {
    const query = source ? `?source=${encodeURIComponent(source)}` : '';
    return fetchJSON(`/students${query}`);
  },

  async getStudent(studentId) {
    return fetchJSON(`/students/${studentId}`);
  },

  async getStudentScores(studentId) {
    return fetchJSON(`/students/${studentId}/scores`);
  },

  async getStudentInsights(studentId) {
    return fetchJSON(`/students/${studentId}/insights`);
  },

  async uploadScoresCSV(studentId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const endpoint = studentId ? `/students/${studentId}/scores/upload-csv` : `/scores/upload-csv`;

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Upload Error ${res.status}`);
    }
    return await res.json();
  },

  async getSubjects() {
    return fetchJSON('/subjects');
  },

  async getClassAverage(subjectId) {
    return fetchJSON(`/subjects/${subjectId}/class-average`);
  },

  async getWhatIf(studentId, subjectName, targetScore) {
    const query = `?subject=${encodeURIComponent(subjectName)}&target_score=${encodeURIComponent(targetScore)}`;
    return fetchJSON(`/students/${studentId}/what-if${query}`);
  }
};
