# Laboratorio: React + Spring Boot 4 con Docker en AWS EC2

Aplicación de ejemplo con un formulario React que consulta `GET /api/estado` y envía `POST /api/saludos` a Spring Boot. Docker Compose levanta dos contenedores. Nginx entrega el frontend y redirige `/api/` al backend por la red interna de Docker.

```text
Navegador ── HTTP :80 ──> Nginx + React ── /api/* ──> Spring Boot :8080
                            frontend                     backend
```

## 1. Requisitos

- Una cuenta AWS con permisos para crear una instancia EC2 y editar su grupo de seguridad.
- Docker y Docker Compose para probar localmente. En EC2 se instalan en el paso 4.
- Una clave `.pem` de EC2 guardada en el computador del estudiante.
- Para compilar fuera de Docker, Java 21, Maven y Node.js 22.

Este ejemplo usa Spring Boot 4.0.9, Java 21, React y Vite. La API no usa base de datos: el saludo se devuelve directamente.

## 2. Probar en el computador local

Desde la carpeta `demo-ec2`:

```bash
docker compose up --build -d
docker compose ps
curl http://localhost/api/estado
```

Abrir `http://localhost` y enviar un saludo. Debe aparecer `estado: ok` en la respuesta JSON y el saludo en la página. Si el puerto 80 está ocupado, crear `.env` a partir de `.env.example`, cambiar `FRONTEND_PORT=8081` y abrir `http://localhost:8081`.

Para detener:

```bash
docker compose down
```

### Desarrollo sin Docker

En una terminal:

```bash
cd backend
mvn spring-boot:run
```

En otra terminal, desde `frontend`:

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`. Vite lee `frontend/.env.development` y llama a `http://localhost:8080/api`; Spring Boot permite ese origen mediante `CORS_ALLOWED_ORIGINS`. Es una petición entre orígenes distintos y sirve para demostrar CORS.

## 3. Crear EC2

1. En AWS Console, abrir **EC2 → Launch instance**.
2. Elegir **Amazon Linux 2023** y arquitectura **x86_64**. Para construir las dos imágenes en la propia instancia, elegir una instancia con al menos **4 GiB de RAM** (por ejemplo `t3.medium`); comprobar el precio antes de lanzarla.
3. Crear o seleccionar un par de claves y descargar el archivo `.pem`.
4. En el grupo de seguridad, agregar entradas: **SSH/TCP 22** desde **My IP** y **HTTP/TCP 80** desde `0.0.0.0/0`. Si se usa IPv6, agregar HTTP desde `::/0`. No hace falta abrir 8080: el backend solo escucha dentro de la red Docker.
5. Lanzar la instancia y esperar el estado **Running**. Anotar su **Public IPv4 address**. La IP pública puede cambiar al detener e iniciar la instancia; para una dirección estable, asociar una Elastic IP.

> Si el sitio va a permanecer publicado, configurar dominio y HTTPS en un proxy o balanceador. Este laboratorio usa HTTP para simplificar la práctica.

## 4. Instalar Docker y Compose en Amazon Linux 2023

Conectar por SSH desde la terminal del computador local (reemplazar los valores):

```bash
ssh -i /ruta/mi-clave.pem ec2-user@IP_PUBLICA
```

En Windows PowerShell la ruta puede ser `C:\ruta\mi-clave.pem`. En macOS/Linux, si SSH rechaza los permisos de la clave, ejecutar `chmod 400 /ruta/mi-clave.pem`.

En la instancia:

```bash
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

Cerrar la sesión SSH y volver a entrar para que el grupo `docker` tenga efecto. Instalar el plugin Compose para el usuario `ec2-user`:

```bash
mkdir -p ~/.docker/cli-plugins
curl -fSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
docker --version
docker compose version
```

Si el enlace `latest` no está disponible, consultar la [versión y la URL de instalación manual de Compose](https://docs.docker.com/compose/install/linux/) y sustituir `latest` por el número de versión indicado allí. Las instalaciones manuales no se actualizan automáticamente.

## 5. Copiar el proyecto a EC2

Desde la **terminal local**, situarse en la carpeta que contiene `demo-ec2` y ejecutar:

```bash
scp -i /ruta/mi-clave.pem -r demo-ec2 ec2-user@IP_PUBLICA:~/
```

En PowerShell, si la carpeta actual contiene `demo-ec2`, usar `scp -i C:\ruta\mi-clave.pem -r .\demo-ec2 ec2-user@IP_PUBLICA:~/`.

Volver a SSH y entrar en el proyecto:

```bash
cd ~/demo-ec2
cp .env.example .env
docker compose config
```

`docker compose config` permite detectar errores de sintaxis antes de construir.

## 6. Desplegar y verificar

En la instancia:

```bash
docker compose up --build -d
docker compose ps
curl -i http://localhost/api/estado
```

La primera compilación descarga imágenes y dependencias, por lo que puede tardar varios minutos. Abrir `http://IP_PUBLICA` en el navegador. La página debe mostrar **Conectada**; enviar un saludo y comprobar la respuesta.

Para ver errores:

```bash
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
```

Para desplegar cambios, copiar de nuevo los archivos modificados a EC2 y ejecutar `docker compose up --build -d` desde `~/demo-ec2`. Para detener el laboratorio, ejecutar `docker compose down`. Para evitar cargos de EC2, detener o terminar la instancia desde AWS cuando termine la práctica; revisar también los cargos asociados a almacenamiento e IP pública.

## Configuraciones que pueden cambiar

| Archivo / variable | Valor de este ejemplo | Cuándo cambiarlo |
| --- | --- | --- |
| `frontend/.env.production` → `VITE_API_BASE_URL` | `/api` | Mantenerlo si React y API usan el mismo sitio y Nginx redirige `/api`. Si la API está en otro origen, poner su URL completa, por ejemplo `https://api.ejemplo.cl/api`, y reconstruir el frontend. |
| `frontend/.env.development` → `VITE_API_BASE_URL` | `http://localhost:8080/api` | Cambiarlo si el backend local usa otro host o puerto; reiniciar Vite. |
| `.env` → `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Si el navegador llama directamente a la API desde otro origen, escribir el origen exacto del frontend: esquema, host y puerto si corresponde, sin `/` final. Varios orígenes se separan con comas. Reiniciar el backend con `docker compose up -d --force-recreate backend`. |
| `.env` → `FRONTEND_PORT` | `80` | Cambiarlo si el puerto público del host es otro; abrir ese puerto en el grupo de seguridad y usar `http://IP_PUBLICA:PUERTO`. |
| `frontend/nginx.conf` → `proxy_pass` | `http://backend:8080` | Cambiarlo si cambia el nombre del servicio o el puerto interno del backend; reconstruir el frontend. |
| `backend/src/main/resources/application.properties` → `server.port` | `8080` | Cambiarlo solo junto con `proxy_pass` y `EXPOSE` del Dockerfile. |

**Para este despliegue concreto en una sola EC2 no hay que reemplazar `localhost` por la IP pública dentro del frontend.** La compilación de producción usa `/api`, una ruta relativa del mismo origen. Nginx conoce al backend como `backend` por la red de Compose. CORS no interviene en esa llamada del navegador porque frontend y `/api` comparten origen; queda configurado para desarrollo y despliegues con orígenes separados. Si se usa una API en otro origen, esa API debe ser accesible desde el navegador y su servidor debe permitir el origen exacto del frontend. Una página HTTPS no debe llamar una API HTTP por contenido mixto.

### Comprobar CORS

Con los contenedores en marcha y el valor predeterminado de CORS:

```bash
curl -i -H "Origin: http://localhost:5173" http://localhost/api/estado
```

La respuesta debe incluir `Access-Control-Allow-Origin: http://localhost:5173`. Para comprobar la solicitud previa de un `POST` JSON:

```bash
curl -i -X OPTIONS http://localhost/api/saludos -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
```

## Problemas frecuentes

- **La página no abre:** revisar IP pública, regla de entrada HTTP 80, `docker compose ps` y que `FRONTEND_PORT=80`.
- **Error 502:** el backend aún inicia o falló. Revisar `docker compose logs backend` y reintentar.
- **Error CORS en desarrollo:** verificar que `VITE_API_BASE_URL` apunta al backend correcto y que `CORS_ALLOWED_ORIGINS` contiene exactamente `http://localhost:5173`. CORS no reemplaza la apertura de puertos ni corrige un host inaccesible.
- **`permission denied` al usar Docker:** salir de SSH y entrar otra vez tras `usermod`.
- **Compilación interrumpida:** revisar RAM disponible (`free -h`) y el tamaño de la instancia.

## Referencias oficiales

- [Spring Boot 4: requisitos de sistema](https://docs.spring.io/spring-boot/4.0/system-requirements.html) y [starter Web MVC](https://docs.spring.io/spring-boot/4.0/reference/using/build-systems.html).
- [AWS: instalar Docker en Amazon Linux 2023](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-docker.html).
- [Docker: instalar el plugin Compose en Linux](https://docs.docker.com/compose/install/linux/).
- [AWS: reglas de grupos de seguridad para EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html).
