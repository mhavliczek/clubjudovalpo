# Judo Club Management System

A backend API for managing a judo club, built with Express and SQLite.

## Features

- **Authentication**: Login system with JWT tokens
- **Roles**: Admin and Member roles
- **Members**: Register and manage club members with 4 membership types
- **Belt Grades**: Track member progression through belt ranks
- **Attendance**: Record and track class attendance
- **Payments**: Manage membership fees and payments
- **Member Portal**: Each member can view their own info
- **Curriculum**: Track tournaments and generate sports CV
- **Certificates**: Generate PDF certificates with club logo
- **Guardians**: Manage guardians for minor members

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
- `GET /api/stats` - Dashboard statistics
- `GET /api/members` - List all members (admin only)
- `GET /api/members/:id` - Get member by ID
- `POST /api/members` - Create new member (admin only)
- `PUT /api/members/:id` - Update member (admin only)
- `DELETE /api/members/:id` - Delete member (admin only)
- `GET /api/grades` - Get all grades (admin only)
- `GET /api/grades/member/:memberId` - Get grades for a member
- `POST /api/grades` - Record new grade (admin only)
- `DELETE /api/grades/:id` - Delete grade (admin only)
- `GET /api/attendance` - List attendance records
- `POST /api/attendance` - Record attendance (admin only)
- `DELETE /api/attendance/:id` - Delete attendance (admin only)
- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment (admin only)
- `DELETE /api/payments/:id` - Delete payment (admin only)

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
