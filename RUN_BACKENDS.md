# Guía de Ejecución de Backends con Docker (MitrufelyWeb)

Para que el ecosistema completo del sistema de pedidos funcione de la forma más fácil y sin configurar entornos virtuales manualmente, he unificado todo en un único orquestador de **Docker Compose** en la raíz del proyecto.

---

## 1. Levantar Todo el Backend (API + Delivery + Redis + Celery)

Abre una terminal en esta misma carpeta raíz (`MitrufelyWeb`) y ejecuta:

```powershell
docker-compose up -d --build
```

Este único comando se encargará de levantar 5 contenedores interconectados en la misma red:
1. **api**: El backend principal de FastAPI en el puerto **`8000`** (`http://localhost:8000/docs`).
2. **delivery-service**: El microservicio logístico asíncrono en el puerto **`8001`**.
3. **redis**: El almacén de caché y broker de mensajes en el puerto **`6399`**.
4. **celery_worker**: El worker para tareas en segundo plano.
5. **celery_beat**: El programador de tareas periódicas.

Para ver los logs en tiempo real de todos los servicios y monitorear cómo el `delivery-service` se comunica con la `api`:
```powershell
docker-compose logs -f
```

---

## 2. Levantar el Frontend (React)

El frontend de React se sigue ejecutando por fuera (en NodeJS) para mantener la agilidad del hot-reload de Vite. Abre una segunda terminal y ejecuta:

```powershell
cd _frontEnd
npm run dev
```

* La aplicación web estará en: **http://localhost:5173**

---

### ¿Cómo apagar todo?
Cuando termines de trabajar, en la terminal de la raíz simplemente ejecuta:
```powershell
docker-compose down
```
