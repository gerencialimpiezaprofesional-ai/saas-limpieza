# Guía de Despliegue a Producción - Impeccable AI

Esta guía detalla los pasos necesarios para que su aplicación Impeccable AI funcione con sus propias claves de API y bases de datos en un entorno productivo.

## 1. Configuración de API Keys (En AI Studio Settings)

Para que la aplicación sea 100% funcional fuera del entorno de pruebas, debe ingresar las siguientes variables en el menú **Settings** de AI Studio:

### Inteligencia Artificial
* `GEMINI_API_KEY`: Su clave de Google AI Studio (para reportes de IA y auditorías).

### Google Maps
* `VITE_GOOGLE_MAPS_API_KEY`: Necesaria para el Portal del Cliente y monitoreo GPS. Obténgala en [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/).

### Firebase (Si usa su propio proyecto)
Si desea usar un proyecto de Firebase independiente (fuera de AI Studio):
* `VITE_FIREBASE_API_KEY`
* `VITE_FIREBASE_AUTH_DOMAIN`
* `VITE_FIREBASE_PROJECT_ID`
* `VITE_FIREBASE_STORAGE_BUCKET`
* `VITE_FIREBASE_MESSAGING_SENDER_ID`
* `VITE_FIREBASE_APP_ID`
* `VITE_FIREBASE_DATABASE_ID` (Si usa una base de datos con nombre personalizado)

### Pasarela de Pagos (Opcional)
* `VITE_STRIPE_PUBLISHABLE_KEY`: Clave pública de Stripe.
* `STRIPE_SECRET_KEY`: Clave secreta (Mantenida segura en el servidor/entorno).

## 2. Seguridad de Base de Datos

Las reglas de seguridad de Firestore ya han sido configuradas y endurecidas (`firestore.rules`). Asegúrese de que estén desplegadas si cambia de proyecto:
1. **Acceso por Inquilino (Tenant)**: Los usuarios solo pueden ver datos de su propia organización.
2. **Validación de IA**: Los campos de calificación de IA están protegidos para evitar manipulación manual sin permisos de supervisor.
3. **Mínimo Privilegio**: Cada rol (Operador, Supervisor, RH, CEO) tiene acceso restringido estrictamente a lo que necesita.

## 3. Cuentas Críticas de Sistema

La aplicación tiene mecanismos de "Autorrecuperación" para la cuenta principal:
* **Admin Principal**: `gerencia.limpiezaprofesional@gmail.com`
  * Esta cuenta siempre tendrá permisos de `superadmin` si se loguea vía Google.

## 4. Próximos Pasos Recomendados
1. **Verificación de Email**: En el panel de Firebase, active la verificación de email para nuevos usuarios.
2. **Dominio Personalizado**: Puede configurar un dominio propio desde las opciones de despliegue de AI Studio.
3. **Backup de Datos**: Configure las copias de seguridad automáticas en Firestore desde el portal de Firebase.
