/**
 * Módulo Curriculum Deportivo
 */

// Use existing API_BASE or define empty string
const CURRICULUM_API_BASE = (typeof API_BASE !== 'undefined') ? API_BASE : '';

// Use existing getToken or create new one
const CURRICULUM_getToken = (typeof getToken !== 'undefined') ? getToken : () => localStorage.getItem('token');

const CurriculumModule = {
  currentMemberId: null,

  init(memberId) {
    this.currentMemberId = memberId;
    this.load();
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('saveCurriculumBtn')?.addEventListener('click', () => this.save());
    document.getElementById('exportCurriculumExcelBtn')?.addEventListener('click', () => this.exportExcel());
    document.getElementById('generateCertificateBtn')?.addEventListener('click', () => this.generateCertificate());
  },

  async load() {
    if (!this.currentMemberId) return;

    try {
      const res = await fetch(`${CURRICULUM_API_BASE}/api/curriculum/member/${this.currentMemberId}`, {
        headers: { 'Authorization': 'Bearer ' + CURRICULUM_getToken() }
      });
      const curriculum = await res.json();
      this.render(curriculum);
    } catch (error) {
      console.error('Error loading curriculum:', error);
    }
  },

  render(curriculum) {
    const container = document.getElementById('curriculumList');
    if (!container) return;

    if (curriculum.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">Sin torneos registrados</p>';
      return;
    }

    const html = `
      <table style="width: 100%; font-size: 13px;">
        <thead>
          <tr style="background: #0066cc; color: white;">
            <th style="padding: 8px; text-align: left;">Torneo</th>
            <th style="padding: 8px;">Fecha</th>
            <th style="padding: 8px;">Lugar</th>
            <th style="padding: 8px;">Tipo</th>
            <th style="padding: 8px;">Categoría</th>
            <th style="padding: 8px;">Peso</th>
            <th style="padding: 8px;">Grado</th>
            <th style="padding: 8px;">Lugar</th>
            <th style="padding: 8px;">Acción</th>
          </tr>
        </thead>
        <tbody>
          ${curriculum.map(item => `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 8px;">${item.tournament_name}</td>
              <td style="padding: 8px;">${formatDateChile(item.tournament_date)}</td>
              <td style="padding: 8px;">${item.location}</td>
              <td style="padding: 8px;">${item.tournament_type === 'federado' ? '🏆 Federado' : '📋 Abierto'}</td>
              <td style="padding: 8px;">${item.category}</td>
              <td style="padding: 8px;">${item.weight}</td>
              <td style="padding: 8px;">${getBeltName(item.belt_grade)}</td>
              <td style="padding: 8px; font-weight: bold;">${item.place_obtained}</td>
              <td style="padding: 8px; text-align: center;">
                <button class="btn btn-danger" onclick="CurriculumModule.delete(${item.id})" style="font-size: 11px; padding: 3px 6px;">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  },

  save() {
    const data = {
      member_id: this.currentMemberId,
      tournament_name: document.getElementById('tournamentName').value,
      tournament_date: document.getElementById('tournamentDate').value,
      location: document.getElementById('tournamentLocation').value,
      tournament_type: document.getElementById('tournamentType').value,
      category: document.getElementById('tournamentCategory').value,
      weight: document.getElementById('tournamentWeight').value,
      belt_grade: document.getElementById('tournamentBelt').value,
      place_obtained: document.getElementById('tournamentPlace').value
    };

    if (!data.tournament_name || !data.tournament_date) {
      alert('Nombre y fecha del torneo son requeridos');
      return;
    }

    fetch(`${CURRICULUM_API_BASE}/api/curriculum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CURRICULUM_getToken()
      },
      body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(() => {
      alert('Torneo agregado');
      this.clearForm();
      this.load();
    })
    .catch(error => alert('Error: ' + error.message));
  },

  delete(id) {
    if (!confirm('¿Eliminar este torneo?')) return;

    fetch(`${CURRICULUM_API_BASE}/api/curriculum/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + CURRICULUM_getToken() }
    })
    .then(res => res.json())
    .then(() => {
      alert('Torneo eliminado');
      this.load();
    })
    .catch(error => alert('Error: ' + error.message));
  },

  clearForm() {
    document.getElementById('tournamentName').value = '';
    document.getElementById('tournamentDate').value = '';
    document.getElementById('tournamentLocation').value = '';
    document.getElementById('tournamentType').value = 'abierto';
    document.getElementById('tournamentCategory').value = '';
    document.getElementById('tournamentWeight').value = '';
    document.getElementById('tournamentBelt').value = '';
    document.getElementById('tournamentPlace').value = '';
  },

  exportExcel() {
    if (!this.currentMemberId) return;
    window.open(`${CURRICULUM_API_BASE}/api/curriculum/member/${this.currentMemberId}/excel`, '_blank');
  },

  generateCertificate() {
    if (!this.currentMemberId) return;
    
    // Mostrar input para ingresar la asociación
    const association = prompt('Ingrese la asociación o institución a la que va dirigido el certificado (ej: Srs. Preuniversitario Federico Santa María):\n\n(Deje vacío para "A quien corresponda")', '');
    
    const token = CURRICULUM_getToken();
    let url = `${CURRICULUM_API_BASE}/api/curriculum/certificate/${this.currentMemberId}/pdf?token=${encodeURIComponent(token)}`;
    
    if (association && association.trim() !== '') {
      url += `&association=${encodeURIComponent(association.trim())}`;
    }
    
    window.open(url, '_blank');
  },

  generateCurriculum() {
    if (!this.currentMemberId) return;
    const token = CURRICULUM_getToken();
    window.open(`${CURRICULUM_API_BASE}/api/curriculum/curriculum/${this.currentMemberId}/pdf?token=${encodeURIComponent(token)}`, '_blank');
  }
};

window.CurriculumModule = CurriculumModule;

// Global wrapper functions for HTML onclick
window.saveCurriculumTournament = () => CurriculumModule.save();
