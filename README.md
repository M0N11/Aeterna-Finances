# Aeterna Finances

Sitio web estático para simular un presupuesto mensual, visualizar la distribución del dinero y guardar escenarios localmente en el navegador. No requiere base de datos ni backend.

## Tecnologías

- Node.js 26.13.0 LTS (recomendado; mínimo compatible con Vite 8: Node.js 20.19+ o 22.12+)
- Vite 8.3.5
- Tailwind CSS 3.4.17
- Chart.js 4.6.1
- JavaScript (ES Modules)
- Font Awesome 6.5.2 y Google Fonts (Inter) mediante CDN

## Requisitos

Instala Node.js 26.13.0 LTS (recomendado) o una versión compatible desde Node.js 22.12. Comprueba la instalación: 

```bash
node -v
npm -v
```

## Instalación y ejecución

En la carpeta del proyecto ejecuta:

```bash
npm install
npm run dev
```

Vite mostrará una URL local, normalmente `http://localhost:5173/`. Abre esa dirección en el navegador.

## Compilar para producción

```bash
npm run build
npm run preview
```

La versión lista para publicar se genera en `dist/`. No subas `node_modules/` ni necesitas subir `dist/` al repositorio cuando despliegues mediante un servicio que ejecute el build.

## Estructura del proyecto

```text
aeterna-finances/
├── index.html
├── src/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── main.js
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── .nvmrc
└── README.md
```

## Publicar en GitHub

1. Crea un repositorio vacío en GitHub.
2. Desde la carpeta del proyecto ejecuta:

```bash
git init
git add .
git commit -m "Initial commit: Aeterna Finances"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

3. Para publicarlo como sitio, conecta el repositorio a Netlify o Vercel y configura:
   - Build command: `npm run build`
   - Publish directory: `dist`

También puedes usar GitHub Pages configurando un workflow de despliegue que ejecute `npm ci` y `npm run build`, y publique la carpeta `dist/`. Vite está configurado con rutas relativas (`base: './'`) para facilitar el despliegue en subrutas.

## Privacidad y almacenamiento

Los escenarios se guardan en `localStorage` del navegador. Por ello, solo están disponibles en el mismo navegador y dispositivo; borrar los datos del sitio puede eliminarlos. El proyecto no envía datos financieros a un servidor. Chart.js se instala como dependencia local; Google Fonts y Font Awesome se cargan desde sus CDN.
