# Laboratorio: frontend React en Windows y backend Spring Boot 4 en EC2

Cada estudiante ejecuta React en su computador con Vite. **Solo el backend se despliega en AWS EC2** mediante Docker Compose. El navegador llama directamente a la IP pública de EC2, por lo que el backend permite el origen local del frontend mediante CORS.

```text
PC Windows                                      AWS EC2 (Amazon Linux 2023)
React + Vite en http://localhost:5173  ────>  Spring Boot 4 en http://IP_PUBLICA:8080/api
             navegador                                  contenedor Docker
```

Los bloques `powershell` se ejecutan en **Windows PowerShell** del estudiante. Los bloques `bash` se ejecutan **dentro de la instancia EC2 por SSH**. No hay que ejecutar `dnf`, `sudo` ni `chmod` en Windows.

## 1. Requisitos

- Cuenta AWS, clave `.pem` y permisos para crear una EC2 y editar su grupo de seguridad.
- En Windows: Node.js 22 con npm, Git y el cliente OpenSSH (`ssh` y `scp`). Windows 10/11 modernos incluyen el cliente OpenSSH; comprobar con `ssh -V`.
- Docker se instala **en EC2**. Docker Desktop en Windows solo hace falta para la prueba local opcional.
- **No hace falta instalar Maven.** El proyecto incluye Maven Wrapper (`backend/mvnw.cmd`), que descarga Maven 3.9.16 la primera vez. Para ejecutar el backend directamente en Windows sí hace falta Java 21. Para construirlo con Docker en EC2, Java y Maven vienen dentro de la imagen de compilación.

Este ejemplo usa Spring Boot 4.0.9, Java 21, React y Vite. La API responde a `GET /api/estado` y `POST /api/saludos`; no utiliza base de datos.

## 2. Crear la instancia EC2

1. En AWS Console, abrir **EC2 → Launch instance**.
2. Elegir **Amazon Linux 2023** y arquitectura **x86_64**. Para compilar la imagen Java en la instancia, elegir al menos **4 GiB de RAM** (por ejemplo `t3.medium`) y revisar su precio.
3. Crear o seleccionar un par de claves y guardar el archivo `.pem` en Windows.
4. En el grupo de seguridad, agregar estas reglas de entrada:

   | Tipo | Puerto | Origen |
   | --- | --- | --- |
   | SSH | TCP 22 | **My IP** |
   | Custom TCP | 8080 | **My IP** del computador que abrirá el frontend |

   Si varios computadores deben llamar a una sola API, agregar las IP públicas de esos computadores o el rango de la red del curso. Evitar `0.0.0.0/0` si no se necesita acceso desde todo Internet.
5. Lanzar la instancia, esperar el estado **Running** y anotar su **Public IPv4 address**. La IP puede cambiar al detener e iniciar la instancia; si cambia, actualizar la URL del frontend.

## 3. Conectar desde Windows e instalar Docker en EC2

En **PowerShell de Windows**, reemplazar la ruta y la IP:

```powershell
ssh -i "C:\ruta\mi-clave.pem" ec2-user@IP_PUBLICA
```

Desde este punto, la terminal SSH ejecuta comandos **Bash en Amazon Linux 2023**:

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

Cerrar SSH con `exit` y conectarse de nuevo con el mismo comando de PowerShell para activar el grupo `docker`. En la **terminal SSH de EC2**, instalar el plugin Compose:

```bash
mkdir -p ~/.docker/cli-plugins
curl -fSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
docker --version
docker compose version
```

Instalar también **Docker Buildx** en EC2 antes de usar `docker compose up --build -d`. El nombre del binario publicado por Docker depende de la arquitectura de la instancia:

```bash
case "$(uname -m)" in
  x86_64) buildx_arch=amd64 ;;
  aarch64) buildx_arch=arm64 ;;
  *) echo "Arquitectura no compatible: $(uname -m)"; exit 1 ;;
esac

curl -fL "https://github.com/docker/buildx/releases/download/v0.38.2/buildx-v0.38.2.linux-${buildx_arch}" -o /tmp/docker-buildx
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo install -m 755 /tmp/docker-buildx /usr/local/lib/docker/cli-plugins/docker-buildx
sudo docker buildx version
docker buildx version
```

Aquí `curl` es el comando **Linux de EC2**, no el alias de PowerShell. Las instalaciones manuales de Compose y Buildx no se actualizan automáticamente. Consultar la [guía oficial de Docker Compose](https://docs.docker.com/compose/install/linux/) si el enlace `latest` cambia; el binario de Buildx usado aquí corresponde a la [versión oficial v0.38.2](https://github.com/docker/buildx/releases/tag/v0.38.2).

## 4. Obtener el código y desplegar solo el backend

En la **terminal SSH de EC2**:

```bash
cd ~
git clone https://github.com/JavPenaR/react-springboot4-docker-ec2.git
cd react-springboot4-docker-ec2
cp .env.example .env
docker compose config
docker compose up --build -d
docker compose ps
curl -i http://localhost:8080/api/estado
```

El repositorio contiene código del frontend, pero `compose.yaml` **solo construye y ejecuta el servicio `backend`**. El frontend no se sirve desde EC2. La primera compilación puede tardar varios minutos.

La carpeta del proyecto no tiene que llamarse como el repositorio. Si se clona con `git clone https://github.com/JavPenaR/react-springboot4-docker-ec2.git mi-carpeta`, usar `cd mi-carpeta` en lugar del nombre anterior. Para los comandos posteriores, estar siempre en la carpeta que contiene `compose.yaml`.

Para inspeccionar fallos en EC2:

```bash
docker compose logs --tail=100 backend
```

## 5. Ejecutar el frontend en Windows

En una **nueva terminal PowerShell local**, clonar el repositorio si todavía no está en el PC:

```powershell
git clone https://github.com/JavPenaR/react-springboot4-docker-ec2.git
Set-Location .\react-springboot4-docker-ec2
```

Si ya está descargado o se clonó con otro nombre, abrir su carpeta raíz (la que contiene `compose.yaml`). Desde esa carpeta:

```powershell
Set-Location .\frontend
Copy-Item .env.development.local.example .env.development.local
notepad .env.development.local
```

En el Bloc de notas, reemplazar `IP_PUBLICA` por la IPv4 de EC2 y guardar. El archivo debe quedar así, con la IP real:

```dotenv
VITE_API_BASE_URL=http://IP_PUBLICA:8080/api
```

Continuar en la misma terminal PowerShell:

```powershell
npm ci
npm run dev
```

Abrir `http://localhost:5173`. Vite usa siempre ese puerto en este proyecto; si está ocupado, se detiene para evitar una discrepancia con CORS. La página debe indicar **Conectada** y permitir enviar un saludo.

El archivo `.env.development.local` es local para cada estudiante y está excluido de Git. **Reiniciar Vite** después de cambiarlo. Si cambia la IP pública de EC2, actualizar ese archivo.

## 6. Verificar desde Windows PowerShell

Para consultar la API sin depender del frontend, reemplazar `IP_PUBLICA`:

```powershell
Invoke-RestMethod -Uri "http://IP_PUBLICA:8080/api/estado"
Invoke-RestMethod -Method Post -Uri "http://IP_PUBLICA:8080/api/saludos" -ContentType "application/json" -Body (@{ nombre = "Ana" } | ConvertTo-Json)
```

Para comprobar los encabezados CORS, usar **`curl.exe`** en PowerShell:

```powershell
curl.exe -i -H "Origin: http://localhost:5173" "http://IP_PUBLICA:8080/api/estado"
curl.exe -i -X OPTIONS "http://IP_PUBLICA:8080/api/saludos" -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
```

La respuesta debe incluir `Access-Control-Allow-Origin: http://localhost:5173`. **Sí, `curl.exe` funciona en Windows.** En Windows PowerShell 5.1, escribir solo `curl` invoca un alias de `Invoke-WebRequest`, que no acepta exactamente las mismas opciones; por eso los ejemplos usan `curl.exe`.

## 7. Qué configuraciones cambiar

| Archivo / variable | Valor inicial | Cuándo cambiarlo |
| --- | --- | --- |
| `frontend/.env.development.local` → `VITE_API_BASE_URL` | `http://IP_PUBLICA:8080/api` | Poner la IPv4 pública real de EC2. Cambiarla si la IP o el puerto de la API cambian. Reiniciar Vite. |
| `.env` en EC2 → `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Mantenerlo mientras React se abra en `localhost:5173`. Si se abre desde otro origen, escribirlo completo, sin `/` final; varios orígenes separados por comas. Ejecutar `docker compose up -d --force-recreate backend`. |
| `.env` en EC2 → `BACKEND_PORT` | `8080` | Cambiarlo si el host publica otro puerto; abrir ese puerto en el grupo de seguridad y ponerlo también en `VITE_API_BASE_URL`. |
| `backend/src/main/resources/application.properties` → `server.port` | `8080` | Cambiarlo solo junto con el puerto interno de `compose.yaml` y `EXPOSE` del Dockerfile. |

`frontend/.env.development` apunta a `http://localhost:8080/api` para la prueba opcional con un backend local. `frontend/.env.development.local` tiene prioridad y apunta a EC2. No usar `localhost` como host de la API cuando el backend está en EC2: en el navegador de cada estudiante, `localhost` es su propio PC.

## 8. Prueba local opcional en Windows

Si se quiere probar antes de usar AWS, con Docker Desktop iniciado, desde la raíz del proyecto en PowerShell:

```powershell
docker compose up --build -d
Invoke-RestMethod -Uri "http://localhost:8080/api/estado"
```

Para que el frontend llame a este backend local, quitar temporalmente `frontend/.env.development.local` o cambiar allí la URL a `http://localhost:8080/api`, y reiniciar Vite. Para apagar el backend:

```powershell
docker compose down
```

También se puede ejecutar el backend **sin Docker y sin Maven instalado**, siempre que Java 21 esté instalado. Desde la raíz del proyecto en PowerShell:

```powershell
Set-Location .\backend
.\mvnw.cmd spring-boot:run
```

Maven Wrapper descargará Maven en el primer uso. La instalación de Java se puede comprobar con `java -version`. En EC2 no hace falta ejecutar `mvnw`, porque el Dockerfile compila el backend dentro de una imagen que ya contiene Maven y Java.

## 9. Actualizar y detener

En la terminal SSH de EC2, dentro de la carpeta del proyecto:

```bash
git pull
docker compose up --build -d
```

Para detener la API:

```bash
docker compose down
```

Detener o terminar la instancia desde AWS al acabar la práctica para evitar cargos. Revisar también los posibles cargos de almacenamiento e IP pública.

## Problemas frecuentes

- **La API no responde desde Windows:** comprobar la IPv4 pública, `docker compose ps`, los registros del backend y la regla de entrada TCP 8080 desde la IP pública del PC. `localhost:8080` en Windows no apunta a EC2.
- **Error CORS en el navegador:** comprobar que Vite abre exactamente `http://localhost:5173` y que `CORS_ALLOWED_ORIGINS` coincide. CORS no corrige una IP o un puerto inaccesibles.
- **`permission denied` al usar Docker en EC2:** salir de SSH y volver a entrar después de `usermod`.
- **`mvnw.cmd` no descarga Maven:** revisar la conexión a Internet del PC y que Java 21 esté instalado. Para la ruta principal de la práctica no se necesita Maven en Windows.
- **Compilación interrumpida en EC2:** revisar la RAM (`free -h`) y el tamaño de la instancia.

## Referencias oficiales

- [Apache Maven Wrapper](https://maven.apache.org/tools/wrapper/index.html) y [Spring Boot 4: requisitos de sistema](https://docs.spring.io/spring-boot/4.0/system-requirements.html).
- [Microsoft: curl en Windows](https://learn.microsoft.com/windows/curl/) y [Windows Terminal con SSH](https://learn.microsoft.com/windows/terminal/tutorials/ssh).
- [AWS: instalar Docker en Amazon Linux 2023](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-docker.html).
- [Docker: instalar el plugin Compose en Linux](https://docs.docker.com/compose/install/linux/).
- [Docker Buildx: versión v0.38.2](https://github.com/docker/buildx/releases/tag/v0.38.2).
- [AWS: reglas de grupos de seguridad para EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html).
