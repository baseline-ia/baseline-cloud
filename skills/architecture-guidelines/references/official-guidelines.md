# Lineamientos Oficiales de Arquitectura de Software

Este documento define las reglas de diseño, estándares de desarrollo y restricciones técnicas obligatorias para todos los proyectos del equipo.

---

## 1. Arquitectura de Backend y Cómputo (AWS Serverless)

Adoptamos una arquitectura orientada a microservicios utilizando el modelo de cómputo Serverless de AWS con Node.js en JavaScript (JS) y TypeScript (TS).

### 1.1 Criterio de Selección de Tecnología

**NestJS** — APIs y Microservicios Principales:
- Flujos de negocio complejos, operaciones CRUD complejas
- APIs expuestas directamente al cliente o API Gateway
- Aprovecha inyección de dependencias, interceptores, guardias y ciclo de vida estructurado

**Lambdas Puras** — Tareas basadas en Eventos y Cron Jobs:
- Tareas ligeras, asíncronas y de bajo acoplamiento
- Procesadores de colas SQS, eventos de S3, tareas programadas vía Amazon EventBridge
- Deben mantenerse optimizadas y con dependencias mínimas para mitigar cold starts

### 1.2 Estructura por Capas Técnicas

```
src/
├── controllers/      # Entrada: Enrutamiento, parseo de HTTP y validación de payloads (DTOs)
├── services/         # Aplicación: Orquestación de lógica de negocio y casos de uso
├── domain/           # Core: Entidades del dominio, reglas puras del negocio y modelos de datos
├── infrastructure/   # Salida: Adaptadores de persistencia (TypeORM), clientes HTTP y servicios AWS (S3, SQS)
└── utils/            # Helpers de uso general y funciones utilitarias
```

---

## 2. Gestión de Base de Datos y Multi-Tenancy

La persistencia de datos se maneja a través de TypeORM con Discriminator Columns (inquilinos compartiendo la misma base de datos y esquema, filtrados por una columna `tenant_id`).

**Aislamiento Obligatorio:** Toda consulta ejecutada en la base de datos debe filtrar explícitamente los resultados por el `tenant_id` del contexto actual.

**Automatización de Seguridad:** Se debe implementar un mecanismo automatizado (Subscriber de TypeORM, Scopes globales o Middleware) para inyectar automáticamente el filtro del inquilino a nivel de consulta y evitar fugas accidentales de datos.

**Prohibición de SQL Crudo:** Queda estrictamente prohibido el uso de `queryRunner.query()` o consultas crudas de SQL nativo sin previa autorización de arquitectura, ya que suelen evadir los mecanismos de filtrado automático del ORM.

---

## 3. Frontend: Gestión de Estado y Consumo de APIs

En el desarrollo Frontend (React / React Native), separamos de forma estricta el estado local de la interfaz gráfica y el estado proveniente del servidor.

**React Query** — Estado del Servidor:
- Único encargado de realizar peticiones HTTP, manejar mutaciones (POST, PUT, DELETE), gestionar la caché, reintentos y sincronización con el backend
- Ningún componente funcional de React debe realizar llamadas directas mediante `fetch` o `axios` en el ciclo de vida (ej. dentro de un `useEffect`)

**Zustand** — Estado Local / UI:
- Uso exclusivo para estado global de la interfaz que no requiera sincronización directa con la base de datos
- Ejemplos permitidos: estado de modales, sesión actual del usuario, preferencias visuales (tema oscuro), pasos intermedios de un formulario complejo

---

## 4. Calidad de Código: Principios SOLID

**Single Responsibility Principle (SRP):**
- Cada clase, función o módulo debe tener una, y solo una, razón para cambiar
- Los controladores no deben acceder a bases de datos ni ejecutar lógica de negocio
- Los servicios no deben conocer detalles sobre los protocolos de transporte HTTP

**Dependency Inversion Principle (DIP):**
- Los módulos de alto nivel no deben depender de módulos de bajo nivel; ambos deben depender de abstracciones
- En NestJS, la inyección de dependencias es mandatoria para facilitar las pruebas unitarias y desacoplar los adaptadores de infraestructura

---

## 5. Reglas Críticas de Operación y Seguridad

> ⚠️ El incumplimiento de cualquiera de los siguientes puntos bloqueará de forma inmediata el despliegue automático en el Pipeline de CI/CD.

**Cero Hardcode de Variables de Entorno:**
- Prohibido incluir credenciales, llaves API, URLs o configuraciones de entorno de forma estática en el código fuente
- Todo valor variable debe cargarse vía `process.env` o, para datos sensibles en producción, mediante AWS Parameter Store o Secrets Manager

**Manejo Robusto de Errores:**
- No se permiten bloques `catch` vacíos o mudos
- Cada excepción debe ser interceptada, catalogada y parseada adecuadamente
- En NestJS, definir filtros globales de excepción para formatear mensajes de error de forma estandarizada y segura

**Prohibición de Logs en Producción:**
- Prohibido el uso de `console.log()` en código productivo
- Usar un logger estructurado (Winston o el logger integrado de NestJS)
- Nunca loguear PII, contraseñas, tokens de autenticación o payloads completos con datos privados
