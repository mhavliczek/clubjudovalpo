import re

with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_html = '<input type="date" id="gradeDate" placeholder="Fecha" style="width: 100%; margin-top: 10px;">\n        <label style="display: block; margin: 10px 0 5px; font-weight: bold;"> Otorgado Por:</label>\n        <select id="instructorSelect" multiple style="width: 100%; height: 100px;"></select>\n        <small>Ctrl/Cmd + Click para múltiples</small>\n        <input type="text" id="gradeNotes" placeholder="Notas" style="width: 100%; margin-top: 10px;">'

new_html = '<input type="date" id="gradeDate" placeholder="Fecha" style="width: 100%; margin-top: 10px;">\n        \n        <div style="margin-top: 15px; padding: 15px; background: #e3f2fd; border-radius: 5px; border-left: 4px solid #2196f3;">\n          <h4 style="margin: 0 0 10px 0; color: #1976d2;">Evaluación del Examen</h4>\n          \n          <label style="display: block; margin: 10px 0 5px; font-weight: bold;">Fecha de Rendición:</label>\n          <input type="date" id="examDate" placeholder="Fecha de Examen" style="width: 100%;">\n          \n          <label style="display: block; margin: 10px 0 5px; font-weight: bold;">Nota (1.0 - 7.0):</label>\n          <input type="number" id="gradeScore" placeholder="Ej: 5.5" step="0.1" min="1.0" max="7.0" style="width: 100%;">\n          <small style="color: #666;">4.0 - 7.0: Aprobado | 1.0 - 3.9: Reprobado<br>Si no se ingresa nota, el estado queda como Pendiente</small>\n        </div>\n        \n        <label style="display: block; margin: 10px 0 5px; font-weight: bold;">Otorgado Por:</label>\n        <select id="instructorSelect" multiple style="width: 100%; height: 100px;"></select>\n        <small>Ctrl/Cmd + Click para múltiples</small>\n        <input type="text" id="gradeNotes" placeholder="Notas / Comentarios" style="width: 100%; margin-top: 10px;">'

if old_html in content:
    content = content.replace(old_html, new_html)
    with open('public/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("HTML updated successfully")
else:
    print("Old HTML not found")
