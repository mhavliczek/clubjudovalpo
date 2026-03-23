# Judo Club Management System

A backend API for managing a judo club, built with Express and SQLite.

## Features

- **Authentication**: Login system with JWT tokens
- **Roles**: Admin and Member roles
- **Members**: Register and manage club members with 4 membership types
- **Belt Grades**: Track member progression through belt ranks
- **Attendance**: Record and track class attendance with pagination and filters
- **Attendance Statistics**: Monthly, semester, and yearly attendance tracking with color-coded percentages
- **Payments**: Manage membership fees and payments
- **Member Portal**: Each member can view their own info
- **Curriculum**: Track tournaments and generate sports CV
- **Certificates**: Generate PDF certificates with club logo
- **Guardians**: Manage guardians for minor members
- **Documents**: Administrative documents (statutes, regulations) management
- **Tournament Documents**: Tournament rules and bases management
- **QR System**: QR code generation for attendance tracking
- **Instructors**: Manage club instructors
- **Schools**: Manage schools for student members
- **Annual Fees**: Configure annual enrollment and monthly fees
- **UF Value**: Integration with UF (Unidad de Fomento) value

---

## 👥 Tipos de Miembros (4 Figuras)

El sistema maneja 4 tipos de miembros con diferentes permisos y obligaciones:

| Tipo | Descripción | Pagos | Certificado | Torneos | Edad Mínima |
|------|-------------|-------|-------------|---------|-------------|
| **Deportista** | Judoca activo que participa en torneos | ✅ Paga | ✅ Sí | ✅ Sí | Cualquier edad |
| **Socio Común** | Miembro no deportista, apoya el club | ✅ Paga | ✅ Sí | ❌ No | +18 años |
| **Apoderado** | Responsable de menores, paga por ellos | ✅ Paga | ✅ Sí | ❌ No | +18 años |
| **Socio Honorífico** | Miembro distinguido, exento de pagos | ❌ Exento | ✅ Sí | ❌ No | +18 años |

---

## 📋 Reglas de Registro por Edad

### **Menores de 18 Años**

Cuando se registra un menor de edad:

1. **Tipo de Socio Automático**: Se fija como **"Deportista"** automáticamente
2. **Selector Bloqueado**: No puede cambiar el tipo de socio hasta cumplir 18 años
3. **Apoderado Obligatorio**: Se debe ingresar los datos de un apoderado
4. **Opciones de Apoderado**:
   - Seleccionar un apoderado existente de la lista
   - Crear un nuevo apoderado (ingresando sus datos completos)

**Mensaje Informativo:**
> ℹ️ Los menores de edad solo pueden registrarse como Deportistas. El tipo de socio se habilitará al cumplir 18 años.

### **Mayores de 18 Años**

Cuando se registra un mayor de edad:

1. **Tipo de Socio Libre**: Puede elegir cualquiera de las 4 figuras
2. **Sin Apoderado**: No se requiere apoderado
3. **Responsable de Pagos**: El miembro es responsable de sus propias cuentas

---

## 🔄 Transición Menor → Mayor (Cumple 18 Años)

Cuando un miembro registrado como menor cumple 18 años:

### **Proceso Actual:**
1. Editar el miembro en el panel de administración
2. El sistema detecta automáticamente que ahora es mayor de edad
3. Se desbloquea el selector de "Tipo de Socio"
4. Se puede cambiar a cualquier tipo (Deportista, Socio Común, Apoderado, Honorífico)
5. El campo `guardian_id` se establece en NULL
6. El miembro pasa a ser responsable de sus propios pagos

### **Próximamente (Fase 3):**
- Notificación automática cuando un menor cumple 18 años
- Botón "Liberar Apoderado" en el perfil del miembro
- Historial de transiciones en la tabla `guardian_relationships`
- Migración automática de deudas/pagos pendientes

---

## 🛡️ Validaciones del Sistema

### **Al Registrar un Menor:**
- ✅ Si intenta seleccionar "Apoderado" → Alerta y revierte a "Deportista"
- ✅ Si intenta seleccionar "Socio Común" → Alerta y revierte a "Deportista"
- ✅ Si intenta seleccionar "Honorífico" → Alerta y revierte a "Deportista"
- ✅ El campo de apoderado es obligatorio

### **Al Registrar un Mayor:**
- ✅ Puede seleccionar cualquier tipo de socio
- ✅ El campo de apoderado está oculto
- ✅ Si es "Honorífico", muestra información de exención de pagos

---

## 📄 Certificados PDF

El sistema genera certificados PDF con:

- **Logo del Club**: En esquina superior derecha y marca de agua
- **Nombre del Director**: Configurable en Administración
- **Destinatario Personalizado**: Se puede ingresar la asociación/institución al generar
- **Texto Oficial**: "De nuestra consideración, como [Club] por petición del socio/a Apoderado/a [Nombre] y Director del Club [Director], indicamos que [Miembro] es judoka activo..."

---

## 🥋 Sistema de Grados de Cinturón con Evaluación

### **Campos de Evaluación**

Cuando se registra un nuevo grado, se puede ingresar:

| Campo | Descripción | Obligatorio |
|-------|-------------|-------------|
| **Grado** | Tipo de cinturón (Kyu/Dan) | ✅ Sí |
| **Fecha de Grado** | Fecha de aprobación | ✅ Sí |
| **Fecha de Rendición** | Fecha del examen | ❌ No |
| **Nota** | Evaluación del 1.0 al 7.0 | ❌ No |
| **Otorgado Por** | Instructor(es) que evalúan | ❌ No |
| **Notas** | Comentarios adicionales | ❌ No |

### **Estados de Grado**

| Nota | Estado | Descripción |
|------|--------|-------------|
| **4.0 - 7.0** | ✅ **Aprobado** | El miembro aprobó el examen |
| **1.0 - 3.9** | ❌ **Reprobado** | El miembro reprobó el examen |
| **Sin nota** | ⏳ **Pendiente** | No se ingresó nota, estado pendiente |

### **Reglas de Negocio**

1. **Fecha de Estado**: Cuando se aprueba (≥ 4.0), la `status_date` = `grade_date`
2. **Visibilidad Admin**: Ve todos los grados (aprobados, reprobados, pendientes)
3. **Visibilidad Judoca**: Solo ve grados **aprobados** en su perfil
4. **CV Deportivo PDF**: Solo incluye grados **aprobados**
5. **Certificado de Grados**: Solo muestra grados **aprobados**

### **Tabla de Historial de Grados**

La tabla muestra las siguientes columnas:

| Columna | Descripción |
|---------|-------------|
| **Grado** | Nombre del cinturón (ej: 5º Kyu) |
| **Fecha Rendición** | Fecha del examen (o fecha de grado si no hay) |
| **Nota** | Nota obtenida (1.0 - 7.0) |
| **Estado** | Badge de color según estado |
| **Fecha Estado** | Fecha cuando se aprobó el grado |
| **Otorgado Por** | Nombre del instructor(es) |
| **Acción** | Botón eliminar (solo admin) |

### **Permisos por Rol**

| Funcionalidad | Admin | Judoca |
|---------------|-------|--------|
| Ver todos los grados | ✅ Sí | ❌ No (solo aprobados) |
| Agregar grado | ✅ Sí | ❌ No |
| Eliminar grado | ✅ Sí | ❌ No |
| Ver nota y estado | ✅ Sí | ❌ No (solo si está aprobado) |
| Generar CV Deportivo | ✅ Sí (ve todo) | ✅ Sí (solo aprobados) |

---

## 📱 Sistema de Código QR para Asistencia

### **Descripción General**

Cada miembro del club puede generar un código QR personal que se utiliza para registrar su asistencia de forma rápida y segura. El QR contiene información verificable del miembro.

### **Características del QR**

| Elemento | Descripción |
|----------|-------------|
| **Foto del Miembro** | Opcional, se puede subir desde el perfil |
| **Nombre Completo** | Nombre y apellido del miembro |
| **RUT** | Documento de identidad |
| **Member ID** | Identificador único en la base de datos |
| **Timestamp** | Fecha y hora de generación del QR |

### **Funcionalidades por Rol**

#### **Judoca (Deportista)**
- ✅ Subir foto de perfil (JPG, PNG, máx 5 MB)
- ✅ Generar su código QR personal
- ✅ Visualizar QR con foto y datos
- ✅ Mostrar QR para registrar asistencia

#### **Apoderado**
- ✅ Todas las funciones del Judoca
- ✅ Ver lista de hijos a cargo
- ✅ Generar QR para cada hijo
- ✅ Visualizar QR de cada hijo en modal

#### **Administrador**
- ✅ Escanear QR de cualquier miembro
- ✅ Validar autenticidad del QR
- ✅ Verificar foto y RUT
- ✅ Registrar asistencia automáticamente

---

### **API Endpoints - QR**

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/qr/upload-photo` | POST | Subir foto de perfil |
| `/api/qr/generate-qr/:memberId` | GET | Generar código QR |
| `/api/qr/my-children` | GET | Obtener hijos del apoderado |
| `/api/qr/scan-qr` | POST | Validar QR escaneado (admin) |

---

### **Flujo de Registro de Asistencia con QR**

```
┌───────────────────────��─────────────────────────────────────┐
│                    FLUJO DE ASISTENCIA                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. MIEMBRO                     2. ADMIN                     │
│  ┌──────────────────┐           ┌──────────────────┐        │
│  │ Genera QR en     │           │ Escanea QR con   │        │
│  │ su perfil        │ ────────▶ │ cámara/celular   │        │
│  │                  │           │                  │        │
│  │ [QR con foto]    │           │ [Escáner]        │        │
│  └──────────────────┘           └──────────────────┘        │
│           │                              │                   │
│           │                              ▼                   │
│           │                     ┌──────────────────┐        │
│           │                     │ 3. Validación    │        │
│           │                     │ - QR válido      │        │
│           │                     │ - RUT coincide   │        │
│           │                     │ - Foto verifica  │        │
│           │                     └──────────────────┘        │
│           │                              │                   │
│           ▼                              ▼                   │
│  ┌──────────────────┐           ┌──────────────────┐        │
│  │ QR mostrado en   │           │ 4. Registro      │        │
│  │ pantalla celular │           │ Asistencia       │        │
│  │ o impreso        │           │ Exitosa ✅       │        │
│  └──────────────────┘           └──────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### **Datos del QR (Formato JSON)**

El código QR contiene la siguiente información en formato JSON:

```json
{
  "type": "judo_member",
  "member_id": 123,
  "rut": "12.345.678-9",
  "name": "Juan Pérez",
  "timestamp": "2026-03-21T15:30:00.000Z"
}
```

---

### **Seguridad del QR**

1. **Validación de RUT**: El sistema verifica que el RUT del QR coincida con el miembro
2. **Alerta de Seguridad**: Si hay discrepancia, se muestra alerta al administrador
3. **Timestamp**: El QR incluye fecha de generación para trazabilidad
4. **Solo Admin**: Solo administradores pueden escanear y validar QRs

---

### **Recomendaciones de Uso**

| Para Miembros | Para Administradores |
|---------------|---------------------|
| ✅ Subir foto reciente | ✅ Verificar foto al escanear |
| ✅ Mantener QR accesible | ✅ Validar RUT visualmente |
| ✅ Mostrar en celular o impreso | ✅ Prestar atención a alertas |
| ✅ Actualizar foto si cambia | ✅ Reportar QRs sospechosos |

---

## 📊 Estadísticas de Asistencia con Colores

### **Descripción General**

El sistema calcula automáticamente el porcentaje de asistencia de cada judoka en tres períodos: mensual, semestral y anual. Los porcentajes se muestran con código de colores para identificación rápida.

### **Código de Colores de Asistencia**

| Color | Porcentaje | Estado | Descripción |
|-------|------------|--------|-------------|
| 🔴 **Rojo** | < 75% | **Bajo** | Asistencia insuficiente |
| 🟡 **Amarillo** | 75% - 84.9% | **Regular** | Asistencia aceptable |
| 🟢 **Verde** | ≥ 85% | **Excelente** | Asistencia destacada |

### **Períodos de Medición**

| Período | Cálculo | Esperado |
|---------|---------|----------|
| **Mensual** | Asistencias del mes seleccionado | 8 clases (2 por semana) |
| **Semestral** | Asistencias del semestre (6 meses) | 48 clases |
| **Anual** | Asistencias del año completo | 96 clases |

### **Funcionalidades Admin**

| Función | Descripción |
|---------|-------------|
| **Filtrar por Mes/Año** | Seleccionar período específico |
| **Vista Tabular** | Todos los judokas con sus porcentajes |
| **Detalle Mensual** | Ver mes a mes la asistencia de cada judoka |
| **Carga Masiva** | Llenar asistencia para múltiples judokas de una vez |

### **Carga Masiva de Asistencia**

El administrador puede cargar automáticamente la asistencia para:
- ✅ Múltiples judokas seleccionados
- ✅ Todos los martes y jueves del mes seleccionado
- ✅ Tipo de clase configurable (regular, competición, examen)

**Flujo:**
1. Seleccionar año y mes
2. Marcar judokas a incluir
3. Click en "Guardar Asistencia Masiva"
4. El sistema crea registros para todos los días de entrenamiento

---

### **API Endpoints - Estadísticas de Asistencia**

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/attendance/statistics` | GET | Obtener estadísticas (mensual/semestral/anual) |
| `/api/attendance/by-month` | GET | Obtener asistencia por mes |
| `/api/attendance/bulk-month` | POST | Carga masiva de asistencia |
| `/api/attendance/member-stats` | GET | Estadísticas mensuales de un miembro |

---

## 📄 Gestión de Documentos

### **Descripción General**

El sistema permite administrar dos tipos de documentos que son visibles para todos los socios en su perfil personal.

### **Tipos de Documentos**

#### **1. Estatutos y Documentos Administrativos** 📄

Documentos oficiales del club visibles para todos los socios.

**Categorías:**
- 📜 Estatuto
- 📋 Reglamento
- 📝 Acta de Reunión
- 📢 Circular
- 📄 Otro

**Formatos Soportados:**
- PDF, DOC, DOCX, TXT, XLS, XLSX, JPG, PNG
- Tamaño máximo: 10 MB

#### **2. Documentos de Torneos** 🏆

Bases, inscripciones y resultados de torneos.

**Categorías:**
- 📋 Bases de Torneo
- 📝 Inscripción
- 🏆 Resultados
- 📄 Otro

**Campos Adicionales:**
- Nombre del torneo
- Fecha del torneo
- Descripción

---

### **Funcionalidades Admin**

| Acción | Descripción |
|--------|-------------|
| **Subir Documento** | Cargar archivo con título, descripción y categoría |
| **Editar Documento** | Modificar metadatos o reemplazar archivo |
| **Eliminar Documento** | Dar de baja documento (soft delete) |
| **Ver Lista** | Listar todos los documentos con vista previa |

---

### **Funcionalidades Socio**

| Acción | Descripción |
|--------|-------------|
| **Ver Documentos** | Ver documentos administrativos en su perfil |
| **Ver Torneos** | Ver documentos de torneos en su perfil |
| **Descargar** | Descargar archivos PDF directamente |

---

### **API Endpoints - Documentos**

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/documents` | GET | Listar documentos administrativos |
| `/api/documents/:id` | GET | Obtener documento específico |
| `/api/documents` | POST | Subir nuevo documento (admin) |
| `/api/documents/:id` | PUT | Actualizar documento (admin) |
| `/api/documents/:id` | DELETE | Eliminar documento (admin) |
| `/api/documents/tournaments` | GET | Listar documentos de torneos |
| `/api/documents/tournaments/:id` | GET | Obtener documento de torneo |
| `/api/documents/tournaments` | POST | Subir documento de torneo (admin) |
| `/api/documents/tournaments/:id` | PUT | Actualizar documento de torneo (admin) |
| `/api/documents/tournaments/:id` | DELETE | Eliminar documento de torneo (admin) |

---

## 📅 Asistencia con Paginación y Filtros

### **Descripción General**

El módulo de asistencia ahora incluye paginación y filtros para mejorar la visualización y navegación de los registros.

### **Funcionalidades**

| Filtro | Descripción |
|--------|-------------|
| **Por Año** | Filtrar asistencias por año (2024, 2025, 2026) |
| **Por Mes** | Filtrar por mes específico o ver todos |
| **Paginación** | 10-20 registros por página (configurable) |
| **Navegación** | Botones "Anterior" y "Siguiente" |

### **Vista por Rol**

#### **Admin**
- ✅ Ver todas las asistencias de todos los miembros
- ✅ Filtrar por año y mes
- ✅ Navegar entre páginas
- ✅ Eliminar registros individuales

#### **Socio (Perfil Personal)**
- ✅ Ver solo sus propias asistencias
- ✅ Filtrado automático por año actual
- ✅ Paginación de 10 registros por página
- ✅ Ver tipo de clase y notas

---

### **API Endpoints - Asistencia con Paginación**

| Endpoint | Método | Parámetros | Descripción |
|----------|--------|------------|-------------|
| `/api/attendance` | GET | `page`, `limit`, `year`, `month` | Listar con paginación |

**Respuesta:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

## Installation

```bash
npm install
```

## Usage

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000`

## Default Admin User

- **Email:** `admin@judoclub.com`
- **Password:** `admin123`

**⚠️ Change the password after first login!**

## API Endpoints

### Authentication (Public)
- `POST /api/auth/login` - Login (body: `email`, `password`)
- `POST /api/auth/register` - Register new user (admin only)
- `GET /api/auth/me` - Get current user

### Config (Public)
- `GET /api/config` - Get club configuration

### Health (Public)
- `GET /health` - Health check

### Protected Endpoints (Require Auth)

#### **Dashboard & Stats**
- `GET /api/stats` - Dashboard statistics
- `GET /api/config` - Club configuration

#### **Members**
- `GET /api/members` - List all members (admin only)
- `GET /api/members/:id` - Get member by ID
- `POST /api/members` - Create new member (admin only)
- `PUT /api/members/:id` - Update member (admin only)
- `DELETE /api/members/:id` - Delete member (admin only)

#### **Belt Grades**
- `GET /api/grades` - Get all grades (admin only)
- `GET /api/grades/member/:memberId` - Get grades for a member
- `POST /api/grades` - Record new grade (admin only)
- `DELETE /api/grades/:id` - Delete grade (admin only)

#### **Attendance**
- `GET /api/attendance` - List attendance records (with pagination: `?page=1&limit=10&year=2025&month=3`)
- `POST /api/attendance` - Record attendance (admin only)
- `DELETE /api/attendance/:id` - Delete attendance (admin only)
- `GET /api/attendance/statistics` - Get attendance statistics (monthly/semester/yearly)
- `GET /api/attendance/by-month` - Get attendance by month
- `POST /api/attendance/bulk-month` - Bulk fill attendance for multiple members
- `GET /api/attendance/member-stats` - Get member monthly statistics
- `GET /api/attendance/summary` - Get attendance summary
- `GET /api/attendance/report` - Get attendance report (admin only)
- `GET /api/attendance/report/excel` - Export attendance report to Excel (admin only)

#### **Payments**
- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment (admin only)
- `DELETE /api/payments/:id` - Delete payment (admin only)

#### **Documents (Admin Only)**
- `GET /api/documents` - List administrative documents
- `GET /api/documents/:id` - Get specific document
- `POST /api/documents` - Upload new document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/tournaments` - List tournament documents
- `GET /api/documents/tournaments/:id` - Get specific tournament document
- `POST /api/documents/tournaments` - Upload tournament document
- `PUT /api/documents/tournaments/:id` - Update tournament document
- `DELETE /api/documents/tournaments/:id` - Delete tournament document

#### **Curriculum (Tournaments)**
- `GET /api/curriculum/member/:memberId` - Get member's tournaments
- `POST /api/curriculum` - Add tournament record
- `DELETE /api/curriculum/:id` - Delete tournament record
- `GET /api/curriculum/member/:memberId/excel` - Export curriculum to Excel
- `GET /api/curriculum/certificate/:memberId/pdf` - Generate sports certificate PDF
- `GET /api/curriculum/curriculum/:memberId/pdf` - Generate curriculum PDF

#### **QR System**
- `POST /api/qr/upload-photo` - Upload member photo
- `GET /api/qr/generate-qr/:memberId` - Generate QR code
- `GET /api/qr/my-children` - Get apoderado's children list
- `POST /api/qr/scan-qr` - Scan and validate QR (admin only)

#### **Instructors (Admin Only)**
- `GET /api/instructors` - List instructors
- `POST /api/instructors` - Create instructor
- `PUT /api/instructors/:id` - Update instructor
- `DELETE /api/instructors/:id` - Delete instructor

#### **Schools (Admin Only)**
- `GET /api/schools` - List schools
- `POST /api/schools` - Create school
- `PUT /api/schools/:id` - Update school
- `DELETE /api/schools/:id` - Delete school

#### **Annual Fees (Admin Only)**
- `GET /api/fees` - List annual fees
- `POST /api/fees` - Create/update annual fees
- `GET /api/uf/value` - Get current UF value

#### **News**
- `GET /api/news` - List news articles
- `POST /api/news` - Create news article (admin only)
- `DELETE /api/news/:id` - Delete news article (admin only)

#### **Settings (Admin Only)**
- `GET /api/settings` - Get all settings
- `POST /api/settings/club-logo` - Upload club logo
- `POST /api/settings/director-signature` - Upload director signature
- `POST /api/settings/club-director` - Set club director name

#### **Authentication**
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user (admin only)
- `GET /api/auth/me` - Get current user info
- `PUT /api/auth/change-password` - Change password

## Deploy to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New +" → "Blueprint"
4. Connect your GitHub repository
5. Render will detect the `render.yaml` file
6. Click "Apply"

### Environment Variables (set in Render dashboard)

| Variable | Value |
|----------|-------|
| `CLUB_NAME` | Your club name |
| `JWT_SECRET` | Random secret (use generator) |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

## Database

The SQLite database is stored at `judo-club.db` in the project root.

**Note:** For production on Render, consider migrating to PostgreSQL for persistence.

## License

ISC
