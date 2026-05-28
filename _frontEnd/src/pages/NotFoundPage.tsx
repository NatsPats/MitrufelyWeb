export default function NotFoundPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="text-lg text-muted-foreground">Página no encontrada</p>
      <a href="/dashboard" className="text-sm text-primary underline underline-offset-4">
        Volver al dashboard
      </a>
    </div>
  )
}
