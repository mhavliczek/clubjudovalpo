# FIX Certificados Grados/Asistencia "Endpoint not found"

## Information Gathered:
- `public/js/members.js` llama `/api/certificates/grades/:id` y `/api/certificates/attendance/:id` 
- `src/routes/certificates.js` solo tiene custom certs `/api/certificates/:id/pdf`
- No existen endpoints para grades/attendance → **404 "Endpoint not found"**

## Plan (src/routes/certificates.js):
1. **Add `/grades/:memberId/pdf`** → PDF lista de grados (belt_grades table)
2. **Add `/attendance/:memberId/pdf`** → PDF resumen asistencia (attendance table)
3. Use token query auth (like `/api/members/:id/card/pdf`)
4. PDFkit tables con logo/firma (copy curriculum.js style)

## Dependent Files:
- `src/routes/certificates.js` (edit)
- `public/js/members.js` (URLs OK)
- `src/database.js` (queries OK)

## Followup steps:
- `npm run dev` reload
- Test Mauricio → Cert Grados/Asistencia → PDFs OK

**¿Apruebas plan o cambias? Luego procedo edits.**

