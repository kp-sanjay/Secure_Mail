# QDK Mail Desktop (Electron)

This wraps the existing Vite/React frontend in an Electron shell and adds secure key storage via the OS keychain (Keytar).

## Dev

1. In one terminal:

```bash
cd frontend
npm run dev
```

2. In another terminal:

```bash
cd desktop
npm install
npm run dev
```

## Production

1. Build the frontend:

```bash
cd frontend
npm run build
```

2. Package Electron:

```bash
cd desktop
npm install
npm run dist
```

